import sql from 'mssql';
import { findActiveAdmin } from './app-sql.js';
import {
  parseCommand,
  selfProtectionViolation,
  type AdminLogEntry,
  type ClerkCode,
  type ClerkCommand,
  type ClerkReason,
  type ClerkResult,
} from './clerk-actions.js';

// The browser inserts an AdminRequest (its insert policy proves requesterEmail); this code runs only
// what that row says, once, within 2 minutes, and only for an active admin.

export const REQUEST_TTL_SECONDS = 120;
// Small allowance for clock differences between the browser that set createdAt and the database.
export const CLOCK_SKEW_SECONDS = 30;

interface StoredRequest {
  requesterEmail: string;
  action: string;
  payload: string;
  ageSeconds: number;
}

interface Outcome {
  code: ClerkCode;
  reason: ClerkReason;
  detail: string;
  log?: AdminLogEntry[];
}

const UNIQUE_VIOLATION = new Set([2601, 2627]);

const done = (detail: string): Outcome => ({ code: 200, reason: 'ok', detail });
const notFound = (detail: string): Outcome => ({ code: 404, reason: 'not_found', detail });

export interface AdminRequestOptions {
  /** Log rows processed before this moment count as automated checks (LEGACY_CHECK_CUTOFF_UTC). */
  legacyCheckCutoff?: Date;
}

async function runCommand(transaction: sql.Transaction, command: ClerkCommand, options: AdminRequestOptions): Promise<Outcome> {
  const request = () => new sql.Request(transaction);
  switch (command.action) {
    case 'swearInJuror': {
      const existing = await request()
        .input('email', sql.NVarChar(254), command.email)
        .query<{ id: string }>(`SELECT TOP (1) id FROM dbo.[Jurors] WITH (UPDLOCK, HOLDLOCK) WHERE LOWER(LTRIM(RTRIM(email))) = @email`);
      if (existing.recordset.length > 0) {
        return { code: 422, reason: 'already_exists', detail: 'This email is already on the jury.' };
      }
      await request()
        .input('email', sql.NVarChar(254), command.email)
        .input('displayName', sql.NVarChar(100), command.displayName ?? null)
        .input('team', sql.NVarChar(100), command.team ?? null)
        .input('role', sql.NVarChar(20), command.role)
        .query(
          `INSERT INTO dbo.[Jurors] (id, email, displayName, role, team, active)
           VALUES (NEWID(), @email, @displayName, @role, @team, 1)`,
        );
      return done('Juror sworn in.');
    }
    case 'setJurorRole': {
      const updated = await request()
        .input('id', sql.UniqueIdentifier, command.jurorId)
        .input('role', sql.NVarChar(20), command.role)
        .query(`UPDATE dbo.[Jurors] SET role = @role WHERE id = @id`);
      return updated.rowsAffected[0] ? done('Role changed.') : notFound('Unknown juror.');
    }
    case 'setJurorActive': {
      const updated = await request()
        .input('id', sql.UniqueIdentifier, command.jurorId)
        .input('active', sql.Bit, command.active)
        .query(`UPDATE dbo.[Jurors] SET active = @active WHERE id = @id`);
      return updated.rowsAffected[0] ? done(command.active ? 'Juror reinstated.' : 'Juror deactivated.') : notFound('Unknown juror.');
    }
    case 'editJurorDetails': {
      const updated = await request()
        .input('id', sql.UniqueIdentifier, command.jurorId)
        .input('displayName', sql.NVarChar(100), command.displayName ?? null)
        .input('team', sql.NVarChar(100), command.team ?? null)
        .query(`UPDATE dbo.[Jurors] SET displayName = @displayName, team = @team WHERE id = @id`);
      return updated.rowsAffected[0] ? done('Details updated.') : notFound('Unknown juror.');
    }
    case 'registerAgent': {
      const existing = await request()
        .input('workspaceId', sql.NVarChar(36), command.workspaceId)
        .input('itemId', sql.NVarChar(36), command.itemId)
        .query<{ id: string }>(
          `SELECT TOP (1) id FROM dbo.[Agents] WITH (UPDLOCK, HOLDLOCK)
           WHERE LOWER(workspaceId) = @workspaceId AND LOWER(itemId) = @itemId`,
        );
      if (existing.recordset.length > 0) {
        return { code: 422, reason: 'already_exists', detail: 'This agent is already registered.' };
      }
      await request()
        .input('name', sql.NVarChar(200), command.name)
        .input('workspaceId', sql.NVarChar(36), command.workspaceId)
        .input('itemId', sql.NVarChar(36), command.itemId)
        .query(
          `INSERT INTO dbo.[Agents] (id, name, workspaceId, itemId, active)
           VALUES (NEWID(), @name, @workspaceId, @itemId, 1)`,
        );
      return done('Agent registered.');
    }
    case 'setAgentActive': {
      const updated = await request()
        .input('id', sql.UniqueIdentifier, command.agentId)
        .input('active', sql.Bit, command.active)
        .query(`UPDATE dbo.[Agents] SET active = @active WHERE id = @id`);
      return updated.rowsAffected[0] ? done(command.active ? 'Agent reinstated.' : 'Agent retired.') : notFound('Unknown agent.');
    }
    case 'readAdminLog': {
      // Successful log reads are recorded but not listed, so opening the log doesn't flood it.
      // automatedCheck: marked by the check scripts (or older than the optional cutoff) and sent by an active admin,
      // so nobody else can hide their own attempts by adding the marker.
      const rows = await request()
        .input('limit', sql.Int, command.limit)
        .input('cutoff', sql.DateTime2, options.legacyCheckCutoff ?? null)
        .query<Omit<AdminLogEntry, 'processedAt'> & { processedAt: Date }>(
          `SELECT TOP (@limit)
             LOWER(CONVERT(NVARCHAR(36), r.requestId)) AS requestId,
             COALESCE(q.action, N'') AS action,
             COALESCE(q.payload, N'{}') AS payload,
             r.requesterEmail, r.outcome, COALESCE(r.reason, N'') AS reason, r.detail, r.processedAt,
             CAST(CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.[Jurors] AS j
                    WHERE LOWER(LTRIM(RTRIM(j.email))) = LOWER(LTRIM(RTRIM(r.requesterEmail))) AND j.role = N'admin' AND j.active = 1)
                  AND (JSON_VALUE(CASE WHEN ISJSON(q.payload) = 1 THEN q.payload END, '$.source') = N'check'
                       OR (@cutoff IS NOT NULL AND r.processedAt < @cutoff))
                  THEN 1 ELSE 0 END AS BIT) AS automatedCheck
           FROM dbo.[AdminRequestResults] AS r
           LEFT JOIN dbo.[AdminRequests] AS q ON q.id = r.requestId
           WHERE NOT (q.action = N'readAdminLog' AND r.outcome = N'done')
           ORDER BY r.processedAt DESC`,
        );
      const log = rows.recordset.map((row) => ({
        ...row,
        automatedCheck: Boolean(row.automatedCheck),
        processedAt: new Date(row.processedAt).toISOString(),
      }));
      return { ...done(`${log.length} entries.`), log };
    }
  }
}

export async function executeAdminRequest(
  pool: sql.ConnectionPool,
  requestId: string,
  options: AdminRequestOptions = {},
): Promise<ClerkResult> {
  const lookup = await pool
    .request()
    .input('id', sql.UniqueIdentifier, requestId)
    .query<StoredRequest>(
      `SELECT requesterEmail, action, payload, DATEDIFF(SECOND, createdAt, SYSUTCDATETIME()) AS ageSeconds
       FROM dbo.[AdminRequests] WHERE id = @id`,
    );
  const stored = lookup.recordset[0];
  if (!stored) {
    return { code: 404, outcome: 'rejected', reason: 'unknown_request', detail: 'Unknown request.' };
  }

  let outcome: Outcome | undefined;
  let command: ClerkCommand | undefined;
  if (stored.ageSeconds > REQUEST_TTL_SECONDS || stored.ageSeconds < -CLOCK_SKEW_SECONDS) {
    outcome = { code: 403, reason: 'expired', detail: 'The request has expired or has an invalid date.' };
  } else {
    const adminId = await findActiveAdmin(pool, stored.requesterEmail);
    const parsed = parseCommand(stored.action, stored.payload);
    if (!adminId) {
      outcome = { code: 403, reason: 'not_admin', detail: 'The requester is not an active admin.' };
    } else if (!parsed.ok) {
      outcome = { code: parsed.reason === 'unknown_action' ? 403 : 400, reason: parsed.reason, detail: parsed.detail };
    } else {
      const violation = selfProtectionViolation(parsed.command, adminId);
      if (violation) {
        outcome = { code: 422, reason: 'self_protection', detail: violation };
      } else {
        command = parsed.command;
      }
    }
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    if (command) {
      outcome = await runCommand(transaction, command, options);
    }
    const final = outcome as Outcome;
    // The unique requestId makes the request single-use, whatever the outcome.
    await new sql.Request(transaction)
      .input('requestId', sql.UniqueIdentifier, requestId)
      .input('email', sql.NVarChar(254), stored.requesterEmail)
      .input('outcome', sql.NVarChar(20), final.code === 200 ? 'done' : 'rejected')
      .input('reason', sql.NVarChar(40), final.reason)
      .input('detail', sql.NVarChar(500), final.detail.slice(0, 500))
      .query(
        `INSERT INTO dbo.[AdminRequestResults] (id, requestId, requesterEmail, outcome, reason, detail, processedAt)
         VALUES (NEWID(), @requestId, @email, @outcome, @reason, @detail, SYSUTCDATETIME())`,
      );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    const number = (error as { number?: number }).number;
    if (number !== undefined && UNIQUE_VIOLATION.has(number)) {
      return { code: 409, outcome: 'rejected', reason: 'already_processed', detail: 'The request was already processed.' };
    }
    throw error;
  }

  const final = outcome as Outcome;
  return { ...final, outcome: final.code === 200 ? 'done' : 'rejected' };
}
