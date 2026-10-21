import {
  buildRealUserReport, migrateRealUsers, parseRealReportRange, pruneRealUsers,
  recordRealUserDays, normalizeCountry, UTC_DAY_MS, type RealUserRequest,
} from './real-users.ts';
import type { SqlLike } from './store.ts';

interface DurableState {
  storage: { sql: SqlLike };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

const MAX_BATCH = 4;
const MAX_BODY = 512;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' };

// Kept for older clients that import the constant. Real reports refresh at most once per UTC day.
export const REPORT_CACHE_TTL_MS = UTC_DAY_MS;

export class AnalyticsDO {
  private readonly sql: SqlLike;
  private readonly seen = new Set<string>();
  private seenDay = -1;
  private readonly memoryCache = new Map<number, { day: number; payload: string }>();

  constructor(state: DurableState, _env?: unknown) {
    this.sql = state.storage.sql;
    // Migrate compact user-days and remove obsolete detailed event logs once.
    void state.blockConcurrencyWhile(async () => migrateRealUsers(this.sql));
  }

  private report(queryParams: URLSearchParams): Response {
    const range = parseRealReportRange(queryParams);
    const now = Date.now();
    const day = Math.floor(now / UTC_DAY_MS);
    const inMemory = this.memoryCache.get(range);
    if (inMemory?.day === day) return new Response(inMemory.payload, { headers: JSON_HEADERS });

    const cache = this.sql.exec('SELECT day, payload FROM real_report_cache WHERE range = ?', range).toArray()[0];
    let payload = typeof cache?.payload === 'string' && cache.day === day ? cache.payload : '';
    if (!payload) {
      // No more than one full report build per range per UTC day; four ranges
      // total and a hard 500-user-day insertion limit bound scanning.
      const report = buildRealUserReport(this.sql, range, now);
      payload = JSON.stringify(report);
      this.sql.exec(
        `INSERT INTO real_report_cache (range, day, cached_at, payload) VALUES (?, ?, ?, ?)
         ON CONFLICT(range) DO UPDATE SET day = excluded.day, cached_at = excluded.cached_at,
         payload = excluded.payload`, range, day, now, payload,
      );
      // Bounded cleanup; avoid a large DELETE and never run this per request.
      pruneRealUsers(this.sql, now);
    }
    this.memoryCache.set(range, { day, payload });
    return new Response(payload, { headers: JSON_HEADERS });
  }

  async fetch(request: RealUserRequest): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/record') {
      const body = await request.text();
      if (body.length > MAX_BODY) return new Response(null, { status: 413 });
      let raw: unknown;
      try { raw = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
      if (!Array.isArray(raw)) return new Response(null, { status: 400 });
      const countries = new Map<string, string | null>();
      for (const entry of raw.slice(0, MAX_BATCH)) {
        const uid = typeof entry === 'string' ? entry : entry?.uid;
        if (typeof uid === 'string' && /^[0-9a-f]{16}$/.test(uid))
          countries.set(uid, normalizeCountry(typeof entry === 'object' && entry ? entry.country : null));
      }
      const ids = [...countries.keys()];
      const day = Math.floor(Date.now() / UTC_DAY_MS);
      if (day !== this.seenDay) { this.seenDay = day; this.seen.clear(); }
      recordRealUserDays(this.sql, ids, Date.now(),
        (uid) => this.seen.has(uid), (uid) => this.seen.add(uid), countries);
      return new Response(null, { status: 204 });
    }
    if (request.method === 'GET' && url.pathname === '/report') return this.report(url.searchParams);
    return new Response(null, { status: 404 });
  }
}
