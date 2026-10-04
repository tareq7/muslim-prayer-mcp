import { z } from 'zod';
import type { UserPreferences } from '../engine/types.ts';
import { isValidIanaTimezone, MAJOR_CITIES, CITY_ALIASES, getKnownCity } from '../location/resolver.ts';
import { isValidCalendarDate } from '../engine/calculator.ts';

export const UserIdSchema = z.string().min(1).max(256).regex(/\S/, 'userId must not be whitespace-only').refine((value) => new TextEncoder().encode(value).length <= 256, 'userId must be at most 256 UTF-8 bytes').describe('Nonblank user identifier; at most 256 UTF-8 bytes and 256 characters. Whitespace in nonblank identifiers is preserved.');
export const TimezoneSchema = z.string().refine(isValidIanaTimezone, 'Invalid IANA timezone');
export const CalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidCalendarDate, 'Invalid calendar date; expected YYYY-MM-DD');
export const KnownCitySchema = z.string().refine((value) => !!getKnownCity(value), 'Unsupported predefined city; supply coordinates and timezone').describe(`Supported cities: ${Object.keys(MAJOR_CITIES).join(', ')}. Aliases: ${Object.keys(CITY_ALIASES).join(', ')}. Case, spaces and punctuation are ignored.`);
const geographicInputMetadata = {
  allOf: [{ not: { required: ['city', 'latitude'] } }, { not: { required: ['city', 'longitude'] } }],
  dependencies: { latitude: ['longitude', 'timezone'], longitude: ['latitude', 'timezone'] },
};
const hasCoordinatePair = (input: { latitude?: number; longitude?: number }) =>
  (input.latitude === undefined) === (input.longitude === undefined);

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

export const ReminderDefaultsSchema = z.object({
  reminderMode: ReminderModeEnum.default('prayer_window'),
  exactWindowMinutes: z.number().int().min(5).max(120).default(20),
  locale: LocaleEnum.default('en'),
});

export const MinuteAdjustmentsSchema = z.object({
  fajr: z.number().int().min(-60).max(60).optional(),
  sunrise: z.number().int().min(-60).max(60).optional(),
  dhuhr: z.number().int().min(-60).max(60).optional(),
  asr: z.number().int().min(-60).max(60).optional(),
  maghrib: z.number().int().min(-60).max(60).optional(),
  isha: z.number().int().min(-60).max(60).optional(),
});

export const GetPrayerStatusInputSchema = z.object({
  city: KnownCitySchema.optional(),
  userId: UserIdSchema.optional(),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: TimezoneSchema.optional().describe('IANA timezone; required in the same request when latitude/longitude are supplied. Must agree with the city or be compatible with the coordinate timezone lookup.'),
  calculationMethod: CalculationMethodEnum.optional().describe('Optional calculation authority override (auto-resolved from location by default)'),
  madhab: MadhabEnum.optional().describe('Optional Asr shadow jurisprudence override (Shafi or Hanafi)'),
}).refine(hasCoordinatePair, 'latitude and longitude must be supplied together').refine(
  input => input.city === undefined || (input.latitude === undefined && input.longitude === undefined),
  'Supply city or coordinates, not both'
).meta(geographicInputMetadata);

export const GetTodayPrayerTimesInputSchema = z.object({
  city: KnownCitySchema.optional(),
  userId: UserIdSchema.optional(),
  date: CalendarDateSchema.optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: TimezoneSchema.optional().describe('IANA timezone; required in the same request when latitude/longitude are supplied. Must agree with the city or be compatible with the coordinate timezone lookup.'),
  calculationMethod: CalculationMethodEnum.optional().describe('Optional calculation authority override (auto-resolved from location by default)'),
  madhab: MadhabEnum.optional().describe('Optional Asr shadow jurisprudence override (Shafi or Hanafi)'),
}).refine(hasCoordinatePair, 'latitude and longitude must be supplied together').refine(
  input => input.city === undefined || (input.latitude === undefined && input.longitude === undefined),
  'Supply city or coordinates, not both'
).meta(geographicInputMetadata);

export const GetNextPrayerInputSchema = z.object({
  city: KnownCitySchema.optional(),
  userId: UserIdSchema.optional(),
  latitude: z.number().min(-90).max(90).optional().describe('Optional explicit latitude override'),
  longitude: z.number().min(-180).max(180).optional().describe('Optional explicit longitude override'),
  timezone: TimezoneSchema.optional().describe('IANA timezone; required in the same request when latitude/longitude are supplied. Must agree with the city or be compatible with the coordinate timezone lookup.'),
  calculationMethod: CalculationMethodEnum.optional().describe('Optional calculation authority override (auto-resolved from location by default)'),
  madhab: MadhabEnum.optional().describe('Optional Asr shadow jurisprudence override (Shafi or Hanafi)'),
}).refine(hasCoordinatePair, 'latitude and longitude must be supplied together').refine(
  input => input.city === undefined || (input.latitude === undefined && input.longitude === undefined),
  'Supply city or coordinates, not both'
).meta(geographicInputMetadata);


export const ConfigurePrayerPreferencesInputSchema = z.object({
  clearFixedLocation: z.boolean().optional().describe('Remove stored fixedCity, fixedCoordinates and timezone. Switches to auto_travel unless locationMode is supplied. Cannot combine with a new fixed location/timezone.'),
  userId: UserIdSchema,
  locationMode: LocationModeEnum.optional().describe('Location strategy: fixed uses saved location; auto_travel requires the caller to supply current city or coordinates/timezone on each query and never uses IP geolocation.'),
  fixedCity: KnownCitySchema.optional(),
  fixedCoordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional().describe('Fixed geographical coordinates'),
  timezone: TimezoneSchema.optional().describe('IANA timezone identifier (e.g. Asia/Riyadh, Europe/London)'),
  calculationMethod: CalculationMethodEnum.optional().describe('Islamic prayer calculation authority'),
  madhab: MadhabEnum.optional().describe('Jurisprudential Asr shadow calculation: Shafi or Hanafi'),
  highLatitudeRule: HighLatitudeRuleEnum.optional().describe('High latitude twilight adjustment rule'),
  reminderMode: ReminderModeEnum.optional().describe('Reminder display policy: prayer_window, exact_window, persistent'),
  exactWindowMinutes: z.number().int().min(5).max(120).optional().describe('Duration in minutes for exact_window mode. Omitted updates preserve the saved value; if unset, the service default is 20 minutes unless the operator overrides it.'),
  locale: LocaleEnum.optional().describe('Language for reminder text: en or ar'),
  minuteAdjustments: MinuteAdjustmentsSchema.optional().describe('Custom per-prayer minute offsets (-60 to +60)'),
  enabled: z.boolean().optional().describe('Whether prayer reminders are enabled'),
});

export const GetPrayerPreferencesInputSchema = z.object({
  userId: UserIdSchema,
});

export const HighLatitudeAdjustmentSchema = z.object({
  applied: z.boolean(), rule: HighLatitudeRuleEnum,
  methodSpecificTwilightRule: z.literal('MoonsightingCommittee').optional(),
  astronomicalLatitudeClamped: z.boolean(),
  effectiveLatitude: z.union([z.literal(48), z.literal(-48)]).optional().describe('Substitute latitude only; never the user coordinate'),
  adjustedPrayers: z.array(z.enum(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'])),
  explanation: z.string(),
});
export const CalculationDetailsSchema = z.object({
  expectedTimezone: z.string().optional().describe('Timezone from city registry or approximate coordinate lookup'),
  timezoneValidation: z.enum(['coordinate_lookup','nearby_boundary','city_registry','polar_choice','ocean_choice']).optional().describe('Validation basis; ocean and mathematical-pole locations retain caller-selected civil timezone with explicit disclosure'),
  timezoneSource: z.enum(['explicit_override','stored_preference','city_default','host_header']).optional().describe('Source of the validated timezone or disclosed ocean/pole choice'),
  locationBasis: z.enum(['explicit_coordinates','explicit_city','stored_fixed_coordinates','stored_fixed_city','host_coordinates','host_city','network_geolocation','default_location']).optional(),
  locationIsApproximate: z.boolean().optional(), fallbackLocationUsed: z.boolean().optional(),
  methodSource: z.enum(['explicit_override','stored_preference','geographic_default']).optional(),
  madhabSource: z.enum(['explicit_override','stored_preference','geographic_default']).optional(),
  highLatitudeRuleSource: z.enum(['stored_preference','geographic_default']).optional(),
  regionalMinuteAdjustments: MinuteAdjustmentsSchema.optional(), customMinuteAdjustments: MinuteAdjustmentsSchema.optional(),
  methodMinuteAdjustments: MinuteAdjustmentsSchema.optional(), appliedMinuteAdjustments: z.record(z.string(), z.number()).optional(),
  calendarAlignmentAdjusted: z.boolean().optional(),
});

export const AuthorityNoticeOutputSchema = z.object({
  method: CalculationMethodEnum.describe('The calculation authority method'),
  madhab: MadhabEnum.describe('The Asr jurisprudence school'),
  authorityDescription: z.string().describe('Full descriptive name of the calculation authority'),
  selectionReason: z.string().describe('Rationale for selecting this authority'),
  requiredDisplayInstruction: z.string().describe('Mandatory theological notice for AI presentation'),
  highLatitudeAdjustment: HighLatitudeAdjustmentSchema.optional(),
  calculationDetails: CalculationDetailsSchema.optional(),
});

export const StatusAuthorityNoticeSchema = AuthorityNoticeOutputSchema.omit({ calculationDetails: true, highLatitudeAdjustment: true });

export const PrayerStatusOutputSchema = z.object({
  nextPrayerCalculation: z.object({
    localDate: z.string(),
    usesCurrentCalculation: z.boolean().describe('If true, this next event uses the top-level calculationDetails, highLatitudeAdjustment and authorityNotice; duplicate fields are omitted. Otherwise its own distinct metadata is included.'),
    highLatitudeAdjustment: HighLatitudeAdjustmentSchema.optional(),
    calculationDetails: CalculationDetailsSchema.optional(),
    authorityNotice: StatusAuthorityNoticeSchema.optional(),
  }).optional().describe('Adjustment disclosure for the actual schedule of the next event, including tomorrow'),
  reminderDue: z.boolean().describe('Whether a prayer is currently due for reminder'),
  prayer: z.string().optional().describe('The name of the currently due prayer if applicable'),
  localDate: z.string().describe('Current local date in YYYY-MM-DD'),
  startedAtUtc: z.string().optional().describe('UTC start time of the active prayer window'),
  expiresAtUtc: z.string().optional().describe('UTC expiration time of the active prayer window'),
  prayerWindowExpiresAtUtc: z.string().optional().describe('End of the active prayer period; same boundary as legacy expiresAtUtc'),
  reminderWindowExpiresAtUtc: z.string().optional().describe('Reminder eligibility end; exact_window is capped by the prayer period boundary. Fields appear when a reminder is emitted.'),
  nextPrayer: z.string().describe('The name of the next upcoming prayer'),
  nextPrayerAtUtc: z.string().describe('UTC timestamp of the next upcoming prayer'),
  timezone: z.string().describe('Resolved IANA timezone'),
  calculationMethod: CalculationMethodEnum.describe('Active calculation authority'),
  madhab: MadhabEnum.describe('Active Asr jurisprudence'),
  minuteAdjustments: MinuteAdjustmentsSchema.optional().describe('Applied minute adjustments'),
  authorityDescription: z.string().optional().describe('Description of the calculation authority'),
  selectionReason: z.string().optional().describe('Reason for authority selection'),
  highLatitudeAdjustment: HighLatitudeAdjustmentSchema.optional(),
  calculationDetails: CalculationDetailsSchema.optional(),
  authorityNotice: StatusAuthorityNoticeSchema.optional().describe('Mandatory theological transparency notice; detailed provenance is at top level'),
  reminderText: z.string().optional().describe('Localized reminder message'),
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
  calculationMethod: CalculationMethodEnum.describe('Active calculation authority'),
  madhab: MadhabEnum.describe('Active Asr jurisprudence'),
  minuteAdjustments: MinuteAdjustmentsSchema.optional(),
  authorityDescription: z.string().optional(),
  selectionReason: z.string().optional(),
  highLatitudeAdjustment: HighLatitudeAdjustmentSchema.optional(),
  calculationDetails: CalculationDetailsSchema.optional(),
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
  highLatitudeAdjustment: HighLatitudeAdjustmentSchema.optional(),
  calculationDetails: CalculationDetailsSchema.optional(),
  authorityNotice: AuthorityNoticeOutputSchema.optional(),
  minuteAdjustments: MinuteAdjustmentsSchema.optional(),
});

export const GetNextPrayerOutputSchema = NextPrayerOutputSchema;

export const UserPreferencesObjectSchema = z.object({
  fixedCoordinatesConfigured: z.boolean(),
  fixedCityConfigured: z.boolean(),
  locationMode: LocationModeEnum.optional(),
  fixedCity: z.string().optional(),
  timezone: TimezoneSchema.optional(),
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


export const StoredUserPreferencesSchema = ConfigurePrayerPreferencesInputSchema.omit({ clearFixedLocation: true }).extend({
  locationMode: LocationModeEnum,
  updatedAtUtc: z.string().optional(),
});

export const RestPreferencesInputSchema = ConfigurePrayerPreferencesInputSchema.extend({
  reset: z.boolean().optional(),
});

export const RestCalculationInputSchema = GetTodayPrayerTimesInputSchema;

export function publicPreferences(prefs: Partial<UserPreferences> | null) {
  return UserPreferencesObjectSchema.parse({
    ...(prefs || { message: 'No preferences configured; defaults active.' }),
    fixedCoordinatesConfigured: !!prefs?.fixedCoordinates,
    fixedCityConfigured: !!prefs?.fixedCity,
  });
}
