import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  ConfigurePrayerPreferencesInputSchema,
  ConfigurePrayerPreferencesOutputSchema,
  GetNextPrayerInputSchema,
  NextPrayerOutputSchema,
  GetPrayerPreferencesInputSchema,
  GetPrayerPreferencesOutputSchema,
  GetPrayerStatusInputSchema,
  GetTodayPrayerTimesInputSchema,
  PrayerScheduleOutputSchema,
  PrayerStatusOutputSchema,
  publicPreferences,
} from './schemas.ts';
import {
  calculateDailySchedule,
  InvalidCalculationError,
  formatLocalTime,
  resolveCalculationParameters,
} from '../engine/calculator.ts';
import { evaluatePrayerStatus } from '../engine/reminder.ts';
import { resolveUserLocation, LocationRequiredError, type ResolveLocationParams } from '../location/resolver.ts';
import { PrayerStorage } from '../storage/kv-store.ts';
import type { ReminderMode, Locale } from '../engine/types.ts';

async function prayerResult(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof LocationRequiredError) && !(error instanceof InvalidCalculationError)) throw error;
    const details = { code: error.code, message: error.message };
    return { isError: true, structuredContent: details, content: [{ type: 'text', text: JSON.stringify(details) }] };
  }
}

export function createPrayerMcpServer(storage: PrayerStorage, context: Pick<ResolveLocationParams, 'headers' | 'cf'> & {
  reminderMode?: ReminderMode; exactWindowMinutes?: number; locale?: Locale;
} = {}) {
  const server = new McpServer(
    {
      name: 'muslim-prayer-reminder',
      version: '1.1.0',
    },
    {
      instructions:
        'MANDATORY TRANSPARENCY INSTRUCTION FOR AI MODELS: When answering user queries regarding prayer times, timetable schedules, next prayer countdowns, or prayer status, you MUST ALWAYS explicitly inform the user of: 1) The exact calculation authority method used (e.g. Palestinian Ministry of Awqaf / Egyptian Survey Authority, Umm al-Qura University, Diyanet, Karachi, ISNA, etc.). 2) The exact reason WHY this authority was chosen (e.g. automatically resolved from geographic location or explicit user preference). Never present prayer times without disclosing the authority and reason. Also disclose highLatitudeAdjustment.explanation whenever applied, including substituted polar sunrise/sunset. Require explicit user city or coordinates/timezone; on location_required ask for location and never guess from infrastructure IP.',
    }
  );

  // Tool 1: get_prayer_status
  server.registerTool(
    'get_prayer_status',
    {
      title: 'Check Muslim Prayer Due Status',
      description:
        'Checks if a Muslim obligatory prayer (Fajr, Dhuhr, Asr, Maghrib, Isha) is currently due for the user location and returns active reminder details. MANDATORY: The LLM must always explicitly disclose to the user which calculation authority method was used and why it was selected (see authorityNotice in response).',
      inputSchema: GetPrayerStatusInputSchema,
      outputSchema: PrayerStatusOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      return prayerResult(async () => {
        return storage.withUserLock(args.userId, async () => {
          const userPrefs = args.userId ? await storage.getUserPreferences(args.userId) : null;
          const dedupeUserId = args.userId || 'anon';

          const location = resolveUserLocation({
            ...context,
            explicitCity: args.city,
            explicitLat: args.latitude,
            explicitLng: args.longitude,
            explicitTimezone: args.timezone,
            userPrefs,
          });

          const params = resolveCalculationParameters(
            location,
            userPrefs,
            args.calculationMethod,
            args.madhab
          );

          const status = await evaluatePrayerStatus({
            now: new Date(),
            location,
            method: params.method,
            madhab: params.madhab,
            highLatitudeRule: params.highLatitudeRule,
            minuteAdjustments: params.minuteAdjustments,
            authorityDescription: params.authorityDescription,
            selectionReason: params.selectionReason,
            authorityNotice: params.authorityNotice,
            calculationDetails: params.calculationDetails,
            enabled: userPrefs?.enabled,
            reminderMode: userPrefs?.reminderMode ?? context.reminderMode ?? 'prayer_window',
            exactWindowMinutes: userPrefs?.exactWindowMinutes ?? context.exactWindowMinutes ?? 20,
            locale: userPrefs?.locale ?? context.locale ?? 'en',
            userId: dedupeUserId,
            isAlreadySent: args.userId ? (key) => storage.isDedupeSent(key) : () => false,
          });


          if (args.userId && status.reminderDue && status.dedupeKey && status.expiresAtUtc && (userPrefs?.reminderMode ?? context.reminderMode) !== 'persistent') {
            const ttl = Math.min(86400, Math.ceil((Date.parse(status.expiresAtUtc) - Date.now()) / 1000));
            await storage.recordDedupeSent(status.dedupeKey, ttl);
          }

          const { dedupeKey, locationSource, ...cleanStatus } = status;

          return {
            structuredContent: cleanStatus,
            content: [
              {
                type: 'text',
                text: JSON.stringify(cleanStatus, null, 2),
              },
            ],
          };
        });
      });
    }
  );

  // Tool 2: get_today_prayer_times
  server.registerTool(
    'get_today_prayer_times',
    {
      title: 'Get Full Daily Prayer Timetable',
      description:
        'Retrieves today prayer timetable (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) in UTC and formatted local time. MANDATORY: The LLM must always explicitly disclose to the user which calculation authority method was used and why it was selected (see authorityNotice in response).',
      inputSchema: GetTodayPrayerTimesInputSchema,
      outputSchema: PrayerScheduleOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      return prayerResult(async () => {
        const userPrefs = args.userId ? await storage.getUserPreferences(args.userId) : null;

        const location = resolveUserLocation({
          ...context,
          explicitCity: args.city,
          explicitLat: args.latitude,
          explicitLng: args.longitude,
          explicitTimezone: args.timezone,
          userPrefs,
        });


        const targetDate = args.date ?? new Date();

        const params = resolveCalculationParameters(
          location,
          userPrefs,
          args.calculationMethod,
          args.madhab
        );

        const schedule = calculateDailySchedule({
          latitude: location.latitude,
          longitude: location.longitude,
          date: targetDate,
          timezone: location.timezone,
          method: params.method,
          madhab: params.madhab,
          highLatitudeRule: params.highLatitudeRule,
          minuteAdjustments: params.minuteAdjustments,
          authorityDescription: params.authorityDescription,
          selectionReason: params.selectionReason,
          authorityNotice: params.authorityNotice,
          calculationDetails: params.calculationDetails,
        });

        const { coordinates, ...cleanSchedule } = schedule;

        return {
          structuredContent: cleanSchedule,
          content: [
            {
              type: 'text',
              text: JSON.stringify(cleanSchedule, null, 2),
            },
          ],
        };
      });
    }
  );

  // Tool 3: get_next_prayer
  server.registerTool(
    'get_next_prayer',
    {
      title: 'Get Upcoming Prayer and Countdown',
      description:
        'Returns the immediate next prayer name, scheduled time, authority calculation method, and remaining countdown in minutes. MANDATORY: The LLM must always explicitly disclose to the user which calculation authority method was used and why it was selected (see authorityNotice in response).',
      inputSchema: GetNextPrayerInputSchema,
      outputSchema: NextPrayerOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      return prayerResult(async () => {
        const userPrefs = args.userId ? await storage.getUserPreferences(args.userId) : null;
        const dedupeUserId = args.userId || 'anon';

        const location = resolveUserLocation({
          ...context,
          explicitCity: args.city,
          explicitLat: args.latitude,
          explicitLng: args.longitude,
          explicitTimezone: args.timezone,
          userPrefs,
        });

        const now = new Date();
        const params = resolveCalculationParameters(
          location,
          userPrefs,
          args.calculationMethod,
          args.madhab
        );

        const status = await evaluatePrayerStatus({
          now,
          location,
          method: params.method,
          madhab: params.madhab,
          highLatitudeRule: params.highLatitudeRule,
          minuteAdjustments: params.minuteAdjustments,
          authorityDescription: params.authorityDescription,
          selectionReason: params.selectionReason,
          authorityNotice: params.authorityNotice,
          calculationDetails: params.calculationDetails,
          locale: userPrefs?.locale || 'en',
          userId: dedupeUserId,
        });


        const nextPrayerDate = new Date(status.nextPrayerAtUtc);
        const remainingMinutes = Math.max(0, Math.round((nextPrayerDate.getTime() - now.getTime()) / 60000));

        const payload = {
          currentLocalDate: status.localDate,
          timezone: status.timezone,
          nextPrayer: status.nextPrayer,
          nextPrayerAtUtc: status.nextPrayerAtUtc,
          nextPrayerLocalTime: formatLocalTime(nextPrayerDate, status.timezone),
          remainingMinutes,
          calculationMethod: status.calculationMethod,
          madhab: status.madhab,
          authorityDescription: status.authorityDescription,
          selectionReason: status.selectionReason,
          authorityNotice: status.nextPrayerCalculation?.authorityNotice ?? status.authorityNotice,
          highLatitudeAdjustment: status.nextPrayerCalculation?.highLatitudeAdjustment ?? status.highLatitudeAdjustment,
          calculationDetails: status.nextPrayerCalculation?.calculationDetails ?? status.calculationDetails,
          minuteAdjustments: status.minuteAdjustments,
        };

        return {
          structuredContent: payload,
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      });
    }
  );

  // Tool 4: configure_prayer_preferences
  server.registerTool(
    'configure_prayer_preferences',
    {
      title: 'Configure User Prayer Preferences',
      description:
        'Updates persistent prayer preferences, overwriting supplied settings while preserving omitted settings. Setting fixedCity replaces stored fixedCoordinates and clears the stored timezone unless supplied; setting fixedCoordinates replaces stored fixedCity. Can disable reminders. Previous values are not retained for undo.',
      inputSchema: ConfigurePrayerPreferencesInputSchema.shape,
      outputSchema: ConfigurePrayerPreferencesOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const updated = await storage.updateUserPreferences(args);
      const preferences = publicPreferences(updated);

      const result = { success: true, preferences };
      return {
        structuredContent: result,
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tool 5: get_prayer_preferences
  server.registerTool(
    'get_prayer_preferences',
    {
      title: 'Retrieve Stored Prayer Preferences',
      description: 'Returns the currently active calculation settings and preferences for a user. Read-only operation.',
      inputSchema: GetPrayerPreferencesInputSchema.shape,
      outputSchema: GetPrayerPreferencesOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const prefs = await storage.getUserPreferences(args.userId);
      const result = publicPreferences(prefs);
      return {
        structuredContent: result,
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
