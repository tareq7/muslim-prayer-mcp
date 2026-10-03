import { buildReport, migrate, parseReportQuery, recordEvents, validateEvent, type AnalyticsEvent, type SqlLike } from './store.ts';

interface DurableState { storage: { sql: SqlLike }; blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> }

const MAX_BATCH = 50;
const MAX_BODY = 32_768;

export class AnalyticsDO {
  private readonly sql: SqlLike;

  constructor(state: DurableState, _env?: unknown) {
    this.sql = state.storage.sql;
    void state.blockConcurrencyWhile(async () => migrate(this.sql));
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
      return Response.json(buildReport(this.sql, parseReportQuery(url.searchParams)));
    }
    return new Response(null, { status: 404 });
  }
}
