import { createPrayerMcpServer } from './mcp/server.ts';
import { publicPrayerStatus } from './mcp/status-response.ts';
import { PrayerStorage, InvalidPreferencesError, type KVNamespaceLike } from './storage/kv-store.ts';
import { RestCalculationInputSchema, RestPreferencesInputSchema, publicPreferences, UserIdSchema, ReminderDefaultsSchema } from './mcp/schemas.ts';
import { resolveUserLocation, LocationRequiredError, InvalidLocationInputError, type ResolveLocationParams } from './location/resolver.ts';
import { LocationTimezoneMismatchError } from './location/timezone.ts';
import { evaluatePrayerStatus } from './engine/reminder.ts';
import { calculateDailySchedule, resolveCalculationParameters, InvalidCalculationError } from './engine/calculator.ts';
import { DASHBOARD_HTML, DASHBOARD_CSS, DASHBOARD_JS } from './analytics/dashboard.ts';
import { LOGO_48, LOGO_180 } from './analytics/logo.ts';
import { collectEvents, recordViaStub, type AnalyticsNamespace } from './analytics/collector.ts';
import { parseReportQuery } from './analytics/store.ts';
import { readLegacySummary } from './analytics/legacy.ts';

export { AnalyticsDO } from './analytics/durable-object.ts';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CalculationMethodName, MadhabName } from './engine/types.ts';

type GeoRequest = Request & { cf?: ResolveLocationParams['cf'] };

export interface Env {
  PRAYER_KV?: KVNamespaceLike;
  OPENAI_VERIFICATION_TOKEN?: string;
  AUTH_TOKEN?: string;
  ANALYTICS_TOKEN?: string;
  ANALYTICS?: AnalyticsNamespace;
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

const ANALYTICS_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};
const ANALYTICS_CSP = "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function analyticsAuthorized(request: Request, token: string | undefined): Promise<boolean> {
  if (!token) return true;
  const header = request.headers.get('Authorization') ?? '';
  let candidate: string | null = null;
  if (header.startsWith('Bearer ')) candidate = header.slice(7);
  else if (header.startsWith('Basic ')) {
    try {
      const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), c => c.charCodeAt(0)));
      candidate = decoded.slice(decoded.indexOf(':') + 1);
    } catch { candidate = null; }
  }
  if (candidate === null) return false;
  const [a, b] = await Promise.all([digest(candidate), digest(token)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function analyticsAsset(body: string, type: string, csp = false): Response {
  return new Response(body, { headers: { 'Content-Type': type, ...ANALYTICS_HEADERS, ...(csp ? { 'Content-Security-Policy': ANALYTICS_CSP } : {}), 'Cache-Control': csp ? 'no-store' : 'public, max-age=300' } });
}

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
    city: url.searchParams.get('city') ?? undefined,
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

    const icon = { '/favicon.png': LOGO_48, '/favicon.ico': LOGO_48, '/apple-touch-icon.png': LOGO_180 }[url.pathname];
    if (icon) return new Response(icon, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });

    if (request.method === 'GET' || request.method === 'HEAD') {
      if (url.pathname === '/analytics/app.js') return analyticsAsset(DASHBOARD_JS, 'text/javascript; charset=utf-8');
      if (url.pathname === '/analytics/app.css') return analyticsAsset(DASHBOARD_CSS, 'text/css; charset=utf-8');
      if (url.pathname === '/analytics' || url.pathname === '/analytics/' || url.pathname === '/api/analytics') {
        const token = env.ANALYTICS_TOKEN ?? env.AUTH_TOKEN;
        if (!(await analyticsAuthorized(request, token))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="Analytics", charset="UTF-8"', ...ANALYTICS_HEADERS } });
        }
        if (url.pathname !== '/api/analytics') return analyticsAsset(DASHBOARD_HTML, 'text/html; charset=utf-8', true);
        const access = { protected: !!token };
        const legacy = await readLegacySummary(env.PRAYER_KV);
        const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', ...ANALYTICS_HEADERS } });
        if (!env.ANALYTICS) return json({ enabled: false, access, legacy });
        try {
          const q = parseReportQuery(url.searchParams);
          const stub = env.ANALYTICS.get(env.ANALYTICS.idFromName('global'));
          const res = await stub.fetch(`https://analytics/report?range=${q.range}&tz=${q.tz}&segment=${q.segment}`);
          if (!res.ok) throw new Error('report failed');
          return json({ enabled: true, access, legacy, ...(await res.json() as object) });
        } catch {
          return new Response(JSON.stringify({ error: 'Analytics store unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', ...ANALYTICS_HEADERS } });
        }
      }
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return jsonResponse({
        status: 'healthy',
        service: 'muslim-prayer-reminder-mcp',
        version: '1.1.2',
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
          version: '1.1.2',
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
        version: '1.1.2',
        publisher: 'Smart Creations',
        author: 'Tareq Naji (@tareq7)',
        fullPolicyUrl: 'https://tareq7.github.io/muslim-prayer-mcp/privacy-policy/',
        privacyStandard: 'Data minimization with pseudonymous operational analytics',
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
            'High-latitude, polar-clamping, location-basis and offset disclosures without original coordinates',
            'Fixed-location configuration indicators',
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
            'Pseudonymous operational analytics in a Durable Object: one row per tool call with a salted SHA-256 hash of the anonymous ChatGPT subject and session IDs (truncated to 64 bits), tool name, outcome, approximate country and language, local hour, client type and a verified-OpenAI flag. IP addresses and raw identifiers are never stored. Events are kept 180 days and per-user rows 400 days',
          ],
          thirdPartySharing: 'None. Calculations execute locally in-isolate. The Worker downloads OpenAI public IP ranges once a day and sends no user data in that request.',
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
    const startedAt = Date.now();
    let mcpBodyText = '';
    try {
      if (request.method === 'POST' && (url.pathname === '/api/preferences' || url.pathname === '/mcp')) {
        const body = await readBoundedBody(request);
        if (body === null) return jsonResponse({ error: 'Request body exceeds 64 KiB' }, 413);
        mcpBodyText = body;
        request = new Request(request, { body });
      }

      // REST Fast Status Check Endpoint: /api/status
      if (url.pathname === '/api/status' && request.method === 'GET') {
        const input = parseCalculationQuery(url);
        if (!input.success) return jsonResponse({ error: 'Invalid calculation parameters' }, 400);
        const { userId, latitude, longitude, timezone, city } = input.data;

        return await storage.withUserLock(userId, async () => {
          const userPrefs = userId ? await storage.getUserPreferences(userId) : null;
          const dedupeUserId = userId || 'anon';

          const location = resolveUserLocation({
            explicitCity: city,
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
            calculationDetails: params.calculationDetails,
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

          return jsonResponse(publicPrayerStatus(status));
        });
      }

      // REST Timetable Endpoint: /api/timetable
      if (url.pathname === '/api/timetable' && request.method === 'GET') {
        const input = parseCalculationQuery(url);
        if (!input.success) return jsonResponse({ error: 'Invalid calculation parameters' }, 400);
        const { userId, date, latitude, longitude, timezone, city } = input.data;
        const userPrefs = userId ? await storage.getUserPreferences(userId) : null;

        const location = resolveUserLocation({
          explicitCity: city,
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
          calculationDetails: params.calculationDetails,
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
        return jsonResponse({ success: true, preferences: publicPreferences(updated) });
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


      // MCP Protocol Handler: /mcp
      if (url.pathname === '/mcp') {
        const mcpServer = createPrayerMcpServer(storage, { headers: request.headers, cf: requestCf, ...getReminderDefaults(env) });

        const transport = new WebStandardStreamableHTTPServerTransport({
          enableJsonResponse: true,
        });

        await mcpServer.connect(transport);
        try {
          const response = await transport.handleRequest(request);
          for (const [name, value] of Object.entries(CORS_HEADERS)) response.headers.set(name, value);
          if (request.method === 'POST' && env.ANALYTICS) {
            const analytics = env.ANALYTICS;
            const task = collectEvents({ requestText: mcpBodyText, request, response, startedAt })
              .then(events => events.length ? recordViaStub(analytics, events) : undefined)
              .then(() => undefined, () => console.warn('Analytics recording failed'));
            const executionCtx = ctx as { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
            if (typeof executionCtx?.waitUntil === 'function') executionCtx.waitUntil(task);
          }
          return response;
        } finally {
          await mcpServer.close();
        }
      }

      return jsonResponse({ error: 'Not Found', path: url.pathname, version: '1.1.2' }, 404);
    } catch (error) {
      if (error instanceof LocationTimezoneMismatchError) return jsonResponse({ code: error.code, error: error.message, expectedTimezone: error.expectedTimezone, timezoneMismatchDetected: true }, 400);
      if (error instanceof LocationRequiredError || error instanceof InvalidCalculationError || error instanceof InvalidPreferencesError || error instanceof InvalidLocationInputError) return jsonResponse({ code: error.code, error: error.message }, 400);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};
