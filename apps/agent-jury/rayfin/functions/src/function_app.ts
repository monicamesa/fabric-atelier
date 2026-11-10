import { UserDataFunctions, AudienceType, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { withAppSql } from './app-sql.js';
import { executeAdminRequest } from './admin-request.js';
import type { ClerkResult } from './clerk-actions.js';
import { parseLegacyCheckCutoff } from './clerk-actions.js';

const udf = new UserDataFunctions();

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error).slice(0, 200);
}

// Optional, set only in deployments with unmarked check rows; reading a declared secret with no value throws.
function legacyCheckCutoff(ctx: RayfinContext<AgentJurySchema, AudienceType.Sql | AudienceType.Fabric>): Date | undefined {
  try {
    return parseLegacyCheckCutoff(ctx.Secrets.LEGACY_CHECK_CUTOFF_UTC);
  } catch {
    return undefined;
  }
}

// Admin entry point (fallback design). Takes only the id of an AdminRequest the caller inserted;
// the action and payload are read from that row, never from the call.
// Named clerk*, not admin*: the Azure Functions host reserves routes starting with admin or runtime.
// The Fabric audience is used only by the hearing actions (start, cancel and check the evaluate_agent notebook job
// as the app identity); every other action never reads it.
udf.func(
  'clerkExecute',
  async (requestId: string, ctx: RayfinContext<AgentJurySchema, AudienceType.Sql | AudienceType.Fabric>): Promise<ClerkResult> => {
    if (!GUID.test(requestId)) {
      return { code: 404, outcome: 'rejected', reason: 'unknown_request', detail: 'Unknown request.' };
    }
    try {
      return await withAppSql(
        { server: ctx.Secrets.APP_SQL_SERVER, database: ctx.Secrets.APP_SQL_DATABASE, token: ctx.Tokens.Sql },
        (pool) =>
          executeAdminRequest(pool, requestId, {
            legacyCheckCutoff: legacyCheckCutoff(ctx),
            hearing: () => ({
              token: ctx.Tokens.Fabric,
              workspaceId: ctx.Secrets.HEARING_WORKSPACE_ID,
              notebookId: ctx.Secrets.HEARING_NOTEBOOK_ID,
              appServer: ctx.Secrets.APP_SQL_SERVER,
              appDatabase: ctx.Secrets.APP_SQL_DATABASE,
            }),
          }),
      );
    } catch (error) {
      return { code: 500, outcome: 'rejected', reason: 'server_error', detail: describe(error) };
    }
  },
  [],
);
