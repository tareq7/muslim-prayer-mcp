import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { MemoryKV, PrayerStorage, StorageUnavailableError, type KVNamespaceLike } from '../src/storage/kv-store.ts';
import { evaluatePrayerStatus } from '../src/engine/reminder.ts';
import { calculateDailySchedule, resolveCalculationParameters } from '../src/engine/calculator.ts';
import { resolveUserLocation } from '../src/location/resolver.ts';

async function rpc(name: string, args: Record<string, unknown>, kv: KVNamespaceLike) {
  const response = await worker.fetch(new Request('https://review.invalid/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { PRAYER_KV: kv });
  assert.equal(response.status, 200);
  return (await response.json() as any).result;
}

function assertStorageError(result: any) {
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, { code: 'storage_unavailable', message: 'Prayer storage is unavailable' });
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.doesNotMatch(JSON.stringify(result), /private-backend-secret/);
}

const unavailableKV: KVNamespaceLike = {
  async get() { throw new Error('private-backend-secret'); },
  async put() { throw new Error('private-backend-secret'); },
  async delete() { throw new Error('private-backend-secret'); },
};

describe('Engine and storage review fixes', () => {
  it('returns Dhuhr throughout the Fajr window while expiration remains Sunrise', async (t) => {
    const location = resolveUserLocation({ explicitCity: 'Riyadh' });
    const params = resolveCalculationParameters(location);
    const schedule = calculateDailySchedule({ ...location, ...params, date: '2026-09-03' });
    const now = new Date(Date.parse(schedule.timesUtc.fajr) + 60000);
    const status = await evaluatePrayerStatus({ location, ...params, now });
    assert.equal(status.prayer, 'Fajr');
    assert.equal(status.nextPrayer, 'Dhuhr');
    assert.equal(status.nextPrayerAtUtc, schedule.timesUtc.dhuhr);
    assert.equal(status.prayerWindowExpiresAtUtc, schedule.timesUtc.sunrise);
    t.mock.timers.enable({ apis: ['Date'], now });
    const next = await rpc('get_next_prayer', { city: 'Riyadh' }, new MemoryKV());
    assert.equal(next.structuredContent.nextPrayer, 'Dhuhr');
    assert.equal(next.structuredContent.nextPrayerAtUtc, schedule.timesUtc.dhuhr);
    assert.equal(next.structuredContent.remainingMinutes, Math.round((Date.parse(schedule.timesUtc.dhuhr) - now.getTime()) / 60000));
    const afterSunrise = await evaluatePrayerStatus({ location, ...params, now: new Date(schedule.timesUtc.sunrise) });
    assert.equal(afterSunrise.reminderDue, false);
    assert.equal(afterSunrise.nextPrayer, 'Dhuhr');
  });

  it('returns the same sanitized structured storage error from all five tools', async () => {
    for (const [name, args] of [
      ['get_prayer_status', { userId: 'review-user', city: 'Riyadh' }],
      ['get_today_prayer_times', { userId: 'review-user', city: 'Riyadh' }],
      ['get_next_prayer', { userId: 'review-user', city: 'Riyadh' }],
      ['configure_prayer_preferences', { userId: 'review-user', enabled: false }],
      ['get_prayer_preferences', { userId: 'review-user' }],
    ] as const) assertStorageError(await rpc(name, args, unavailableKV));
  });

  it('sanitizes preference writes and dedupe reads and writes at the adapter', async () => {
    const storage = new PrayerStorage(unavailableKV);
    for (const operation of [
      () => storage.getUserPreferences('review-user'),
      () => storage.saveUserPreferences({ userId: 'review-user', enabled: true, locationMode: 'auto_travel' }),
      () => storage.isDedupeSent('review-key'),
      () => storage.recordDedupeSent('review-key'),
      () => storage.clearDedupe('review-key'),
      () => storage.deleteUserPreferences('review-user'),
    ]) await assert.rejects(operation, (error: unknown) => error instanceof StorageUnavailableError && error.message === 'Prayer storage is unavailable');
    const kv = new MemoryKV();
    const failingWrites = { get: kv.get.bind(kv), put: unavailableKV.put, delete: kv.delete.bind(kv) };
    assertStorageError(await rpc('configure_prayer_preferences', { userId: 'review-user', enabled: false }, failingWrites));
    assert.equal(await kv.get('pref:review-user'), null);
  });

  it('preserves the location-required structured error without accessing storage', async () => {
    const result = await rpc('get_prayer_status', {}, unavailableKV);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.code, 'location_required');
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  });
});
