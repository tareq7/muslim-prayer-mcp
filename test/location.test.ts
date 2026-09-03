import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation, sanitizeCoordinate } from '../src/location/resolver.ts';
import type { UserPreferences } from '../src/engine/types.ts';

describe('Location & Timezone Layered Resolver Suite', () => {
  it('sanitizes coordinates to 2 decimal places for data minimization', () => {
    assert.equal(sanitizeCoordinate(24.713554), 24.71);
    assert.equal(sanitizeCoordinate(46.675296), 46.68);
  });

  it('Layer 1: prioritizes explicit request coordinates over all other sources', () => {
    const loc = resolveLocation({
      explicitLat: 51.5074,
      explicitLng: -0.1278,
      explicitTimezone: 'Europe/London',
      cf: { latitude: 24.71, longitude: 46.67, timezone: 'Asia/Riyadh' },
    });

    assert.equal(loc.source, 'explicit_request');
    assert.equal(loc.latitude, 51.51);
    assert.equal(loc.longitude, -0.13);
    assert.equal(loc.timezone, 'Europe/London');
  });

  it('Layer 2: resolves user fixed preference by city name', () => {
    const prefs: UserPreferences = {
      userId: 'user_cairo',
      locationMode: 'fixed',
      fixedCity: 'Cairo',
      calculationMethod: 'Egyptian',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      reminderMode: 'prayer_window',
      exactWindowMinutes: 20,
      locale: 'en',
      minuteAdjustments: {},
      enabled: true,
      updatedAtUtc: new Date().toISOString(),
    };

    const loc = resolveLocation({ userPrefs: prefs });
    assert.equal(loc.source, 'user_fixed_preference');
    assert.equal(loc.city, 'Cairo');
    assert.equal(loc.timezone, 'Africa/Cairo');
    assert.equal(loc.latitude, 30.04);
  });

  it('Layer 2: resolves user fixed preference by coordinates', () => {
    const prefs: UserPreferences = {
      userId: 'user_custom',
      locationMode: 'fixed',
      fixedCoordinates: { latitude: 35.6762, longitude: 139.6503 },
      timezone: 'Asia/Tokyo',
      calculationMethod: 'MuslimWorldLeague',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      reminderMode: 'prayer_window',
      exactWindowMinutes: 20,
      locale: 'en',
      minuteAdjustments: {},
      enabled: true,
      updatedAtUtc: new Date().toISOString(),
    };

    const loc = resolveLocation({ userPrefs: prefs });
    assert.equal(loc.source, 'user_fixed_preference');
    assert.equal(loc.latitude, 35.68);
    assert.equal(loc.longitude, 139.65);
    assert.equal(loc.timezone, 'Asia/Tokyo');
  });

  it('Layer 3: extracts host-forwarded headers when present', () => {
    const headers = new Headers({
      'X-User-Coordinates': '40.7128, -74.0060',
      'X-User-Timezone': 'America/New_York',
      'X-User-City': 'New York City',
    });

    const loc = resolveLocation({ headers });
    assert.equal(loc.source, 'host_header');
    assert.equal(loc.latitude, 40.71);
    assert.equal(loc.longitude, -74.01);
    assert.equal(loc.timezone, 'America/New_York');
    assert.equal(loc.city, 'New York City');
  });

  it('Layer 4: resolves Cloudflare request.cf geolocation as fallback', () => {
    const cf = {
      latitude: '25.2048',
      longitude: '55.2708',
      timezone: 'Asia/Dubai',
      city: 'Dubai',
      country: 'AE',
    };

    const loc = resolveLocation({ cf });
    assert.equal(loc.source, 'cf_geo');
    assert.equal(loc.latitude, 25.2);
    assert.equal(loc.longitude, 55.27);
    assert.equal(loc.timezone, 'Asia/Dubai');
    assert.equal(loc.city, 'Dubai');
  });

  it('Layer 5: defaults to Makkah when all location inputs are absent', () => {
    const loc = resolveLocation({});
    assert.equal(loc.source, 'fallback_default');
    assert.equal(loc.city, 'Makkah');
    assert.equal(loc.timezone, 'Asia/Riyadh');
    assert.equal(loc.latitude, 21.42);
    assert.equal(loc.longitude, 39.83);
  });
});
