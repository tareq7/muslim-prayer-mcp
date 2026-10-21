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
export async function realUserIds(requestText: string, request: RealUserRequest): Promise<string[]> {
  if (request.cf?.botManagement?.verifiedBot) return [];
  let body: unknown;
  try { body = JSON.parse(requestText); } catch { return []; }
  const items = Array.isArray(body) ? body.slice(0, 20) : [body];
  const subjects = new Set<string>();
  for (const item of items) {
    if (!isRecord(item) || item.method !== 'tools/call' || !('id' in item)) continue;
    const params = isRecord(item.params) ? item.params : {};
    if (!(REGISTERED_TOOL_NAMES as readonly unknown[]).includes(params.name)) continue;
    const meta = isRecord(params._meta) ? params._meta : {};
    const subject = meta['openai/subject'];
    if (typeof subject !== 'string' || subject.length < 1 || subject.length > 2048 || !subject.trim()) continue;
    subjects.add(subject);
  }
  if (!subjects.size) return [];
  await refreshEgress(fetch);
  if (!isOpenAIEgress(request.headers.get('CF-Connecting-IP'))) return [];
  return Promise.all([...subjects].slice(0, 4).map(hashId));
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
  markKnown?: (uid: string, day: number) => void): number {
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
    sql.exec('INSERT OR IGNORE INTO real_user_days (day, uid) VALUES (?, ?)', day, uid);
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

const scalar = (sql: SqlLike, query: string, ...bindings: unknown[]): number => {
  const value = sql.exec(query, ...bindings).toArray()[0]?.n;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export function buildRealUserReport(sql: SqlLike, range: number, now = Date.now()) {
  const today = dayNumber(now);
  const first = today - range + 1;
  const previous = first - range;
  const unique = (start: number, end: number) => scalar(sql,
    'SELECT COUNT(DISTINCT uid) AS n FROM real_user_days WHERE day >= ? AND day <= ?', start, end);
  const currentUsers = unique(first, today);
  const previousUsers = previous >= today - RETENTION_DAYS + 1 ? unique(previous, first - 1) : null;
  const historyFloor = today - RETENTION_DAYS + 1;
  // A first appearance is within the retention window, not necessarily lifetime first use.
  const newUsers = scalar(sql, `SELECT COUNT(*) AS n FROM (
    SELECT uid, MIN(day) AS first_day FROM real_user_days WHERE day >= ? AND day <= ?
    GROUP BY uid HAVING first_day >= ?)`, historyFloor, today, first);
  const firstDays = new Map<number, number>();
  for (const row of sql.exec(`SELECT day, COUNT(*) AS n FROM real_user_days
    WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day`, first, today).toArray()) {
    if (typeof row.day === 'number' && typeof row.n === 'number') firstDays.set(row.day, row.n);
  }
  const daily = Array.from({ length: range }, (_, i) => ({
    date: dayString(first + i), users: firstDays.get(first + i) ?? 0,
  }));
  const budget = sql.exec('SELECT users FROM real_daily_budget WHERE day = ?', today).toArray()[0];
  return {
    generatedAt: new Date(now).toISOString(),
    range,
    timezone: 'UTC',
    privacy: 'Verified OpenAI egress and identified ChatGPT tool calls; one hashed user-day only',
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
    daily,
  };
}
