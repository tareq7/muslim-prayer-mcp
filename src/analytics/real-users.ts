import { REGISTERED_TOOL_NAMES } from '../mcp/tool-names.ts';
import { hashId } from './collector.ts';
import { isOpenAIEgress, refreshEgress } from './openai-egress.ts';
import type { SqlLike } from './store.ts';

// Intentionally store one 16-hex-character pseudonym per UTC day, not request logs.
// At most 500 distinct users are recorded per day, protecting shared free quotas.
export const MAX_DAILY_USERS = 500;
export const RETENTION_DAYS = 180;
export const REPORT_TTL_MS = 24 * 60 * 60_000;
export const UTC_DAY_MS = 86_400_000;
const REPORT_RANGES = [7, 30, 90, 180] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const dayNumber = (now: number) => Math.floor(now / UTC_DAY_MS);
const dayString = (day: number) => new Date(day * UTC_DAY_MS).toISOString().slice(0, 10);

export interface RealUserRequest extends Request {
  cf?: { country?: string; botManagement?: { verifiedBot?: boolean } };
}

// A valid OpenAI subject from OpenAI's published egress IPs is our conservative
// "identifiable ChatGPT user" signal. It cannot prove a human is at the keyboard.
export async function realUserVisits(requestText: string, request: RealUserRequest): Promise<{uid: string; country: string | null}[]> {
  if (request.cf?.botManagement?.verifiedBot) return [];
  let body: unknown;
  try { body = JSON.parse(requestText); } catch { return []; }
  const items = Array.isArray(body) ? body.slice(0, 20) : [body];
  const subjects = new Map<string, string | null>();
  for (const item of items) {
    if (!isRecord(item) || item.method !== 'tools/call' || !('id' in item)) continue;
    const params = isRecord(item.params) ? item.params : {};
    if (!(REGISTERED_TOOL_NAMES as readonly unknown[]).includes(params.name)) continue;
    const meta = isRecord(params._meta) ? params._meta : {};
    const subject = meta['openai/subject'];
    if (typeof subject !== 'string' || subject.length < 1 || subject.length > 2048 || !subject.trim()) continue;
    const loc = isRecord(meta['openai/userLocation']) ? meta['openai/userLocation'] : {};
    if (!subjects.has(subject) || normalizeCountry(loc.country)) subjects.set(subject, normalizeCountry(loc.country));
  }
  if (!subjects.size) return [];
  await refreshEgress(fetch);
  if (!isOpenAIEgress(request.headers.get('CF-Connecting-IP'))) return [];
  return Promise.all([...subjects].slice(0, 4).map(async ([subject, country]) => ({ uid: await hashId(subject), country })));
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
const countryCodes = new Map<string, string | null>();
export function normalizeCountry(value: unknown): string | null {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(code) || ['XX', 'ZZ'].includes(code)) return null;
  if (countryCodes.has(code)) return countryCodes.get(code)!;
  let result: string | null = null;
  try { result = countryNames.of(code) ? code : null; } catch { /* Invalid region. */ }
  countryCodes.set(code, result);
  return result;
}
export async function realUserIds(text: string, request: RealUserRequest): Promise<string[]> {
  return (await realUserVisits(text, request)).map(x => x.uid);
}
export function parseRealReportRange(params: URLSearchParams): number {
  const n = Number(params.get('range'));
  return (REPORT_RANGES as readonly number[]).includes(n) ? n : 30;
}

export function migrateRealUsers(sql: SqlLike): void {
  // WITHOUT ROWID compresses a composite key and avoids a secondary rowid tree.
  sql.exec(`CREATE TABLE IF NOT EXISTS real_user_days (
    day INTEGER NOT NULL, uid TEXT NOT NULL,
    PRIMARY KEY(day, uid)) WITHOUT ROWID`);
  sql.exec(`CREATE TABLE IF NOT EXISTS real_daily_budget (
    day INTEGER PRIMARY KEY, users INTEGER NOT NULL)`);
  sql.exec(`CREATE TABLE IF NOT EXISTS real_report_cache (
    range INTEGER PRIMARY KEY, day INTEGER NOT NULL, cached_at INTEGER NOT NULL, payload TEXT NOT NULL)`);
  sql.exec('CREATE TABLE IF NOT EXISTS real_schema (k TEXT PRIMARY KEY) WITHOUT ROWID');
  if (!sql.exec("SELECT 1 AS complete FROM real_schema WHERE k = 'v3'").toArray().length) {
    if (!sql.exec('PRAGMA table_info(real_user_days)').toArray().some(row => row.name === 'country'))
      sql.exec('ALTER TABLE real_user_days ADD COLUMN country TEXT');
    sql.exec('DELETE FROM real_report_cache');
    sql.exec("INSERT INTO real_schema(k) VALUES ('v3')");
  }
  // Report shape changed: invalidate at most four old snapshots once.
  if (!sql.exec("SELECT 1 AS complete FROM real_schema WHERE k = 'v4'").toArray().length) {
    sql.exec('DELETE FROM real_report_cache');
    sql.exec("INSERT INTO real_schema(k) VALUES ('v4')");
  }
  // One-time transition: retain only identified/verified user-days from the
  // former event log, then permanently discard request-level and bot history.
  if (sql.exec("SELECT 1 AS complete FROM real_schema WHERE k = 'v2'").toArray().length) return;
  const hasLegacyEvents = sql.exec(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'events'",
  ).toArray().length > 0;
  if (hasLegacyEvents) {
    const earliest = dayNumber(Date.now()) - RETENTION_DAYS + 1;
    sql.exec(`INSERT OR IGNORE INTO real_user_days(day, uid)
      SELECT DISTINCT CAST(ts / ${UTC_DAY_MS} AS INTEGER), uid FROM events
      WHERE kind = 'tool' AND verified = 1 AND uid IS NOT NULL
        AND ts >= ? AND ts <= ?`, earliest * UTC_DAY_MS, Date.now());
    sql.exec(`INSERT OR IGNORE INTO real_daily_budget(day, users)
      SELECT day, COUNT(*) FROM real_user_days GROUP BY day`);
    sql.exec('DROP TABLE events');
    sql.exec('DROP TABLE IF EXISTS users');
    sql.exec('DROP TABLE IF EXISTS meta');
    sql.exec('DROP TABLE IF EXISTS report_cache');
  }
  sql.exec("INSERT OR IGNORE INTO real_schema(k) VALUES ('v2')");
}

// This function is called for genuinely identified subjects only. It always
// preserves their MCP response, even when accounting storage is unavailable.
export function recordRealUserDays(sql: SqlLike, ids: readonly string[], now = Date.now(),
  isAlreadyKnown?: (uid: string, day: number) => boolean,
  markKnown?: (uid: string, day: number) => void, countries: ReadonlyMap<string, string | null> = new Map()): number {
  if (!ids.length) return 0;
  const day = dayNumber(now);
  let inserted = 0;
  for (const uid of new Set(ids)) {
    if (!/^[a-f0-9]{16}$/.test(uid)) continue;
    if (isAlreadyKnown?.(uid, day)) continue;
    const existing = sql.exec('SELECT 1 AS present FROM real_user_days WHERE day = ? AND uid = ?', day, uid).toArray();
    if (existing.length) { markKnown?.(uid, day); continue; }
    const usedRow = sql.exec('SELECT users FROM real_daily_budget WHERE day = ?', day).toArray()[0];
    const used = typeof usedRow?.users === 'number' ? usedRow.users : 0;
    if (used >= MAX_DAILY_USERS) break; // Silently stop telemetry, never user service.
    sql.exec('INSERT OR IGNORE INTO real_user_days (day, uid, country) VALUES (?, ?, ?)', day, uid, normalizeCountry(countries.get(uid)));
    sql.exec(`INSERT INTO real_daily_budget(day, users) VALUES (?, 1)
      ON CONFLICT(day) DO UPDATE SET users = users + 1`, day);
    markKnown?.(uid, day);
    inserted++;
  }
  return inserted;
}

export function pruneRealUsers(sql: SqlLike, now = Date.now()): void {
  const cutoff = dayNumber(now) - RETENTION_DAYS + 1;
  // Limit maintenance writes per run, including after a long idle period.
  sql.exec(`DELETE FROM real_user_days WHERE (day, uid) IN
    (SELECT day, uid FROM real_user_days WHERE day < ? ORDER BY day LIMIT 600)`, cutoff);
  sql.exec('DELETE FROM real_daily_budget WHERE day < ?', dayNumber(now) - 7);
}

export function buildRealUserReport(sql: SqlLike, range: number, now = Date.now()) {
  const today = dayNumber(now);
  const first = today - range + 1;
  const previous = first - range;
  // One bounded indexed read supplies every report metric.
  const historyFloor = today - RETENTION_DAYS + 1;
  const history = sql.exec('SELECT day, uid, country FROM real_user_days WHERE day >= ? AND day <= ? ORDER BY day', historyFloor, today).toArray();
  const unique = (start: number, end: number) => new Set(history.filter(r => Number(r.day) >= start && Number(r.day) <= end).map(r => r.uid)).size;
  const currentUsers = unique(first, today);
  const previousUsers = previous >= historyFloor ? unique(previous, first - 1) : null;
  const firstSeen = new Map<string, number>();
  const firstDays = new Map<number, number>();
  const userCountries = new Map<string, string | null>();
  for (const row of history) {
    const uid = String(row.uid), day = Number(row.day);
    if (!firstSeen.has(uid)) firstSeen.set(uid, day);
    if (day < first) continue;
    firstDays.set(day, (firstDays.get(day) ?? 0) + 1);
    const country = normalizeCountry(row.country);
    if (!userCountries.has(uid) || country) userCountries.set(uid, country);
  }
  const newByDay = new Map<number, number>();
  for (const day of firstSeen.values()) {
    if (day >= first) newByDay.set(day, (newByDay.get(day) ?? 0) + 1);
  }
  const newUsers = [...newByDay.values()].reduce((total, count) => total + count, 0);
  const counts = new Map<string, number>();
  let unknownUsers = 0;
  for (const country of userCountries.values()) {
    if (country) counts.set(country, (counts.get(country) ?? 0) + 1);
    else unknownUsers++;
  }
  const countries = {
    items: [...counts].map(([code, users]) => ({ code, users })).sort((a,b) => b.users-a.users || a.code.localeCompare(b.code)),
    unknownUsers,
    source: 'Approximate ChatGPT user location; latest known country per user in the selected period. Historical countries before this update are unavailable.'
  };
  const daily = Array.from({ length: range }, (_, i) => ({
    date: dayString(first + i), users: firstDays.get(first + i) ?? 0, newUsers: newByDay.get(first + i) ?? 0,
  }));
  const budget = sql.exec('SELECT users FROM real_daily_budget WHERE day = ?', today).toArray()[0];
  return {
    generatedAt: new Date(now).toISOString(),
    range,
    timezone: 'UTC',
    privacy: 'Verified OpenAI egress and identified ChatGPT tool calls; one hashed user-day and optional country only',
    retentionDays: RETENTION_DAYS,
    trackingLimit: MAX_DAILY_USERS,
    trackingLimitReached: typeof budget?.users === 'number' && budget.users >= MAX_DAILY_USERS,
    summary: {
      currentUsers,
      previousUsers,
      newUsers,
      returningUsers: Math.max(0, currentUsers - newUsers),
      dau: unique(today, today),
      wau: unique(today - 6, today),
      mau: unique(today - 29, today),
      userDays: daily.reduce((total, x) => total + x.users, 0),
    },
    countries,
    daily,
  };
}
