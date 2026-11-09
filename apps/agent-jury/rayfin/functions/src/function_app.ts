import { UserDataFunctions, AudienceType, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { withAppSql } from './app-sql.js';

const udf = new UserDataFunctions();

export interface AdminProbeResult {
  status: 200 | 403;
  stage: 'insert' | 'read-back' | 'admin-check' | 'allowed' | 'error';
  requestId?: string;
  detail?: string;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error).slice(0, 200);
}

// Spike "proof by insert": the AdminRequest insert policy (claims.email = requesterEmail) runs with the
// caller's identity through getDataClient(), so a successful insert proves who is calling.
// Diagnostic split: this one uses only the caller's data client; sqlPing uses only the Sql audience.
udf.func(
  'adminProbe',
  async (claimedEmail: string, ctx: RayfinContext<AgentJurySchema>): Promise<AdminProbeResult> => {
    try {
      return await probe(ctx.getDataClient(), claimedEmail);
    } catch (error) {
      return { status: 403, stage: 'error', detail: describe(error) };
    }
  },
  [],
);

// Diagnostic: confirms the Functions host runs code that has no context or audience.
udf.func('ping', (): string => 'pong', []);

export interface SqlPingResult {
  ok: boolean;
  activeAdmins?: number;
  detail?: string;
}

// Diagnostic: the AudienceType.Sql binding alone, reading Jurors as the app identity.
udf.func(
  'sqlPing',
  async (ctx: RayfinContext<AgentJurySchema, AudienceType.Sql>): Promise<SqlPingResult> => {
    try {
      const activeAdmins = await withAppSql(
        { server: ctx.Secrets.APP_SQL_SERVER, database: ctx.Secrets.APP_SQL_DATABASE, token: ctx.Tokens.Sql },
        async (pool) => {
          const result = await pool.request().query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM dbo.[Jurors] WHERE role = N'admin' AND active = 1`,
          );
          return result.recordset[0]?.total ?? 0;
        },
      );
      return { ok: true, activeAdmins };
    } catch (error) {
      return { ok: false, detail: describe(error) };
    }
  },
  [],
);

async function probe(
  data: ReturnType<RayfinContext<AgentJurySchema>['getDataClient']>,
  claimedEmail: string,
): Promise<AdminProbeResult> {
    let requestId: string;
    try {
      const created = await data.AdminRequest.create({
        requesterEmail: claimedEmail,
        action: 'probe',
        payload: '{}',
        createdAt: new Date(),
      });
      requestId = created.id;
    } catch (error) {
      return { status: 403, stage: 'insert', detail: describe(error) };
    }

    let verifiedEmail: string;
    try {
      const [row] = await data.AdminRequest.select(['id', 'requesterEmail'])
        .where({ id: { eq: requestId } })
        .execute();
      if (!row?.requesterEmail) {
        return { status: 403, stage: 'read-back', requestId, detail: 'Request not readable by its author.' };
      }
      verifiedEmail = row.requesterEmail;
    } catch (error) {
      return { status: 403, stage: 'read-back', requestId, detail: describe(error) };
    }

    // Diagnostic variant of the admin check: Jurors are readable by any signed-in user.
    const jurors = await data.Juror.select(['email', 'role', 'active']).first(1000).execute();
    const target = verifiedEmail.trim().toLowerCase();
    const admin = jurors.some((juror) => juror.active && juror.role === 'admin' && juror.email.trim().toLowerCase() === target);
    return admin
      ? { status: 200, stage: 'allowed', requestId }
      : { status: 403, stage: 'admin-check', requestId, detail: 'The caller is not an active admin.' };
}
