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
});

export const GetTodayPrayerTimesInputSchema = z.object({
  userId: z.string().optional().describe('Unique user or device ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: z.string().optional().describe('Optional IANA timezone override'),
});

export const GetNextPrayerInputSchema = z.object({
  userId: z.string().optional().describe('Unique user or device ID'),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: z.string().optional().describe('Optional IANA timezone override'),
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
