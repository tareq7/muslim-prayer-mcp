import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { MemoryKV, PrayerStorage } from '../src/storage/kv-store.ts';

async function rpc(name: string, args: Record<string, unknown>, kv = new MemoryKV(), headers: Record<string,string> = {}, cf?: { latitude: number; longitude: number; timezone: string; country: string }) {
  const request = Object.assign(new Request('https://review.invalid/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { cf });
  const response = await worker.fetch(request, { PRAYER_KV: kv });
  assert.equal(response.status, 200);
  return (await response.json() as any).result;
}

describe('Remaining issue regressions', () => {
  it('requires end-user location for all MCP prayer tools despite connector geolocation', async () => {
    for (const name of ['get_prayer_status', 'get_today_prayer_times', 'get_next_prayer']) {
      for (const cf of [undefined, { latitude: 55.68, longitude: 12.57, timezone: 'Europe/Copenhagen', country: 'DK' }]) {
        const result = await rpc(name, {}, new MemoryKV(), {}, cf);
        assert.equal(result.isError, true);
        assert.equal(result.structuredContent.code, 'location_required');
        assert.equal(result.structuredContent.timesUtc, undefined);
      }
    }
  });
  it('does not use connector timezone for explicit coordinates', async () => {
    const result = await rpc('get_today_prayer_times', { latitude: 24.71, longitude: 46.68 }, new MemoryKV(), {}, { latitude: 55.68, longitude: 12.57, timezone: 'Europe/Copenhagen', country: 'DK' });
    assert.equal(result.structuredContent.code, 'location_required');
  });
  it('accepts a supported explicit city and reports its location basis', async () => {
    const result = await rpc('get_today_prayer_times', { city: 'Riyadh', date: '2026-09-03' });
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.timezone, 'Asia/Riyadh');
    assert.equal(result.structuredContent.calculationDetails.locationBasis, 'explicit_city');
    assert.equal(result.structuredContent.calculationDetails.fallbackLocationUsed, false);
  });
  it('allows explicit overrides without silently changing the geographic authority for a known city', async () => {
    const result = await rpc('get_today_prayer_times', { city: 'London', timezone: 'Asia/Riyadh', date: '2026-09-03' });
    assert.equal(result.structuredContent.calculationMethod, 'MuslimWorldLeague');
    assert.equal(result.structuredContent.timezone, 'Asia/Riyadh');
  });
  it('requires location on REST and accepts explicit city queries', async () => {
    for (const path of ['/api/status', '/api/timetable']) {
      const response = await worker.fetch(Object.assign(new Request('https://review.invalid' + path), { cf: { latitude: 55.68, longitude: 12.57, timezone: 'Europe/Copenhagen', country: 'DK' } }), {});
      assert.equal(response.status, 400);
      assert.equal((await response.json() as any).code, 'location_required');
    }
    const response = await worker.fetch(new Request('https://review.invalid/api/timetable?city=Riyadh&date=2026-09-03'), {});
    assert.equal(response.status, 200);
    assert.equal((await response.json() as any).calculationMethod, 'UmmAlQura');
  });
  it('reports fixed-coordinate configuration without revealing coordinates', async () => {
    const kv = new MemoryKV();
    const configured = await rpc('configure_prayer_preferences', { userId: 'fixed', locationMode: 'fixed', fixedCoordinates: { latitude: 40.7128, longitude: -74.006 }, timezone: 'America/New_York' }, kv);
    assert.equal(configured.structuredContent.preferences.fixedCoordinatesConfigured, true);
    const prefs = await rpc('get_prayer_preferences', { userId: 'fixed' }, kv);
    assert.equal(prefs.structuredContent.fixedCoordinatesConfigured, true);
    assert.equal(prefs.structuredContent.fixedCoordinates, undefined);
    const times = await rpc('get_today_prayer_times', { userId: 'fixed' }, kv);
    assert.equal(times.structuredContent.calculationMethod, 'NorthAmerica');
    assert.equal(times.structuredContent.calculationDetails.locationBasis, 'stored_fixed_coordinates');
    assert.equal((await rpc('get_prayer_preferences', { userId: 'unknown' }, kv)).structuredContent.fixedCoordinatesConfigured, false);
  });
  it('preserves coordinate-based Palestinian routing with a stored display timezone', async () => {
    const kv = new MemoryKV();
    await new PrayerStorage(kv).saveUserPreferences({ userId: 'palestine-fixed', locationMode: 'fixed', fixedCoordinates: { latitude: 31.5, longitude: 34.46 }, timezone: 'Europe/London' });
    const result = await rpc('get_today_prayer_times', { userId: 'palestine-fixed', date: '2026-09-03' }, kv);
    assert.equal(result.structuredContent.calculationMethod, 'Egyptian');
    assert.equal(result.structuredContent.minuteAdjustments.maghrib, 3);
    assert.equal(result.structuredContent.timezone, 'Europe/London');
  });
  it('discloses polar clamping and attaches the same disclosure to authority notices', async () => {
    for (const latitude of [69.65, 90, -90]) {
      const result = await rpc('get_today_prayer_times', { latitude, longitude: 18.96, timezone: 'Europe/Oslo', date: '2026-06-21' });
      const timetable = result.structuredContent;
      assert.equal(timetable.highLatitudeAdjustment.applied, true);
      assert.equal(timetable.highLatitudeAdjustment.astronomicalLatitudeClamped, true);
      assert.equal(timetable.highLatitudeAdjustment.effectiveLatitude, latitude > 0 ? 48 : -48);
      assert.deepEqual(timetable.authorityNotice.highLatitudeAdjustment, timetable.highLatitudeAdjustment);
      assert.match(timetable.authorityNotice.requiredDisplayInstruction, /adjust|approxim/i);
      assert.equal(timetable.coordinates, undefined);
    }
  });
  it('reports twilight adjustments without claiming a normal latitude was clamped', async () => {
    const summer = (await rpc('get_today_prayer_times', { city: 'London', date: '2026-06-21' })).structuredContent;
    assert.equal(summer.highLatitudeAdjustment.applied, true);
    assert.equal(summer.highLatitudeAdjustment.astronomicalLatitudeClamped, false);
    assert.equal(summer.highLatitudeAdjustment.effectiveLatitude, undefined);
    const regular = (await rpc('get_today_prayer_times', { city: 'Riyadh', date: '2026-09-03' })).structuredContent;
    assert.equal(regular.highLatitudeAdjustment.applied, false);
  });
  it('reports regional, stored and explicit adjustment provenance', async () => {
    const kv = new MemoryKV();
    await new PrayerStorage(kv).saveUserPreferences({ userId: 'offsets', locationMode: 'auto_travel', calculationMethod: 'Egyptian', madhab: 'Hanafi', highLatitudeRule: 'SeventhOfTheNight', minuteAdjustments: { maghrib: 5 } });
    const result = await rpc('get_today_prayer_times', { userId: 'offsets', city: 'Gaza', date: '2026-09-03', calculationMethod: 'NorthAmerica', madhab: 'Shafi' }, kv);
    const details = result.structuredContent.calculationDetails;
    assert.equal(details.methodSource, 'explicit_override');
    assert.equal(details.madhabSource, 'explicit_override');
    assert.equal(details.highLatitudeRuleSource, 'stored_preference');
    assert.deepEqual(details.regionalMinuteAdjustments, { maghrib: 3, dhuhr: -1 });
    assert.deepEqual(details.customMinuteAdjustments, { maghrib: 5 });
    assert.equal(result.structuredContent.minuteAdjustments.maghrib, 5);
  });
  it('rejects offsets that reverse prayer windows rather than returning an invalid timetable', async () => {
    const kv = new MemoryKV();
    await new PrayerStorage(kv).saveUserPreferences({ userId: 'reversed', locationMode: 'fixed', fixedCity: 'Makkah', minuteAdjustments: { fajr: 60, sunrise: -60 } });
    const result = await rpc('get_today_prayer_times', { userId: 'reversed', date: '2026-09-03' }, kv);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.code, 'invalid_calculation');
    const response = await worker.fetch(new Request('https://review.invalid/api/timetable?userId=reversed&date=2026-09-03'), { PRAYER_KV: kv });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as any).code, 'invalid_calculation');
  });
  it('guards both analytics aliases when service authentication is configured and sets HTML security headers', async () => {
    for (const path of ['/api/analytics', '/analytics']) {
      const response = await worker.fetch(new Request('https://review.invalid' + path), { AUTH_TOKEN: 'test-only-token' });
      assert.equal(response.status, 401);
    }
    const response = await worker.fetch(new Request('https://review.invalid/analytics', { headers: { Accept: 'text/html' } }), {});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Security-Policy') || '', /default-src 'none'/);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  });
  it('attaches next-prayer disclosures to tomorrow when queried after Isha', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-03T20:00:00Z') });
    const result = await rpc('get_prayer_status', { city: 'Makkah' });
    assert.equal(result.structuredContent.nextPrayer, 'Fajr');
    assert.equal(result.structuredContent.nextPrayerCalculation.localDate, '2026-09-04');
    const upcoming = await rpc('get_next_prayer', { city: 'Makkah' });
    assert.deepEqual(upcoming.structuredContent.highLatitudeAdjustment, result.structuredContent.nextPrayerCalculation.highLatitudeAdjustment);
  });
  it('rejects a timezone-skipped calendar day instead of returning a different day', async () => {
    const result = await rpc('get_today_prayer_times', { latitude: -13.83, longitude: -171.75, timezone: 'Pacific/Apia', date: '2011-12-30' });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.code, 'invalid_calculation');
    assert.match(result.structuredContent.message, /calendar day does not exist/);
    for (const date of ['2011-12-29', '2011-12-31']) {
      const valid = await rpc('get_today_prayer_times', { latitude: -13.83, longitude: -171.75, timezone: 'Pacific/Apia', date });
      assert.notEqual(valid.isError, true);
      assert.equal(valid.structuredContent.localDate, date);
    }
  });
});
