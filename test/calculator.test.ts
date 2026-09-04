import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailySchedule,
  formatLocalTime,
  getLocalDateString,
  getDefaultCalculationParameters,
  resolveCalculationParameters,
} from '../src/engine/calculator.ts';

describe('Astronomical Prayer Calculation Suite', () => {
  const testLocations = [
    { name: 'Riyadh', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh', method: 'UmmAlQura' as const },
    { name: 'Makkah', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh', method: 'UmmAlQura' as const },
    { name: 'Cairo', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo', method: 'Egyptian' as const },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai', method: 'Dubai' as const },
    { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', method: 'MuslimWorldLeague' as const },
    { name: 'Paris', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris', method: 'MuslimWorldLeague' as const },
    { name: 'New York', lat: 40.7128, lng: -74.0060, tz: 'America/New_York', method: 'NorthAmerica' as const },
    { name: 'Jakarta', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta', method: 'Singapore' as const },
    { name: 'Karachi', lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi', method: 'Karachi' as const },
    { name: 'Sydney (Southern Hem)', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney', method: 'MuslimWorldLeague' as const },
  ];

  for (const loc of testLocations) {
    it(`calculates valid prayer timetable for ${loc.name} in correct chronological sequence`, () => {
      const date = new Date('2026-09-03T12:00:00Z');
      const schedule = calculateDailySchedule({
        latitude: loc.lat,
        longitude: loc.lng,
        date,
        timezone: loc.tz,
        method: loc.method,
      });

      assert.equal(schedule.localDate, '2026-09-03');
      assert.equal(schedule.timezone, loc.tz);

      const fajr = new Date(schedule.timesUtc.fajr).getTime();
      const sunrise = new Date(schedule.timesUtc.sunrise).getTime();
      const dhuhr = new Date(schedule.timesUtc.dhuhr).getTime();
      const asr = new Date(schedule.timesUtc.asr).getTime();
      const maghrib = new Date(schedule.timesUtc.maghrib).getTime();
      const isha = new Date(schedule.timesUtc.isha).getTime();

      // Chronological sequence verification
      assert.ok(fajr < sunrise, 'Fajr must be before Sunrise');
      assert.ok(sunrise < dhuhr, 'Sunrise must be before Dhuhr');
      assert.ok(dhuhr < asr, 'Dhuhr must be before Asr');
      assert.ok(asr < maghrib, 'Asr must be before Maghrib');
      assert.ok(maghrib < isha, 'Maghrib must be before Isha');
    });
  }

  it('verifies Hanafi Asr is strictly later than Shafi Asr', () => {
    const date = new Date('2026-09-03T12:00:00Z');
    const shafi = calculateDailySchedule({
      latitude: 24.8607,
      longitude: 67.0011,
      date,
      timezone: 'Asia/Karachi',
      method: 'Karachi',
      madhab: 'Shafi',
    });

    const hanafi = calculateDailySchedule({
      latitude: 24.8607,
      longitude: 67.0011,
      date,
      timezone: 'Asia/Karachi',
      method: 'Karachi',
      madhab: 'Hanafi',
    });

    const shafiAsr = new Date(shafi.timesUtc.asr).getTime();
    const hanafiAsr = new Date(hanafi.timesUtc.asr).getTime();

    // Hanafi Asr occurs when shadow length is twice the object height (shadow factor 2 vs 1)
    assert.ok(hanafiAsr > shafiAsr, 'Hanafi Asr must be strictly later than Shafi Asr');
    const diffMinutes = (hanafiAsr - shafiAsr) / (1000 * 60);
    assert.ok(diffMinutes >= 30, `Expected at least 30 min difference, got ${diffMinutes} min`);
  });

  it('verifies custom minute adjustments', () => {
    const date = new Date('2026-09-03T12:00:00Z');
    const unadjusted = calculateDailySchedule({
      latitude: 24.7136,
      longitude: 46.6753,
      date,
      timezone: 'Asia/Riyadh',
    });

    const adjusted = calculateDailySchedule({
      latitude: 24.7136,
      longitude: 46.6753,
      date,
      timezone: 'Asia/Riyadh',
      minuteAdjustments: {
        fajr: -3,
        maghrib: 5,
      },
    });

    const unadjustedFajr = new Date(unadjusted.timesUtc.fajr).getTime();
    const adjustedFajr = new Date(adjusted.timesUtc.fajr).getTime();
    assert.equal((adjustedFajr - unadjustedFajr) / 60000, -3);

    const unadjustedMaghrib = new Date(unadjusted.timesUtc.maghrib).getTime();
    const adjustedMaghrib = new Date(adjusted.timesUtc.maghrib).getTime();
    assert.equal((adjustedMaghrib - unadjustedMaghrib) / 60000, 5);
  });

  it('handles Daylight Saving Time (DST) spring-forward and fall-back without hour skew', () => {
    // London DST transition: 2026-03-29 (spring forward)
    const springDate = new Date('2026-03-29T12:00:00Z');
    const springSched = calculateDailySchedule({
      latitude: 51.5074,
      longitude: -0.1278,
      date: springDate,
      timezone: 'Europe/London',
    });
    assert.ok(springSched.timesLocal.Dhuhr.startsWith('13:'), 'Dhuhr should be 13:xx BST after spring forward');

    // London winter: 2026-01-15 (GMT +0)
    const winterDate = new Date('2026-01-15T12:00:00Z');
    const winterSched = calculateDailySchedule({
      latitude: 51.5074,
      longitude: -0.1278,
      date: winterDate,
      timezone: 'Europe/London',
    });
    assert.ok(winterSched.timesLocal.Dhuhr.startsWith('12:'), 'Dhuhr should be 12:xx GMT in winter');
  });

  it('calculates high-latitude polar city with MiddleOfTheNight rule safely', () => {
    // Tromsø in mid-summer (midnight sun period: June 21)
    const summerSolstice = new Date('2026-06-21T12:00:00Z');
    const sched = calculateDailySchedule({
      latitude: 69.6492,
      longitude: 18.9553,
      date: summerSolstice,
      timezone: 'Europe/Oslo',
      highLatitudeRule: 'MiddleOfTheNight',
    });

    assert.ok(sched.timesUtc.fajr, 'Fajr should resolve via high-latitude rule');
    assert.ok(sched.timesUtc.maghrib, 'Maghrib should resolve via high-latitude rule');
  });

  it('automatically resolves Palestinian Awqaf standard (Egyptian + offsets) for Gaza', () => {
    const gazaLocation = {
      latitude: 31.50,
      longitude: 34.46,
      timezone: 'Asia/Gaza',
      source: 'explicit_request' as const,
      isApproximated: true,
    };

    const resolved = resolveCalculationParameters(gazaLocation);
    assert.equal(resolved.method, 'Egyptian');
    assert.equal(resolved.madhab, 'Shafi');
    assert.deepEqual(resolved.minuteAdjustments, { maghrib: 3, dhuhr: -1 });
    assert.equal(resolved.isAutoResolved, true);
    assert.ok(resolved.authorityDescription.includes('Palestinian Ministry of Awqaf'));

    // Verify 100% exact match against official Gaza printed calendar on 2026-09-04
    const gazaSchedule = calculateDailySchedule({
      latitude: gazaLocation.latitude,
      longitude: gazaLocation.longitude,
      date: new Date('2026-09-04T12:00:00Z'),
      timezone: gazaLocation.timezone,
      method: resolved.method,
      madhab: resolved.madhab,
      highLatitudeRule: resolved.highLatitudeRule,
      minuteAdjustments: resolved.minuteAdjustments,
      authorityDescription: resolved.authorityDescription,
    });

    assert.equal(gazaSchedule.timesLocal.Fajr, '04:49');
    assert.equal(gazaSchedule.timesLocal.Sunrise, '06:20');
    assert.equal(gazaSchedule.timesLocal.Dhuhr, '12:41');
    assert.equal(gazaSchedule.timesLocal.Asr, '16:15');
    assert.equal(gazaSchedule.timesLocal.Maghrib, '19:05');
    assert.equal(gazaSchedule.timesLocal.Isha, '20:23');
  });

  it('automatically resolves regional authorities worldwide', () => {
    // Saudi Arabia -> UmmAlQura
    const sa = getDefaultCalculationParameters({ country: 'SA', timezone: 'Asia/Riyadh' });
    assert.equal(sa.method, 'UmmAlQura');
    assert.equal(sa.madhab, 'Shafi');

    // UAE -> Dubai
    const uae = getDefaultCalculationParameters({ country: 'AE', timezone: 'Asia/Dubai' });
    assert.equal(uae.method, 'Dubai');

    // Qatar -> Qatar
    const qa = getDefaultCalculationParameters({ country: 'QA', timezone: 'Asia/Qatar' });
    assert.equal(qa.method, 'Qatar');

    // Kuwait -> Kuwait
    const kw = getDefaultCalculationParameters({ country: 'KW', timezone: 'Asia/Kuwait' });
    assert.equal(kw.method, 'Kuwait');

    // Turkey -> Turkey (Diyanet) + Hanafi
    const tr = getDefaultCalculationParameters({ country: 'TR', timezone: 'Europe/Istanbul' });
    assert.equal(tr.method, 'Turkey');
    assert.equal(tr.madhab, 'Hanafi');

    // Pakistan -> Karachi + Hanafi
    const pk = getDefaultCalculationParameters({ country: 'PK', timezone: 'Asia/Karachi' });
    assert.equal(pk.method, 'Karachi');
    assert.equal(pk.madhab, 'Hanafi');

    // USA -> NorthAmerica (ISNA)
    const us = getDefaultCalculationParameters({ country: 'US', timezone: 'America/New_York' });
    assert.equal(us.method, 'NorthAmerica');

    // Singapore -> Singapore (MUIS)
    const sg = getDefaultCalculationParameters({ country: 'SG', timezone: 'Asia/Singapore' });
    assert.equal(sg.method, 'Singapore');

    // UK / Europe -> MuslimWorldLeague (MWL)
    const gb = getDefaultCalculationParameters({ country: 'GB', timezone: 'Europe/London' });
    assert.equal(gb.method, 'MuslimWorldLeague');
  });

  it('honors explicit user override over automatic location defaults', () => {
    const gazaLocation = {
      latitude: 31.50,
      longitude: 34.46,
      timezone: 'Asia/Gaza',
      source: 'explicit_request' as const,
      isApproximated: true,
    };

    const userPrefs = {
      calculationMethod: 'Karachi' as const,
      madhab: 'Hanafi' as const,
      minuteAdjustments: { fajr: 5 },
    };

    const resolved = resolveCalculationParameters(gazaLocation, userPrefs);
    assert.equal(resolved.method, 'Karachi');
    assert.equal(resolved.madhab, 'Hanafi');
    assert.equal(resolved.isAutoResolved, false);
    // User custom minute adjustment merged on top of location offsets
    assert.equal(resolved.minuteAdjustments.fajr, 5);
    assert.equal(resolved.minuteAdjustments.maghrib, 3);
  });
});
