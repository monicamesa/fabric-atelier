import { UserDataFunctions, AudienceType, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { isActiveAdmin, withAppSql } from './app-sql.js';

const udf = new UserDataFunctions();

export interface AdminProbeResult {
  status: 200 | 403;
  stage: 'insert' | 'read-back' | 'admin-check' | 'allowed';
  requestId?: string;
  detail?: string;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error).slice(0, 200);
}

// Spike "proof by insert": the AdminRequest insert policy (claims.email = requesterEmail) runs with the
// caller's identity through getDataClient(), so a successful insert proves who is calling.
udf.func(
  'adminProbe',
  async (claimedEmail: string, ctx: RayfinContext<AgentJurySchema, AudienceType.Sql>): Promise<AdminProbeResult> => {
    const data = ctx.getDataClient();

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

    const admin = await withAppSql(
      { server: ctx.Secrets.APP_SQL_SERVER, database: ctx.Secrets.APP_SQL_DATABASE, token: ctx.Tokens.Sql },
      (pool) => isActiveAdmin(pool, verifiedEmail),
    );
    return admin
      ? { status: 200, stage: 'allowed', requestId }
      : { status: 403, stage: 'admin-check', requestId, detail: 'The caller is not an active admin.' };
  },
  [],
);
