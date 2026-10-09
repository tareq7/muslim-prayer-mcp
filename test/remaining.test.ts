import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { MemoryKV, PrayerStorage } from '../src/storage/kv-store.ts';
import { evaluatePrayerStatus } from '../src/engine/reminder.ts';
import { resolveUserLocation } from '../src/location/resolver.ts';
import { resolveCalculationParameters } from '../src/engine/calculator.ts';
import { publicPrayerStatus } from '../src/mcp/status-response.ts';
import { PrayerStatusOutputSchema } from '../src/mcp/schemas.ts';

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
  it('publishes draft-07 status dependencies and typed business result fields', async () => {
    const request = new Request('https://review.invalid/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
    const tools = (await (await worker.fetch(request, {})).json() as any).result.tools;
    const status = tools.find((tool: any) => tool.name === 'get_prayer_status');
    assert.equal(status.inputSchema.$schema, 'http://json-schema.org/draft-07/schema#');
    assert.deepEqual(status.inputSchema.dependencies.latitude, ['longitude', 'timezone']);
    assert.equal(status.inputSchema.dependentRequired, undefined);
    assert.equal(status.inputSchema.properties.city.type, 'string');
    assert.equal(status.outputSchema.properties.reminderDue.type, 'boolean');
    assert.ok(status.outputSchema.required.includes('authorityNotice'));
    assert.equal(PrayerStatusOutputSchema.safeParse({ reminderDue: false }).success, false);
    assert.equal(status.outputSchema.properties.nextPrayerCalculation.properties.usesCurrentCalculation.type, 'boolean');
  });
  it('compacts status provenance while preserving parsed fallback and REST parity', async (t) => {
    const now = new Date('2026-09-03T04:00:00Z');
    t.mock.timers.enable({ apis: ['Date'], now });
    const result = await rpc('get_prayer_status', { city: 'Riyadh' });
    const status = result.structuredContent;
    assert.equal(status.authorityNotice.calculationDetails, undefined);
    assert.equal(status.authorityNotice.highLatitudeAdjustment, undefined);
    assert.equal(status.nextPrayerCalculation.usesCurrentCalculation, true);
    assert.equal(status.nextPrayerCalculation.calculationDetails, undefined);
    assert.ok(status.calculationDetails);
    assert.ok(status.highLatitudeAdjustment);
    assert.deepEqual(JSON.parse(result.content[0].text), status);
    assert.equal(result.content[0].text, JSON.stringify(status));
    const location = resolveUserLocation({ explicitCity: 'Riyadh' });
    const params = resolveCalculationParameters(location);
    const raw = await evaluatePrayerStatus({ now, location, ...params, userId: 'anon', isAlreadySent: () => false });
    const { dedupeKey, locationSource, ...oldStatus } = raw;
    const oldEnvelope = { structuredContent: oldStatus, content: [{ type: 'text', text: JSON.stringify(oldStatus, null, 2) }] };
    assert.ok(JSON.stringify(result).length < JSON.stringify(oldEnvelope).length * 0.6);
    for (const field of ['reminderDue', 'localDate', 'nextPrayer', 'nextPrayerAtUtc', 'timezone', 'calculationMethod', 'madhab']) {
      assert.equal(status[field], oldStatus[field as keyof typeof oldStatus]);
    }
    const rest = await worker.fetch(new Request('https://review.invalid/api/status?city=Riyadh'), {});
    assert.deepEqual(await rest.json(), status);
    assert.equal(PrayerStatusOutputSchema.safeParse(status).success, true);
  });
  it('keeps distinct next-date metadata and does not mutate internal schedules', async () => {
    const location = resolveUserLocation({ explicitCity: 'London' });
    const params = resolveCalculationParameters(location);
    const raw = await evaluatePrayerStatus({ now: new Date('2026-06-21T12:00:00Z'), location, ...params, userId: 'anon', isAlreadySent: () => false });
    assert.ok(raw.nextPrayerCalculation?.calculationDetails);
    const amended = { ...raw, nextPrayerCalculation: {
      ...raw.nextPrayerCalculation,
      localDate: '2026-06-22',
      calculationDetails: { ...raw.nextPrayerCalculation.calculationDetails, calendarAlignmentAdjusted: !raw.calculationDetails?.calendarAlignmentAdjusted },
    } };
    const original = JSON.stringify(amended);
    const result = publicPrayerStatus(amended);
    assert.equal(result.nextPrayerCalculation?.usesCurrentCalculation, false);
    assert.equal(result.nextPrayerCalculation?.localDate, '2026-06-22');
    assert.deepEqual(result.nextPrayerCalculation?.calculationDetails, amended.nextPrayerCalculation.calculationDetails);
    assert.deepEqual(result.highLatitudeAdjustment, amended.highLatitudeAdjustment);
    assert.equal(JSON.stringify(amended), original);
    assert.equal(PrayerStatusOutputSchema.safeParse(result).success, true);
  });
  it('rejects contradictory coordinate timezones and reports the expected zone', async () => {
    for (const args of [
      { latitude: 40.71, longitude: -74.01, timezone: 'Asia/Dubai', expected: 'America/New_York' },
      { latitude: 25.2, longitude: 55.27, timezone: 'America/New_York', expected: 'Asia/Dubai' },
    ]) {
      for (const name of ['get_today_prayer_times', 'get_next_prayer', 'get_prayer_status']) {
        const result = await rpc(name, args);
        assert.equal(result.isError, true);
        assert.equal(result.structuredContent.code, 'location_timezone_mismatch');
        assert.equal(result.structuredContent.expectedTimezone, args.expected);
      }
    }
    const compatible = await rpc('get_today_prayer_times', { latitude: 40.71, longitude: -74.01, timezone: 'US/Eastern' });
    assert.notEqual(compatible.isError, true);
    assert.equal(compatible.structuredContent.calculationMethod, 'NorthAmerica');
    assert.equal(compatible.structuredContent.calculationDetails.expectedTimezone, 'America/New_York');
  });
  it('rejects contradictory fixed-city timezone updates without changing existing storage', async () => {
    const kv = new MemoryKV();
    await rpc('configure_prayer_preferences', { userId: 'city-timezone', locationMode: 'fixed', fixedCity: 'Riyadh' }, kv);
    const before = await kv.get('pref:city-timezone');
    const result = await rpc('configure_prayer_preferences', { userId: 'city-timezone', timezone: 'America/New_York' }, kv);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.code, 'location_timezone_mismatch');
    assert.equal(await kv.get('pref:city-timezone'), before);
    const valid = await rpc('configure_prayer_preferences', { userId: 'city-timezone', timezone: 'Asia/Riyadh' }, kv);
    assert.equal(valid.structuredContent.preferences.timezone, 'Asia/Riyadh');
  });
  it('allows disabling legacy preferences without silently replacing their location', async () => {
    const kv = new MemoryKV();
    const coordinates = { latitude: 40.71, longitude: -74.01 };
    await kv.put('pref:legacy-location', JSON.stringify({ userId: 'legacy-location', locationMode: 'fixed', fixedCoordinates: coordinates, timezone: 'Asia/Dubai', enabled: true }));
    const updated = await rpc('configure_prayer_preferences', { userId: 'legacy-location', enabled: false, locale: 'ar' }, kv);
    assert.notEqual(updated.isError, true);
    const stored = JSON.parse(await kv.get('pref:legacy-location'));
    assert.deepEqual(stored.fixedCoordinates, coordinates);
    assert.equal(stored.timezone, 'Asia/Dubai');
    assert.equal(stored.enabled, false);
    assert.equal((await rpc('get_today_prayer_times', { userId: 'legacy-location' }, kv)).structuredContent.code, 'location_timezone_mismatch');
    assert.equal((await rpc('configure_prayer_preferences', { userId: 'legacy-location', locationMode: 'fixed' }, kv)).structuredContent.code, 'location_timezone_mismatch');
    const repaired = await rpc('configure_prayer_preferences', { userId: 'legacy-location', timezone: 'America/New_York' }, kv);
    assert.notEqual(repaired.isError, true);
  });
  it('does not treat similar seasonal offsets as timezone aliases across DST transitions', async () => {
    const result = await rpc('get_today_prayer_times', { latitude: 31.7683, longitude: 35.2137, timezone: 'Europe/Athens', date: '2026-03-27' });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.code, 'location_timezone_mismatch');
    assert.equal(result.structuredContent.expectedTimezone, 'Asia/Jerusalem');
  });
  it('applies contradiction checks to forwarded city and coordinate headers', async () => {
    const mismatch = await rpc('get_today_prayer_times', {}, new MemoryKV(), { 'X-User-City': 'New York', 'X-User-Timezone': 'Asia/Dubai' });
    assert.equal(mismatch.structuredContent.code, 'location_timezone_mismatch');
    const mixed = await rpc('get_today_prayer_times', {}, new MemoryKV(), { 'X-User-City': 'Dubai', 'X-User-Coordinates': '40.71,-74.01', 'X-User-Timezone': 'America/New_York' });
    assert.equal(mixed.structuredContent.code, 'invalid_location');
    const invalid = await rpc('get_today_prayer_times', {}, new MemoryKV(), { 'X-User-City': 'New York', 'X-User-Timezone': 'not/a-timezone' });
    assert.equal(invalid.structuredContent.code, 'invalid_location');
  });
  it('rejects mixed city/coordinates on all prayer tools and REST', async () => {
    for (const timezone of [undefined, 'America/New_York']) {
      for (const name of ['get_today_prayer_times', 'get_next_prayer', 'get_prayer_status']) {
        assert.equal((await rpc(name, { city: 'Riyadh', latitude: 40.71, longitude: -74.01, timezone })).isError, true);
      }
    }
    const response = await worker.fetch(new Request('https://review.invalid/api/timetable?city=Riyadh&lat=40.71&lng=-74.01&timezone=America/New_York'), {});
    assert.equal(response.status, 400);
  });
  it('advertises current result fields, whitespace validation, and the exact-window default', async () => {
    const request = new Request('https://review.invalid/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
    const tools = (await (await worker.fetch(request, {})).json() as any).result.tools;
    const configure = tools.find((tool: any) => tool.name === 'configure_prayer_preferences');
    assert.equal(configure.inputSchema.properties.userId.pattern, '\\S');
    assert.match(configure.inputSchema.properties.exactWindowMinutes.description, /20/);
    const status = tools.find((tool: any) => tool.name === 'get_prayer_status');
    assert.ok(status.outputSchema.properties.prayerWindowExpiresAtUtc);
    assert.ok(status.outputSchema.properties.reminderWindowExpiresAtUtc);
    assert.ok(status.outputSchema.properties.calculationDetails.properties.timezoneSource);
  });
  it('rejects explicit coordinates without a same-request timezone instead of inheriting Dubai', async () => {
    const kv = new MemoryKV();
    await rpc('configure_prayer_preferences', { userId: 'traveler-dubai', locationMode: 'fixed', fixedCity: 'Dubai', timezone: 'Asia/Dubai', calculationMethod: 'Dubai' }, kv);
    for (const tool of ['get_today_prayer_times', 'get_next_prayer', 'get_prayer_status']) {
      const result = await rpc(tool, { userId: 'traveler-dubai', latitude: 40.71, longitude: -74.01 }, kv, { 'X-User-Timezone': 'Asia/Dubai' });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.code, 'location_required');
    }
    const valid = await rpc('get_today_prayer_times', { userId: 'traveler-dubai', latitude: 40.71, longitude: -74.01, timezone: 'America/New_York', date: '2026-10-02' }, kv);
    assert.equal(valid.structuredContent.timezone, 'America/New_York');
    assert.equal(valid.structuredContent.calculationDetails.timezoneSource, 'explicit_override');
    assert.equal(valid.structuredContent.calculationDetails.methodSource, 'stored_preference');
    const rest = await worker.fetch(new Request('https://review.invalid/api/timetable?userId=traveler-dubai&lat=40.71&lng=-74.01'), { PRAYER_KV: kv });
    assert.equal(rest.status, 400);
  });
  it('validates merged fixed preferences before writing and offers explicit location clearing', async () => {
    const kv = new MemoryKV();
    for (const args of [{ locationMode: 'fixed' }, { locationMode: 'fixed', fixedCoordinates: { latitude: 24.71, longitude: 46.68 } }]) {
      const result = await rpc('configure_prayer_preferences', { userId: 'incomplete', ...args }, kv);
      assert.equal(result.isError, true);
      assert.equal(await kv.get('pref:incomplete'), null);
    }
    await rpc('configure_prayer_preferences', { userId: 'clear', locationMode: 'fixed', fixedCity: 'Riyadh', timezone: 'Asia/Riyadh', locale: 'ar' }, kv);
    const partial = await rpc('configure_prayer_preferences', { userId: 'clear', reminderMode: 'persistent' }, kv);
    assert.notEqual(partial.isError, true);
    const invalid = await rpc('configure_prayer_preferences', { userId: 'clear', fixedCoordinates: { latitude: 40.71, longitude: -74.01 } }, kv);
    assert.equal(invalid.isError, true);
    assert.equal((await new PrayerStorage(kv).getUserPreferences('clear'))?.fixedCity, 'Riyadh');
    const cleared = await rpc('configure_prayer_preferences', { userId: 'clear', clearFixedLocation: true }, kv);
    assert.equal(cleared.structuredContent.preferences.locationMode, 'auto_travel');
    assert.equal(cleared.structuredContent.preferences.fixedCityConfigured, false);
    assert.equal(cleared.structuredContent.preferences.fixedCoordinatesConfigured, false);
    assert.equal(cleared.structuredContent.preferences.timezone, undefined);
    assert.equal(cleared.structuredContent.preferences.locale, 'ar');
    const fixedAgain = await rpc('configure_prayer_preferences', { userId: 'clear', locationMode: 'fixed' }, kv);
    assert.equal(fixedAgain.isError, true);
    const response = await worker.fetch(new Request('https://review.invalid/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'rest-incomplete', locationMode: 'fixed' }) }), { PRAYER_KV: kv });
    assert.equal(response.status, 400);
    assert.equal(await kv.get('pref:rest-incomplete'), null);
  });
  it('rejects direct fixed-coordinate saves lacking timezone even when a city is present', async () => {
    const kv = new MemoryKV();
    await assert.rejects(new PrayerStorage(kv).saveUserPreferences({
      userId: 'ambiguous-fixed', locationMode: 'fixed', fixedCity: 'Riyadh',
      fixedCoordinates: { latitude: 40.71, longitude: -74.01 },
    }), /timezone/);
    assert.equal(await kv.get('pref:ambiguous-fixed'), null);
  });
  it('supports common city aliases and rejects whitespace-only identifiers', async () => {
    for (const city of ['Gaza City', 'NYC', 'Abu Dhabi', 'Kuwait City']) {
      assert.notEqual((await rpc('get_today_prayer_times', { city, date: '2026-10-02' })).isError, true, city);
    }
    const kv = new MemoryKV();
    assert.equal((await rpc('configure_prayer_preferences', { userId: '   ', locale: 'en' }, kv)).isError, true);
    assert.equal(await kv.get('pref:   '), null);
  });
  it('distinguishes exact reminder expiry from the prayer period boundary', async (t) => {
    const kv = new MemoryKV();
    const schedule = (await rpc('get_today_prayer_times', { city: 'Riyadh', date: '2026-10-02' })).structuredContent;
    const start = Date.parse(schedule.timesUtc.dhuhr);
    await rpc('configure_prayer_preferences', { userId: 'expiry', locationMode: 'fixed', fixedCity: 'Riyadh', reminderMode: 'exact_window', exactWindowMinutes: 5 }, kv);
    t.mock.timers.enable({ apis: ['Date'], now: new Date(start + 1000) });
    const result = (await rpc('get_prayer_status', { userId: 'expiry' }, kv)).structuredContent;
    assert.equal(result.reminderDue, true);
    assert.equal(result.prayerWindowExpiresAtUtc, schedule.timesUtc.asr);
    assert.equal(result.expiresAtUtc, result.prayerWindowExpiresAtUtc);
    assert.equal(result.reminderWindowExpiresAtUtc, new Date(start + 5 * 60000).toISOString());
  });
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
  it('rejects a timezone override that contradicts a predefined city', async () => {
    const result = await rpc('get_today_prayer_times', { city: 'London', timezone: 'Asia/Riyadh', date: '2026-09-03' });
    assert.equal(result.structuredContent.code, 'location_timezone_mismatch');
    assert.equal(result.structuredContent.expectedTimezone, 'Europe/London');
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
  it('preserves coordinate-based Palestinian routing with a compatible timezone', async () => {
    const kv = new MemoryKV();
    await new PrayerStorage(kv).saveUserPreferences({ userId: 'palestine-fixed', locationMode: 'fixed', fixedCoordinates: { latitude: 31.5, longitude: 34.46 }, timezone: 'Asia/Gaza' });
    const result = await rpc('get_today_prayer_times', { userId: 'palestine-fixed', date: '2026-09-03' }, kv);
    assert.equal(result.structuredContent.calculationMethod, 'Egyptian');
    assert.equal(result.structuredContent.minuteAdjustments.maghrib, 3);
    assert.equal(result.structuredContent.timezone, 'Asia/Gaza');
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
    // Seed an invalid legacy record directly; preference writes now reject it.
    await kv.put('pref:reversed', JSON.stringify({ userId: 'reversed', locationMode: 'fixed', fixedCity: 'Makkah', minuteAdjustments: { fajr: 60, sunrise: -60 } }));
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
    const nextAdjustment = result.structuredContent.nextPrayerCalculation.usesCurrentCalculation
      ? result.structuredContent.highLatitudeAdjustment : result.structuredContent.nextPrayerCalculation.highLatitudeAdjustment;
    assert.deepEqual(upcoming.structuredContent.highLatitudeAdjustment, nextAdjustment);
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
