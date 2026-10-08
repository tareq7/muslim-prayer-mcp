import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../src/index.ts';
import { MemoryKV, PrayerStorage } from '../src/storage/kv-store.ts';
import { PrayerReminderMiddleware } from '../src/middleware/host-connector.ts';

async function rpc(env: Env, name: string, args: Record<string, unknown>, headers: Record<string, string> = {}) {
  const response = await worker.fetch(new Request('http://localhost/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), env);
  assert.equal(response.status, 200);
  return (await response.json() as any).result;
}

async function save(env: Env, body: unknown) {
  return worker.fetch(new Request('http://localhost/api/preferences', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }), env);
}

describe('Review regressions', () => {
  it('keeps geographic defaults when saving only notification preferences', async () => {
    for (const viaMcp of [false, true]) {
      const env = { PRAYER_KV: new MemoryKV() };
      if (viaMcp) await rpc(env, 'configure_prayer_preferences', { userId: 'locale-user', locale: 'ar' });
      else assert.equal((await save(env, { userId: 'locale-user', locale: 'ar' })).status, 200);
      const result = await rpc(env, 'get_today_prayer_times', { userId: 'locale-user', latitude: 51.5, longitude: -0.12, timezone: 'Europe/London' });
      assert.equal(result.structuredContent.calculationMethod, 'MuslimWorldLeague');
    }
  });

  it('does not delete legitimate default_user preferences during read requests', async () => {
    const kv = new MemoryKV();
    const storage = new PrayerStorage(kv);
    await storage.saveUserPreferences({ userId: 'default_user', locationMode: 'auto_travel', calculationMethod: 'Egyptian' });
    await worker.fetch(new Request('http://localhost/api/timetable'), { PRAYER_KV: kv });
    assert.equal((await storage.getUserPreferences('default_user'))?.calculationMethod, 'Egyptian');
  });

  it('validates REST preferences before any write', async () => {
    const env = { PRAYER_KV: new MemoryKV() };
    for (const body of [null, { userId: 5 }, { userId: 'bad', locale: 'unknown' }, { userId: 'bad', fixedCoordinates: { latitude: 100, longitude: 20 } }, { userId: 'bad', timezone: 'Invalid/Zone' }, { userId: 'bad', exactWindowMinutes: -1 }]) {
      assert.equal((await save(env, body)).status, 400);
    }
    assert.equal(await env.PRAYER_KV.get('pref:bad'), null);
  });

  it('rounds fixed coordinates before storage and excludes them and identifiers from tool output', async () => {
    const kv = new MemoryKV();
    const result = await rpc({ PRAYER_KV: kv }, 'configure_prayer_preferences', { userId: 'fixed-user', locationMode: 'fixed', fixedCoordinates: { latitude: 24.713678, longitude: 46.675321 }, timezone: 'Asia/Riyadh' });
    const stored = await kv.get('pref:fixed-user', 'json');
    assert.deepEqual(stored.fixedCoordinates, { latitude: 24.71, longitude: 46.68 });
    for (const output of [result, await rpc({ PRAYER_KV: kv }, 'get_prayer_preferences', { userId: 'fixed-user' })]) {
      assert.equal(output.structuredContent.fixedCoordinates, undefined);
      assert.equal(output.structuredContent.userId, undefined);
      assert.equal(JSON.parse(output.content[0].text).fixedCoordinates, undefined);
    }
  });

  it('replaces the alternate fixed location when changing between city and coordinates', async () => {
    const env = { PRAYER_KV: new MemoryKV() };
    await save(env, { userId: 'traveler', locationMode: 'fixed', fixedCoordinates: { latitude: 35.67, longitude: 139.65 }, timezone: 'Asia/Tokyo' });
    await rpc(env, 'configure_prayer_preferences', { userId: 'traveler', fixedCity: 'London' });
    const schedule = await rpc(env, 'get_today_prayer_times', { userId: 'traveler' });
    assert.equal(schedule.structuredContent.timezone, 'Europe/London');
    assert.equal(schedule.structuredContent.calculationMethod, 'MuslimWorldLeague');
    const storage = new PrayerStorage(env.PRAYER_KV);
    assert.equal((await storage.getUserPreferences('traveler'))?.fixedCoordinates, undefined);
    await save(env, { userId: 'traveler', fixedCoordinates: { latitude: 24.71, longitude: 46.68 }, timezone: 'Asia/Riyadh' });
    assert.equal((await storage.getUserPreferences('traveler'))?.fixedCity, undefined);
  });

  it('rejects unsupported cities and prototype keys rather than saving an unusable fixed location', async () => {
    for (const fixedCity of ['constructor', 'Unknown City']) {
      assert.equal((await save({}, { userId: 'unknown-city', locationMode: 'fixed', fixedCity })).status, 400);
      assert.equal((await rpc({}, 'configure_prayer_preferences', { userId: 'unknown-city', fixedCity })).isError, true);
    }
  });

  it('reclaims expired in-memory entries during later writes', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T12:00:00Z') });
    const kv = new MemoryKV();
    await kv.put('expired-daily-key', 'old', { expirationTtl: 60 });
    t.mock.timers.tick(61000);
    const deletes = t.mock.method(Map.prototype, 'delete');
    await kv.put('new-daily-key', 'new', { expirationTtl: 60 });
    assert.ok(deletes.mock.calls.some((call) => call.arguments[0] === 'expired-daily-key'));
    assert.equal(await kv.get('new-daily-key'), 'new');
  });

  it('does not expose storage exception text through MCP', async () => {
    const kv = new MemoryKV();
    kv.get = async () => { throw new Error('private backend details'); };
    const result = await rpc({ PRAYER_KV: kv }, 'get_prayer_preferences', { userId: 'failure' });
    assert.equal(result.isError, true);
    assert.ok(!JSON.stringify(result).includes('private backend'));
    assert.ok(result.content[0].text.includes('storage is unavailable'));
  });

  it('REST calculation responses exclude coordinates and internal keys', async () => {
    const env = { PRAYER_KV: new MemoryKV() };
    for (const path of ['/api/status?city=Makkah', '/api/timetable?city=Makkah']) {
      const response = await worker.fetch(new Request('http://localhost' + path), env);
      const body = await response.json() as any;
      assert.equal(body.coordinates, undefined);
      assert.equal(body.locationSource, undefined);
      assert.equal(body.dedupeKey, undefined);
    }
  });

  it('forwards host location to every HTTP MCP calculation tool', async () => {
    for (const name of ['get_prayer_status', 'get_today_prayer_times', 'get_next_prayer']) {
      const result = await rpc({}, name, {}, { 'X-User-Coordinates': '51.5,-0.12', 'X-User-Timezone': 'Europe/London' });
      assert.equal(result.structuredContent.timezone, 'Europe/London');
      assert.equal(result.structuredContent.calculationMethod, 'MuslimWorldLeague');
    }
  });

  it('honors disabled reminders on both transports', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T12:00:00Z') });
    const env = { PRAYER_KV: new MemoryKV() };
    await save(env, { userId: 'disabled-user', enabled: false, reminderMode: 'persistent' });
    const response = await worker.fetch(new Request('http://localhost/api/status?city=Makkah&userId=disabled-user'), env);
    assert.equal((await response.json() as any).reminderDue, false);
    const result = await rpc(env, 'get_prayer_status', { city: 'Makkah', userId: 'disabled-user' });
    assert.equal(result.structuredContent.reminderDue, false);
  });

  it('honors Worker reminder defaults consistently on REST and MCP', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T12:00:00Z') });
    const env = { PRAYER_KV: new MemoryKV(), DEFAULT_REMINDER_MODE: 'persistent', DEFAULT_LOCALE: 'ar' };
    await save(env, { userId: 'env-user', madhab: 'Hanafi' });
    for (let i = 0; i < 2; i++) {
      const rest = await worker.fetch(new Request('http://localhost/api/status?city=Makkah&userId=env-user'), env);
      const status = await rest.json() as any;
      assert.equal(status.reminderDue, true);
      assert.match(status.reminderText, /حان وقت/);
      const result = await rpc(env, 'get_prayer_status', { city: 'Makkah', userId: 'env-user' });
      assert.equal(result.structuredContent.reminderDue, true);
      assert.match(result.structuredContent.reminderText, /حان وقت/);
    }
    assert.equal((await worker.fetch(new Request('http://localhost/api/status?city=Makkah'), { DEFAULT_EXACT_WINDOW_MINUTES: 'invalid' })).status, 500);
  });

  it('does not share anonymous deduplication state or persist it', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T12:00:00Z') });
    const kv = new MemoryKV();
    const put = t.mock.method(kv, 'put');
    for (let i = 0; i < 2; i++) {
      assert.equal((await rpc({ PRAYER_KV: kv }, 'get_prayer_status', { city: 'Makkah' })).structuredContent.reminderDue, true);
    }
    assert.equal(put.mock.callCount(), 0);
  });

  it('retains user deduplication until the prayer window ends', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T19:00:00Z') });
    const env = { PRAYER_KV: new MemoryKV() };
    assert.equal((await rpc(env, 'get_prayer_status', { city: 'Makkah', userId: 'night-user' })).structuredContent.reminderDue, true);
    t.mock.timers.tick(3 * 60 * 60 * 1000);
    assert.equal((await rpc(env, 'get_prayer_status', { city: 'Makkah', userId: 'night-user' })).structuredContent.reminderDue, false);
  });

  it('serializes concurrent reminders and preference patches within a KV instance', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T12:00:00Z') });
    const env = { PRAYER_KV: new MemoryKV() };
    const reminders = await Promise.all([rpc(env, 'get_prayer_status', { city: 'Makkah', userId: 'concurrent' }), rpc(env, 'get_prayer_status', { city: 'Makkah', userId: 'concurrent' })]);
    assert.equal(reminders.filter((result) => result.structuredContent.reminderDue).length, 1);
    const updates = await Promise.all([save(env, { userId: 'patches', locale: 'ar' }), save(env, { userId: 'patches', madhab: 'Hanafi' })]);
    assert.ok(updates.every((response) => response.status === 200));
    const prefs = await new PrayerStorage(env.PRAYER_KV).getUserPreferences('patches');
    assert.equal(prefs?.locale, 'ar');
    assert.equal(prefs?.madhab, 'Hanafi');
  });

  it('rejects oversized streamed request bodies on REST and MCP', async () => {
    for (const path of ['/api/preferences', '/mcp']) {
      const response = await worker.fetch(new Request('http://localhost' + path, {
        method: 'POST', body: JSON.stringify({ userId: 'large', padding: 'x'.repeat(65536) }),
      }), {});
      assert.equal(response.status, 413);
    }
  });

  it('rejects malformed REST coordinates and calendar dates', async () => {
    for (const path of ['/api/status?lat=Infinity&lng=20', '/api/status?lat=abc&lng=20', '/api/status?lat=20', '/api/timetable?date=2026-02-30', '/api/timetable?date=nope']) {
      const response = await worker.fetch(new Request('http://localhost' + path), {});
      assert.equal(response.status, 400, path);
    }
  });

  it('rejects contradictory UTC+14 input and preserves a valid Kiritimati calendar date', async () => {
    const invalid = await worker.fetch(new Request('http://localhost/api/timetable?lat=-21.14&lng=-175.2&timezone=Pacific/Kiritimati&date=2026-09-03'), {});
    assert.equal(invalid.status, 400);
    const response = await worker.fetch(new Request('http://localhost/api/timetable?lat=1.87&lng=-157.43&timezone=Pacific/Kiritimati&date=2026-09-03'), {});
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.localDate, '2026-09-03');
    assert.equal(body.timezone, 'Pacific/Kiritimati');
  });

  it('validates impossible dates and timezones in MCP tools', async () => {
    for (const args of [{ date: '2026-02-30' }, { timezone: 'Invalid/Zone' }, { latitude: 50 }]) {
      assert.equal((await rpc({}, 'get_today_prayer_times', args)).isError, true);
    }
  });

  it('enforces configured bearer auth before accessing storage', async (t) => {
    const kv = new MemoryKV();
    const get = t.mock.method(kv, 'get');
    for (const path of ['/api/status?city=Makkah', '/api/timetable?city=Makkah', '/mcp']) {
      const response = await worker.fetch(new Request('http://localhost' + path), { PRAYER_KV: kv, AUTH_TOKEN: 'test-token' });
      assert.equal(response.status, 401);
    }
    assert.equal(get.mock.callCount(), 0);
    const response = await worker.fetch(new Request('http://localhost/api/timetable?city=Makkah', { headers: { Authorization: 'Bearer test-token' } }), { PRAYER_KV: kv, AUTH_TOKEN: 'test-token' });
    assert.equal(response.status, 200);
  });

  it('distinguishes storage failure from invalid input without leaking internal errors', async () => {
    const kv = new MemoryKV();
    kv.put = async () => { throw new Error('private backend details'); };
    const response = await save({ PRAYER_KV: kv }, { userId: 'failure-user', locale: 'ar' });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'storage_unavailable', error: 'Prayer storage is unavailable' });
  });

  it('allows browser deletion and MCP protocol headers in preflight', async () => {
    const response = await worker.fetch(new Request('http://localhost/mcp', { method: 'OPTIONS' }), {});
    assert.ok(response.headers.get('Access-Control-Allow-Methods')?.includes('DELETE'));
    assert.ok(response.headers.get('Access-Control-Allow-Headers')?.includes('MCP-Protocol-Version'));
  });

  it('host middleware omits a user ID when none was supplied', async (t) => {
    let requestedUrl = '';
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json({ reminderDue: false });
    });
    await new PrayerReminderMiddleware({ workerBaseUrl: 'http://localhost' }).checkPrayerStatus();
    assert.equal(new URL(requestedUrl).searchParams.has('userId'), false);
  });

  it('host middleware cancels an unread error response body', async (t) => {
    let cancelled = false;
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
      cancel() { cancelled = true; },
    }), { status: 500 }));
    assert.equal(await new PrayerReminderMiddleware({ workerBaseUrl: 'http://localhost' }).checkPrayerStatus(), null);
    assert.equal(cancelled, true);
  });
});
