import sql from 'mssql';
import { isActiveAdmin } from './app-sql.js';

// Fallback admin flow: the browser inserts an AdminRequest (its insert policy proves requesterEmail),
// then this code runs only what that row says, once, within 2 minutes, and only for an active admin.

export const REQUEST_TTL_SECONDS = 120;
// Small allowance for clock differences between the browser that set createdAt and the database.
export const CLOCK_SKEW_SECONDS = 30;

export interface AdminExecuteResult {
  status: 200 | 403 | 404 | 409;
  outcome: 'done' | 'rejected';
  detail: string;
}

type ActionHandler = (transaction: sql.Transaction, payload: unknown) => Promise<string>;

// I1b adds the juror and agent actions here.
const ACTIONS: Record<string, ActionHandler> = {
  probe: async () => 'Probe accepted; nothing written.',
};

interface StoredRequest {
  requesterEmail: string;
  action: string;
  payload: string;
  ageSeconds: number;
}

const UNIQUE_VIOLATION = new Set([2601, 2627]);

export async function executeAdminRequest(pool: sql.ConnectionPool, requestId: string): Promise<AdminExecuteResult> {
  const lookup = await pool
    .request()
    .input('id', sql.UniqueIdentifier, requestId)
    .query<StoredRequest>(
      `SELECT requesterEmail, action, payload, DATEDIFF(SECOND, createdAt, SYSUTCDATETIME()) AS ageSeconds
       FROM dbo.[AdminRequests] WHERE id = @id`,
    );
  const request = lookup.recordset[0];
  if (!request) {
    return { status: 404, outcome: 'rejected', detail: 'Unknown request.' };
  }

  let status: AdminExecuteResult['status'] = 200;
  let detail = '';
  let payload: unknown;
  if (request.ageSeconds > REQUEST_TTL_SECONDS || request.ageSeconds < -CLOCK_SKEW_SECONDS) {
    status = 403;
    detail = 'The request has expired or has an invalid date.';
  } else if (!(await isActiveAdmin(pool, request.requesterEmail))) {
    status = 403;
    detail = 'The requester is not an active admin.';
  } else if (!Object.hasOwn(ACTIONS, request.action)) {
    status = 403;
    detail = 'Unknown action.';
  } else {
    try {
      payload = JSON.parse(request.payload);
    } catch {
      status = 403;
      detail = 'The payload is not valid JSON.';
    }
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    if (status === 200) {
      detail = await ACTIONS[request.action](transaction, payload);
    }
    // The unique requestId makes the request single-use, whatever the outcome.
    await new sql.Request(transaction)
      .input('requestId', sql.UniqueIdentifier, requestId)
      .input('email', sql.NVarChar(254), request.requesterEmail)
      .input('outcome', sql.NVarChar(20), status === 200 ? 'done' : 'rejected')
      .input('detail', sql.NVarChar(500), detail.slice(0, 500))
      .query(
        `INSERT INTO dbo.[AdminRequestResults] (id, requestId, requesterEmail, outcome, detail, processedAt)
         VALUES (NEWID(), @requestId, @email, @outcome, @detail, SYSUTCDATETIME())`,
      );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    const number = (error as { number?: number }).number;
    if (number !== undefined && UNIQUE_VIOLATION.has(number)) {
      return { status: 409, outcome: 'rejected', detail: 'The request was already processed.' };
    }
    throw error;
  }

  return { status, outcome: status === 200 ? 'done' : 'rejected', detail };
}
