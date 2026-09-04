import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ConfigurePrayerPreferencesInputSchema,
  GetNextPrayerInputSchema,
  GetPrayerPreferencesInputSchema,
  GetPrayerStatusInputSchema,
  GetTodayPrayerTimesInputSchema,
} from './schemas.ts';
import {
  calculateDailySchedule,
  formatLocalTime,
  resolveCalculationParameters,
} from '../engine/calculator.ts';
import { evaluatePrayerStatus } from '../engine/reminder.ts';
import { resolveLocation } from '../location/resolver.ts';
import { PrayerStorage } from '../storage/kv-store.ts';
import type { UserPreferences } from '../engine/types.ts';

export function createPrayerMcpServer(storage: PrayerStorage) {
  const server = new McpServer({
    name: 'muslim-prayer-reminder',
    version: '1.0.0',
  });

  // Tool 1: get_prayer_status
  server.registerTool(
    'get_prayer_status',
    {
      title: 'Check Muslim Prayer Due Status',
      description:
        'Checks if a Muslim obligatory prayer (Fajr, Dhuhr, Asr, Maghrib, Isha) is currently due for the user location and returns active reminder details. Automatically resolves local authority calculation method and adjustments if not overridden.',
      inputSchema: GetPrayerStatusInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const userId = args.userId || 'default_user';
      const userPrefs = await storage.getUserPreferences(userId);

      const location = resolveLocation({
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
        reminderMode: userPrefs?.reminderMode || 'prayer_window',
        exactWindowMinutes: userPrefs?.exactWindowMinutes || 20,
        locale: userPrefs?.locale || 'en',
        userId,
        isAlreadySent: async (key) => storage.isDedupeSent(key),
      });

      if (status.reminderDue && status.dedupeKey) {
        await storage.recordDedupeSent(status.dedupeKey);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }
  );

  // Tool 2: get_today_prayer_times
  server.registerTool(
    'get_today_prayer_times',
    {
      title: 'Get Full Daily Prayer Timetable',
      description:
        'Retrieves today prayer timetable (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) in UTC and formatted local time. Pure astronomical calculation with automatic local calculation authority defaults.',
      inputSchema: GetTodayPrayerTimesInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const userId = args.userId || 'default_user';
      const userPrefs = await storage.getUserPreferences(userId);

      const location = resolveLocation({
        explicitLat: args.latitude,
        explicitLng: args.longitude,
        explicitTimezone: args.timezone,
        userPrefs,
      });

      const targetDate = args.date ? new Date(`${args.date}T12:00:00Z`) : new Date();

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
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(schedule, null, 2),
          },
        ],
      };
    }
  );

  // Tool 3: get_next_prayer
  server.registerTool(
    'get_next_prayer',
    {
      title: 'Get Upcoming Prayer and Countdown',
      description:
        'Returns the immediate next prayer name, scheduled time, authority calculation method, and remaining countdown in minutes. Read-only operation.',
      inputSchema: GetNextPrayerInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const userId = args.userId || 'default_user';
      const userPrefs = await storage.getUserPreferences(userId);

      const location = resolveLocation({
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
        locale: userPrefs?.locale || 'en',
        userId,
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
        minuteAdjustments: status.minuteAdjustments,
        locationSource: status.locationSource,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  // Tool 4: configure_prayer_preferences
  server.registerTool(
    'configure_prayer_preferences',
    {
      title: 'Configure User Prayer Preferences',
      description:
        'Configures prayer calculation parameters, location behavior (fixed or auto_travel), madhab, reminder mode, and notification language in persistent storage.',
      inputSchema: ConfigurePrayerPreferencesInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const existing = (await storage.getUserPreferences(args.userId)) || {
        userId: args.userId,
        locationMode: 'auto_travel',
        calculationMethod: 'UmmAlQura',
        madhab: 'Shafi',
        highLatitudeRule: 'MiddleOfTheNight',
        reminderMode: 'prayer_window',
        exactWindowMinutes: 20,
        locale: 'en',
        minuteAdjustments: {},
        enabled: true,
        updatedAtUtc: new Date().toISOString(),
      };

      const updated: UserPreferences = {
        ...existing,
        locationMode: args.locationMode ?? existing.locationMode,
        fixedCity: args.fixedCity ?? existing.fixedCity,
        fixedCoordinates: args.fixedCoordinates ?? existing.fixedCoordinates,
        timezone: args.timezone ?? existing.timezone,
        calculationMethod: args.calculationMethod ?? existing.calculationMethod,
        madhab: args.madhab ?? existing.madhab,
        highLatitudeRule: args.highLatitudeRule ?? existing.highLatitudeRule,
        reminderMode: args.reminderMode ?? existing.reminderMode,
        exactWindowMinutes: args.exactWindowMinutes ?? existing.exactWindowMinutes,
        locale: args.locale ?? existing.locale,
        minuteAdjustments: args.minuteAdjustments ?? existing.minuteAdjustments,
        enabled: args.enabled ?? existing.enabled,
        updatedAtUtc: new Date().toISOString(),
      };

      await storage.saveUserPreferences(updated);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, preferences: updated }, null, 2),
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const prefs = await storage.getUserPreferences(args.userId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(prefs || { message: 'No preferences configured; defaults active.' }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
