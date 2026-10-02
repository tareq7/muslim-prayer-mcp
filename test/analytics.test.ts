import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { MemoryKV } from '../src/storage/kv-store.ts';
import { trackAnalytics, getAnalyticsReport, renderAnalyticsHtml } from '../src/analytics/tracker.ts';

describe('Historical analytics bounds', () => {
  it('rejects oversized historical records before parsing them and keeps tracking fail-open', async () => {
    const kv = new MemoryKV();
    await kv.put('analytics:summary', JSON.stringify({ tools: { ['x'.repeat(524288)]: 1 } }));
    await assert.rejects(getAnalyticsReport(kv), /bounded size/);
    assert.equal(await trackAnalytics(kv, { tool: 'get_next_prayer' }), 'failed');
  });
});

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

describe('Analytics boundary regressions', () => {
  it('rejects unsupported tools and malformed identities before writes', async () => {
    const kv = new MemoryKV();
    for (const event of [ { tool: '<img src=x onerror=alert(1)>' }, { tool: 'get_prayer_status', subject: {} }, { tool: 'get_prayer_status', session: 'a'.repeat(2049) }, {tool: 'get_prayer_status', subject: '\u00e9'.repeat(1025)}, {tool: 42} ]) {
      assert.equal(await trackAnalytics(kv, event as any), 'rejected');
    }
    assert.equal(await kv.get('analytics:summary'), null);
  });

  it('retains all concurrent calls within a shared KV instance', async () => {
    class DelayedKV extends MemoryKV {
      override async get(key: string) {
        const value = await super.get(key);
        await new Promise(resolve => setTimeout(resolve, 2));
        return value;
      }
    }
    const kv = new DelayedKV();
    await Promise.all(Array.from({length: 20}, () => trackAnalytics(kv, { tool: 'get_prayer_status', subject: 'same', session: 'same' })));
    const report = await getAnalyticsReport(kv);
    assert.equal(report.metrics.totalCalls, 20);
    assert.equal(report.metrics.totalActiveUsers, 1);
    assert.equal(report.metrics.totalSessions, 1);
    assert.equal(report.metrics.toolUsage.get_prayer_status, 20);
  });

  it('normalizes historical hostile counters and escapes dashboard strings', async () => {
    const kv = new MemoryKV();
    await kv.put('analytics:summary', JSON.stringify({ totalCalls: -2, totalUniqueUsers: 'bad', tools: { '<img src=x onerror=alert(1)>': 1, get_prayer_status: -3 }, countries: { '<svg/onload=alert(1)>': 1, SA: 2 }, lastRecordedAt: '<script>alert(1)</script>' }));
    const report = await getAnalyticsReport(kv);
    assert.equal(report.metrics.totalCalls, 0);
    assert.deepEqual(report.metrics.toolUsage, {});
    assert.deepEqual(report.metrics.countryDistribution, {SA: 2});
    const html = renderAnalyticsHtml({ ...report, lastUpdated: '<script>alert(1)</script>', metrics: { ...report.metrics, recentTrend: [{date: '12345<img src=x>', calls: 1, activeUsers: 1}] } });
    assert.ok(!html.includes('<img src=x>'));
  });

  it('does not create identity keys beyond daily cardinality caps', async () => {
    class WriteTrackingKV extends MemoryKV {
      writes: string[] = [];
      override async put(key: string, value: string, options?: {expirationTtl?: number}) { this.writes.push(key); await super.put(key, value, options); }
    }
    const kv = new WriteTrackingKV();
    const today = new Date().toISOString().slice(0, 10);
    await kv.put(`analytics:day:${today}`, JSON.stringify({date: today, calls: 5000, tools: {}, countries: {}, users: Array.from({length: 5000}, (_,i) => i.toString(16).padStart(16, '0')), sessions: Array.from({length: 5000}, (_,i) => i.toString(16).padStart(16, '0'))}));
    await trackAnalytics(kv, {tool: 'get_prayer_status', subject: 'overflow', session: 'overflow'});
    const report = await getAnalyticsReport(kv);
    assert.equal(report.metrics.totalActiveUsers, 5000);
    assert.equal(report.metrics.totalSessions, 0);
    assert.ok(kv.writes.every(key => !key.startsWith('analytics:user:') && !key.startsWith('analytics:session:')));
  });

  it('counts anonymous legitimate calls and exposes nonblocking write failure', async () => {
    class FailingKV extends MemoryKV {
      fail = true;
      override async put(key: string, value: string, options?: {expirationTtl?: number}) {
        if (this.fail) throw new Error('unavailable');
        await super.put(key, value, options);
      }
    }
    const kv = new FailingKV();
    assert.equal(await trackAnalytics(kv, {tool: 'get_prayer_status'}), 'failed');
    kv.fail = false;
    assert.equal(await trackAnalytics(kv, {tool: 'get_prayer_status'}), 'recorded');
    const report = await getAnalyticsReport(kv);
    assert.equal(report.metrics.totalCalls, 1);
    assert.equal(report.metrics.totalActiveUsers, 0);
    assert.equal(report.countAccuracy, 'approximate');
  });
});
