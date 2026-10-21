import { buildReport, migrate, parseReportQuery, recordEvents, validateEvent, type AnalyticsEvent, type SqlLike } from './store.ts';

interface DurableState { storage: { sql: SqlLike }; blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> }

const MAX_BATCH = 50;
const MAX_BODY = 32_768;
// Building the dashboard runs dozens of large SQLite aggregate queries.
// Persist cached reports so ordinary refreshes do not repeatedly scan events,
// including after Durable Object eviction or deployment.
export const REPORT_CACHE_TTL_MS = 60 * 60_000;
const MAX_REPORT_CACHE_ENTRIES = 24;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export class AnalyticsDO {
  private readonly sql: SqlLike;
  private readonly reportCache = new Map<string, { cachedAt: number; payload: string }>();

  constructor(state: DurableState, _env?: unknown) {
    this.sql = state.storage.sql;
    void state.blockConcurrencyWhile(async () => migrate(this.sql));
  }

  private report(queryParams: URLSearchParams): Response {
    // Parse before creating a cache key; unrecognized params cannot create new entries.
    const query = parseReportQuery(queryParams);
    const key = `${query.range}:${query.tz}:${query.segment}`;
    const now = Date.now();
    const memory = this.reportCache.get(key);
    if (memory && memory.cachedAt <= now && now - memory.cachedAt < REPORT_CACHE_TTL_MS) {
      return new Response(memory.payload, { headers: JSON_HEADERS });
    }

    // The SQLite primary-key lookup is inexpensive compared with the report
    // scans and survives restarts; cached_at is intentionally not updated on reads.
    const cached = this.sql.exec('SELECT cached_at, payload FROM report_cache WHERE cache_key = ?', key).toArray()[0];
    let cachedAt = typeof cached?.cached_at === 'number' ? cached.cached_at : -1;
    let payload = typeof cached?.payload === 'string' ? cached.payload : '';
    if (cachedAt < 0 || cachedAt > now || now - cachedAt >= REPORT_CACHE_TTL_MS || !payload) {
      payload = JSON.stringify(buildReport(this.sql, query, now));
      cachedAt = now;
      this.sql.exec(
        'INSERT INTO report_cache (cache_key, cached_at, payload) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET cached_at = excluded.cached_at, payload = excluded.payload',
        key, cachedAt, payload,
      );
      // Bound storage even when clients vary the requested timezone and range.
      this.sql.exec(
        'DELETE FROM report_cache WHERE cache_key IN (SELECT cache_key FROM report_cache ORDER BY cached_at DESC LIMIT -1 OFFSET ?)',
        MAX_REPORT_CACHE_ENTRIES,
      );
    }
    this.reportCache.set(key, { cachedAt, payload });
    if (this.reportCache.size > MAX_REPORT_CACHE_ENTRIES) {
      const oldest = this.reportCache.keys().next().value;
      if (oldest !== undefined) this.reportCache.delete(oldest);
    }
    return new Response(payload, { headers: JSON_HEADERS });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/record') {
      const text = await request.text();
      if (text.length > MAX_BODY) return new Response(null, { status: 413 });
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
      if (!Array.isArray(raw)) return new Response(null, { status: 400 });
      const events = raw.slice(0, MAX_BATCH).map(e => validateEvent(e)).filter((e): e is AnalyticsEvent => e !== null);
      recordEvents(this.sql, events);
      return new Response(null, { status: 204 });
    }
    if (request.method === 'GET' && url.pathname === '/report') {
      return this.report(url.searchParams);
    }
    return new Response(null, { status: 404 });
  }
}
