import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { MemoryKV } from '../src/storage/kv-store.ts';
import { AnalyticsDO } from '../src/analytics/durable-object.ts';
import { migrateRealUsers, recordRealUserDays } from '../src/analytics/real-users.ts';
import { buildReport, migrate, recordEvents, validateEvent, parseReportQuery, DAY, type AnalyticsEvent, type SqlLike } from '../src/analytics/store.ts';
import { compileRanges, isOpenAIEgress } from '../src/analytics/openai-egress.ts';
import { classifyClient, hashId, localParts, collectEvents } from '../src/analytics/collector.ts';

const OPENAI_IP = '104.192.219.205';

function makeSql(): { sql: SqlLike; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  return { db, sql: { exec: (q, ...b) => { const out = db.prepare(q).all(...(b as never[])) as Record<string, unknown>[]; return { toArray: () => out }; } } };
}

function makeEnv(extra: Record<string, unknown> = {}) {
  const { sql, db } = makeSql();
  const doInstance = new AnalyticsDO({ storage: { sql }, blockConcurrencyWhile: async fn => fn() });
  const ANALYTICS = { idFromName: (n: string) => n, get: () => ({ fetch: (u: string, init?: RequestInit) => doInstance.fetch(new Request(u, init)) }) };
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
  return { env: { PRAYER_KV: new MemoryKV(), ANALYTICS, ...extra } as any, ctx, db, sql, flush: () => Promise.all(pending.splice(0)) };
}

const ev = (over: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  ts: Date.now(), kind: 'tool', tool: 'get_prayer_status', uid: 'a'.repeat(16), sid: 'b'.repeat(16), country: 'SA', locale: 'en', client: 'ChatGPT',
  verified: 1, status: 'ok', errorCode: null, latencyMs: 12, localHour: 9, localDow: 2, authority: 'UmmAlQura', methodSource: 'geographic_default', ...over,
});

async function call(env: any, ctx: unknown, name: string, args: Record<string, unknown>, meta: Record<string, unknown> = {}, headers: Record<string, string> = {}, method = 'tools/call') {
  const body = method === 'tools/call' ? { name, arguments: args, _meta: meta } : method === 'initialize'
    ? { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'chatgpt-connector', version: '1' } } : {};
  const res = await worker.fetch(new Request('https://t.invalid/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: body }),
  }), env, ctx);
  assert.equal(res.status, 200);
  return res;
}

const MAKKAH = { city: 'Makkah' };


describe('Real user-only analytics through /mcp', () => {
  it('records only a verified identified user-day without per-call details', async () => {
    const t = makeEnv();
    const meta = { 'openai/subject': 'real-user-123', 'openai/session': 'private-session', 'openai/locale': 'ar-SA' };
    await call(t.env, t.ctx, 'get_today_prayer_times', MAKKAH, meta, { 'CF-Connecting-IP': OPENAI_IP });
    await t.flush();
    const rows = t.db.prepare('SELECT * FROM real_user_days').all() as any[];
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['day','uid']);
    assert.equal(rows[0].uid, await hashId('real-user-123'));
    assert.equal((t.db.prepare("SELECT name FROM sqlite_master WHERE name = 'events'").all() as any[]).length, 0);
    assert.ok(!JSON.stringify(rows).includes('private-session'));
  });

  it('ignores anonymous, non-OpenAI, and unknown-client traffic with no SQL writes', async () => {
    const t = makeEnv();
    await call(t.env, t.ctx, 'get_today_prayer_times', MAKKAH);
    await call(t.env, t.ctx, 'get_today_prayer_times', MAKKAH, { 'openai/subject': 'spoofed' });
    await call(t.env, t.ctx, 'rm_rf', {}, { 'openai/subject': 'spoofed' }, { 'CF-Connecting-IP': OPENAI_IP });
    await t.flush();
    assert.equal((t.db.prepare('SELECT COUNT(*) n FROM real_user_days').get() as any).n, 0);
    assert.equal((t.db.prepare('SELECT COUNT(*) n FROM real_daily_budget').get() as any).n, 0);
  });

  it('never counts initialize, tools/list or protocol failures', async () => {
    const t = makeEnv();
    await call(t.env, t.ctx, '', {}, {}, { 'CF-Connecting-IP': OPENAI_IP }, 'initialize');
    const res = await worker.fetch(new Request('https://t.invalid/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }), t.env, t.ctx);
    assert.equal(res.status, 406);
    await t.flush();
    assert.equal((t.db.prepare('SELECT COUNT(*) n FROM real_user_days').get() as any).n, 0);
  });

  it('deduplicates repeated requests for the same user on the same day', async () => {
    const t = makeEnv();
    for (let i = 0; i < 3; i++)
      await call(t.env, t.ctx, 'get_next_prayer', MAKKAH, { 'openai/subject': 'repeat-user' }, { 'CF-Connecting-IP': OPENAI_IP });
    await t.flush();
    assert.equal((t.db.prepare('SELECT COUNT(*) n FROM real_user_days').get() as any).n, 1);
    assert.equal((t.db.prepare('SELECT users FROM real_daily_budget').get() as any).users, 1);
  });

  it('preserves the prayer MCP service when analytics are missing', async () => {
    const res = await call({ PRAYER_KV: new MemoryKV() }, undefined, 'get_next_prayer', MAKKAH, { 'openai/subject': 'person' });
    assert.equal(res.status, 200);
  });
});


describe('Analytics store math', () => {
  const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
  const at = (days: number, hour = 10) => NOW - days * DAY - (12 - hour) * 3_600_000;
  const u = (c: string) => c.repeat(16);

  function seeded() {
    const { sql } = makeSql();
    migrate(sql);
    recordEvents(sql, [
      ev({ uid: u('a'), ts: at(10), tool: 'get_next_prayer' }), ev({ uid: u('a'), ts: at(8) }), ev({ uid: u('a'), ts: at(1) }),
      ev({ uid: u('b'), ts: at(5) }), ev({ uid: u('b'), ts: at(5), status: 'error', errorCode: 'location_required', authority: null }),
      ev({ uid: u('c'), ts: at(0.2), verified: 0 }), ev({ uid: null, sid: null, ts: at(0.1), verified: 0 }),
    ], NOW);
    return sql;
  }

  it('computes period totals, DAU/WAU/MAU, new vs returning, errors', () => {
    const r = buildReport(seeded(), { range: 30, tz: 0, segment: 'all' }, NOW);
    assert.equal(r.kpis.current.calls, 7);
    assert.equal(r.kpis.current.users, 3);
    assert.equal(r.kpis.current.errors, 1);
    assert.equal(r.kpis.current.anonymous, 1);
    assert.equal(r.kpis.current.newUsers, 3);
    assert.equal(r.kpis.dau, 1);
    assert.equal(r.kpis.wau, 3);
    assert.equal(r.kpis.mau, 3);
    assert.equal(r.allTime.users, 3);
    assert.equal(r.allTime.calls, 7);
  });

  it('counts a user as returning only if first seen before the window', () => {
    const r = buildReport(seeded(), { range: 7, tz: 0, segment: 'all' }, NOW);
    assert.equal(r.kpis.current.users, 3);
    assert.equal(r.kpis.current.returning, 1);
    assert.equal(r.kpis.current.newUsers, 2);
  });

  it('computes day-N retention among eligible users only', () => {
    const r = buildReport(seeded(), { range: 30, tz: 0, segment: 'all' }, NOW);
    const [d1, d7] = r.retention;
    assert.equal(d1.eligible, 2);
    assert.equal(d1.retained, 1);
    assert.equal(d7.eligible, 1);
    assert.equal(d7.retained, 1);
  });

  it('restricts every metric to verified traffic when asked', () => {
    const r = buildReport(seeded(), { range: 30, tz: 0, segment: 'verified' }, NOW);
    assert.equal(r.kpis.current.calls, 5);
    assert.equal(r.kpis.current.users, 2);
    assert.ok(r.recent.every(x => x.verified));
  });

  it('fills the daily series, tool series and cohorts to fixed lengths', () => {
    const r = buildReport(seeded(), { range: 30, tz: 0, segment: 'all' }, NOW);
    assert.equal(r.daily.length, 30);
    assert.equal(r.daily.reduce((s, d) => s + d.calls, 0), 7);
    assert.ok(Object.values(r.toolDaily.series).every(a => a.length === 30));
    assert.equal(r.cohorts.length, 8);
    assert.equal(r.cohorts.reduce((s, c) => s + c.size, 0), 3);
    assert.equal(r.depth.reduce((s, d) => s + d.users, 0), 3);
  });

  it('shifts day buckets by the viewer timezone', () => {
    const { sql } = makeSql();
    migrate(sql);
    recordEvents(sql, [ev({ ts: Date.UTC(2026, 9, 2, 22, 30) })], NOW);
    const utc = buildReport(sql, { range: 7, tz: 0, segment: 'all' }, NOW).daily.find(d => d.calls)?.date;
    const plus3 = buildReport(sql, { range: 7, tz: 180, segment: 'all' }, NOW).daily.find(d => d.calls)?.date;
    assert.equal(utc, '2026-10-02');
    assert.equal(plus3, '2026-10-03');
  });

  it('prunes events older than the retention window', () => {
    const { sql, db } = makeSql();
    migrate(sql);
    recordEvents(sql, [ev({ ts: NOW - 200 * DAY })], NOW + 200 * DAY - 1000);
    recordEvents(sql, [ev({ ts: NOW })], NOW + 200 * DAY + 5000 + DAY);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM events WHERE ts < ?').get(NOW - 100 * DAY) as any).n, 0);
  });
});


describe('Bounded real-user reporting', () => {
  const uri = 'https://analytics/report?range=7';
  it('reuses report snapshots without scanning again, including after restarts', async () => {
    const { sql } = makeSql();
    migrateRealUsers(sql);
    recordRealUserDays(sql, ['a'.repeat(16)]);
    let scans = 0;
    const counted: SqlLike = { exec: (q, ...args) => {
      if (q.includes('FROM real_user_days')) scans++;
      return sql.exec(q, ...args);
    } };
    const make = () => new AnalyticsDO({ storage: { sql: counted }, blockConcurrencyWhile: async fn => fn() });
    const first = make();
    const initial = await (await first.fetch(new Request(uri))).json() as any;
    assert.equal(initial.summary.currentUsers, 1);
    assert.ok(scans >= 3);
    const initialScans = scans;
    assert.deepEqual(await (await first.fetch(new Request(uri))).json(), initial);
    assert.equal(scans, initialScans);
    const restarted = make();
    assert.deepEqual(await (await restarted.fetch(new Request(uri))).json(), initial);
    assert.equal(scans, initialScans);
  });

  it('limits report variants, omits request details, and rejects arbitrary range variants', async () => {
    const { sql, db } = makeSql();
    migrateRealUsers(sql);
    const d = new AnalyticsDO({ storage: { sql }, blockConcurrencyWhile: async fn => fn() });
    for (let i = 0; i < 30; i++)
      await d.fetch(new Request('https://analytics/report?range=' + i + '&tz=' + i + '&segment=all'));
    assert.ok((db.prepare('SELECT COUNT(*) n FROM real_report_cache').get() as any).n <= 4);
    const report = await (await d.fetch(new Request(uri))).json() as any;
    assert.equal(report.range, 7);
    assert.ok(!JSON.stringify(report).includes('errorCode'));
  });
});


describe('Free-tier analytics guardrails and legacy cleanup', () => {
  it('hard-stops writes after 500 distinct UTC user-days', () => {
    const { sql, db } = makeSql();
    migrateRealUsers(sql);
    const now = Date.UTC(2026, 9, 21, 12);
    const ids = Array.from({ length: 600 }, (_, i) => i.toString(16).padStart(16, '0'));
    const accepted = recordRealUserDays(sql, ids, now);
    assert.equal(accepted, 500);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM real_user_days').get() as any).n, 500);
    assert.equal((db.prepare('SELECT users FROM real_daily_budget').get() as any).users, 500);
    assert.equal(recordRealUserDays(sql, [ids[599]!], now), 0);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM real_user_days').get() as any).n, 500);
  });

  it('migrates verified identified user-days, then purges the former detailed and bot logs once', () => {
    const { sql, db } = makeSql();
    migrate(sql);
    const now = Date.now();
    recordEvents(sql, [
      ev({ uid: 'a'.repeat(16), ts: now - 60_000, verified: 1 }),
      ev({ uid: 'a'.repeat(16), ts: now - 30_000, verified: 1 }),
      ev({ uid: 'b'.repeat(16), ts: now - 10_000, verified: 0 }),
      ev({ uid: null, ts: now, verified: 1 }),
    ], now);
    migrateRealUsers(sql);
    const surviving = db.prepare('SELECT uid FROM real_user_days').all() as any[];
    assert.deepEqual(surviving.map(row => row.uid), ['a'.repeat(16)]);
    assert.equal((db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'events'").get() as any).n, 0);
    assert.equal((db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'users'").get() as any).n, 0);
    migrateRealUsers(sql);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM real_user_days').get() as any).n, 1);
  });
});

describe('Analytics validation and helpers', () => {
  it('rejects malformed events and normalises unknown values', () => {
    assert.equal(validateEvent(null), null);
    assert.equal(validateEvent({ kind: 'tool', tool: '<img onerror=x>' }), null);
    const e = validateEvent({ kind: 'tool', tool: 'get_next_prayer', uid: 'not-a-hash', country: 'sa', client: 'Evil<script>', status: 'error', errorCode: '<x>', authority: 'a b' })!;
    assert.equal(e.uid, null);
    assert.equal(e.country, null);
    assert.equal(e.client, 'Other');
    assert.equal(e.errorCode, 'tool_error');
    assert.equal(e.authority, null);
    for (const errorCode of ['location_timezone_mismatch', 'invalid_location']) {
      assert.equal(validateEvent({ kind: 'tool', tool: 'get_next_prayer', status: 'error', errorCode })?.errorCode, errorCode);
    }
  });

  it('parses report queries with safe defaults', () => {
    assert.deepEqual(parseReportQuery(new URLSearchParams('range=9999&tz=abc&segment=x')), { range: 30, tz: 0, segment: 'all' });
    assert.deepEqual(parseReportQuery(new URLSearchParams('range=90&tz=180&segment=verified')), { range: 90, tz: 180, segment: 'verified' });
  });

  it('matches OpenAI egress CIDRs', () => {
    const r = compileRanges(['104.192.219.204/30', '100.31.168.162/32']);
    assert.ok(isOpenAIEgress('104.192.219.207', r));
    assert.ok(isOpenAIEgress('100.31.168.162', r));
    assert.ok(!isOpenAIEgress('104.192.219.208', r));
    assert.ok(!isOpenAIEgress('not-an-ip', r));
    assert.ok(isOpenAIEgress(OPENAI_IP));
  });

  it('classifies clients and derives local time', () => {
    assert.equal(classifyClient('Claude Desktop'), 'Claude');
    assert.equal(classifyClient('cursor-vscode'), 'Cursor');
    assert.equal(classifyClient(null, null), 'Other');
    const p = localParts('Asia/Riyadh', Date.UTC(2026, 9, 3, 12, 0));
    assert.deepEqual(p, { hour: 15, dow: 6 });
    assert.equal(localParts('Mars/Base', Date.now()), null);
  });
});

describe('Analytics dashboard routes', () => {
  const get = (path: string, env: unknown, headers: Record<string, string> = {}) => worker.fetch(new Request('https://t.invalid' + path, { headers }), env as never);

  it('serves the dashboard shell with a strict CSP and favicon', async () => {
    const res = await get('/analytics', {});
    assert.equal(res.status, 200);
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self'/);
    assert.ok(!csp.includes('unsafe-inline'));
    const html = await res.text();
    assert.ok(html.includes('rel="icon"') && html.includes('/favicon.png') && html.includes('/analytics/app.js?v=3'));
    for (const path of ['/favicon.png', '/favicon.ico', '/apple-touch-icon.png']) {
      const icon = await get(path, {});
      assert.equal(icon.status, 200);
      assert.equal(icon.headers.get('content-type'), 'image/png');
      assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it('serves app assets and keeps the client free of inline HTML injection', async () => {
    const js = await (await get('/analytics/app.js', {})).text();
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(js));
    assert.equal((await get('/analytics/app.css', {})).headers.get('content-type'), 'text/css; charset=utf-8');
  });

  it('requires Basic or Bearer auth when a token is configured and ignores CORS', async () => {
    const env = { ANALYTICS_TOKEN: 'secret-token' };
    for (const p of ['/analytics', '/api/analytics']) {
      const res = await get(p, env);
      assert.equal(res.status, 401);
      assert.match(res.headers.get('WWW-Authenticate') ?? '', /Basic/);
    }
    assert.equal((await get('/api/analytics', env, { Authorization: 'Bearer wrong' })).status, 401);
    const basic = 'Basic ' + btoa('admin:secret-token');
    assert.equal((await get('/analytics', env, { Authorization: basic })).status, 200);
    const api = await get('/api/analytics', env, { Authorization: 'Bearer secret-token' });
    assert.equal(api.status, 200);
    assert.equal(api.headers.get('access-control-allow-origin'), null);
    assert.equal((await get('/analytics/app.js', env)).status, 200);
  });

  it('falls back to AUTH_TOKEN and reports unprotected access when no token exists', async () => {
    assert.equal((await get('/api/analytics', { AUTH_TOKEN: 't' })).status, 401);
    const body = await (await get('/api/analytics', {})).json() as any;
    assert.equal(body.enabled, false);
    assert.equal(body.access.protected, false);
  });

  it('returns minimal active-user counts without legacy call logs or query bypasses', async () => {
    const t = makeEnv();
    await call(t.env, t.ctx, 'get_next_prayer', MAKKAH,
      { 'openai/subject': 'real-live-user' }, { 'CF-Connecting-IP': OPENAI_IP });
    await t.flush();
    const res = await worker.fetch(new Request('https://t.invalid/api/analytics?range=7&tz=180'), t.env);
    const body = await res.json() as any;
    assert.equal(body.enabled, true);
    assert.equal(body.summary.currentUsers, 1);
    assert.equal(body.summary.dau, 1);
    assert.equal(body.range, 7);
    assert.equal(body.timezone, 'UTC');
    assert.ok(!JSON.stringify(body).includes('real-live-user'));
    assert.ok(!('legacy' in body));
  });
});


describe('Analytics response observation', () => {
  const rpcRequest = [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { jsonrpc: '2.0', id: 'two', method: 'tools/list' }];
  const observe = (response: Response, body: unknown = rpcRequest) => collectEvents({
    requestText: JSON.stringify(body), request: new Request('https://t.invalid/mcp'), response, startedAt: Date.now(),
  });

  it('correlates all SSE replies across split CRLF and multiline frames, skipping notifications and malformed events', async () => {
    const text = ': keepalive\r\n\r\ndata: invalid\r\n\r\n'
      + 'data: {"jsonrpc":"2.0","method":"notifications/progress"}\r\n\r\n'
      + 'event: message\r\ndata: {"jsonrpc":"2.0",\r\ndata: "id":"two","error":{"code":-32602}}\r\n\r\n'
      + 'data: {"jsonrpc":"2.0","id":1,"result":{}}\r\n\r\n';
    const encoded = new TextEncoder().encode(text);
    let offset = 0;
    const response = new Response(new ReadableStream({ pull(controller) {
      if (offset >= encoded.length) return; // The transport stays open after the replies.
      controller.enqueue(encoded.slice(offset, offset += 7));
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
    const events = await observe(response);
    assert.deepEqual(events.map(e => [e.status, e.errorCode]), [['ok', null], ['error', 'invalid_params']]);
    assert.equal(response.bodyUsed, false);
    await response.body?.cancel();
  });

  it('accepts bare CR frame separators and case-insensitive SSE media types', async () => {
    const events = await observe(new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}\r\r',
      { headers: { 'Content-Type': 'Text/Event-Stream; charset=utf-8' } }), rpcRequest[0]);
    assert.equal(events[0].status, 'ok');
  });

  it('keeps malformed completed JSON classified as a transport error', async () => {
    const events = await observe(new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }), rpcRequest[0]);
    assert.equal(events[0].errorCode, 'transport_error');
  });

  it('does not treat an unterminated SSE frame as a completed response', async () => {
    const events = await observe(new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}',
      { headers: { 'Content-Type': 'text/event-stream' } }), rpcRequest[0]);
    assert.equal(events[0].errorCode, 'transport_error');
  });

  it('marks a valid oversized response observation incomplete without consuming the live response', async () => {
    let pulls = 0, offset = 0;
    const json = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { padding: 'x'.repeat(3_000_000) } });
    const bytes = new TextEncoder().encode(json);
    const response = new Response(new ReadableStream({ pull(controller) {
      pulls++;
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset += 100_000));
    } }), { headers: { 'Content-Type': 'application/json' } });
    const events = await observe(response, rpcRequest[0]);
    assert.equal(events[0].errorCode, 'observation_incomplete');
    assert.equal(events[0].status, 'unknown');
    assert.ok(pulls < 10, 'The observer must stop before consuming the oversized response');
    assert.equal(response.bodyUsed, false);
    const live = await response.json() as any;
    assert.equal(live.id, 1);
    assert.equal(live.result.padding.length, 3_000_000);
  });

  it('marks a delayed valid SSE reply as an incomplete observation and preserves its live result', async () => {
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      setTimeout(() => {
        controller.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n'));
        controller.close();
      }, 2300);
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
    const events = await observe(response, rpcRequest[0]);
    assert.equal(events[0].errorCode, 'observation_incomplete');
    assert.equal(events[0].status, 'unknown');
    assert.equal(response.bodyUsed, false);
    assert.match(await response.text(), /"id":1,"result":\{\}/);
  });

});

describe('Analytics selected-period consistency', () => {
  it('excludes old and future rows from period sections and future rows from rolling activity and retention', () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const { sql } = makeSql();
    migrate(sql);
    recordEvents(sql, [
      ev({ ts: now - 40 * DAY, uid: 'a'.repeat(16) }),
      ev({ ts: now - 1000, uid: 'b'.repeat(16) }),
      ev({ ts: now + 60_000, uid: 'c'.repeat(16), status: 'error', errorCode: 'invalid_params', latencyMs: 9000, country: 'US' }),
      ev({ ts: now + 60_000, uid: 'a'.repeat(16), kind: 'initialize' }),
      ev({ ts: now + 60_000, kind: 'list' }),
      ev({ ts: now + 60_000, uid: 'a'.repeat(16) }),
    ], now);
    for (const segment of ['all', 'verified'] as const) {
      const r = buildReport(sql, { range: 7, tz: 180, segment }, now);
      assert.equal(r.kpis.current.calls, 1);
      assert.equal(r.kpis.current.newUsers, 1);
      assert.equal(r.daily.reduce((sum, day) => sum + day.calls, 0), 1);
      assert.equal(r.daily.reduce((sum, day) => sum + day.newUsers, 0), 1);
      assert.equal(r.tools.reduce((sum, tool) => sum + tool.calls, 0), 1);
      assert.equal(Object.values(r.toolDaily.series).flat().reduce((sum, n) => sum + n, 0), 1);
      assert.equal(r.countries.items.reduce((sum, c) => sum + c.calls, 0), 1);
      assert.equal(r.kpis.latency.samples, 1);
      assert.equal(r.kpis.latency.p95, 12);
      assert.equal(r.kpis.dau, 1);
      assert.equal(r.kpis.wau, 1);
      assert.equal(r.kpis.mau, 1);
      assert.equal(r.heatmap.cells.flat().reduce((sum, n) => sum + n, 0), 1);
      assert.equal(r.depth.reduce((sum, d) => sum + d.users, 0), 1);
      assert.equal(r.errors.length, 0);
      assert.equal(r.handshakes.initialize.length, 0);
      assert.equal(r.handshakes.list, 0);
      assert.equal(r.topUsers.length, 1);
      assert.equal(r.recent.length, 1);
      assert.equal(r.retention[0].retained, 0);
      assert.equal(r.cohorts.reduce((sum, c) => sum + c.size, 0), 2);
    }
  });
});


describe('Real-user dashboard request ordering', () => {
  for (const staleError of [false, true]) it('ignores stale ' + (staleError ? 'errors' : 'successes'), async () => {
    const js = await (await worker.fetch(new Request('https://t.invalid/analytics/app.js'), {} as never)).text();
    const code = js.slice(js.indexOf('  function load() {'), js.indexOf('  function show(data) {'));
    const pending: { resolve: (v: unknown) => void; reject: (e: Error) => void }[] = [];
    const shown: unknown[] = [];
    const ctx = { seq: 0, range: 30, show: (x: unknown) => shown.push(x),
      fetch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
    runInNewContext(code + '\nload(); range = 7; load();', ctx);
    pending[1].resolve({ ok: true, json: async () => ({ range: 7 }) });
    await new Promise(resolve => setImmediate(resolve));
    if (staleError) pending[0].reject(new Error('stale'));
    else pending[0].resolve({ ok: true, json: async () => ({ range: 30 }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(shown.filter(Boolean).length, 1);
    assert.equal((shown.filter(Boolean)[0] as any).range, 7);
  });
});


describe('Analytics incomplete outcomes', () => {
  it('preserves unknown outcomes through validation and excludes them from reliability denominators', () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const unknown = validateEvent(ev({ ts: now, status: 'unknown', errorCode: 'observation_incomplete' }), now)!;
    assert.equal(unknown.status, 'unknown');
    assert.equal(unknown.errorCode, 'observation_incomplete');
    const { sql } = makeSql();
    migrate(sql);
    recordEvents(sql, [unknown, ev({ ts: now, status: 'error', errorCode: 'transport_error' }), ev({ ts: now }),
      ev({ ts: now - 7 * DAY, status: 'unknown', errorCode: 'observation_incomplete' })], now);
    const report = buildReport(sql, { range: 7, tz: 0, segment: 'all' }, now);
    for (const section of [report.kpis.current, report.daily.at(-1)!, report.tools[0]]) {
      assert.equal(section.calls, 3);
      assert.equal(section.errors, 1);
      assert.equal(section.incomplete, 1);
      assert.equal(section.errorRate, 0.5);
    }
    assert.equal(report.kpis.previous.incomplete, 1);
    assert.equal(report.kpis.previous.errors, 0);
    assert.equal(report.kpis.previous.errorRate, null);
    assert.deepEqual(report.errors.map(e => e.code), ['transport_error']);
    assert.equal(report.recent.find(e => e.code === 'observation_incomplete')?.status, 'unknown');
  });
});
