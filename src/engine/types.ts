export type ObligatoryPrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type PrayerName = ObligatoryPrayerName | 'Sunrise';

export type CalculationMethodName =
  | 'UmmAlQura'
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'NorthAmerica'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'MoonsightingCommittee'
  | 'Singapore'
  | 'Turkey'
  | 'Tehran';

export type MadhabName = 'Shafi' | 'Hanafi';

export type HighLatitudeRuleName =
  | 'MiddleOfTheNight'
  | 'SeventhOfTheNight'
  | 'TwilightAngle';

export type ReminderMode = 'prayer_window' | 'exact_window' | 'persistent';

export type LocationMode = 'auto_travel' | 'fixed';

export type Locale = 'en' | 'ar';

export interface MinuteAdjustments {
  fajr?: number;
  sunrise?: number;
  dhuhr?: number;
  asr?: number;
  maghrib?: number;
  isha?: number;
}

export interface UserPreferences {
  userId: string;
  locationMode: LocationMode;
  fixedCoordinates?: {
    latitude: number;
    longitude: number;
  };
  fixedCity?: string;
  timezone?: string;
  calculationMethod?: CalculationMethodName;
  madhab?: MadhabName;
  highLatitudeRule?: HighLatitudeRuleName;
  reminderMode?: ReminderMode;
  exactWindowMinutes?: number;
  locale?: Locale;
  minuteAdjustments?: MinuteAdjustments;
  enabled?: boolean;
  updatedAtUtc?: string;
}

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  city?: string;
  country?: string;
  source: 'explicit_request' | 'user_fixed_preference' | 'host_header' | 'cached_kv' | 'cf_geo' | 'fallback_default';
  isApproximated: boolean;
}

export interface PrayerTimesUtc {
  fajr: string;      // ISO 8601 UTC
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface AuthorityNotice {
  method: CalculationMethodName;
  madhab: MadhabName;
  authorityDescription: string;
  selectionReason: string;
  requiredDisplayInstruction: string;
}

export interface PrayerSchedule {
  localDate: string; // YYYY-MM-DD in target timezone
  timezone: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  calculationMethod: CalculationMethodName;
  madhab: MadhabName;
  minuteAdjustments?: MinuteAdjustments;
  authorityDescription?: string;
  selectionReason?: string;
  authorityNotice?: AuthorityNotice;
  timesUtc: PrayerTimesUtc;
  timesLocal: Record<PrayerName, string>; // formatted local HH:mm
}

export interface PrayerStatusResult {
  reminderDue: boolean;
  prayer?: ObligatoryPrayerName;
  localDate: string;
  startedAtUtc?: string;
  expiresAtUtc?: string;
  nextPrayer: PrayerName;
  nextPrayerAtUtc: string;
  timezone: string;
  calculationMethod: CalculationMethodName;
  madhab: MadhabName;
  minuteAdjustments?: MinuteAdjustments;
  authorityDescription?: string;
  selectionReason?: string;
  authorityNotice?: AuthorityNotice;
  reminderText?: string;
  dedupeKey?: string;
  locationSource: ResolvedLocation['source'];
}
