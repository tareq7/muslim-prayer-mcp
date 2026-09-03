import {
  Coordinates,
  CalculationMethod,
  CalculationParameters,
  PrayerTimes,
  Madhab,
  HighLatitudeRule,
} from 'adhan';
import type {
  CalculationMethodName,
  HighLatitudeRuleName,
  MadhabName,
  MinuteAdjustments,
  PrayerSchedule,
  PrayerTimesUtc,
  PrayerName,
} from './types.ts';

export function getMethodParameters(methodName: CalculationMethodName): CalculationParameters {
  switch (methodName) {
    case 'MuslimWorldLeague':
      return CalculationMethod.MuslimWorldLeague();
    case 'Egyptian':
      return CalculationMethod.Egyptian();
    case 'Karachi':
      return CalculationMethod.Karachi();
    case 'UmmAlQura':
      return CalculationMethod.UmmAlQura();
    case 'Dubai':
      return CalculationMethod.Dubai();
    case 'Qatar':
      return CalculationMethod.Qatar();
    case 'Kuwait':
      return CalculationMethod.Kuwait();
    case 'MoonsightingCommittee':
      return CalculationMethod.MoonsightingCommittee();
    case 'NorthAmerica':
      return CalculationMethod.NorthAmerica();
    case 'Singapore':
      return CalculationMethod.Singapore();
    case 'Turkey':
      return CalculationMethod.Turkey();
    case 'Tehran':
      return CalculationMethod.Tehran();
    default:
      return CalculationMethod.UmmAlQura();
  }
}

export function getMadhab(madhabName: MadhabName) {
  return madhabName === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
}

export function getHighLatitudeRule(ruleName: HighLatitudeRuleName) {
  switch (ruleName) {
    case 'SeventhOfTheNight':
      return HighLatitudeRule.SeventhOfTheNight;
    case 'TwilightAngle':
      return HighLatitudeRule.TwilightAngle;
    case 'MiddleOfTheNight':
    default:
      return HighLatitudeRule.MiddleOfTheNight;
  }
}

export function getLocalDateString(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD
}

export function formatLocalTime(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date); // Returns HH:mm
}

export interface CalculateOptions {
  latitude: number;
  longitude: number;
  date: Date;
  timezone: string;
  method?: CalculationMethodName;
  madhab?: MadhabName;
  highLatitudeRule?: HighLatitudeRuleName;
  minuteAdjustments?: MinuteAdjustments;
}

export function calculateDailySchedule(options: CalculateOptions): PrayerSchedule {
  const {
    latitude,
    longitude,
    date,
    timezone,
    method = 'UmmAlQura',
    madhab = 'Shafi',
    highLatitudeRule = 'MiddleOfTheNight',
    minuteAdjustments = {},
  } = options;

  // Extract calendar day in the target timezone
  const localDateStr = getLocalDateString(date, timezone);
  const [year, month, day] = localDateStr.split('-').map(Number);

  // Initialize calculation date at 12:00:00 UTC for the target calendar day to avoid timezone day shifts
  const calcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const coordinates = new Coordinates(latitude, longitude);
  const params = getMethodParameters(method);
  params.madhab = getMadhab(madhab);
  params.highLatitudeRule = getHighLatitudeRule(highLatitudeRule);

  if (minuteAdjustments.fajr) params.adjustments.fajr = minuteAdjustments.fajr;
  if (minuteAdjustments.sunrise) params.adjustments.sunrise = minuteAdjustments.sunrise;
  if (minuteAdjustments.dhuhr) params.adjustments.dhuhr = minuteAdjustments.dhuhr;
  if (minuteAdjustments.asr) params.adjustments.asr = minuteAdjustments.asr;
  if (minuteAdjustments.maghrib) params.adjustments.maghrib = minuteAdjustments.maghrib;
  if (minuteAdjustments.isha) params.adjustments.isha = minuteAdjustments.isha;

  let prayerTimes = new PrayerTimes(coordinates, calcDate, params);

  // High-latitude polar fallback: if astronomical dawn or sunset cannot be computed (polar day/night)
  // clamp latitude to 48.0 degrees as mandated by contemporary Islamic Fiqh academies
  if (
    !prayerTimes.fajr ||
    isNaN(prayerTimes.fajr.getTime()) ||
    !prayerTimes.maghrib ||
    isNaN(prayerTimes.maghrib.getTime())
  ) {
    const clampedLat = latitude > 0 ? Math.min(latitude, 48.0) : Math.max(latitude, -48.0);
    const fallbackCoords = new Coordinates(clampedLat, longitude);
    prayerTimes = new PrayerTimes(fallbackCoords, calcDate, params);
  }

  const timesUtc: PrayerTimesUtc = {
    fajr: prayerTimes.fajr.toISOString(),
    sunrise: prayerTimes.sunrise.toISOString(),
    dhuhr: prayerTimes.dhuhr.toISOString(),
    asr: prayerTimes.asr.toISOString(),
    maghrib: prayerTimes.maghrib.toISOString(),
    isha: prayerTimes.isha.toISOString(),
  };

  const timesLocal: Record<PrayerName, string> = {
    Fajr: formatLocalTime(prayerTimes.fajr, timezone),
    Sunrise: formatLocalTime(prayerTimes.sunrise, timezone),
    Dhuhr: formatLocalTime(prayerTimes.dhuhr, timezone),
    Asr: formatLocalTime(prayerTimes.asr, timezone),
    Maghrib: formatLocalTime(prayerTimes.maghrib, timezone),
    Isha: formatLocalTime(prayerTimes.isha, timezone),
  };

  return {
    localDate: localDateStr,
    timezone,
    coordinates: {
      latitude,
      longitude,
    },
    calculationMethod: method,
    madhab,
    timesUtc,
    timesLocal,
  };
}
