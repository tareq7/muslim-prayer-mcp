import { createPrayerMcpServer } from './mcp/server.ts';
import { PrayerStorage } from './storage/kv-store.ts';
import { resolveLocation } from './location/resolver.ts';
import { evaluatePrayerStatus } from './engine/reminder.ts';
import { calculateDailySchedule, resolveCalculationParameters } from './engine/calculator.ts';
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
      'Cache-Control': 'no-store, no-cache, must-revalidate',
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

    // Favicon redirect to official icon
    if (url.pathname === '/favicon.ico') {
      return Response.redirect(
        'https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/icon.png',
        302
      );
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return jsonResponse({
        status: 'healthy',
        service: 'muslim-prayer-reminder-mcp',
        version: '1.0.1',
        icon: 'https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/icon.png',
        docs: 'https://tareq7.github.io/muslim-prayer-mcp',
        timestamp: new Date().toISOString(),
        hasKv: !!env.PRAYER_KV,
        kvType: typeof env.PRAYER_KV,
      });
    }

    // Static Server Card for MCP Registry Discovery (Smithery, Glama)
    if (
      url.pathname === '/.well-known/mcp/server-card.json' ||
      url.pathname === '/server-card' ||
      url.pathname === '/mcp/server-card'
    ) {
      return jsonResponse({
        serverInfo: {
          name: 'muslim-prayer-reminder',
          version: '1.0.1',
        },
        description: 'Production-ready Muslim prayer reminder MCP on Cloudflare Workers with Streamable HTTP, automatic location-based calculation authority calibration, mandatory theological disclosure, and deterministic host middleware.',
        iconUrl: 'https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/icon.png',
        icons: [
          {
            src: 'https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        tools: [
          { name: 'get_prayer_status', description: 'Checks if an obligatory prayer is currently due. Returns active reminder details, calculation authority, and mandatory selection justification.' },
          { name: 'get_today_prayer_times', description: 'Retrieves today prayer timetable with astronomical accuracy. Includes mandatory calculation authority and selection justification.' },
          { name: 'get_next_prayer', description: 'Returns next incoming prayer name, scheduled time, authority description, selection justification, and countdown in minutes.' },
          { name: 'configure_prayer_preferences', description: 'Configures user calculation parameters, madhab, and reminder settings in Cloudflare KV.' },
          { name: 'get_prayer_preferences', description: 'Inspects active user preferences and calculation settings.' },
        ],
      });
    }

    // Privacy Policy Endpoint (OpenAI Apps & Public Directories compliance)
    if (url.pathname === '/privacy') {
      return jsonResponse({
        policy: 'Privacy Policy for Muslim Prayer Reminder MCP',
        dataCollection: 'Zero PII collected or stored by default.',
        geolocation: 'Coordinates are processed ephemerally and sanitized to 2 decimal places (city-level precision). No exact GPS tracks are retained.',
        storage: 'User preferences (calculation method, madhab, notification window) are stored in Cloudflare KV strictly when explicitly submitted via configure_prayer_preferences.',
        thirdPartySharing: 'None. All astronomical prayer calculations run locally at the edge using open mathematical formulas.',
        retention: 'Ephemeral deduplication caches expire automatically within 24 hours.',
        contact: 'https://github.com/tareq7/muslim-prayer-mcp',
      });
    }

    // Terms of Service Endpoint
    if (url.pathname === '/terms') {
      return jsonResponse({
        service: 'Muslim Prayer Reminder MCP',
        license: 'MIT License',
        accuracy: 'Prayer times are computed using standard astronomical algorithms (Adhan engine). Users should verify with local authorities for region-specific adjustments.',
        availability: 'Provided as-is on Cloudflare Workers edge infrastructure with no uptime warranty.',
        repository: 'https://github.com/tareq7/muslim-prayer-mcp',
      });
    }

    // OpenAI Apps Challenge Verification Endpoint
    if (url.pathname === '/.well-known/openai-apps-challenge') {
      const token = (env as any).OPENAI_VERIFICATION_TOKEN || 'muslim-prayer-mcp-verified';
      return new Response(token, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
      });
    }

    // Security.txt endpoint (RFC 9116)
    if (url.pathname === '/.well-known/security.txt' || url.pathname === '/security.txt') {
      const securityTxt = [
        'Contact: https://github.com/tareq7/muslim-prayer-mcp/security',
        'Expires: 2027-12-31T23:59:59.000Z',
        'Preferred-Languages: en, ar',
        'Canonical: https://muslim-prayer-mcp.najetareqz.workers.dev/.well-known/security.txt',
        'Policy: https://github.com/tareq7/muslim-prayer-mcp/blob/main/SECURITY.md',
        'Acknowledgments: https://github.com/tareq7/muslim-prayer-mcp/blob/main/SECURITY.md',
      ].join('\n');
      return new Response(securityTxt, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
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

      const params = resolveCalculationParameters(location, userPrefs);
      const reminderMode = userPrefs?.reminderMode || (env.DEFAULT_REMINDER_MODE as any) || 'prayer_window';
      const exactWindowMinutes = userPrefs?.exactWindowMinutes || parseInt(env.DEFAULT_EXACT_WINDOW_MINUTES || '20', 10);
      const locale = userPrefs?.locale || (env.DEFAULT_LOCALE as any) || 'en';

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
      const params = resolveCalculationParameters(location, userPrefs);

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

    return jsonResponse({ error: 'Not Found', path: url.pathname, version: '1.0.1' }, 404);
  },
};
