import { createPrayerMcpServer } from './mcp/server.ts';
import { PrayerStorage, type KVNamespaceLike } from './storage/kv-store.ts';
import { RestCalculationInputSchema, RestPreferencesInputSchema, UserPreferencesObjectSchema, UserIdSchema, ReminderDefaultsSchema } from './mcp/schemas.ts';
import { resolveLocation, type ResolveLocationParams } from './location/resolver.ts';
import { evaluatePrayerStatus } from './engine/reminder.ts';
import { calculateDailySchedule, resolveCalculationParameters } from './engine/calculator.ts';
import { trackAnalytics, getAnalyticsReport, renderAnalyticsHtml } from './analytics/tracker.ts';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CalculationMethodName, MadhabName } from './engine/types.ts';

type GeoRequest = Request & { cf?: ResolveLocationParams['cf'] };

export interface Env {
  PRAYER_KV?: KVNamespaceLike;
  OPENAI_VERIFICATION_TOKEN?: string;
  AUTH_TOKEN?: string;
  DEFAULT_CALCULATION_METHOD?: CalculationMethodName;
  DEFAULT_MADHAB?: MadhabName;
  DEFAULT_REMINDER_MODE?: string;
  DEFAULT_EXACT_WINDOW_MINUTES?: string;
  DEFAULT_LOCALE?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Coordinates, X-User-Timezone, X-User-City, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
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


async function readBoundedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseCalculationQuery(url: URL) {
  const coordinate = (name: string) => {
    const raw = url.searchParams.get(name);
    return raw === null ? undefined : raw.trim() === '' ? NaN : Number(raw);
  };
  return RestCalculationInputSchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
    latitude: coordinate('lat'), longitude: coordinate('lng'),
    timezone: url.searchParams.get('timezone') ?? undefined,
  });
}

function getReminderDefaults(env: Env) {
  return ReminderDefaultsSchema.parse({
    reminderMode: env.DEFAULT_REMINDER_MODE,
    exactWindowMinutes: env.DEFAULT_EXACT_WINDOW_MINUTES === undefined ? undefined : Number(env.DEFAULT_EXACT_WINDOW_MINUTES),
    locale: env.DEFAULT_LOCALE,
  });
}

export default {
  async fetch(request: GeoRequest, env: Env, ctx?: unknown): Promise<Response> {
    const url = new URL(request.url);
    const requestCf = request.cf;

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
        publisher: 'Smart Creations',
        author: 'Tareq Naji (@tareq7)',
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
          publisher: 'Smart Creations',
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
        app: 'Muslim Prayer Reminder',
        version: '1.0.1',
        publisher: 'Smart Creations',
        author: 'Tareq Naji (@tareq7)',
        fullPolicyUrl: 'https://tareq7.github.io/muslim-prayer-mcp/privacy-policy/',
        privacyStandard: 'Privacy by default, zero tracking, strict data minimization',
        dataCategories: {
          inputsProcessedEphemerally: [
            'City name or approximate latitude/longitude (rounded to 2 decimal places / ~1.1km)',
            'IANA timezone string for local wall-clock conversion',
            'Calculation method and madhab preferences',
          ],
          outputsReturnedToHosts: [
            'Prayer names (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha)',
            'Calculated prayer times in ISO-8601 UTC and local HH:mm format',
            'Prayer due status boolean and countdown in minutes',
            'Localized prayer alert notifications (Arabic and English)',
            'Calculation authority name and theological selection justification',
          ],
          explicitlyExcludedFromOutputs: [
            'Zero coordinate leakage: latitude and longitude are NEVER returned in tool outputs',
            'Zero internal debug keys: deduplication sentinels and location sources are stripped',
            'Zero user identifiers in read queries',
          ],
          storageAndRetention: [
            'Timetable and next-prayer queries write no data; identified status queries can write temporary deduplication markers',
            'Explicit MCP or REST preference updates store user identifiers, calculation and reminder settings, fixed city, rounded fixed coordinates, and timezone until deleted',
            'Deduplication markers expire at the prayer window end, with a maximum TTL of 24 hours',
            'Anonymous operational analytics: hashed subject identifiers (SHA-256) and tool invocation counts are tracked ephemerally for active user metrics (DAU/WAU/MAU) with 60-day auto-expiry',
          ],
          thirdPartySharing: 'None. Calculations execute locally in-isolate at the edge without external API calls or tracking SDKs.',
        },
        contact: 'https://github.com/tareq7/muslim-prayer-mcp',
      });
    }

    // Terms of Service Endpoint
    if (url.pathname === '/terms') {
      return jsonResponse({
        service: 'Muslim Prayer Reminder MCP',
        publisher: 'Smart Creations',
        author: 'Tareq Naji (@tareq7)',
        license: 'MIT License (Copyright (c) 2026 Smart Creations & Tareq Naji)',
        accuracy: 'Prayer times are computed using standard astronomical algorithms (Adhan engine). Users should verify with local authorities for region-specific adjustments.',
        availability: 'Provided as-is on Cloudflare Workers edge infrastructure with no uptime warranty.',
        repository: 'https://github.com/tareq7/muslim-prayer-mcp',
      });
    }


    // OpenAI Apps Challenge Verification Endpoint
    if (url.pathname === '/.well-known/openai-apps-challenge') {
      const token =
        env.OPENAI_VERIFICATION_TOKEN ||
        'MLVjA8AU-omfsOI7YwHNqDPsXpG6XRZundaSs1D04lI';
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

    if ((url.pathname.startsWith('/api/') || url.pathname === '/mcp') && env.AUTH_TOKEN &&
        request.headers.get('Authorization') !== `Bearer ${env.AUTH_TOKEN}`) {
      const response = jsonResponse({ error: 'Unauthorized' }, 401);
      response.headers.set('WWW-Authenticate', 'Bearer');
      return response;
    }

    const storage = new PrayerStorage(env.PRAYER_KV);
    try {
      if (request.method === 'POST' && (url.pathname === '/api/preferences' || url.pathname === '/mcp')) {
        const body = await readBoundedBody(request);
        if (body === null) return jsonResponse({ error: 'Request body exceeds 64 KiB' }, 413);
        request = new Request(request, { body });
      }

      // REST Fast Status Check Endpoint: /api/status
      if (url.pathname === '/api/status' && request.method === 'GET') {
        const input = parseCalculationQuery(url);
        if (!input.success) return jsonResponse({ error: 'Invalid calculation parameters' }, 400);
        const { userId, latitude, longitude, timezone } = input.data;

        return await storage.withUserLock(userId, async () => {
          const userPrefs = userId ? await storage.getUserPreferences(userId) : null;
          const dedupeUserId = userId || 'anon';

          const location = resolveLocation({
            explicitLat: latitude,
            explicitLng: longitude,
            explicitTimezone: timezone,
            userPrefs,
            headers: request.headers,
            cf: requestCf,
          });

          const params = resolveCalculationParameters(location, userPrefs);
          const defaults = getReminderDefaults(env);
          const reminderMode = userPrefs?.reminderMode ?? defaults.reminderMode;
          const exactWindowMinutes = userPrefs?.exactWindowMinutes ?? defaults.exactWindowMinutes;
          const locale = userPrefs?.locale ?? defaults.locale;

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
            enabled: userPrefs?.enabled,
            reminderMode,
            exactWindowMinutes,
            locale,
            userId: dedupeUserId,
            isAlreadySent: userId ? (key) => storage.isDedupeSent(key) : () => false,
          });

          if (userId && status.reminderDue && status.dedupeKey && status.expiresAtUtc && reminderMode !== 'persistent') {
            const ttl = Math.min(86400, Math.ceil((Date.parse(status.expiresAtUtc) - Date.now()) / 1000));
            await storage.recordDedupeSent(status.dedupeKey, ttl);
          }

          const { dedupeKey, locationSource, ...publicStatus } = status;
          return jsonResponse(publicStatus);
        });
      }

      // REST Timetable Endpoint: /api/timetable
      if (url.pathname === '/api/timetable' && request.method === 'GET') {
        const input = parseCalculationQuery(url);
        if (!input.success) return jsonResponse({ error: 'Invalid calculation parameters' }, 400);
        const { userId, date, latitude, longitude, timezone } = input.data;
        const userPrefs = userId ? await storage.getUserPreferences(userId) : null;

        const location = resolveLocation({
          explicitLat: latitude,
          explicitLng: longitude,
          explicitTimezone: timezone,
          userPrefs,
          headers: request.headers,
          cf: requestCf,
        });

        const targetDate = date ?? new Date();
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

        const { coordinates, ...publicSchedule } = schedule;
        return jsonResponse(publicSchedule);
      }

      // REST Preferences Save Endpoint: /api/preferences (POST)
      if (url.pathname === '/api/preferences' && request.method === 'POST') {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch (error) {
          if (error instanceof SyntaxError) return jsonResponse({ error: 'Invalid JSON body' }, 400);
          throw error;
        }
        const parsed = RestPreferencesInputSchema.safeParse(raw);
        if (!parsed.success) return jsonResponse({ error: 'Invalid preferences' }, 400);
        const { reset, ...input } = parsed.data;
        if (reset) {
          await storage.deleteUserPreferences(input.userId);
          return jsonResponse({ success: true, message: 'Preferences reset' });
        }
        const updated = await storage.updateUserPreferences(input);
        return jsonResponse({ success: true, preferences: UserPreferencesObjectSchema.parse(updated) });
      }

      // REST Preferences Delete Endpoint: /api/preferences (DELETE)
      if (url.pathname === '/api/preferences' && request.method === 'DELETE') {
        const parsedUserId = UserIdSchema.safeParse(url.searchParams.get('userId'));
        if (!parsedUserId.success) {
          return jsonResponse({ error: 'userId query parameter is required' }, 400);
        }
        await storage.deleteUserPreferences(parsedUserId.data);
        return jsonResponse({ success: true, message: 'Preferences deleted' });
      }


      // Edge Analytics Endpoints: /api/analytics and /analytics
      if ((url.pathname === '/api/analytics' || url.pathname === '/analytics') && request.method === 'GET') {
        const accept = request.headers.get('accept') || '';
        const report = await getAnalyticsReport(storage.getKV());
        if (url.pathname === '/analytics' && accept.includes('text/html')) {
          return new Response(renderAnalyticsHtml(report), {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              ...CORS_HEADERS,
            },
          });
        }
        return jsonResponse(report);
      }

      // MCP Protocol Handler: /mcp
      if (url.pathname === '/mcp') {
        if (request.method === 'POST') {
          try {
            const clone = request.clone();
            const trackPromise = (async () => {
              try {
                const body = (await clone.json());
                if (body && body.method === 'tools/call' && body.params) {
                  const tool = body.params.name || 'unknown';
                  const meta = body.params._meta || {};
                  const subject =
                    meta['openai/subject'] ||
                    request.headers.get('x-openai-subject') ||
                    request.headers.get('openai-subject') ||
                    undefined;
                  const session =
                    meta['openai/session'] ||
                    request.headers.get('x-openai-session') ||
                    request.headers.get('openai-session') ||
                    undefined;
                  const country =
                    requestCf?.country ||
                    request.headers.get('cf-ipcountry') ||
                    undefined;
                  await trackAnalytics(storage.getKV(), {
                    tool,
                    subject,
                    session,
                    country,
                  });
                }
              } catch {}
            })();
            const executionCtx = ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
            if (typeof executionCtx?.waitUntil === 'function') {
              executionCtx.waitUntil(trackPromise);
            } else {
              trackPromise.catch(() => {});
            }
          } catch {}
        }
        const mcpServer = createPrayerMcpServer(storage, { headers: request.headers, cf: requestCf, ...getReminderDefaults(env) });

        const transport = new WebStandardStreamableHTTPServerTransport({
          enableJsonResponse: true,
        });

        await mcpServer.connect(transport);
        try {
          const response = await transport.handleRequest(request);
          for (const [name, value] of Object.entries(CORS_HEADERS)) response.headers.set(name, value);
          return response;
        } finally {
          await mcpServer.close();
        }
      }

      return jsonResponse({ error: 'Not Found', path: url.pathname, version: '1.0.1' }, 404);
    } catch {
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};
