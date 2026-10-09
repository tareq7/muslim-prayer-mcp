import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { InvalidCalculationError, calculateDailySchedule, resolveCalculationParameters } from '../src/engine/calculator.ts';
import { resolveUserLocation } from '../src/location/resolver.ts';
import { MemoryKV, PrayerStorage } from '../src/storage/kv-store.ts';

const invalidOffsets = { fajr: 60, sunrise: -60, maghrib: 60, isha: -60 };

async function configure(transport: 'MCP' | 'REST', input: Record<string, unknown>, kv: MemoryKV) {
  const isMcp = transport === 'MCP';
  const response = await worker.fetch(new Request(`https://test.invalid/${isMcp ? 'mcp' : 'api/preferences'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(isMcp ? {
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'configure_prayer_preferences', arguments: input },
    } : input),
  }), { PRAYER_KV: kv });
  const body = await response.json() as any;
  return { status: response.status, value: isMcp ? body.result.structuredContent : body, isError: body.result?.isError };
}

describe('Preference timetable validation before persistence', () => {
  for (const transport of ['MCP', 'REST'] as const) {
    it(`${transport} rejects individually permitted offsets whose merged timetable is invalid without changing saved bytes`, async (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
      const kv = new MemoryKV();
      const userId = `chronology-${transport}`;
      const initial = await configure(transport, { userId, locationMode: 'fixed', fixedCity: 'Riyadh', locale: 'ar' }, kv);
      assert.equal(initial.value.success, true);
      const before = await kv.get(`pref:${userId}`);
      const rejected = await configure(transport, { userId, minuteAdjustments: invalidOffsets }, kv);
      assert.equal(rejected.value.code, 'invalid_calculation');
      assert.equal(rejected.status, transport === 'REST' ? 400 : 200);
      if (transport === 'MCP') assert.equal(rejected.isError, true);
      assert.equal(await kv.get(`pref:${userId}`), before);

      const prefs = await new PrayerStorage(kv).getUserPreferences(userId);
      const location = resolveUserLocation({ userPrefs: prefs });
      const schedule = calculateDailySchedule({ ...location, ...resolveCalculationParameters(location, prefs), date: new Date() });
      assert.equal(schedule.calculationMethod, 'UmmAlQura');
      assert.ok(Date.parse(schedule.timesUtc.fajr) < Date.parse(schedule.timesUtc.sunrise));
    });

    it(`${transport} rejects invalid initial fixed coordinates without creating a preference record`, async (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
      const kv = new MemoryKV();
      const userId = `new-chronology-${transport}`;
      const rejected = await configure(transport, {
        userId, locationMode: 'fixed', fixedCoordinates: { latitude: 24.71, longitude: 46.68 },
        timezone: 'Asia/Riyadh', minuteAdjustments: invalidOffsets,
      }, kv);
      assert.equal(rejected.value.code, 'invalid_calculation');
      assert.equal(await kv.get(`pref:${userId}`), null);
    });
  }

  it('allows disabling a legacy invalid timetable and repairing its offsets, while rejecting activation', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
    const kv = new MemoryKV();
    const storage = new PrayerStorage(kv);
    await kv.put('pref:legacy-offsets', JSON.stringify({ userId: 'legacy-offsets', locationMode: 'fixed', fixedCity: 'Riyadh', enabled: true, minuteAdjustments: invalidOffsets }));
    const disabled = await storage.updateUserPreferences({ userId: 'legacy-offsets', enabled: false });
    assert.equal(disabled.enabled, false);
    const before = await kv.get('pref:legacy-offsets');
    await assert.rejects(storage.updateUserPreferences({ userId: 'legacy-offsets', enabled: true }), InvalidCalculationError);
    assert.equal(await kv.get('pref:legacy-offsets'), before);
    const repaired = await storage.updateUserPreferences({ userId: 'legacy-offsets', minuteAdjustments: {} });
    assert.deepEqual(repaired.minuteAdjustments, {});
    assert.equal(repaired.enabled, false);
    assert.equal((await storage.updateUserPreferences({ userId: 'legacy-offsets', enabled: true })).enabled, true);
  });

  it('allows disabling or clearing a legacy contradictory location without calculating a fallback', async () => {
    const kv = new MemoryKV();
    const storage = new PrayerStorage(kv);
    await kv.put('pref:legacy-location', JSON.stringify({ userId: 'legacy-location', locationMode: 'fixed', fixedCoordinates: { latitude: 40.71, longitude: -74.01 }, timezone: 'Asia/Dubai', minuteAdjustments: invalidOffsets }));
    assert.equal((await storage.updateUserPreferences({ userId: 'legacy-location', enabled: false })).enabled, false);
    const cleared = await storage.updateUserPreferences({ userId: 'legacy-location', clearFixedLocation: true });
    assert.equal(cleared.locationMode, 'auto_travel');
    assert.equal(cleared.fixedCoordinates, undefined);
    assert.equal(cleared.timezone, undefined);
  });

  it('validates inherited offsets on calculation edits and does not let disabling hide an invalid adjustment update', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
    const kv = new MemoryKV();
    const storage = new PrayerStorage(kv);
    await kv.put('pref:inherited', JSON.stringify({ userId: 'inherited', locationMode: 'fixed', fixedCity: 'Riyadh', minuteAdjustments: invalidOffsets }));
    const before = await kv.get('pref:inherited');
    for (const update of [
      { calculationMethod: 'UmmAlQura' as const },
      { madhab: 'Hanafi' as const },
      { highLatitudeRule: 'SeventhOfTheNight' as const },
      { enabled: false, minuteAdjustments: invalidOffsets },
    ]) {
      await assert.rejects(storage.updateUserPreferences({ userId: 'inherited', ...update }), InvalidCalculationError);
      assert.equal(await kv.get('pref:inherited'), before);
    }
  });

  it('defers travel-mode calculations until a real caller location exists, then rejects activating an invalid fixed site', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
    const kv = new MemoryKV();
    const storage = new PrayerStorage(kv);
    const travel = await storage.updateUserPreferences({ userId: 'travel', minuteAdjustments: invalidOffsets });
    assert.equal(travel.locationMode, 'auto_travel');
    const before = await kv.get('pref:travel');
    await assert.rejects(storage.updateUserPreferences({ userId: 'travel', locationMode: 'fixed', fixedCity: 'Riyadh' }), InvalidCalculationError);
    assert.equal(await kv.get('pref:travel'), before);
  });

  it('direct storage saves enforce the same chronology guard', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
    const kv = new MemoryKV();
    await assert.rejects(new PrayerStorage(kv).saveUserPreferences({ userId: 'direct', locationMode: 'fixed', fixedCity: 'Riyadh', minuteAdjustments: invalidOffsets }), InvalidCalculationError);
    assert.equal(await kv.get('pref:direct'), null);
  });

  it('rejects offsets that are valid today but invalidate tomorrow, using the saved site local date', async (t) => {
    // UTC is still December 31; Riyadh has already crossed into January 1.
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2025-12-31T21:30:00Z') });
    const kv = new MemoryKV();
    const storage = new PrayerStorage(kv);
    const prefs = await storage.updateUserPreferences({ userId: 'tomorrow', locationMode: 'fixed', fixedCity: 'Riyadh' });
    const before = await kv.get('pref:tomorrow');
    const adjustments = { fajr: 60, sunrise: -23 };
    const location = resolveUserLocation({ userPrefs: prefs });
    const parameters = resolveCalculationParameters(location, { ...prefs, minuteAdjustments: adjustments });
    const today = calculateDailySchedule({ ...location, ...parameters, date: new Date() });
    assert.equal(today.localDate, '2026-01-01');
    assert.ok(Date.parse(today.timesUtc.fajr) < Date.parse(today.timesUtc.sunrise));
    assert.throws(() => calculateDailySchedule({ ...location, ...parameters, date: '2026-01-02' }), InvalidCalculationError);
    await assert.rejects(storage.updateUserPreferences({ userId: 'tomorrow', minuteAdjustments: adjustments }), InvalidCalculationError);
    assert.equal(await kv.get('pref:tomorrow'), before);
  });
});

for (const transport of ['REST', 'MCP'] as const) {
  it(`${transport} distinguishes exact poles from coordinates that round to a pole`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
    const kv = new MemoryKV();
    for (const latitude of [89.999, -89.999]) {
      const userId = `near-pole-${transport}-${latitude > 0 ? 'north' : 'south'}`;
      const rejected = await configure(transport, { userId, locationMode: 'fixed', fixedCoordinates: { latitude, longitude: 0 }, timezone: 'Asia/Dubai' }, kv);
      assert.equal(rejected.value.code, 'location_timezone_mismatch');
      assert.equal(await kv.get(`pref:${userId}`), null);
    }
    const accepted = await configure(transport, { userId: `exact-pole-${transport}`, locationMode: 'fixed', fixedCoordinates: { latitude: 90, longitude: 0 }, timezone: 'Asia/Dubai' }, kv);
    assert.equal(accepted.value.success, true);
  });
}
