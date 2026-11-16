export type RicReason = 'config' | 'auth' | 'timeout' | 'agent' | 'unknown';
export type RicResult = { ok: true; answer: string } | { ok: false; reason: RicReason };

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

class McpError extends Error {
  constructor(readonly reason: RicReason) { super(reason); }
}

function parseResponse(text: string, contentType: string): JsonRecord | undefined {
  if (!text.trim()) return undefined;
  if (contentType.includes('text/event-stream')) {
    const messages = text.split(/\r?\n\r?\n/).flatMap((event) => {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart()).join('\n');
      return data ? [data] : [];
    });
    for (const message of messages.reverse()) {
      const parsed = record(JSON.parse(message));
      if (parsed && ('result' in parsed || 'error' in parsed)) return parsed;
    }
    return undefined;
  }
  return contentType.includes('application/json') ? record(JSON.parse(text)) : undefined;
}

export async function askAgent(endpoint: string, token: string, question: string): Promise<RicResult> {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, reason: 'config' };
  }
  if (url.protocol !== 'https:' || url.hostname !== 'api.fabric.microsoft.com' ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\/v1\/mcp\/workspaces\/[0-9a-f-]+\/dataagents\/[0-9a-f-]+\/agent\/?$/i.test(url.pathname)) {
    return { ok: false, reason: 'config' };
  }
  if (!token) return { ok: false, reason: 'auth' };
  if (typeof question !== 'string') return { ok: false, reason: 'agent' };
  const prompt = question.trim();
  if (!prompt || prompt.length > 500) return { ok: false, reason: 'agent' };
  const signal = AbortSignal.timeout(120_000);
  let session: string | undefined;
  async function send(payload: JsonRecord, notification = false): Promise<JsonRecord | undefined> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-03-26',
        ...(session ? { 'Mcp-Session-Id': session } : {}),
      },
      body: JSON.stringify(payload),
      signal,
      redirect: 'error',
    });
    session = response.headers.get('mcp-session-id') ?? session;
    if (!response.ok) console.error(`Ric MCP ${String(payload.method)}: HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403) throw new McpError('auth');
    if (!response.ok) throw new McpError('agent');
    const text = await response.text();
    const body = parseResponse(text, response.headers.get('content-type')?.toLowerCase() ?? '');
    if (!notification && (!body || body.error || !record(body.result))) throw new McpError('agent');
    return record(body?.result);
  }
  try {
    await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'moss-triage', version: '1.0' },
    } });
    await send({ jsonrpc: '2.0', method: 'notifications/initialized' }, true);
    const list = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = Array.isArray(list?.tools) ? list.tools : [];
    const candidates = tools.flatMap((item) => {
      const tool = record(item);
      const schema = record(tool?.inputSchema);
      const properties = record(schema?.properties);
      if (typeof tool?.name !== 'string' || !properties) return [];
      const strings = Object.entries(properties).filter(([, value]) => record(value)?.type === 'string').map(([key]) => key);
      const key = strings.find((name) => /^(question|query|prompt|message|input)$/i.test(name)) ?? (strings.length === 1 ? strings[0] : undefined);
      const required = Array.isArray(schema?.required) ? schema.required : [];
      return key && required.every((name) => name === key) ? [{ name: tool.name, key }] : [];
    });
    if (candidates.length !== 1) throw new McpError('agent');
    const tool = candidates[0];
    const result = await send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
      name: tool.name, arguments: { [tool.key]: prompt },
    } });
    if (result?.isError === true || !Array.isArray(result?.content)) throw new McpError('agent');
    const answer = result.content.flatMap((item) => {
      const part = record(item);
      return part?.type === 'text' && typeof part.text === 'string' ? [part.text] : [];
    }).join('\n').trim().slice(0, 4000);
    return answer ? { ok: true, answer } : { ok: false, reason: 'agent' };
  } catch (error) {
    if (signal.aborted) return { ok: false, reason: 'timeout' };
    if (error instanceof McpError) return { ok: false, reason: error.reason };
    return { ok: false, reason: 'unknown' };
  }
}
