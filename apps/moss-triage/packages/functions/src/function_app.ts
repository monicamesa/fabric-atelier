import { AudienceType, UserDataFunctions, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import type { UniversalAppSchema } from '@rayfin-app/shared';
import { askAgent, type RicResult } from './ric-mcp.js';

const udf = new UserDataFunctions();

udf.func(
  'askRic',
  async (
    ctx: RayfinContext<UniversalAppSchema, AudienceType.Fabric, 'RIC_DATA_AGENT_MCP_URL'>,
    question: string,
  ): Promise<RicResult> => {
    let endpoint: string;
    let token: string;
    try { endpoint = ctx.Secrets.RIC_DATA_AGENT_MCP_URL; } catch { return { ok: false, reason: 'config' }; }
    try { token = ctx.Tokens.Fabric; } catch { return { ok: false, reason: 'auth' }; }
    return askAgent(endpoint, token, question);
  },
  []
);
