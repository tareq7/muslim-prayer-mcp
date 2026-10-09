import { isOpenAIEgress, refreshEgress } from './openai-egress.ts';
import type { AnalyticsEvent } from './store.ts';
import { REGISTERED_TOOL_NAMES } from '../mcp/tool-names.ts';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

export async function hashId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mpr:v1:' + value));
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}

const CLIENT_RULES: [RegExp, string][] = [
  [/openai|chatgpt/i, 'ChatGPT'], [/claude|anthropic/i, 'Claude'], [/cursor/i, 'Cursor'],
  [/vs ?code|visual studio/i, 'VS Code'], [/windsurf|codeium/i, 'Windsurf'], [/gemini|google/i, 'Gemini'],
];
export const classifyClient = (...hints: (string | null | undefined)[]) => {
  const text = hints.filter(Boolean).join(' ');
  return CLIENT_RULES.find(([re]) => re.test(text))?.[1] ?? 'Other';
};

const formatters = new Map<string, Intl.DateTimeFormat | null>();
const DOW = new Map([['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]]);
export function localParts(tz: unknown, at: number): { hour: number; dow: number } | null {
  if (typeof tz !== 'string' || tz.length > 64) return null;
  let f = formatters.get(tz);
  if (f === undefined) {
    try { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23', weekday: 'short' }); } catch { f = null; }
    if (formatters.size > 64) formatters.clear();
    formatters.set(tz, f);
  }
  if (!f) return null;
  const parts = f.formatToParts(new Date(at));
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const dow = DOW.get(parts.find(p => p.type === 'weekday')?.value ?? '');
  return Number.isInteger(hour) && dow !== undefined ? { hour, dow } : null;
}

interface Pending { kind: AnalyticsEvent['kind']; tool: string | null; id: unknown; meta: Rec; clientName: string | null }

function parseRequest(body: unknown): Pending[] {
  const items = Array.isArray(body) ? body : [body];
  const out: Pending[] = [];
  for (const item of items.slice(0, 20)) {
    if (!isRec(item) || typeof item.method !== 'string' || !('id' in item)) continue;
    const params = isRec(item.params) ? item.params : {};
    const meta = isRec(params._meta) ? params._meta : {};
    if (item.method === 'tools/call') {
      const name = params.name;
      if ((REGISTERED_TOOL_NAMES as readonly unknown[]).includes(name)) out.push({ kind: 'tool', tool: name as string, id: item.id, meta, clientName: null });
    } else if (item.method === 'initialize') {
      const info = isRec(params.clientInfo) ? params.clientInfo : {};
      out.push({ kind: 'initialize', tool: null, id: item.id, meta, clientName: typeof info.name === 'string' ? info.name.slice(0, 80) : null });
    } else if (item.method === 'tools/list') {
      out.push({ kind: 'list', tool: null, id: item.id, meta, clientName: null });
    }
  }
  return out;
}

const RPC_ERRORS = new Map([[-32602, 'invalid_params'], [-32601, 'method_not_found'], [-32603, 'internal_error']]);

const HTTP_ERRORS = new Map([[406, 'not_acceptable'], [415, 'unsupported_media']]);

function outcome(responseBody: unknown, id: unknown, httpStatus: number, incomplete = false): { status: 'ok' | 'error' | 'unknown'; errorCode: string | null; authority: string | null; methodSource: string | null } {
  if (httpStatus >= 400) return { status: 'error', errorCode: HTTP_ERRORS.get(httpStatus) ?? 'http_error', authority: null, methodSource: null };
  const items = Array.isArray(responseBody) ? responseBody : [responseBody];
  const res = items.find(r => isRec(r) && r.id === id);
  if (!isRec(res)) return { status: incomplete ? 'unknown' : 'error', errorCode: incomplete ? 'observation_incomplete' : 'transport_error', authority: null, methodSource: null };
  if (isRec(res.error)) return { status: 'error', errorCode: RPC_ERRORS.get(Number(res.error.code)) ?? 'tool_error', authority: null, methodSource: null };
  const result = isRec(res.result) ? res.result : {};
  const sc = isRec(result.structuredContent) ? result.structuredContent : {};
  if (result.isError === true) {
    const first = Array.isArray(result.content) && isRec(result.content[0]) ? result.content[0].text : '';
    const text = typeof first === 'string' ? first : '';
    const errorCode = typeof sc.code === 'string' ? sc.code
      : /unsupported predefined city/i.test(text) ? 'unsupported_city'
      : /input validation error/i.test(text) ? 'invalid_params' : 'tool_error';
    return { status: 'error', errorCode, authority: null, methodSource: null };
  }
  const details = isRec(sc.calculationDetails) ? sc.calculationDetails : {};
  return {
    status: 'ok', errorCode: null,
    authority: typeof sc.calculationMethod === 'string' ? sc.calculationMethod : null,
    methodSource: typeof details.methodSource === 'string' ? details.methodSource : null,
  };
}

const RESPONSE_BYTE_LIMIT = 524_288;
const RESPONSE_READ_TIMEOUT_MS = 2_000;

// Observe only a bounded prefix of the cloned body. SSE may remain open after
// its RPC response, so finish as soon as all tracked request IDs are resolved.
async function readResponse(response: Response, pending: Pending[]): Promise<{ replies: Rec[]; incomplete: boolean }> {
  const reader = response.clone().body?.getReader();
  if (!reader) return { replies: [], incomplete: false };
  const decoder = new TextDecoder();
  const sse = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'text/event-stream';
  const replies: Rec[] = [];
  let buffer = '', bytes = 0, line = '', skipLF = false;
  let dataLines: string[] = [];
  const timeoutError = new Error('Analytics response observation timed out');
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), RESPONSE_READ_TIMEOUT_MS);
  });
  const add = (value: unknown) => {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (isRec(item) && ('result' in item || 'error' in item) && pending.some(p => p.id === item.id)
        && !replies.some(r => r.id === item.id)) replies.push(item);
    }
  };
  const finishLine = () => {
    if (!line) {
      if (dataLines.length) {
        try { add(JSON.parse(dataLines.join('\n'))); } catch { /* Skip malformed events, not later valid replies. */ }
      }
      dataLines = [];
    } else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    line = '';
  };
  const parseFrames = (text: string) => {
    for (const char of text) {
      if (skipLF) { skipLF = false; if (char === '\n') continue; }
      if (char === '\r') { finishLine(); skipLF = true; }
      else if (char === '\n') finishLine();
      else line += char;
    }
  };
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), expired]);
      if (done) {
        const tail = decoder.decode();
        if (sse) parseFrames(tail);
        else add(JSON.parse(buffer + tail));
        return { replies, incomplete: false };
      }
      bytes += value.byteLength;
      if (bytes > RESPONSE_BYTE_LIMIT) return { replies, incomplete: true };
      const text = decoder.decode(value, { stream: true });
      if (sse) {
        parseFrames(text);
        if (pending.every(p => replies.some(r => r.id === p.id))) return { replies, incomplete: false };
      } else buffer += text;
    }
  } catch (error) { return { replies, incomplete: error === timeoutError }; }
  finally {
    clearTimeout(timer!);
    // A tee branch's cancel promise can await the consumer of the other branch.
    // Do not block analytics or the live response waiting for that consumer.
    void reader.cancel().catch(() => {});
  }
}

export interface CollectInput {
  requestText: string;
  request: Request & { cf?: { country?: string } };
  response: Response;
  startedAt: number;
}

export async function collectEvents({ requestText, request, response, startedAt }: CollectInput): Promise<AnalyticsEvent[]> {
  let body: unknown;
  try { body = JSON.parse(requestText); } catch { return []; }
  const pending = parseRequest(body);
  if (!pending.length) return [];
  const latencyMs = Math.max(0, Date.now() - startedAt);
  const responseBody = await readResponse(response, pending);

  await refreshEgress(fetch);
  const verified = isOpenAIEgress(request.headers.get('CF-Connecting-IP')) ? 1 : 0;
  const ua = request.headers.get('user-agent');
  const events: AnalyticsEvent[] = [];
  for (const p of pending) {
    const m = p.meta;
    const hasOpenAI = Object.keys(m).some(k => k.startsWith('openai/'));
    const client = hasOpenAI ? 'ChatGPT' : classifyClient(p.clientName, typeof m['openai/userAgent'] === 'string' ? m['openai/userAgent'] : null, ua);
    const loc = isRec(m['openai/userLocation']) ? m['openai/userLocation'] : {};
    const locCountry = typeof loc.country === 'string' ? loc.country.toUpperCase() : null;
    const cfCountry = request.cf?.country ?? request.headers.get('cf-ipcountry');
    const country = locCountry ?? (client === 'ChatGPT' || client === 'Claude' ? null : cfCountry?.toUpperCase() ?? null);
    const locale = typeof m['openai/locale'] === 'string' ? m['openai/locale'].split(/[-_]/)[0]?.toLowerCase() ?? null : null;
    const local = localParts(loc.timezone, Date.now());
    const result = outcome(responseBody.replies, p.id, response.status, responseBody.incomplete);
    const subject = typeof m['openai/subject'] === 'string' && m['openai/subject'].length <= 2048 ? m['openai/subject'] : null;
    const session = typeof m['openai/session'] === 'string' && m['openai/session'].length <= 2048 ? m['openai/session'] : null;
    events.push({
      ts: Date.now(), kind: p.kind, tool: p.tool,
      uid: subject ? await hashId(subject) : null, sid: session ? await hashId(session) : null,
      country, locale, client, verified, status: result.status, errorCode: result.errorCode, latencyMs,
      localHour: local?.hour ?? null, localDow: local?.dow ?? null,
      authority: p.kind === 'tool' ? result.authority : null, methodSource: p.kind === 'tool' ? result.methodSource : null,
    });
  }
  return events;
}

interface Namespace { idFromName(name: string): unknown; get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> } }

export function recordViaStub(ns: Namespace, events: AnalyticsEvent[]): Promise<Response> {
  return ns.get(ns.idFromName('global')).fetch('https://analytics/record', { method: 'POST', body: JSON.stringify(events) });
}
export type { Namespace as AnalyticsNamespace };
