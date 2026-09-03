import { createPrayerMcpServer } from './mcp/server.ts';
import { PrayerStorage } from './storage/kv-store.ts';
import { resolveLocation } from './location/resolver.ts';
import { evaluatePrayerStatus } from './engine/reminder.ts';
import { calculateDailySchedule } from './engine/calculator.ts';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CalculationMethodName, MadhabName, UserPreferences } from './engine/types.ts';

export interface Env {
  PRAYER_KV?: any;
  AUTH_TOKEN?: string;
  DEFAULT_CALCULATION_METHOD?: CalculationMethodName;
  DEFAULT_MADHAB?: MadhabName;
  DEFAULT_REMINDER_MODE?: string;
  DEFAULT_EXACT_WINDOW_MINUTES?: string;
  DEFAULT_LOCALE?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Coordinates, X-User-Timezone, X-User-City',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx?: any): Promise<Response> {
    const url = new URL(request.url);

    // Preflight CORS handler
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return jsonResponse({
        status: 'healthy',
        service: 'muslim-prayer-reminder-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    }

    // Static Server Card for MCP Registry Discovery (Smithery, Glama)
    if (url.pathname === '/.well-known/mcp/server-card.json') {
      return jsonResponse({
        serverInfo: {
          name: 'muslim-prayer-reminder',
          version: '1.0.0',
        },
        description: 'Production-ready Muslim prayer reminder system on Cloudflare Workers with Streamable HTTP MCP.',
        tools: [
          { name: 'get_prayer_status', description: 'Checks if an obligatory prayer is currently due.' },
          { name: 'get_today_prayer_times', description: 'Retrieves today prayer timetable.' },
          { name: 'get_next_prayer', description: 'Returns next prayer name and remaining countdown.' },
          { name: 'configure_prayer_preferences', description: 'Configures calculation and reminder parameters.' },
          { name: 'get_prayer_preferences', description: 'Inspects active user preferences.' },
        ],
      });
    }

    const storage = new PrayerStorage(env.PRAYER_KV);

    // REST Fast Status Check Endpoint: /api/status
    if (url.pathname === '/api/status' && request.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'default_user';
      const latParam = url.searchParams.get('lat');
      const lngParam = url.searchParams.get('lng');
      const tzParam = url.searchParams.get('timezone');

      const userPrefs = await storage.getUserPreferences(userId);

      const location = resolveLocation({
        explicitLat: latParam ? parseFloat(latParam) : undefined,
        explicitLng: lngParam ? parseFloat(lngParam) : undefined,
        explicitTimezone: tzParam || undefined,
        userPrefs,
        headers: request.headers,
        cf: (request as any).cf,
      });

      const method = userPrefs?.calculationMethod || env.DEFAULT_CALCULATION_METHOD || 'UmmAlQura';
      const madhab = userPrefs?.madhab || env.DEFAULT_MADHAB || 'Shafi';
      const reminderMode = userPrefs?.reminderMode || (env.DEFAULT_REMINDER_MODE as any) || 'prayer_window';
      const exactWindowMinutes = userPrefs?.exactWindowMinutes || parseInt(env.DEFAULT_EXACT_WINDOW_MINUTES || '20', 10);
      const locale = userPrefs?.locale || (env.DEFAULT_LOCALE as any) || 'en';

      const status = await evaluatePrayerStatus({
        now: new Date(),
        location,
        method,
        madhab,
        reminderMode,
        exactWindowMinutes,
        locale,
        userId,
        isAlreadySent: async (key) => storage.isDedupeSent(key),
      });

      if (status.reminderDue && status.dedupeKey) {
        await storage.recordDedupeSent(status.dedupeKey);
      }

      return jsonResponse(status);
    }

    // REST Timetable Endpoint: /api/timetable
    if (url.pathname === '/api/timetable' && request.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'default_user';
      const dateParam = url.searchParams.get('date');
      const userPrefs = await storage.getUserPreferences(userId);

      const location = resolveLocation({
        userPrefs,
        headers: request.headers,
        cf: (request as any).cf,
      });

      const targetDate = dateParam ? new Date(`${dateParam}T12:00:00Z`) : new Date();

      const schedule = calculateDailySchedule({
        latitude: location.latitude,
        longitude: location.longitude,
        date: targetDate,
        timezone: location.timezone,
        method: userPrefs?.calculationMethod || 'UmmAlQura',
        madhab: userPrefs?.madhab || 'Shafi',
        minuteAdjustments: userPrefs?.minuteAdjustments,
      });

      return jsonResponse(schedule);
    }

    // REST Preferences Save Endpoint: /api/preferences
    if (url.pathname === '/api/preferences' && request.method === 'POST') {
      try {
        const body = (await request.json()) as Partial<UserPreferences> & { userId: string };
        if (!body.userId) {
          return jsonResponse({ error: 'userId is required' }, 400);
        }

        const existing = (await storage.getUserPreferences(body.userId)) || {
          userId: body.userId,
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
          ...body,
          updatedAtUtc: new Date().toISOString(),
        };

        await storage.saveUserPreferences(updated);
        return jsonResponse({ success: true, preferences: updated });
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Invalid JSON body' }, 400);
      }
    }

    // MCP Protocol Handler: /mcp
    if (url.pathname === '/mcp') {
      const mcpServer = createPrayerMcpServer(storage);

      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
      });

      await mcpServer.connect(transport);
      return transport.handleRequest(request);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};
