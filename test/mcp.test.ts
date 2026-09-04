import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { PrayerStorage } from '../src/storage/kv-store.ts';

describe('MCP Protocol & Cloudflare Worker Endpoint Suite', () => {
  it('GET /health returns healthy status and service metadata', async () => {
    const req = new Request('http://localhost/health', { method: 'GET' });
    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.status, 'healthy');
    assert.equal(data.service, 'muslim-prayer-reminder-mcp');
  });

  it('GET /api/status returns valid prayer status payload', async () => {
    const req = new Request('http://localhost/api/status?lat=24.71&lng=46.68&timezone=Asia/Riyadh', {
      method: 'GET',
    });
    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(typeof data.reminderDue, 'boolean');
    assert.ok(data.nextPrayer);
    assert.ok(data.nextPrayerAtUtc);
    assert.equal(data.timezone, 'Asia/Riyadh');
    assert.equal(data.locationSource, 'explicit_request');
  });

  it('GET /api/timetable returns full 6 prayer times', async () => {
    const req = new Request('http://localhost/api/timetable', {
      method: 'GET',
      headers: {
        'X-User-Coordinates': '21.42, 39.83',
        'X-User-Timezone': 'Asia/Riyadh',
      },
    });
    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(data.timesUtc.fajr);
    assert.ok(data.timesUtc.sunrise);
    assert.ok(data.timesUtc.dhuhr);
    assert.ok(data.timesUtc.asr);
    assert.ok(data.timesUtc.maghrib);
    assert.ok(data.timesUtc.isha);
    assert.ok(data.timesLocal.Fajr);
  });

  it('POST /api/preferences stores and updates user preferences', async () => {
    const updatePayload = {
      userId: 'user_mcp_test',
      locationMode: 'fixed',
      fixedCity: 'Dubai',
      calculationMethod: 'Dubai',
      locale: 'ar',
      reminderMode: 'exact_window',
      exactWindowMinutes: 15,
    };

    const req = new Request('http://localhost/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });

    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.preferences.fixedCity, 'Dubai');
    assert.equal(body.preferences.locale, 'ar');
  });

  it('POST /mcp handles JSON-RPC tools/list', async () => {
    const rpcPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };

    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(rpcPayload),
    });

    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const rpcRes = (await res.json()) as any;
    assert.equal(rpcRes.jsonrpc, '2.0');
    assert.equal(rpcRes.id, 1);
    assert.ok(Array.isArray(rpcRes.result.tools));

    const toolNames = rpcRes.result.tools.map((t: any) => t.name);
    assert.ok(toolNames.includes('get_prayer_status'));
    assert.ok(toolNames.includes('get_today_prayer_times'));
    assert.ok(toolNames.includes('get_next_prayer'));
    assert.ok(toolNames.includes('configure_prayer_preferences'));
    assert.ok(toolNames.includes('get_prayer_preferences'));
  });

  it('POST /mcp handles JSON-RPC tools/call for get_prayer_status', async () => {
    const rpcCall = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_prayer_status',
        arguments: {
          latitude: 24.71,
          longitude: 46.68,
          timezone: 'Asia/Riyadh',
        },
      },
    };

    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(rpcCall),
    });

    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const rpcRes = (await res.json()) as any;
    assert.equal(rpcRes.id, 2);
    assert.ok(rpcRes.result.content);
    assert.equal(rpcRes.result.content[0].type, 'text');

    const statusPayload = JSON.parse(rpcRes.result.content[0].text);
    assert.equal(typeof statusPayload.reminderDue, 'boolean');
    assert.ok(statusPayload.nextPrayer);
  });

  it('POST /mcp auto-resolves Palestinian Awqaf calculation method and offsets for Gaza coordinates', async () => {
    const rpcCall = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_today_prayer_times',
        arguments: {
          latitude: 31.50,
          longitude: 34.46,
          date: '2026-09-04',
        },
      },
    };

    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(rpcCall),
    });

    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const rpcRes = (await res.json()) as any;
    assert.equal(rpcRes.id, 3);
    const schedule = JSON.parse(rpcRes.result.content[0].text);

    assert.equal(schedule.calculationMethod, 'Egyptian');
    assert.equal(schedule.timesLocal.Fajr, '04:49');
    assert.equal(schedule.timesLocal.Sunrise, '06:20');
    assert.equal(schedule.timesLocal.Dhuhr, '12:41');
    assert.equal(schedule.timesLocal.Asr, '16:15');
    assert.equal(schedule.timesLocal.Maghrib, '19:05');
    assert.equal(schedule.timesLocal.Isha, '20:23');
    assert.ok(schedule.authorityDescription.includes('Palestinian Ministry of Awqaf'));
    assert.ok(schedule.authorityNotice);
    assert.equal(schedule.authorityNotice.method, 'Egyptian');
    assert.ok(schedule.authorityNotice.selectionReason.includes('Palestine'));
    assert.ok(schedule.authorityNotice.requiredDisplayInstruction.includes('MANDATORY'));
  });

  it('GET /.well-known/mcp/server-card.json returns registry discovery card', async () => {
    const req = new Request('http://localhost/.well-known/mcp/server-card.json', { method: 'GET' });
    const res = await worker.fetch(req, {});
    assert.equal(res.status, 200);
    const card = (await res.json()) as any;
    assert.equal(card.serverInfo.name, 'muslim-prayer-reminder');
    assert.ok(Array.isArray(card.tools));
    assert.equal(card.tools.length, 5);
  });
});
