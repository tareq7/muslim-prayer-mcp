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
  basis?: CalculationDetails['locationBasis'];
  timezoneSource?: CalculationDetails['timezoneSource'];
  expectedTimezone?: string;
  timezoneValidation?: CalculationDetails['timezoneValidation'];
}

export interface PrayerTimesUtc {
  fajr: string;      // ISO 8601 UTC
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface HighLatitudeAdjustment {
  applied: boolean;
  rule: HighLatitudeRuleName;
  methodSpecificTwilightRule?: 'MoonsightingCommittee';
  astronomicalLatitudeClamped: boolean;
  effectiveLatitude?: 48 | -48;
  adjustedPrayers: PrayerName[];
  explanation: string;
}

export interface CalculationDetails {
  expectedTimezone?: string;
  timezoneValidation?: 'coordinate_lookup' | 'nearby_boundary' | 'city_registry' | 'polar_choice' | 'ocean_choice';
  timezoneSource?: 'explicit_override' | 'stored_preference' | 'city_default' | 'host_header';
  locationBasis?: 'explicit_coordinates' | 'explicit_city' | 'stored_fixed_coordinates' | 'stored_fixed_city' | 'host_coordinates' | 'host_city' | 'network_geolocation' | 'default_location';
  locationIsApproximate?: boolean;
  fallbackLocationUsed?: boolean;
  methodSource?: 'explicit_override' | 'stored_preference' | 'geographic_default';
  madhabSource?: 'explicit_override' | 'stored_preference' | 'geographic_default';
  highLatitudeRuleSource?: 'stored_preference' | 'geographic_default';
  regionalMinuteAdjustments?: MinuteAdjustments;
  customMinuteAdjustments?: MinuteAdjustments;
  methodMinuteAdjustments?: MinuteAdjustments;
  appliedMinuteAdjustments?: MinuteAdjustments;
  calendarAlignmentAdjusted?: boolean;
}

export interface AuthorityNotice {
  method: CalculationMethodName;
  madhab: MadhabName;
  authorityDescription: string;
  selectionReason: string;
  requiredDisplayInstruction: string;
  highLatitudeAdjustment?: HighLatitudeAdjustment;
  calculationDetails?: CalculationDetails;
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
  highLatitudeAdjustment?: HighLatitudeAdjustment;
  calculationDetails?: CalculationDetails;
  timesUtc: PrayerTimesUtc;
  timesLocal: Record<PrayerName, string>; // formatted local HH:mm
}

export interface PrayerStatusResult {
  reminderDue: boolean;
  prayer?: ObligatoryPrayerName;
  localDate: string;
  startedAtUtc?: string;
  expiresAtUtc?: string;
  prayerWindowExpiresAtUtc?: string;
  reminderWindowExpiresAtUtc?: string;
  nextPrayer: ObligatoryPrayerName;
  nextPrayerAtUtc: string;
  timezone: string;
  calculationMethod: CalculationMethodName;
  madhab: MadhabName;
  minuteAdjustments?: MinuteAdjustments;
  authorityDescription?: string;
  selectionReason?: string;
  authorityNotice?: AuthorityNotice;
  highLatitudeAdjustment?: HighLatitudeAdjustment;
  calculationDetails?: CalculationDetails;
  reminderText?: string;
  dedupeKey?: string;
  locationSource: ResolvedLocation['source'];
  nextPrayerCalculation?: {
    localDate: string;
    highLatitudeAdjustment?: HighLatitudeAdjustment;
    calculationDetails?: CalculationDetails;
    authorityNotice?: AuthorityNotice;
  };
}
