import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { MemoryKV } from '../src/storage/kv-store.ts';
import { trackAnalytics, getAnalyticsReport, renderAnalyticsHtml } from '../src/analytics/tracker.ts';

describe('Edge Analytics & OpenAI Subject Tracking Suite', () => {
  it('accurately tracks unique users and active days without storing raw subject identifiers', async () => {
    const kv = new MemoryKV();

    // Turn 1: User 1 invokes get_prayer_status
    await trackAnalytics(kv, {
      tool: 'get_prayer_status',
      subject: 'user_openai_alpha_123',
      session: 'session_chat_1',
      country: 'SA',
    });

    // Turn 2: User 1 invokes get_today_prayer_times (same user, same session)
    await trackAnalytics(kv, {
      tool: 'get_today_prayer_times',
      subject: 'user_openai_alpha_123',
      session: 'session_chat_1',
      country: 'SA',
    });

    // Turn 3: User 2 invokes get_next_prayer (different user, new session)
    await trackAnalytics(kv, {
      tool: 'get_next_prayer',
      subject: 'user_openai_beta_456',
      session: 'session_chat_2',
      country: 'AE',
    });

    const report = await getAnalyticsReport(kv);

    assert.equal(report.status, 'active');
    assert.equal(report.metrics.totalCalls, 3);
    assert.equal(report.metrics.totalActiveUsers, 2);
    assert.equal(report.metrics.totalSessions, 2);
    assert.equal(report.metrics.dau, 2);
    assert.equal(report.metrics.wau, 2);
    assert.equal(report.metrics.mau, 2);
    assert.equal(report.metrics.callsPerUser, 1.5);
    assert.equal(report.metrics.toolUsage['get_prayer_status'], 1);
    assert.equal(report.metrics.toolUsage['get_today_prayer_times'], 1);
    assert.equal(report.metrics.toolUsage['get_next_prayer'], 1);
    assert.equal(report.metrics.countryDistribution['SA'], 2);
    assert.equal(report.metrics.countryDistribution['AE'], 1);

    // Verify raw user IDs are NEVER stored in plaintext
    const rawSummary = await kv.get('analytics:summary');
    assert.ok(rawSummary);
    assert.ok(!rawSummary.includes('user_openai_alpha_123'));
    assert.ok(!rawSummary.includes('user_openai_beta_456'));
  });

  it('GET /api/analytics returns valid JSON report over HTTP', async () => {
    const kv = new MemoryKV();
    await trackAnalytics(kv, {
      tool: 'get_prayer_status',
      subject: 'user_test_999',
      session: 'session_test',
      country: 'US',
    });

    const req = new Request('http://localhost/api/analytics', { method: 'GET' });
    const res = await worker.fetch(req, { PRAYER_KV: kv });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');

    const data = (await res.json()) as any;
    assert.equal(data.status, 'active');
    assert.equal(data.metrics.totalCalls, 1);
    assert.equal(data.metrics.totalActiveUsers, 1);
    assert.equal(data.metrics.toolUsage['get_prayer_status'], 1);
  });

  it('GET /analytics returns styled HTML dashboard when requested by browser', async () => {
    const kv = new MemoryKV();
    const req = new Request('http://localhost/analytics', {
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    const res = await worker.fetch(req, { PRAYER_KV: kv });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');

    const html = await res.text();
    assert.ok(html.includes('Muslim Prayer Reminder'));
    assert.ok(html.includes('Live Edge Analytics'));
    assert.ok(html.includes('Daily Active (DAU)'));
    assert.ok(html.includes('Weekly Active (WAU)'));
    assert.ok(html.includes('Monthly Active (MAU)'));
  });

  it('POST /mcp with OpenAI _meta records telemetry seamlessly without blocking', async () => {
    const kv = new MemoryKV();
    const rpcCall = {
      jsonrpc: '2.0',
      id: 'openai-call-1',
      method: 'tools/call',
      params: {
        name: 'get_prayer_status',
        arguments: {
          latitude: 24.71,
          longitude: 46.68,
          timezone: 'Asia/Riyadh',
        },
        _meta: {
          'openai/subject': 'sub_user_test_edge_42',
          'openai/session': 'sess_chat_turn_1',
        },
      },
    };

    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'CF-IPCountry': 'SA',
      },
      body: JSON.stringify(rpcCall),
    });

    const res = await worker.fetch(req, { PRAYER_KV: kv });
    assert.equal(res.status, 200);

    // Yield short tick for background analytics write
    await new Promise((resolve) => setTimeout(resolve, 50));

    const report = await getAnalyticsReport(kv);
    assert.equal(report.metrics.totalCalls, 1);
    assert.equal(report.metrics.totalActiveUsers, 1);
    assert.equal(report.metrics.toolUsage['get_prayer_status'], 1);
    assert.equal(report.metrics.countryDistribution['SA'], 1);
  });
});
