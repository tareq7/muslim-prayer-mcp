import {
  Coordinates,
  CalculationMethod,
  CalculationParameters,
  PrayerTimes,
  Madhab,
  HighLatitudeRule,
  Rounding,
} from 'adhan';
import type {
  AuthorityNotice,
  HighLatitudeAdjustment,
  CalculationDetails,
  CalculationMethodName,
  HighLatitudeRuleName,
  MadhabName,
  MinuteAdjustments,
  PrayerSchedule,
  PrayerTimesUtc,
  PrayerName,
  ResolvedLocation,
  UserPreferences,
} from './types.ts';
import { inferCountryFromTimezone } from '../location/resolver.ts';

export class InvalidCalculationError extends Error {
  readonly code = 'invalid_calculation';
  constructor(message = 'The requested inputs produce an invalid or non-chronological prayer timetable. Check the location, date, and minute adjustments.') {
    super(message);
    this.name = 'InvalidCalculationError';
  }
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  // Adhan's UTC date constructor treats years 00..99 as 1900..1999.
  if (year < 100) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDaysToCalendarDate(value: string, days: number): string {
  if (!isValidCalendarDate(value)) throw new RangeError(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + days);
  return date.toISOString().slice(0, 10);
}

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
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
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
  date: Date | string;
  timezone: string;
  method?: CalculationMethodName;
  madhab?: MadhabName;
  highLatitudeRule?: HighLatitudeRuleName;
  minuteAdjustments?: MinuteAdjustments;
  authorityDescription?: string;
  selectionReason?: string;
  authorityNotice?: AuthorityNotice;
  calculationDetails?: CalculationDetails;
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
    authorityDescription,
    selectionReason,
    authorityNotice,
    calculationDetails,
  } = options;

  // Extract calendar day in the target timezone
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new InvalidCalculationError();
  }
  const localDateStr = typeof date === 'string' ? date : getLocalDateString(date, timezone);
  if (!isValidCalendarDate(localDateStr)) throw new RangeError(`Invalid calendar date: ${localDateStr}`);
  const [year, month, day] = localDateStr.split('-').map(Number);

  // Adhan reads host-local calendar fields and returns UTC instants.
  const calcDate = new Date(0);
  calcDate.setFullYear(year, month - 1, day);
  calcDate.setHours(12, 0, 0, 0);

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

  let effectiveLatitude = latitude;
  const computePrayerTimes = (): PrayerTimes => {
    effectiveLatitude = latitude;
    const times = new PrayerTimes(coordinates, calcDate, params);
    // High-latitude polar fallback: if astronomical dawn or sunset cannot be computed (polar day/night)
    // use this service's configured latitude substitute of 48.0 degrees
    if ([times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha].some(time => !time || !Number.isFinite(time.getTime()))) {
      const clampedLat = latitude > 0 ? Math.min(latitude, 48.0) : Math.max(latitude, -48.0);
      effectiveLatitude = clampedLat;
      return new PrayerTimes(new Coordinates(clampedLat, longitude), calcDate, params);
    }
    return times;
  };
  let prayerTimes = computePrayerTimes();
  // Civil timezones can fall on the opposite side of the date line from their longitude.
  const transitLocalDate = getLocalDateString(prayerTimes.dhuhr, timezone);
  if (transitLocalDate !== localDateStr) {
    calcDate.setDate(calcDate.getDate() + (transitLocalDate > localDateStr ? -1 : 1));
    prayerTimes = computePrayerTimes();
  }

  if (getLocalDateString(prayerTimes.dhuhr, timezone) !== localDateStr) {
    throw new InvalidCalculationError('The requested calendar day does not exist in this location/timezone. Select an existing local date.');
  }

  const orderedTimes = [prayerTimes.fajr, prayerTimes.sunrise, prayerTimes.dhuhr, prayerTimes.asr, prayerTimes.maghrib, prayerTimes.isha].map(time => time.getTime());
  if (orderedTimes.some((time, index) => !Number.isFinite(time) || (index > 0 && time <= orderedTimes[index - 1]))) {
    throw new InvalidCalculationError();
  }

  const latitudeClamped = effectiveLatitude !== latitude;
  // Compare unrounded public Adhan calculations against a whole-night bound.
  // That bound preserves every valid angle-based time, exposing twilight substitutions.
  const probeParameters = () => {
    const probe = getMethodParameters(method);
    probe.madhab = params.madhab;
    probe.highLatitudeRule = params.highLatitudeRule;
    probe.adjustments = { ...params.adjustments };
    probe.rounding = Rounding.None;
    return probe;
  };
  const effectiveCoordinates = new Coordinates(effectiveLatitude, longitude);
  const policyProbe = new PrayerTimes(effectiveCoordinates, calcDate, probeParameters());
  const referenceParameters = probeParameters();
  referenceParameters.nightPortions = () => ({ fajr: 1, isha: 1 });
  if (method === 'MoonsightingCommittee') referenceParameters.method = 'Other';
  const referenceProbe = new PrayerTimes(effectiveCoordinates, calcDate, referenceParameters);
  const adjustedPrayers: PrayerName[] = latitudeClamped
    ? ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']
    : [];
  if (!latitudeClamped) {
    if (policyProbe.fajr.getTime() !== referenceProbe.fajr.getTime()) adjustedPrayers.push('Fajr');
    if (policyProbe.isha.getTime() !== referenceProbe.isha.getTime()) adjustedPrayers.push('Isha');
  }
  const explanation = latitudeClamped
    ? `Polar astronomical events were unavailable. Times are approximations using a substitute latitude of ${effectiveLatitude} degrees and the ${highLatitudeRule} twilight rule; sunrise and sunset are substitutes, not observed local events.`
    : adjustedPrayers.length
      ? `Twilight adjustments were applied to ${adjustedPrayers.join(', ')} using ${method === 'MoonsightingCommittee' ? 'Moonsighting Committee seasonal/night-fraction rules' : highLatitudeRule}. Verify local authority guidance.`
      : 'No geographic clamping or twilight substitution changed this timetable.';
  const highLatitudeAdjustment: HighLatitudeAdjustment = {
    applied: adjustedPrayers.length > 0, rule: highLatitudeRule,
    ...(method === 'MoonsightingCommittee' ? { methodSpecificTwilightRule: 'MoonsightingCommittee' as const } : {}),
    astronomicalLatitudeClamped: latitudeClamped,
    ...(latitudeClamped ? { effectiveLatitude: effectiveLatitude > 0 ? 48 as const : -48 as const } : {}),
    adjustedPrayers, explanation,
  };
  const details: CalculationDetails = {
    ...calculationDetails,
    methodMinuteAdjustments: { ...params.methodAdjustments },
    appliedMinuteAdjustments: Object.fromEntries(['fajr','sunrise','dhuhr','asr','maghrib','isha'].map((prayer) => [prayer, (params.adjustments[prayer as keyof MinuteAdjustments] || 0) + (params.methodAdjustments[prayer as keyof MinuteAdjustments] || 0)])),
    calendarAlignmentAdjusted: transitLocalDate !== localDateStr,
  };
  const disclosedAuthorityNotice = authorityNotice ? {
    ...authorityNotice, highLatitudeAdjustment, calculationDetails: details,
    requiredDisplayInstruction: authorityNotice.requiredDisplayInstruction + (highLatitudeAdjustment.applied ? ` Also disclose: ${explanation}` : ''),
  } : undefined;

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
    minuteAdjustments,
    authorityDescription,
    selectionReason,
    authorityNotice: disclosedAuthorityNotice,
    highLatitudeAdjustment,
    calculationDetails: details,
    timesUtc,
    timesLocal,
  };
}

export interface LocationSignals {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  city?: string;
}

export interface CalculationDefaults {
  method: CalculationMethodName;
  madhab: MadhabName;
  highLatitudeRule: HighLatitudeRuleName;
  minuteAdjustments: MinuteAdjustments;
  authorityDescription: string;
  selectionReason: string;
}

export function isPalestineLocation(loc: LocationSignals): boolean {
  // Legacy API name: matches a configured regional profile, not a jurisdiction boundary.
  if (loc.country) return ['PS', 'IL'].includes(loc.country.toUpperCase());
  if (loc.country === 'PS' || loc.country === 'IL') return true;
  if (
    loc.timezone === 'Asia/Gaza' ||
    loc.timezone === 'Asia/Hebron' ||
    loc.timezone === 'Asia/Jerusalem'
  ) {
    return true;
  }
  if (loc.city) {
    const c = loc.city.toLowerCase().replace(/[^a-z]/g, '');
    const palestineCities = [
      'gaza',
      'jerusalem',
      'alquds',
      'ramallah',
      'hebron',
      'nablus',
      'jenin',
      'bethlehem',
      'rafah',
      'khanyunis',
      'tulkarm',
      'qalqilya',
      'salfit',
      'jericho',
      'tubas',
    ];
    if (palestineCities.includes(c)) return true;
  }
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    if (
      loc.latitude >= 31.0 &&
      loc.latitude <= 33.5 &&
      loc.longitude >= 34.0 &&
      loc.longitude <= 35.8
    ) {
      return true;
    }
  }
  return false;
}

export function getDefaultCalculationParameters(location: LocationSignals): CalculationDefaults {
  // 1. Configured Palestinian regional profile (Egyptian + service offsets).
  // The ministry pages at https://www.pal-wakf.ps/en did not verify these exact parameters.
  if (isPalestineLocation(location)) {
    return {
      method: 'Egyptian',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: { maghrib: 3, dhuhr: -1 },
      authorityDescription:
        'Configured Palestinian regional profile (Egyptian method + service offsets)',
      selectionReason:
        'Selected by this service\'s regional heuristic: country metadata takes precedence (PS or IL); otherwise Gaza/Hebron/Jerusalem timezone, a listed regional city, or broad coordinate bounds select this profile. This is not precise jurisdiction detection. The configured profile uses Adhan\'s Egyptian method (Fajr 19.5°, Isha 17.5°), with service offsets of +3 minutes for Maghrib and -1 minute for Dhuhr. Adoption of these exact parameters by the Palestinian Ministry of Awqaf has not been independently verified.',
    };
  }

  const country = location.country?.toUpperCase();
  const tz = country ? '' : location.timezone || '';

  // 2. Saudi Arabia (Umm al-Qura)
  if (country === 'SA' || tz === 'Asia/Riyadh') {
    return {
      method: 'UmmAlQura',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Umm al-Qura University, Makkah (Kingdom of Saudi Arabia)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Saudi Arabia profile, which uses Adhan\'s Umm al-Qura method.',
    };
  }

  // 3. United Arab Emirates (Awqaf UAE)
  if (country === 'AE' || tz === 'Asia/Dubai') {
    return {
      method: 'Dubai',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Dubai method (Adhan; configured UAE profile)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured UAE profile, which uses Adhan\'s Dubai method.',
    };
  }

  // 4. Qatar
  if (country === 'QA' || tz === 'Asia/Qatar') {
    return {
      method: 'Qatar',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Qatar method (Adhan)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Qatar profile, which uses Adhan\'s Qatar method.',
    };
  }

  // 5. Kuwait
  if (country === 'KW' || tz === 'Asia/Kuwait') {
    return {
      method: 'Kuwait',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Kuwait method (Adhan)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Kuwait profile, which uses Adhan\'s Kuwait method.',
    };
  }

  // 6. Egypt (Egyptian General Authority of Survey)
  if (country === 'EG' || tz === 'Africa/Cairo') {
    return {
      method: 'Egyptian',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Egyptian General Authority of Survey',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Egypt profile, which uses Adhan\'s Egyptian General Authority of Survey method.',
    };
  }

  // 7. Turkey, Central Asia & Balkans (Diyanet Hanafi Standard)
  if (
    ['TR', 'AZ', 'TM', 'UZ', 'KZ', 'KG', 'BA', 'AL', 'XK'].includes(country || '') ||
    tz === 'Europe/Istanbul'
  ) {
    return {
      method: 'Turkey',
      madhab: 'Hanafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Turkey method (Adhan approximation of Diyanet)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Turkey/Balkans/Central Asia profile, which uses Adhan\'s Turkey approximation of Diyanet with Hanafi Asr. Adhan documents this approximation as less accurate outside Turkey.',
    };
  }

  // 8. South Asia: Pakistan, India, Bangladesh, Afghanistan (Karachi Hanafi Standard)
  if (
    ['PK', 'IN', 'BD', 'AF'].includes(country || '') ||
    tz === 'Asia/Karachi' ||
    tz === 'Asia/Kolkata' ||
    tz === 'Asia/Calcutta' ||
    tz === 'Asia/Dhaka' ||
    tz === 'Asia/Kabul'
  ) {
    return {
      method: 'Karachi',
      madhab: 'Hanafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'University of Islamic Sciences, Karachi (Adhan method; Hanafi Asr)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured South Asia profile (Pakistan/India/Bangladesh/Afghanistan), which uses Adhan\'s Karachi method with Hanafi Asr.',
    };
  }

  // 9. North America: USA & Canada (ISNA Standard)
  const timezoneCountry = inferCountryFromTimezone(tz);
  if (country === 'US' || country === 'CA' || (!country && ['US', 'CA'].includes(timezoneCountry || ''))) {
    return {
      method: 'NorthAmerica',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Islamic Society of North America (ISNA)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured USA/Canada profile, which uses Adhan\'s NorthAmerica (ISNA) method with 15° Fajr and Isha angles.',
    };
  }

  // 10. Southeast Asia: Singapore, Malaysia, Indonesia, Brunei (MUIS/JAKIM/MABIMS Standard)
  if (
    ['SG', 'MY', 'ID', 'BN'].includes(country || '') ||
    tz === 'Asia/Singapore' ||
    tz === 'Asia/Kuala_Lumpur' ||
    tz === 'Asia/Kuching' ||
    tz.startsWith('Asia/Jakarta') ||
    tz.startsWith('Asia/Pontianak') ||
    tz.startsWith('Asia/Makassar') ||
    tz.startsWith('Asia/Jayapura') ||
    tz === 'Asia/Brunei'
  ) {
    return {
      method: 'Singapore',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Singapore method (Adhan; configured Southeast Asia profile)',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Southeast Asia profile (Singapore/Malaysia/Indonesia/Brunei), which uses Adhan\'s Singapore method (Fajr 20°, Isha 18°).',
    };
  }

  // 11. Iran (Institute of Geophysics, Tehran)
  if (country === 'IR' || tz === 'Asia/Tehran') {
    return {
      method: 'Tehran',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Institute of Geophysics, University of Tehran',
      selectionReason:
        'Country/timezone mapping matched this service\'s configured Iran profile, which uses Adhan\'s Tehran method associated with the Institute of Geophysics, University of Tehran.',
    };
  }

  // 12. Global Fallback: Europe, UK, Australia & Rest of World (MWL Standard)
  return {
    method: 'MuslimWorldLeague',
    madhab: 'Shafi',
    highLatitudeRule: 'MiddleOfTheNight',
    minuteAdjustments: {},
    authorityDescription: 'Muslim World League (MWL / رابطة العالم الإسلامي)',
    selectionReason:
      'No configured regional mapping matched the supplied location signals. Using this service\'s fallback Adhan Muslim World League method (Fajr 18°, Isha 17°).',
  };
}

export interface ResolvedCalculationParams {
  method: CalculationMethodName;
  madhab: MadhabName;
  highLatitudeRule: HighLatitudeRuleName;
  minuteAdjustments: MinuteAdjustments;
  isAutoResolved: boolean;
  authorityDescription: string;
  selectionReason: string;
  authorityNotice: AuthorityNotice;
  calculationDetails: CalculationDetails;
}

export function resolveCalculationParameters(
  location: ResolvedLocation,
  userPrefs?: Partial<UserPreferences> | null,
  overrideMethod?: CalculationMethodName,
  overrideMadhab?: MadhabName
): ResolvedCalculationParams {
  const defaults = getDefaultCalculationParameters(location);

  const method = overrideMethod || userPrefs?.calculationMethod || defaults.method;
  const madhab = overrideMadhab || userPrefs?.madhab || defaults.madhab;
  const highLatitudeRule = userPrefs?.highLatitudeRule || defaults.highLatitudeRule;

  // Merge minute adjustments: location-specific defaults overridden/augmented by user custom adjustments
  const minuteAdjustments: MinuteAdjustments = {
    ...defaults.minuteAdjustments,
    ...(userPrefs?.minuteAdjustments || {}),
  };

  const isAuto = !overrideMethod && !userPrefs?.calculationMethod;
  const authorityDescription = isAuto ? defaults.authorityDescription : `Custom Override (${method})`;
  let selectionReason = isAuto
    ? defaults.selectionReason
    : `Selected per explicit user preference override for calculation method '${method}' and madhab '${madhab}'.`;
  if (isAuto && location.source === 'fallback_default') {
    selectionReason = 'No usable location was supplied. Using the default Makkah location and its calculation authority.';
  }
  if (isAuto && madhab !== defaults.madhab) {
    selectionReason = `${selectionReason} The Asr madhab was explicitly changed from '${defaults.madhab}' to '${madhab}'.`;
  }

  const authorityNotice: AuthorityNotice = {
    method,
    madhab,
    authorityDescription,
    selectionReason,
    requiredDisplayInstruction: `MANDATORY TRANSPARENCY REQUIREMENT FOR LLM: In your response to the user, you MUST ALWAYS explicitly disclose: 1) The calculation authority used: "${authorityDescription}". 2) Why it was chosen: "${selectionReason}". Never omit this disclosure.`,
  };

  return {
    calculationDetails: {
      timezoneSource: location.timezoneSource,
      locationBasis: location.basis || (location.source === 'cf_geo' ? 'network_geolocation' : location.source === 'fallback_default' ? 'default_location' : undefined),
      locationIsApproximate: location.isApproximated,
      fallbackLocationUsed: location.source === 'fallback_default',
      methodSource: overrideMethod ? 'explicit_override' : userPrefs?.calculationMethod ? 'stored_preference' : 'geographic_default',
      madhabSource: overrideMadhab ? 'explicit_override' : userPrefs?.madhab ? 'stored_preference' : 'geographic_default',
      highLatitudeRuleSource: userPrefs?.highLatitudeRule ? 'stored_preference' : 'geographic_default',
      regionalMinuteAdjustments: { ...defaults.minuteAdjustments },
      customMinuteAdjustments: { ...(userPrefs?.minuteAdjustments || {}) },
    },
    method,
    madhab,
    highLatitudeRule,
    minuteAdjustments,
    isAutoResolved: isAuto,
    authorityDescription,
    selectionReason,
    authorityNotice,
  };
}
