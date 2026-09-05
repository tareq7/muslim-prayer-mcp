import { z } from 'zod';

export const CalculationMethodEnum = z.enum([
  'UmmAlQura',
  'MuslimWorldLeague',
  'Egyptian',
  'Karachi',
  'NorthAmerica',
  'Dubai',
  'Qatar',
  'Kuwait',
  'MoonsightingCommittee',
  'Singapore',
  'Turkey',
  'Tehran',
]);

export const MadhabEnum = z.enum(['Shafi', 'Hanafi']);

export const HighLatitudeRuleEnum = z.enum([
  'MiddleOfTheNight',
  'SeventhOfTheNight',
  'TwilightAngle',
]);

export const ReminderModeEnum = z.enum(['prayer_window', 'exact_window', 'persistent']);

export const LocationModeEnum = z.enum(['auto_travel', 'fixed']);

export const LocaleEnum = z.enum(['en', 'ar']);

export const MinuteAdjustmentsSchema = z.object({
  fajr: z.number().int().min(-60).max(60).optional(),
  sunrise: z.number().int().min(-60).max(60).optional(),
  dhuhr: z.number().int().min(-60).max(60).optional(),
  asr: z.number().int().min(-60).max(60).optional(),
  maghrib: z.number().int().min(-60).max(60).optional(),
  isha: z.number().int().min(-60).max(60).optional(),
});

export const GetPrayerStatusInputSchema = z.object({
  userId: z.string().optional().describe('Unique user or device ID for preference and deduplication tracking'),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: z.string().optional().describe('Optional IANA timezone override (e.g. Asia/Riyadh)'),
  calculationMethod: CalculationMethodEnum.optional().describe('Optional calculation authority override (auto-resolved from location by default)'),
  madhab: MadhabEnum.optional().describe('Optional Asr shadow jurisprudence override (Shafi or Hanafi)'),
});

export const GetTodayPrayerTimesInputSchema = z.object({
  userId: z.string().optional().describe('Unique user or device ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: z.string().optional().describe('Optional IANA timezone override'),
  calculationMethod: CalculationMethodEnum.optional().describe('Optional calculation authority override (auto-resolved from location by default)'),
  madhab: MadhabEnum.optional().describe('Optional Asr shadow jurisprudence override (Shafi or Hanafi)'),
});

export const GetNextPrayerInputSchema = z.object({
  userId: z.string().optional().describe('Unique user or device ID'),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: z.string().optional().describe('Optional IANA timezone override'),
  calculationMethod: CalculationMethodEnum.optional().describe('Optional calculation authority override (auto-resolved from location by default)'),
  madhab: MadhabEnum.optional().describe('Optional Asr shadow jurisprudence override (Shafi or Hanafi)'),
});

export const ConfigurePrayerPreferencesInputSchema = z.object({
  userId: z.string().min(1).describe('Unique user identifier'),
  locationMode: LocationModeEnum.optional().describe('Location strategy: auto_travel or fixed'),
  fixedCity: z.string().optional().describe('Predefined city name for fixed location (e.g. Riyadh, London)'),
  fixedCoordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional().describe('Fixed geographical coordinates'),
  timezone: z.string().optional().describe('IANA timezone identifier (e.g. Asia/Riyadh, Europe/London)'),
  calculationMethod: CalculationMethodEnum.optional().describe('Islamic prayer calculation authority'),
  madhab: MadhabEnum.optional().describe('Jurisprudential Asr shadow calculation: Shafi or Hanafi'),
  highLatitudeRule: HighLatitudeRuleEnum.optional().describe('High latitude twilight adjustment rule'),
  reminderMode: ReminderModeEnum.optional().describe('Reminder display policy: prayer_window, exact_window, persistent'),
  exactWindowMinutes: z.number().int().min(5).max(120).optional().describe('Duration in minutes for exact_window mode'),
  locale: LocaleEnum.optional().describe('Language for reminder text: en or ar'),
  minuteAdjustments: MinuteAdjustmentsSchema.optional().describe('Custom per-prayer minute offsets (-60 to +60)'),
  enabled: z.boolean().optional().describe('Whether prayer reminders are enabled'),
});

export const GetPrayerPreferencesInputSchema = z.object({
  userId: z.string().min(1).describe('Unique user identifier'),
});

export const AuthorityNoticeOutputSchema = z.object({
  method: CalculationMethodEnum.describe('The calculation authority method'),
  madhab: MadhabEnum.describe('The Asr jurisprudence school'),
  authorityDescription: z.string().describe('Full descriptive name of the calculation authority'),
  selectionReason: z.string().describe('Rationale for selecting this authority'),
  requiredDisplayInstruction: z.string().describe('Mandatory theological notice for AI presentation'),
});

export const PrayerStatusOutputSchema = z.object({
  reminderDue: z.boolean().describe('Whether a prayer is currently due for reminder'),
  prayer: z.string().optional().describe('The name of the currently due prayer if applicable'),
  localDate: z.string().describe('Current local date in YYYY-MM-DD'),
  startedAtUtc: z.string().optional().describe('UTC start time of the active prayer window'),
  expiresAtUtc: z.string().optional().describe('UTC expiration time of the active prayer window'),
  nextPrayer: z.string().describe('The name of the next upcoming prayer'),
  nextPrayerAtUtc: z.string().describe('UTC timestamp of the next upcoming prayer'),
  timezone: z.string().describe('Resolved IANA timezone'),
  calculationMethod: CalculationMethodEnum.describe('Active calculation authority'),
  madhab: MadhabEnum.describe('Active Asr jurisprudence'),
  minuteAdjustments: MinuteAdjustmentsSchema.optional().describe('Applied minute adjustments'),
  authorityDescription: z.string().optional().describe('Description of the calculation authority'),
  selectionReason: z.string().optional().describe('Reason for authority selection'),
  authorityNotice: AuthorityNoticeOutputSchema.optional().describe('Mandatory theological transparency notice'),
  reminderText: z.string().optional().describe('Localized reminder message'),
  dedupeKey: z.string().optional().describe('Deduplication cache key'),
  locationSource: z.string().describe('Source of location resolution'),
});

export const PrayerTimesUtcSchema = z.object({
  fajr: z.string().describe('Fajr UTC timestamp'),
  sunrise: z.string().describe('Sunrise UTC timestamp'),
  dhuhr: z.string().describe('Dhuhr UTC timestamp'),
  asr: z.string().describe('Asr UTC timestamp'),
  maghrib: z.string().describe('Maghrib UTC timestamp'),
  isha: z.string().describe('Isha UTC timestamp'),
});

export const PrayerTimesLocalSchema = z.object({
  Fajr: z.string().describe('Fajr local 24h time HH:mm'),
  Sunrise: z.string().describe('Sunrise local 24h time HH:mm'),
  Dhuhr: z.string().describe('Dhuhr local 24h time HH:mm'),
  Asr: z.string().describe('Asr local 24h time HH:mm'),
  Maghrib: z.string().describe('Maghrib local 24h time HH:mm'),
  Isha: z.string().describe('Isha local 24h time HH:mm'),
});

export const PrayerScheduleOutputSchema = z.object({
  localDate: z.string().describe('Local schedule date YYYY-MM-DD'),
  timezone: z.string().describe('Resolved IANA timezone'),
  coordinates: z.object({
    latitude: z.number().describe('Latitude in degrees'),
    longitude: z.number().describe('Longitude in degrees'),
  }),
  calculationMethod: CalculationMethodEnum.describe('Active calculation authority'),
  madhab: MadhabEnum.describe('Active Asr jurisprudence'),
  minuteAdjustments: MinuteAdjustmentsSchema.optional(),
  authorityDescription: z.string().optional(),
  selectionReason: z.string().optional(),
  authorityNotice: AuthorityNoticeOutputSchema.optional(),
  timesUtc: PrayerTimesUtcSchema,
  timesLocal: PrayerTimesLocalSchema,
});

export const NextPrayerOutputSchema = z.object({
  currentLocalDate: z.string().describe('Current local date YYYY-MM-DD'),
  timezone: z.string().describe('Resolved IANA timezone'),
  nextPrayer: z.string().describe('Name of the upcoming prayer'),
  nextPrayerAtUtc: z.string().describe('UTC timestamp of the upcoming prayer'),
  nextPrayerLocalTime: z.string().describe('Formatted local time HH:mm'),
  remainingMinutes: z.number().int().describe('Minutes remaining until prayer start'),
  calculationMethod: CalculationMethodEnum.describe('Active calculation authority'),
  madhab: MadhabEnum.describe('Active Asr jurisprudence'),
  authorityDescription: z.string().optional(),
  selectionReason: z.string().optional(),
  authorityNotice: AuthorityNoticeOutputSchema.optional(),
  minuteAdjustments: MinuteAdjustmentsSchema.optional(),
  locationSource: z.string().describe('Source of location resolution'),
});

export const GetNextPrayerOutputSchema = NextPrayerOutputSchema;

export const UserPreferencesObjectSchema = z.object({
  userId: z.string().optional(),
  locationMode: LocationModeEnum.optional(),
  fixedCoordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  fixedCity: z.string().optional(),
  timezone: z.string().optional(),
  calculationMethod: CalculationMethodEnum.optional(),
  madhab: MadhabEnum.optional(),
  highLatitudeRule: HighLatitudeRuleEnum.optional(),
  reminderMode: ReminderModeEnum.optional(),
  exactWindowMinutes: z.number().optional(),
  locale: LocaleEnum.optional(),
  minuteAdjustments: MinuteAdjustmentsSchema.optional(),
  enabled: z.boolean().optional(),
  updatedAtUtc: z.string().optional(),
  message: z.string().optional(),
});

export const ConfigurePrayerPreferencesOutputSchema = z.object({
  success: z.boolean().describe('Whether configuration succeeded'),
  preferences: UserPreferencesObjectSchema,
});

export const GetPrayerPreferencesOutputSchema = UserPreferencesObjectSchema;

