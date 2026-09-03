import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrayerStatus, formatReminderText } from '../src/engine/reminder.ts';
import { calculateDailySchedule } from '../src/engine/calculator.ts';
import type { ResolvedLocation } from '../src/engine/types.ts';

describe('Prayer Reminder & Due Logic Suite', () => {
  const riyadhLocation: ResolvedLocation = {
    latitude: 24.71,
    longitude: 46.68,
    timezone: 'Asia/Riyadh',
    city: 'Riyadh',
    country: 'SA',
    source: 'explicit_request',
    isApproximated: true,
  };

  const testDate = new Date('2026-09-03T12:00:00Z');
  const schedule = calculateDailySchedule({
    latitude: riyadhLocation.latitude,
    longitude: riyadhLocation.longitude,
    date: testDate,
    timezone: riyadhLocation.timezone,
  });

  const maghribMs = new Date(schedule.timesUtc.maghrib).getTime();
  const ishaMs = new Date(schedule.timesUtc.isha).getTime();
  const dhuhrMs = new Date(schedule.timesUtc.dhuhr).getTime();

  it('evaluates exactly 1 second before Maghrib: reminder is NOT due for Maghrib', async () => {
    const timeBeforeMaghrib = new Date(maghribMs - 1000);
    const status = await evaluatePrayerStatus({
      now: timeBeforeMaghrib,
      location: riyadhLocation,
      reminderMode: 'prayer_window',
    });

    assert.notEqual(status.prayer, 'Maghrib');
    assert.equal(status.nextPrayer, 'Maghrib');
  });

  it('evaluates at exact Maghrib time: reminder IS due for Maghrib', async () => {
    const exactMaghrib = new Date(maghribMs);
    const status = await evaluatePrayerStatus({
      now: exactMaghrib,
      location: riyadhLocation,
      reminderMode: 'prayer_window',
    });

    assert.equal(status.reminderDue, true);
    assert.equal(status.prayer, 'Maghrib');
    assert.equal(status.nextPrayer, 'Isha');
    assert.equal(status.reminderText, '🕌 It is time for Maghrib prayer.');
  });

  it('evaluates 1 second after Maghrib: reminder IS due for Maghrib', async () => {
    const timeAfterMaghrib = new Date(maghribMs + 1000);
    const status = await evaluatePrayerStatus({
      now: timeAfterMaghrib,
      location: riyadhLocation,
      reminderMode: 'prayer_window',
    });

    assert.equal(status.reminderDue, true);
    assert.equal(status.prayer, 'Maghrib');
  });

  it('evaluates exact_window mode: active within 20m, inactive after 21m', async () => {
    const inside20m = new Date(dhuhrMs + 15 * 60 * 1000); // 15 mins after Dhuhr
    const outside20m = new Date(dhuhrMs + 25 * 60 * 1000); // 25 mins after Dhuhr

    const statusInside = await evaluatePrayerStatus({
      now: inside20m,
      location: riyadhLocation,
      reminderMode: 'exact_window',
      exactWindowMinutes: 20,
    });
    assert.equal(statusInside.reminderDue, true);
    assert.equal(statusInside.prayer, 'Dhuhr');

    const statusOutside = await evaluatePrayerStatus({
      now: outside20m,
      location: riyadhLocation,
      reminderMode: 'exact_window',
      exactWindowMinutes: 20,
    });
    assert.equal(statusOutside.reminderDue, false);
    assert.equal(statusOutside.prayer, undefined);
  });

  it('handles post-midnight early morning before Fajr: active prayer is yesterday Isha', async () => {
    const fajrMs = new Date(schedule.timesUtc.fajr).getTime();
    // 1 hour before Fajr (e.g. 03:15 AM in Riyadh)
    const earlyMorning = new Date(fajrMs - 60 * 60 * 1000);

    const status = await evaluatePrayerStatus({
      now: earlyMorning,
      location: riyadhLocation,
      reminderMode: 'prayer_window',
    });

    assert.equal(status.reminderDue, true);
    assert.equal(status.prayer, 'Isha');
    assert.equal(status.nextPrayer, 'Fajr');
  });

  it('enforces deduplication in prayer_window mode: suppresses duplicate reminder on retry', async () => {
    const sentMap = new Set<string>();
    const exactMaghrib = new Date(maghribMs + 5000);

    // Turn 1: Not yet sent
    const turn1 = await evaluatePrayerStatus({
      now: exactMaghrib,
      location: riyadhLocation,
      reminderMode: 'prayer_window',
      userId: 'user_test_dedupe',
      isAlreadySent: (key) => sentMap.has(key),
    });

    assert.equal(turn1.reminderDue, true);
    assert.ok(turn1.dedupeKey);
    sentMap.add(turn1.dedupeKey!);

    // Turn 2: Retry/next prompt during same prayer window
    const turn2 = await evaluatePrayerStatus({
      now: new Date(maghribMs + 60000), // 1 min later
      location: riyadhLocation,
      reminderMode: 'prayer_window',
      userId: 'user_test_dedupe',
      isAlreadySent: (key) => sentMap.has(key),
    });

    // Deduplication should suppress second reminder
    assert.equal(turn2.reminderDue, false);
  });

  it('bypasses deduplication in persistent mode', async () => {
    const sentMap = new Set<string>();
    sentMap.add('user_test:2026-09-03:Maghrib:persistent');

    const status = await evaluatePrayerStatus({
      now: new Date(maghribMs + 10000),
      location: riyadhLocation,
      reminderMode: 'persistent',
      userId: 'user_test',
      isAlreadySent: (key) => sentMap.has(key),
    });

    // In persistent mode, reminderDue is true even if already sent
    assert.equal(status.reminderDue, true);
  });

  it('formats reminder text in Arabic and English', () => {
    assert.equal(formatReminderText('Fajr', 'en'), '🕌 It is time for Fajr prayer.');
    assert.equal(formatReminderText('Maghrib', 'en'), '🕌 It is time for Maghrib prayer.');
    assert.equal(formatReminderText('Fajr', 'ar'), '🕌 حان وقت صلاة الفجر.');
    assert.equal(formatReminderText('Dhuhr', 'ar'), '🕌 حان وقت صلاة الظهر.');
    assert.equal(formatReminderText('Asr', 'ar'), '🕌 حان وقت صلاة العصر.');
    assert.equal(formatReminderText('Maghrib', 'ar'), '🕌 حان وقت صلاة المغرب.');
    assert.equal(formatReminderText('Isha', 'ar'), '🕌 حان وقت صلاة العشاء.');
  });
});
