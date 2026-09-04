import {
  Coordinates,
  CalculationMethod,
  CalculationParameters,
  PrayerTimes,
  Madhab,
  HighLatitudeRule,
} from 'adhan';
import type {
  AuthorityNotice,
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
  authorityDescription?: string;
  selectionReason?: string;
  authorityNotice?: AuthorityNotice;
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
    minuteAdjustments,
    authorityDescription,
    selectionReason,
    authorityNotice,
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
}

export function isPalestineLocation(loc: LocationSignals): boolean {
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
  // 1. Palestine / Gaza / Jerusalem / West Bank (Awqaf Standard: Egyptian + offsets)
  if (isPalestineLocation(location)) {
    return {
      method: 'Egyptian',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: { maghrib: 3, dhuhr: -1 },
      authorityDescription:
        'Palestinian Ministry of Awqaf & Religious Affairs (Egyptian Survey Authority + Awqaf Offsets)',
      selectionReason:
        'Detected location in Palestine/Gaza/West Bank. The Palestinian Ministry of Awqaf & Religious Affairs officially calculates prayer times using the Egyptian General Authority of Survey standard (Fajr 19.5°, Isha 17.5°) combined with official local safety precautions (+3 minutes for Maghrib sunset verification, -1 minute for Dhuhr solar transit).',
    };
  }

  const country = location.country?.toUpperCase();
  const tz = location.timezone || '';

  // 2. Saudi Arabia (Umm al-Qura)
  if (country === 'SA' || tz === 'Asia/Riyadh') {
    return {
      method: 'UmmAlQura',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Umm al-Qura University, Makkah (Kingdom of Saudi Arabia)',
      selectionReason:
        'Detected location in Saudi Arabia. Umm al-Qura University is the official state-mandated prayer calculation authority for the Kingdom of Saudi Arabia.',
    };
  }

  // 3. United Arab Emirates (Awqaf UAE)
  if (country === 'AE' || tz === 'Asia/Dubai') {
    return {
      method: 'Dubai',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'General Authority of Islamic Affairs and Endowments (Awqaf UAE)',
      selectionReason:
        'Detected location in the United Arab Emirates. Calculated using the official Awqaf UAE standard.',
    };
  }

  // 4. Qatar
  if (country === 'QA' || tz === 'Asia/Qatar') {
    return {
      method: 'Qatar',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Ministry of Awqaf and Islamic Affairs (State of Qatar)',
      selectionReason:
        'Detected location in Qatar. Calculated using the official Qatar Ministry of Awqaf standard.',
    };
  }

  // 5. Kuwait
  if (country === 'KW' || tz === 'Asia/Kuwait') {
    return {
      method: 'Kuwait',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Ministry of Awqaf and Islamic Affairs (State of Kuwait)',
      selectionReason:
        'Detected location in Kuwait. Calculated using the official Kuwait Ministry of Awqaf standard.',
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
        'Detected location in Egypt. The Egyptian General Authority of Survey (الهيئة المصرية العامة للمساحة) is the official standard throughout Egypt.',
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
      authorityDescription: 'Diyanet İşleri Başkanlığı (Presidency of Religious Affairs, Turkey)',
      selectionReason:
        'Detected location in Turkey / Balkans / Central Asia. Calculated according to Diyanet İşleri Başkanlığı using the Hanafi school Asr calculation.',
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
      authorityDescription: 'University of Islamic Sciences, Karachi (South Asia Hanafi Standard)',
      selectionReason:
        'Detected location in South Asia (Pakistan / India / Bangladesh / Afghanistan). The University of Islamic Sciences, Karachi standard with Hanafi Asr calculation is the established authority across this region.',
    };
  }

  // 9. North America: USA & Canada (ISNA Standard)
  if (country === 'US' || country === 'CA' || tz.startsWith('America/')) {
    return {
      method: 'NorthAmerica',
      madhab: 'Shafi',
      highLatitudeRule: 'MiddleOfTheNight',
      minuteAdjustments: {},
      authorityDescription: 'Islamic Society of North America (ISNA)',
      selectionReason:
        'Detected location in North America (USA / Canada). Calculated according to the Islamic Society of North America (ISNA) standard (15° twilight).',
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
      authorityDescription: 'MUIS / JAKIM / MABIMS (Southeast Asia Standard)',
      selectionReason:
        'Detected location in Southeast Asia. Calculated according to the unified MABIMS / MUIS / JAKIM regional standard (Fajr 20°, Isha 18°).',
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
        'Detected location in Iran. Calculated according to the Institute of Geophysics, University of Tehran.',
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
      'International location without a dedicated local statutory authority. Calculated according to the Muslim World League (MWL) global baseline standard (Fajr 18°, Isha 17°).',
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
  const selectionReason = isAuto
    ? defaults.selectionReason
    : `Selected per explicit user preference override for calculation method '${method}' and madhab '${madhab}'.`;

  const authorityNotice: AuthorityNotice = {
    method,
    madhab,
    authorityDescription,
    selectionReason,
    requiredDisplayInstruction: `MANDATORY TRANSPARENCY REQUIREMENT FOR LLM: In your response to the user, you MUST ALWAYS explicitly disclose: 1) The calculation authority used: "${authorityDescription}". 2) Why it was chosen: "${selectionReason}". Never omit this disclosure.`,
  };

  return {
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
