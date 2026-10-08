import { REGISTERED_TOOL_NAMES } from '../mcp/tool-names.ts';

export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
}

export const DAY = 86_400_000;
const WEEK = 7 * DAY;
const EVENT_RETENTION_DAYS = 180;
const USER_RETENTION_DAYS = 400;

export const CLIENTS = ['ChatGPT', 'Claude', 'Cursor', 'VS Code', 'Windsurf', 'Gemini', 'Other'] as const;
export const ERROR_CODES = ['location_required', 'location_timezone_mismatch', 'invalid_location', 'invalid_calculation', 'invalid_preferences', 'invalid_params', 'unsupported_city', 'method_not_found', 'internal_error', 'not_acceptable', 'unsupported_media', 'http_error', 'transport_error', 'observation_incomplete', 'storage_unavailable', 'tool_error'] as const;
export const METHOD_SOURCES = ['explicit_override', 'stored_preference', 'geographic_default'] as const;
const KINDS = ['tool', 'initialize', 'list'] as const;
const RANGES = [7, 30, 90, 180] as const;

export interface AnalyticsEvent {
  ts: number;
  kind: (typeof KINDS)[number];
  tool: string | null;
  uid: string | null;
  sid: string | null;
  country: string | null;
  locale: string | null;
  client: string | null;
  verified: 0 | 1;
  status: 'ok' | 'error';
  errorCode: string | null;
  latencyMs: number | null;
  localHour: number | null;
  localDow: number | null;
  authority: string | null;
  methodSource: string | null;
}

export interface ReportQuery { range: number; tz: number; segment: 'all' | 'verified' }

const HASH = /^[a-f0-9]{16}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const pick = <T extends string>(list: readonly T[], v: unknown): T | null => (list as readonly unknown[]).includes(v) ? v as T : null;
const match = (re: RegExp, v: unknown) => typeof v === 'string' && re.test(v) ? v : null;
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? v as number : null;

export function validateEvent(raw: unknown, now = Date.now()): AnalyticsEvent | null {
  if (!isRecord(raw)) return null;
  const kind = pick(KINDS, raw.kind);
  if (!kind) return null;
  const tool = pick(REGISTERED_TOOL_NAMES, raw.tool);
  if (kind === 'tool' && !tool) return null;
  const status = raw.status === 'error' ? 'error' : 'ok';
  const ts = int(raw.ts, now - 3_600_000, now + 300_000) ?? now;
  const country = match(/^[A-Z]{2}$/, raw.country);
  return {
    ts, kind, tool: kind === 'tool' ? tool : null,
    uid: match(HASH, raw.uid), sid: match(HASH, raw.sid),
    country: country === 'XX' ? null : country,
    locale: match(/^[a-z]{2,3}$/, raw.locale),
    client: raw.client == null ? null : pick(CLIENTS, raw.client) ?? 'Other',
    verified: raw.verified === true || raw.verified === 1 ? 1 : 0,
    status,
    errorCode: status === 'error' ? pick(ERROR_CODES, raw.errorCode) ?? 'tool_error' : null,
    latencyMs: int(raw.latencyMs, 0, 600_000),
    localHour: int(raw.localHour, 0, 23),
    localDow: int(raw.localDow, 0, 6),
    authority: match(/^[A-Za-z]{2,32}$/, raw.authority),
    methodSource: pick(METHOD_SOURCES, raw.methodSource),
  };
}

const rows = (sql: SqlLike, q: string, ...b: unknown[]) => sql.exec(q, ...b).toArray();
const one = (sql: SqlLike, q: string, ...b: unknown[]) => rows(sql, q, ...b)[0] ?? {};
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'bigint' ? Number(v) : 0;
const str = (v: unknown) => typeof v === 'string' ? v : null;
const iso = (ms: number | null) => ms === null || !Number.isFinite(ms) ? null : new Date(ms).toISOString();

export function migrate(sql: SqlLike): void {
  for (const q of [
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, kind TEXT NOT NULL, tool TEXT, uid TEXT, sid TEXT,
      country TEXT, locale TEXT, client TEXT, verified INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ok',
      error_code TEXT, latency_ms INTEGER, local_hour INTEGER, local_dow INTEGER, authority TEXT, method_source TEXT)`,
    'CREATE INDEX IF NOT EXISTS events_ts ON events(ts)',
    'CREATE INDEX IF NOT EXISTS events_uid_ts ON events(uid, ts)',
    `CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0)`,
    'CREATE INDEX IF NOT EXISTS users_first_seen ON users(first_seen)',
    'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)',
  ]) sql.exec(q);
}

const bumpMeta = (sql: SqlLike, k: string, by: number) =>
  sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = v + excluded.v', k, by);
const getMeta = (sql: SqlLike, k: string) => { const r = one(sql, 'SELECT v FROM meta WHERE k = ?', k); return 'v' in r ? num(r.v) : null; };

export function recordEvents(sql: SqlLike, events: AnalyticsEvent[], now = Date.now()): number {
  sql.exec('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)', 'created_at', now);
  for (const e of events) {
    sql.exec(
      `INSERT INTO events (ts, kind, tool, uid, sid, country, locale, client, verified, status, error_code, latency_ms, local_hour, local_dow, authority, method_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e.ts, e.kind, e.tool, e.uid, e.sid, e.country, e.locale, e.client, e.verified, e.status, e.errorCode,
      e.latencyMs, e.localHour, e.localDow, e.authority, e.methodSource,
    );
    if (e.kind !== 'tool') continue;
    bumpMeta(sql, 'calls_ever', 1);
    if (!e.uid) continue;
    const known = rows(sql, 'SELECT 1 AS k FROM users WHERE uid = ?', e.uid).length > 0;
    sql.exec(
      `INSERT INTO users (uid, first_seen, last_seen, calls, verified) VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(uid) DO UPDATE SET first_seen = MIN(first_seen, excluded.first_seen), last_seen = MAX(last_seen, excluded.last_seen),
       calls = calls + 1, verified = MAX(verified, excluded.verified)`,
      e.uid, e.ts, e.ts, e.verified,
    );
    if (!known) bumpMeta(sql, 'users_ever', 1);
  }
  const lastPrune = getMeta(sql, 'last_prune') ?? 0;
  if (now - lastPrune > DAY) {
    sql.exec('DELETE FROM events WHERE ts < ?', now - EVENT_RETENTION_DAYS * DAY);
    sql.exec('DELETE FROM users WHERE last_seen < ?', now - USER_RETENTION_DAYS * DAY);
    sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', 'last_prune', now);
  }
  return events.length;
}

export function parseReportQuery(params: URLSearchParams): ReportQuery {
  const range = Number(params.get('range'));
  const tz = Number(params.get('tz'));
  return {
    range: (RANGES as readonly number[]).includes(range) ? range : 30,
    tz: Number.isInteger(tz) && tz >= -840 && tz <= 840 ? tz : 0,
    segment: params.get('segment') === 'verified' ? 'verified' : 'all',
  };
}

const dateOfDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
const rate = (a: number, b: number) => b > 0 ? Math.round((a / b) * 10_000) / 10_000 : 0;

export function buildReport(sql: SqlLike, query: ReportQuery, now = Date.now()) {
  const { range, tz, segment } = query;
  const tzMs = tz * 60_000;
  const seg = segment === 'verified' ? ' AND verified = 1' : '';
  const segE = segment === 'verified' ? ' AND e.verified = 1' : '';
  const segU = segment === 'verified' ? ' AND u.verified = 1' : '';
  const today = Math.floor((now + tzMs) / DAY);
  const startDay = today - range + 1;
  const start = startDay * DAY - tzMs;
  const prevStart = start - range * DAY;
  const prevEnd = now - range * DAY;
  const dayExpr = `CAST((ts + ${tzMs}) / ${DAY} AS INTEGER)`;
  const tool = `kind = 'tool'${seg}`;

  const totals = (a: number, b: number) => {
    const t = one(sql, `SELECT COUNT(*) AS calls, COUNT(DISTINCT uid) AS users, COUNT(DISTINCT sid) AS sessions,
      COALESCE(SUM(status = 'error'), 0) AS errors, COALESCE(SUM(uid IS NULL), 0) AS anonymous, COALESCE(SUM(verified), 0) AS verified
      FROM events WHERE ${tool} AND ts >= ? AND ts <= ?`, a, b);
    const newUsers = num(one(sql, `SELECT COUNT(*) AS n FROM users u WHERE u.first_seen >= ? AND u.first_seen <= ?${segU}`, a, b).n);
    const returning = num(one(sql, `SELECT COUNT(DISTINCT e.uid) AS n FROM events e JOIN users u ON u.uid = e.uid
      WHERE e.kind = 'tool' AND e.ts >= ? AND e.ts <= ? AND u.first_seen < ?${segE}`, a, b, a).n);
    return { calls: num(t.calls), users: num(t.users), sessions: num(t.sessions), errors: num(t.errors),
      anonymous: num(t.anonymous), verified: num(t.verified), newUsers, returning };
  };
  const current = totals(start, now);
  const previous = totals(prevStart, prevEnd);
  const activeSince = (ms: number) => num(one(sql, `SELECT COUNT(DISTINCT uid) AS n FROM events WHERE ${tool} AND ts > ? AND ts <= ?`, now - ms, now).n);
  const mau = activeSince(30 * DAY);
  const userDays30 = num(one(sql, `SELECT COUNT(*) AS n FROM (SELECT DISTINCT uid, ${dayExpr} AS d FROM events
    WHERE ${tool} AND uid IS NOT NULL AND ts > ? AND ts <= ?)`, now - 30 * DAY, now).n);

  const latencyAt = (p: number, n: number) => n === 0 ? null : num(one(sql, `SELECT latency_ms AS v FROM events
    WHERE ${tool} AND ts >= ? AND ts <= ? AND latency_ms IS NOT NULL ORDER BY latency_ms LIMIT 1 OFFSET ?`, start, now, Math.floor(p * (n - 1))).v);
  const latencySamples = num(one(sql, `SELECT COUNT(*) AS n FROM events WHERE ${tool} AND ts >= ? AND ts <= ? AND latency_ms IS NOT NULL`, start, now).n);

  const dailyRows = new Map(rows(sql, `SELECT ${dayExpr} AS d, COUNT(*) AS calls, COUNT(DISTINCT uid) AS users,
    COUNT(DISTINCT sid) AS sessions, COALESCE(SUM(status = 'error'), 0) AS errors
    FROM events WHERE ${tool} AND ts >= ? AND ts <= ? GROUP BY d`, start, now).map(r => [num(r.d), r]));
  const newRows = new Map(rows(sql, `SELECT CAST((u.first_seen + ${tzMs}) / ${DAY} AS INTEGER) AS d, COUNT(*) AS n
    FROM users u WHERE u.first_seen >= ? AND u.first_seen <= ?${segU} GROUP BY d`, start, now).map(r => [num(r.d), num(r.n)]));
  const days = Array.from({ length: range }, (_, i) => startDay + i);
  const daily = days.map(d => {
    const r = dailyRows.get(d) ?? {};
    return { date: dateOfDay(d), calls: num(r.calls), users: num(r.users), sessions: num(r.sessions), errors: num(r.errors), newUsers: newRows.get(d) ?? 0 };
  });

  const toolSeries: Record<string, number[]> = {};
  for (const r of rows(sql, `SELECT ${dayExpr} AS d, tool, COUNT(*) AS n FROM events WHERE ${tool} AND ts >= ? AND ts <= ? GROUP BY d, tool`, start, now)) {
    const name = str(r.tool);
    const idx = num(r.d) - startDay;
    if (!name || idx < 0 || idx >= range) continue;
    (toolSeries[name] ??= new Array(range).fill(0))[idx] = num(r.n);
  }

  const tools = rows(sql, `SELECT tool, COUNT(*) AS calls, COUNT(DISTINCT uid) AS users, COALESCE(SUM(status = 'error'), 0) AS errors,
    CAST(AVG(latency_ms) AS INTEGER) AS avgMs FROM events WHERE ${tool} AND ts >= ? AND ts <= ? GROUP BY tool ORDER BY calls DESC`, start, now)
    .map(r => ({ tool: str(r.tool), calls: num(r.calls), users: num(r.users), errors: num(r.errors), avgMs: r.avgMs == null ? null : num(r.avgMs) }));

  const breakdown = (col: string, limit = 20) => ({
    items: rows(sql, `SELECT ${col} AS k, COUNT(*) AS calls, COUNT(DISTINCT uid) AS users FROM events
      WHERE ${tool} AND ts >= ? AND ts <= ? AND ${col} IS NOT NULL GROUP BY ${col} ORDER BY users DESC, calls DESC LIMIT ${limit}`, start, now)
      .map(r => ({ key: str(r.k), calls: num(r.calls), users: num(r.users) })),
    unknownCalls: num(one(sql, `SELECT COUNT(*) AS n FROM events WHERE ${tool} AND ts >= ? AND ts <= ? AND ${col} IS NULL`, start, now).n),
  });

  const handshakes = {
    initialize: rows(sql, `SELECT COALESCE(client, 'Other') AS k, COUNT(*) AS n FROM events WHERE kind = 'initialize'${seg} AND ts >= ? AND ts <= ?
      GROUP BY k ORDER BY n DESC`, start, now).map(r => ({ key: str(r.k), n: num(r.n) })),
    list: num(one(sql, `SELECT COUNT(*) AS n FROM events WHERE kind = 'list'${seg} AND ts >= ? AND ts <= ?`, start, now).n),
  };

  const errors = rows(sql, `SELECT tool, error_code AS code, COUNT(*) AS n FROM events WHERE ${tool} AND ts >= ? AND ts <= ? AND status = 'error'
    GROUP BY tool, error_code ORDER BY n DESC LIMIT 20`, start, now).map(r => ({ tool: str(r.tool), code: str(r.code), n: num(r.n) }));

  const cells = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const localShift = Math.floor(tzMs / 1000);
  for (const r of rows(sql, `SELECT COALESCE(local_dow, CAST(strftime('%w', ts / 1000 + ${localShift}, 'unixepoch') AS INTEGER)) AS dow,
    COALESCE(local_hour, CAST(strftime('%H', ts / 1000 + ${localShift}, 'unixepoch') AS INTEGER)) AS hr, COUNT(*) AS n
    FROM events WHERE ${tool} AND ts >= ? AND ts <= ? GROUP BY dow, hr`, start, now)) {
    const dow = num(r.dow), hr = num(r.hr);
    if (dow >= 0 && dow < 7 && hr >= 0 && hr < 24) cells[dow][hr] += num(r.n);
  }
  const localCount = num(one(sql, `SELECT COUNT(*) AS n FROM events WHERE ${tool} AND ts >= ? AND ts <= ? AND local_hour IS NOT NULL`, start, now).n);

  const depthOrder = ['1', '2', '3-6', '7-13', '14+'];
  const depthRows = new Map(rows(sql, `SELECT CASE WHEN days = 1 THEN '1' WHEN days = 2 THEN '2' WHEN days <= 6 THEN '3-6'
    WHEN days <= 13 THEN '7-13' ELSE '14+' END AS b, COUNT(*) AS n FROM (SELECT uid, COUNT(DISTINCT ${dayExpr}) AS days
    FROM events WHERE ${tool} AND uid IS NOT NULL AND ts >= ? AND ts <= ? GROUP BY uid) GROUP BY b`, start, now).map(r => [str(r.b), num(r.n)]));
  const depth = depthOrder.map(bucket => ({ bucket, users: depthRows.get(bucket) ?? 0 }));

  const cohortFloor = now - EVENT_RETENTION_DAYS * DAY;
  const retention = [1, 7, 30].map(n => {
    const r = one(sql, `SELECT COUNT(*) AS eligible, COALESCE(SUM(EXISTS(SELECT 1 FROM events e WHERE e.uid = u.uid AND e.kind = 'tool'
      AND e.ts >= u.first_seen + ? AND e.ts <= ?${segE})), 0) AS retained FROM users u WHERE u.first_seen <= ? AND u.first_seen >= ?${segU}`,
      n * DAY, now, now - n * DAY, cohortFloor);
    const eligible = num(r.eligible), retained = num(r.retained);
    return { day: n, eligible, retained, rate: rate(retained, eligible) };
  });

  const weekShift = tzMs + 3 * DAY;
  const currentWeek = Math.floor((now + weekShift) / WEEK);
  const firstWeek = currentWeek - 7;
  const cohortMap = new Map<number, Map<number, number>>();
  for (const r of rows(sql, `SELECT CAST((u.first_seen + ${weekShift}) / ${WEEK} AS INTEGER) AS cw,
    CAST((e.ts + ${weekShift}) / ${WEEK} AS INTEGER) - CAST((u.first_seen + ${weekShift}) / ${WEEK} AS INTEGER) AS off,
    COUNT(DISTINCT e.uid) AS n FROM users u JOIN events e ON e.uid = u.uid AND e.kind = 'tool'
    WHERE u.first_seen >= ? AND u.first_seen <= ? AND e.ts <= ?${segU}${segE} GROUP BY cw, off`, firstWeek * WEEK - weekShift, now, now)) {
    const cw = num(r.cw), off = num(r.off);
    if (off < 0) continue;
    if (!cohortMap.has(cw)) cohortMap.set(cw, new Map());
    cohortMap.get(cw)!.set(off, num(r.n));
  }
  const cohorts = Array.from({ length: 8 }, (_, i) => firstWeek + i).map(cw => {
    const m = cohortMap.get(cw) ?? new Map<number, number>();
    const size = num(one(sql, `SELECT COUNT(*) AS n FROM users u WHERE u.first_seen >= ? AND u.first_seen < ? AND u.first_seen <= ?${segU}`,
      cw * WEEK - weekShift, (cw + 1) * WEEK - weekShift, now).n);
    return { week: dateOfDay(cw * 7 - 3), size, cells: Array.from({ length: currentWeek - cw + 1 }, (_, off) => rate(m.get(off) ?? 0, size)) };
  });

  const topUsers = rows(sql, `SELECT e.uid AS uid, COUNT(*) AS calls, COUNT(DISTINCT CAST((e.ts + ${tzMs}) / ${DAY} AS INTEGER)) AS days,
    MAX(e.ts) AS last, u.first_seen AS first, u.calls AS lifetime, COUNT(DISTINCT e.tool) AS tools
    FROM events e LEFT JOIN users u ON u.uid = e.uid WHERE e.kind = 'tool' AND e.uid IS NOT NULL AND e.ts >= ? AND e.ts <= ?${segE}
    GROUP BY e.uid ORDER BY calls DESC LIMIT 10`, start, now).map(r => ({
      id: (str(r.uid) ?? '').slice(0, 8), calls: num(r.calls), days: num(r.days), tools: num(r.tools),
      firstSeen: iso(r.first == null ? null : num(r.first)), lastSeen: iso(num(r.last)), lifetimeCalls: num(r.lifetime),
    }));

  const recent = rows(sql, `SELECT ts, kind, tool, uid, country, locale, client, verified, status, error_code, latency_ms, authority
    FROM events WHERE ts >= ? AND ts <= ?${seg} ORDER BY ts DESC, id DESC LIMIT 30`, start, now).map(r => ({
      ts: iso(num(r.ts)), kind: str(r.kind), tool: str(r.tool), user: str(r.uid)?.slice(0, 8) ?? null, country: str(r.country),
      locale: str(r.locale), client: str(r.client), verified: num(r.verified) === 1, status: str(r.status), code: str(r.error_code),
      ms: r.latency_ms == null ? null : num(r.latency_ms), authority: str(r.authority),
    }));

  const firstEvent = one(sql, 'SELECT MIN(ts) AS t FROM events').t;
  const avgDau = daily.reduce((s, d) => s + d.users, 0) / range;

  return {
    generatedAt: iso(now), range, tz, segment,
    period: { start: iso(start), end: iso(now), prevStart: iso(prevStart), prevEnd: iso(prevEnd) },
    kpis: {
      current, previous,
      dau: activeSince(DAY), wau: activeSince(7 * DAY), mau,
      avgDau: Math.round(avgDau * 100) / 100,
      stickiness: mau > 0 ? rate(userDays30 / 30, mau) : 0,
      callsPerUser: current.users > 0 ? Math.round(((current.calls - current.anonymous) / current.users) * 100) / 100 : 0,
      callsPerSession: current.sessions > 0 ? Math.round((current.calls / current.sessions) * 100) / 100 : 0,
      latency: { p50: latencyAt(0.5, latencySamples), p95: latencyAt(0.95, latencySamples), samples: latencySamples },
    },
    allTime: {
      calls: getMeta(sql, 'calls_ever') ?? 0, users: getMeta(sql, 'users_ever') ?? 0,
      since: iso(getMeta(sql, 'created_at')), firstEvent: iso(firstEvent == null ? null : num(firstEvent)),
    },
    daily,
    toolDaily: { dates: daily.map(d => d.date), series: toolSeries },
    tools,
    countries: breakdown('country'),
    locales: breakdown('locale'),
    clients: breakdown('client', 10).items,
    authorities: breakdown('authority', 15).items,
    methodSources: breakdown('method_source', 5).items,
    handshakes,
    errors,
    heatmap: { cells, userLocalShare: rate(localCount, current.calls) },
    depth,
    retention,
    cohorts,
    topUsers,
    recent,
  };
}

export type AnalyticsReport = ReturnType<typeof buildReport>;
