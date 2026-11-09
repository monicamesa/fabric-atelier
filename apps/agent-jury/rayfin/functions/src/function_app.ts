import { UserDataFunctions, AudienceType, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { AgentJurySchema } from '../../data/schema.js';
import { withAppSql } from './app-sql.js';
import { executeAdminRequest, type AdminExecuteResult } from './admin-request.js';

const udf = new UserDataFunctions();

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error).slice(0, 200);
}

// Admin entry point (fallback design). Takes only the id of an AdminRequest the caller inserted;
// the action and payload are read from that row, never from the call.
udf.func(
  'adminExecute',
  async (requestId: string, ctx: RayfinContext<AgentJurySchema, AudienceType.Sql>): Promise<AdminExecuteResult> => {
    if (!GUID.test(requestId)) {
      return { code: 404, outcome: 'rejected', detail: 'Unknown request.' };
    }
    return withAppSql(
      { server: ctx.Secrets.APP_SQL_SERVER, database: ctx.Secrets.APP_SQL_DATABASE, token: ctx.Tokens.Sql },
      (pool) => executeAdminRequest(pool, requestId),
    );
  },
  [],
);

export interface DataPingResult {
  ok: boolean;
  detail?: string;
}

// Diagnostics: which signatures can the host invoke? (sync/async, with/without an input and context)
udf.func('echoSync', (text: string): string => `sync:${text.length}`, []);
udf.func('echoAsync', async (text: string): Promise<string> => `async:${text.length}`, []);
udf.func(
  'echoAsyncCtx',
  async (text: string, ctx: RayfinContext<AgentJurySchema>): Promise<string> => `ctx:${text.length}:${ctx.baseUrl ? 'base' : 'none'}`,
  [],
);

// Diagnostic: the smallest possible read through the caller-scoped data client.
udf.func(
  'dataPing',
  async (ctx: RayfinContext<AgentJurySchema>): Promise<DataPingResult> => {
    try {
      await ctx.getDataClient().Juror.select(['id']).first(1).execute();
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: describe(error) };
    }
  },
  [],
);
