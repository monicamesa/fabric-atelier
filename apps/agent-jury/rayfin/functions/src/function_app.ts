import { UserDataFunctions, AudienceType, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { withAppSql } from './app-sql.js';
import { executeAdminRequest } from './admin-request.js';
import type { ClerkResult } from './clerk-actions.js';

const udf = new UserDataFunctions();

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error).slice(0, 200);
}

// Admin entry point (fallback design). Takes only the id of an AdminRequest the caller inserted;
// the action and payload are read from that row, never from the call.
// Named clerk*, not admin*: the Azure Functions host reserves routes starting with admin or runtime.
udf.func(
  'clerkExecute',
  async (requestId: string, ctx: RayfinContext<AgentJurySchema, AudienceType.Sql>): Promise<ClerkResult> => {
    if (!GUID.test(requestId)) {
      return { code: 404, outcome: 'rejected', reason: 'unknown_request', detail: 'Unknown request.' };
    }
    try {
      return await withAppSql(
        { server: ctx.Secrets.APP_SQL_SERVER, database: ctx.Secrets.APP_SQL_DATABASE, token: ctx.Tokens.Sql },
        (pool) => executeAdminRequest(pool, requestId),
      );
    } catch (error) {
      return { code: 500, outcome: 'rejected', reason: 'server_error', detail: describe(error) };
    }
  },
  [],
);
