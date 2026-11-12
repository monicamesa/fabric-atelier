import sql from 'mssql';
import { randomUUID } from 'node:crypto';
import type { ClerkCode, ClerkCommand, ClerkReason } from './clerk-actions.js';
import { HEARING_COOLDOWN_SECONDS, HEARING_MAX_CASES, hearingState, type HearingEventKind } from './hearing-rules.js';
import { analyzeCase, type CaseDismissalRecord, type CaseRecord, type JurorRecord, type ReviewRecord, type ReviewRecords, type TestimonyRecord, type VoteRecord } from './rules/case-validity.js';
import { CRITIC_PROMPT } from './rules/judge-trust.js';

// launchHearing, cancelHearing and checkWithFabric. They run inside the transaction of executeAdminRequest, so the
// requester is already proven to be an active admin. Hearings are insert-only: a failed start is recorded as a
// "failed" event, never undone.

export interface HearingRuntime {
  /** Fabric token of the app identity (AudienceType.Fabric). */
  token: string;
  workspaceId: string;
  notebookId: string;
  appServer: string;
  appDatabase: string;
}

export interface HearingOutcome {
  code: ClerkCode;
  reason: ClerkReason;
  detail: string;
  hearingId?: string;
  jobStatus?: string;
}

type Command<A extends ClerkCommand['action']> = Extract<ClerkCommand, { action: A }>;
type FetchLike = (url: string, init?: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

const FABRIC = 'https://api.fabric.microsoft.com/v1';

const refuse = (code: ClerkCode, reason: ClerkReason, detail: string): HearingOutcome => ({ code, reason, detail });

function describeFabric(status: number, body: string): string {
  return `Fabric answered ${status}${body ? `: ${body.replace(/\s+/g, ' ').slice(0, 120)}` : ''}`;
}

async function addEvent(transaction: sql.Transaction, hearingId: string, kind: HearingEventKind, detail: string | null): Promise<void> {
  await new sql.Request(transaction)
    .input('id', sql.UniqueIdentifier, randomUUID())
    .input('hearingId', sql.UniqueIdentifier, hearingId)
    .input('kind', sql.NVarChar(20), kind)
    .input('detail', sql.NVarChar(500), detail === null ? null : detail.slice(0, 500))
    .query(`INSERT INTO dbo.[HearingEvents] (id, hearing_id, kind, detail, createdAt) VALUES (@id, @hearingId, @kind, @detail, SYSUTCDATETIME())`);
}

interface CaseRows {
  cases: (CaseRecord & { text: string })[];
  testimonies: (TestimonyRecord & { answer: string })[];
  votes: VoteRecord[];
  dismissals: CaseDismissalRecord[];
  jurors: JurorRecord[];
  /** R9: verdicts, the testimony each hearing asked about, and the jurors' reviews. */
  reviewRecords: ReviewRecords;
}

async function loadCaseRows(transaction: sql.Transaction, agentId: string): Promise<CaseRows> {
  const run = async <T>(text: string): Promise<T[]> =>
    (await new sql.Request(transaction).input('agentId', sql.UniqueIdentifier, agentId).query<T>(text)).recordset;
  const cases = await run<CaseRows['cases'][number]>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), id)) AS id, text, authorUserId, authorEmail, createdAt FROM dbo.[Cases] WHERE agent_id = @agentId`,
  );
  const testimonies = await run<CaseRows['testimonies'][number]>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), t.id)) AS id, LOWER(CONVERT(NVARCHAR(36), t.case_id)) AS case_id, t.answer, t.authorUserId, t.authorEmail, t.createdAt
     FROM dbo.[Testimonies] t JOIN dbo.[Cases] c ON c.id = t.case_id WHERE c.agent_id = @agentId`,
  );
  const votes = await run<VoteRecord>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), v.id)) AS id, LOWER(CONVERT(NVARCHAR(36), v.testimony_id)) AS testimony_id, v.value, v.comment, v.voterUserId, v.voterEmail, v.createdAt
     FROM dbo.[Votes] v JOIN dbo.[Testimonies] t ON t.id = v.testimony_id JOIN dbo.[Cases] c ON c.id = t.case_id WHERE c.agent_id = @agentId`,
  );
  const dismissals = await run<CaseDismissalRecord>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), d.id)) AS id, LOWER(CONVERT(NVARCHAR(36), d.case_id)) AS case_id, d.dismissedByUserId, d.dismissedByEmail, d.createdAt
     FROM dbo.[CaseDismissals] d JOIN dbo.[Cases] c ON c.id = d.case_id WHERE c.agent_id = @agentId`,
  );
  const jurors = await run<JurorRecord>(`SELECT email, role, active FROM dbo.[Jurors]`);
  const verdicts = await run<ReviewRecords['verdicts'][number]>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), v.id)) AS id, LOWER(CONVERT(NVARCHAR(36), v.hearing_id)) AS hearing_id, LOWER(CONVERT(NVARCHAR(36), v.case_id)) AS case_id, v.judgeVerdict, v.createdAt
     FROM dbo.[Verdicts] v JOIN dbo.[Cases] c ON c.id = v.case_id WHERE c.agent_id = @agentId`,
  );
  const hearingCases = await run<ReviewRecords['hearingCases'][number]>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), h.hearing_id)) AS hearing_id, LOWER(CONVERT(NVARCHAR(36), h.case_id)) AS case_id, LOWER(CONVERT(NVARCHAR(36), h.testimony_id)) AS testimony_id
     FROM dbo.[HearingCases] h JOIN dbo.[Cases] c ON c.id = h.case_id WHERE c.agent_id = @agentId`,
  );
  const reviews = await run<ReviewRecord>(
    `SELECT LOWER(CONVERT(NVARCHAR(36), r.id)) AS id, LOWER(CONVERT(NVARCHAR(36), r.verdict_id)) AS verdict_id, r.humanVerdict, r.reason, r.comment, r.reviewerUserId, r.reviewerEmail, r.source, r.createdAt
     FROM dbo.[VerdictReviews] r JOIN dbo.[Verdicts] v ON v.id = r.verdict_id JOIN dbo.[Cases] c ON c.id = v.case_id WHERE c.agent_id = @agentId`,
  );
  return { cases, testimonies, votes, dismissals, jurors, reviewRecords: { verdicts, hearingCases, reviews } };
}

/** R5 and R7: the cases of the agent that are ruled and verified, with the ruled testimony as the expected answer. */
export function rulingSnapshot(rows: CaseRows, caseIds: readonly string[], now: Date): { ok: true; items: { caseId: string; testimonyId: string; question: string; expectedAnswer: string }[] } | { ok: false; detail: string } {
  const items: { caseId: string; testimonyId: string; question: string; expectedAnswer: string }[] = [];
  for (const caseId of caseIds) {
    const caseRecord = rows.cases.find((row) => row.id === caseId);
    if (!caseRecord) return { ok: false, detail: 'A chosen case does not belong to this agent.' };
    const analysis = analyzeCase({
      caseRecord,
      testimonies: rows.testimonies,
      votes: rows.votes,
      dismissals: rows.dismissals,
      jurors: rows.jurors,
      now,
      reviewRecords: rows.reviewRecords,
    });
    const ruling = rows.testimonies.find((testimony) => testimony.id === analysis.rulingTestimonyId);
    if (analysis.state !== 'ruled' || !analysis.verified || !ruling) {
      return { ok: false, detail: 'Only ruled cases from active jurors can go to a hearing.' };
    }
    items.push({ caseId, testimonyId: ruling.id, question: caseRecord.text, expectedAnswer: ruling.answer });
  }
  return { ok: true, items };
}

export async function launchHearing(
  transaction: sql.Transaction,
  command: Command<'launchHearing'>,
  context: { requestId: string; requesterEmail: string },
  runtime: () => HearingRuntime,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<HearingOutcome> {
  if (command.caseIds.length > HEARING_MAX_CASES) {
    return refuse(422, 'limit_exceeded', `A hearing takes at most ${HEARING_MAX_CASES} cases.`);
  }
  const agent = await new sql.Request(transaction)
    .input('id', sql.UniqueIdentifier, command.agentId)
    .query<{ id: string; name: string; workspaceId: string; active: boolean }>(`SELECT id, name, workspaceId, active FROM dbo.[Agents] WHERE id = @id`);
  if (!agent.recordset[0]?.active) return refuse(404, 'not_found', 'Unknown or retired agent.');

  // One hearing at a time across the whole capacity (D9), checked under a lock so two launches cannot both pass.
  const running = await new sql.Request(transaction).query<{ id: string }>(
    `SELECT TOP (1) h.id FROM dbo.[Hearings] AS h WITH (UPDLOCK, HOLDLOCK)
     WHERE NOT EXISTS (SELECT 1 FROM dbo.[HearingEvents] e WHERE e.hearing_id = h.id AND e.kind IN (N'completed', N'failed', N'cancelled'))
       AND DATEDIFF(SECOND, h.createdAt, SYSUTCDATETIME()) < h.caseCount * 90 + 600`,
  );
  if (running.recordset.length > 0) return refuse(409, 'hearing_in_progress', 'Another hearing is still in session.');
  const recent = await new sql.Request(transaction)
    .input('cooldown', sql.Int, HEARING_COOLDOWN_SECONDS)
    .query<{ id: string }>(
      `SELECT TOP (1) e.id FROM dbo.[HearingEvents] e
       WHERE e.kind IN (N'completed', N'failed', N'cancelled') AND NOT (e.kind = N'failed' AND e.detail LIKE N'launch:%')
         AND DATEDIFF(SECOND, e.createdAt, SYSUTCDATETIME()) < @cooldown`,
    );
  if (recent.recordset.length > 0) return refuse(409, 'cooldown', 'The last hearing ended less than 10 minutes ago.');

  const rows = await loadCaseRows(transaction, command.agentId);
  const snapshot = rulingSnapshot(rows, command.caseIds, new Date());
  if (!snapshot.ok) return refuse(422, 'no_cases', snapshot.detail);

  let settings: HearingRuntime;
  try {
    settings = runtime();
  } catch {
    return refuse(500, 'server_error', 'The hearing settings are not configured on this deployment.');
  }

  const hearingId = randomUUID();
  await new sql.Request(transaction)
    .input('id', sql.UniqueIdentifier, hearingId)
    .input('agentId', sql.UniqueIdentifier, command.agentId)
    .input('stage', sql.NVarChar(20), command.stage)
    .input('requestId', sql.UniqueIdentifier, context.requestId)
    .input('email', sql.NVarChar(254), context.requesterEmail)
    .input('count', sql.Int, snapshot.items.length)
    .input('criticPromptVersion', sql.NVarChar(64), CRITIC_PROMPT.version)
    .query(
      `INSERT INTO dbo.[Hearings] (id, agent_id, stage, requestId, launchedByEmail, caseCount, criticPromptVersion, createdAt)
       VALUES (@id, @agentId, @stage, @requestId, @email, @count, @criticPromptVersion, SYSUTCDATETIME())`,
    );
  for (const [index, item] of snapshot.items.entries()) {
    await new sql.Request(transaction)
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('hearingId', sql.UniqueIdentifier, hearingId)
      .input('caseId', sql.UniqueIdentifier, item.caseId)
      .input('testimonyId', sql.UniqueIdentifier, item.testimonyId)
      .input('position', sql.Int, index + 1)
      .input('question', sql.NVarChar(1000), item.question)
      .input('expected', sql.NVarChar(2000), item.expectedAnswer)
      .query(
        `INSERT INTO dbo.[HearingCases] (id, hearing_id, case_id, testimony_id, position, question, expectedAnswer)
         VALUES (@id, @hearingId, @caseId, @testimonyId, @position, @question, @expected)`,
      );
  }

  const agentRow = agent.recordset[0];
  let response;
  try {
    response = await fetchFn(`${FABRIC}/workspaces/${settings.workspaceId}/items/${settings.notebookId}/jobs/instances?jobType=RunNotebook`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionData: {
          parameters: {
            HEARING_ID: { value: hearingId, type: 'string' },
            AGENT_NAME: { value: agentRow.name, type: 'string' },
            AGENT_WORKSPACE_ID: { value: agentRow.workspaceId, type: 'string' },
            STAGE: { value: command.stage, type: 'string' },
            APP_SQL_SERVER: { value: settings.appServer, type: 'string' },
            APP_SQL_DATABASE: { value: settings.appDatabase, type: 'string' },
            // Only sent for a custom critic prompt; without it the SDK's default prompt runs.
            ...(CRITIC_PROMPT.text ? { CRITIC_PROMPT: { value: CRITIC_PROMPT.text, type: 'string' } } : {}),
          },
        },
      }),
    });
  } catch (error) {
    await addEvent(transaction, hearingId, 'failed', `launch: ${(error as Error).message}`);
    return { ...refuse(502, 'fabric_error', 'Fabric could not be reached.'), hearingId };
  }
  const jobInstanceId = (response.headers.get('location') ?? '').split('/').pop()?.split('?')[0] ?? '';
  if (response.status !== 202 || !jobInstanceId) {
    const detail = describeFabric(response.status, await response.text());
    await addEvent(transaction, hearingId, 'failed', `launch: ${detail}`);
    return { ...refuse(502, 'fabric_error', detail), hearingId };
  }
  await addEvent(transaction, hearingId, 'launched', jobInstanceId);
  return { code: 200, reason: 'ok', detail: 'Hearing started.', hearingId };
}

interface StoredHearing {
  id: string;
  createdAt: Date;
  caseCount: number;
  jobInstanceId: string | null;
  events: { kind: HearingEventKind; createdAt: Date }[];
}

async function loadHearing(transaction: sql.Transaction, hearingId: string): Promise<StoredHearing | undefined> {
  const head = await new sql.Request(transaction)
    .input('id', sql.UniqueIdentifier, hearingId)
    .query<{ createdAt: Date; caseCount: number }>(`SELECT createdAt, caseCount FROM dbo.[Hearings] WHERE id = @id`);
  if (!head.recordset[0]) return undefined;
  const events = await new sql.Request(transaction)
    .input('id', sql.UniqueIdentifier, hearingId)
    .query<{ kind: HearingEventKind; detail: string | null; createdAt: Date }>(`SELECT kind, detail, createdAt FROM dbo.[HearingEvents] WHERE hearing_id = @id ORDER BY createdAt`);
  const launched = events.recordset.find((event) => event.kind === 'launched');
  return { id: hearingId, ...head.recordset[0], jobInstanceId: launched?.detail ?? null, events: events.recordset };
}

export async function cancelHearing(
  transaction: sql.Transaction,
  command: Command<'cancelHearing'>,
  runtime: () => HearingRuntime,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<HearingOutcome> {
  const hearing = await loadHearing(transaction, command.hearingId);
  if (!hearing) return refuse(404, 'not_found', 'Unknown hearing.');
  if (hearingState(hearing, hearing.events, new Date()) !== 'in_progress' && hearingState(hearing, hearing.events, new Date()) !== 'no_news') {
    return refuse(422, 'already_processed', 'This hearing is already over.');
  }
  let note = 'cancelled by an admin';
  if (hearing.jobInstanceId) {
    try {
      const settings = runtime();
      const response = await fetchFn(`${FABRIC}/workspaces/${settings.workspaceId}/items/${settings.notebookId}/jobs/instances/${hearing.jobInstanceId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
      });
      note = `cancelled by an admin (Fabric answered ${response.status})`;
    } catch {
      note = 'cancelled by an admin (Fabric could not be reached)';
    }
  }
  await addEvent(transaction, hearing.id, 'cancelled', note);
  return { code: 200, reason: 'ok', detail: 'Hearing cancelled.', hearingId: hearing.id };
}

export async function checkWithFabric(
  transaction: sql.Transaction,
  command: Command<'checkWithFabric'>,
  runtime: () => HearingRuntime,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<HearingOutcome> {
  const hearing = await loadHearing(transaction, command.hearingId);
  if (!hearing) return refuse(404, 'not_found', 'Unknown hearing.');
  if (!hearing.jobInstanceId) return refuse(422, 'not_found', 'This hearing has no job to check.');
  const settings = runtime();
  const response = await fetchFn(`${FABRIC}/workspaces/${settings.workspaceId}/items/${settings.notebookId}/jobs/instances/${hearing.jobInstanceId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${settings.token}` },
  });
  const text = await response.text();
  if (response.status !== 200) return refuse(502, 'fabric_error', describeFabric(response.status, text));
  let status = 'Unknown';
  try {
    status = String((JSON.parse(text) as { status?: string }).status ?? 'Unknown');
  } catch {
    // keep Unknown
  }
  const open = hearingState(hearing, hearing.events, new Date());
  if (open === 'in_progress' || open === 'no_news') {
    if (status === 'Failed') await addEvent(transaction, hearing.id, 'failed', 'checked with Fabric: the job failed');
    else if (status === 'Cancelled') await addEvent(transaction, hearing.id, 'cancelled', 'checked with Fabric: the job was cancelled');
    else if (status === 'Completed') await addEvent(transaction, hearing.id, 'completed', 'checked with Fabric: the job finished');
  }
  return { code: 200, reason: 'ok', detail: `Fabric reports the job as ${status}.`, hearingId: hearing.id, jobStatus: status };
}
