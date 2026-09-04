import type { ResolvedLocation, UserPreferences } from '../engine/types.ts';

export interface KnownCityCoordinates {
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
}

export const MAJOR_CITIES: Record<string, KnownCityCoordinates> = {
  makkah: { latitude: 21.4225, longitude: 39.8262, timezone: 'Asia/Riyadh', country: 'SA' },
  madinah: { latitude: 24.4686, longitude: 39.6142, timezone: 'Asia/Riyadh', country: 'SA' },
  riyadh: { latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh', country: 'SA' },
  cairo: { latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', country: 'EG' },
  gaza: { latitude: 31.5017, longitude: 34.4668, timezone: 'Asia/Gaza', country: 'PS' },
  jerusalem: { latitude: 31.7683, longitude: 35.2137, timezone: 'Asia/Jerusalem', country: 'PS' },
  alquds: { latitude: 31.7683, longitude: 35.2137, timezone: 'Asia/Jerusalem', country: 'PS' },
  ramallah: { latitude: 31.9038, longitude: 35.2034, timezone: 'Asia/Hebron', country: 'PS' },
  hebron: { latitude: 31.5326, longitude: 35.0998, timezone: 'Asia/Hebron', country: 'PS' },
  nablus: { latitude: 32.2211, longitude: 35.2544, timezone: 'Asia/Hebron', country: 'PS' },
  rafah: { latitude: 31.2969, longitude: 34.2435, timezone: 'Asia/Gaza', country: 'PS' },
  khanyunis: { latitude: 31.3462, longitude: 34.3063, timezone: 'Asia/Gaza', country: 'PS' },
  dubai: { latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai', country: 'AE' },
  kuwait: { latitude: 29.3759, longitude: 47.9774, timezone: 'Asia/Kuwait', country: 'KW' },
  doha: { latitude: 25.2854, longitude: 51.5310, timezone: 'Asia/Qatar', country: 'QA' },
  amman: { latitude: 31.9454, longitude: 35.9284, timezone: 'Asia/Amman', country: 'JO' },
  istanbul: { latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul', country: 'TR' },
  london: { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', country: 'GB' },
  paris: { latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris', country: 'FR' },
  newyork: { latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York', country: 'US' },
  toronto: { latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto', country: 'CA' },
  jakarta: { latitude: -6.2088, longitude: 106.8456, timezone: 'Asia/Jakarta', country: 'ID' },
  singapore: { latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', country: 'SG' },
  karachi: { latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', country: 'PK' },
  kualalumpur: { latitude: 3.1390, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur', country: 'MY' },
  tehran: { latitude: 35.6892, longitude: 51.3890, timezone: 'Asia/Tehran', country: 'IR' },
  sydney: { latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', country: 'AU' },
  tromso: { latitude: 69.6492, longitude: 18.9553, timezone: 'Europe/Oslo', country: 'NO' },
};

export interface ResolveLocationParams {
  explicitLat?: number;
  explicitLng?: number;
  explicitTimezone?: string;
  userPrefs?: UserPreferences | null;
  headers?: Headers;
  cf?: {
    latitude?: string | number;
    longitude?: string | number;
    timezone?: string;
    city?: string;
    country?: string;
  };
}

export function sanitizeCoordinate(val: number): number {
  return Math.round(val * 100) / 100;
}

export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function inferCountryFromTimezone(tz: string): string | undefined {
  if (!tz) return undefined;
  const t = tz.trim();
  if (t === 'Asia/Gaza' || t === 'Asia/Hebron' || t === 'Asia/Jerusalem') return 'PS';
  if (t === 'Asia/Riyadh') return 'SA';
  if (t === 'Africa/Cairo') return 'EG';
  if (t === 'Asia/Dubai') return 'AE';
  if (t === 'Asia/Qatar') return 'QA';
  if (t === 'Asia/Kuwait') return 'KW';
  if (t === 'Europe/Istanbul') return 'TR';
  if (t === 'Asia/Karachi') return 'PK';
  if (t === 'Asia/Kolkata' || t === 'Asia/Calcutta') return 'IN';
  if (t === 'Asia/Dhaka') return 'BD';
  if (t === 'Asia/Kabul') return 'AF';
  if (t === 'Asia/Singapore') return 'SG';
  if (t === 'Asia/Kuala_Lumpur' || t === 'Asia/Kuching') return 'MY';
  if (
    t.startsWith('Asia/Jakarta') ||
    t.startsWith('Asia/Pontianak') ||
    t.startsWith('Asia/Makassar') ||
    t.startsWith('Asia/Jayapura')
  ) {
    return 'ID';
  }
  if (t === 'Asia/Brunei') return 'BN';
  if (t === 'Asia/Tehran') return 'IR';
  if (t === 'Europe/London') return 'GB';
  if (t === 'Europe/Paris') return 'FR';
  if (t === 'Europe/Berlin') return 'DE';
  if (t === 'Europe/Rome') return 'IT';
  if (t === 'Europe/Madrid') return 'ES';
  if (
    t.startsWith('America/Toronto') ||
    t.startsWith('America/Vancouver') ||
    t.startsWith('America/Montreal') ||
    t.startsWith('America/Edmonton') ||
    t.startsWith('America/Winnipeg') ||
    t.startsWith('America/Halifax') ||
    t.startsWith('America/St_Johns')
  ) {
    return 'CA';
  }
  if (t.startsWith('America/')) return 'US';
  if (t.startsWith('Australia/')) return 'AU';
  return undefined;
}

export function resolveLocation(params: ResolveLocationParams): ResolvedLocation {
  const { explicitLat, explicitLng, explicitTimezone, userPrefs, headers, cf } = params;

  const enrichLocation = (loc: ResolvedLocation): ResolvedLocation => {
    if (
      loc.latitude >= 31.0 &&
      loc.latitude <= 33.5 &&
      loc.longitude >= 34.0 &&
      loc.longitude <= 35.8
    ) {
      if (!loc.country) loc.country = 'PS';
      if (!loc.timezone || loc.timezone === 'UTC') loc.timezone = 'Asia/Gaza';
    }

    if (!loc.country) {
      if (loc.timezone) {
        loc.country = inferCountryFromTimezone(loc.timezone);
      }
    }
    return loc;
  };

  // Layer 1: Explicit coordinates in request
  if (typeof explicitLat === 'number' && typeof explicitLng === 'number') {
    const tz = explicitTimezone && isValidIanaTimezone(explicitTimezone)
      ? explicitTimezone
      : (userPrefs?.timezone || cf?.timezone || 'UTC');
    return enrichLocation({
      latitude: sanitizeCoordinate(explicitLat),
      longitude: sanitizeCoordinate(explicitLng),
      timezone: tz,
      source: 'explicit_request',
      isApproximated: true,
    });
  }

  // Layer 2: User configured fixed preferences
  if (userPrefs && userPrefs.locationMode === 'fixed') {
    if (userPrefs.fixedCoordinates) {
      return enrichLocation({
        latitude: sanitizeCoordinate(userPrefs.fixedCoordinates.latitude),
        longitude: sanitizeCoordinate(userPrefs.fixedCoordinates.longitude),
        timezone: userPrefs.timezone || 'Asia/Riyadh',
        city: userPrefs.fixedCity,
        source: 'user_fixed_preference',
        isApproximated: true,
      });
    }
    if (userPrefs.fixedCity) {
      const normalizedCity = userPrefs.fixedCity.toLowerCase().replace(/[^a-z]/g, '');
      const matched = MAJOR_CITIES[normalizedCity];
      if (matched) {
        return enrichLocation({
          latitude: sanitizeCoordinate(matched.latitude),
          longitude: sanitizeCoordinate(matched.longitude),
          timezone: matched.timezone,
          city: userPrefs.fixedCity,
          country: matched.country,
          source: 'user_fixed_preference',
          isApproximated: false,
        });
      }
    }
  }

  // Layer 3: Host forwarded HTTP headers
  if (headers) {
    const headerCoords = headers.get('X-User-Coordinates');
    const headerTz = headers.get('X-User-Timezone');
    const headerCity = headers.get('X-User-City');

    if (headerCoords) {
      const [latStr, lngStr] = headerCoords.split(',').map((s) => s.trim());
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        const tz = headerTz && isValidIanaTimezone(headerTz)
          ? headerTz
          : (userPrefs?.timezone || cf?.timezone || 'UTC');
        return enrichLocation({
          latitude: sanitizeCoordinate(lat),
          longitude: sanitizeCoordinate(lng),
          timezone: tz,
          city: headerCity ?? undefined,
          source: 'host_header',
          isApproximated: true,
        });
      }
    }
  }

  // Layer 4: Cloudflare Geolocation
  if (cf && cf.latitude && cf.longitude) {
    const lat = typeof cf.latitude === 'string' ? parseFloat(cf.latitude) : cf.latitude;
    const lng = typeof cf.longitude === 'string' ? parseFloat(cf.longitude) : cf.longitude;
    if (!isNaN(lat) && !isNaN(lng)) {
      const tz = cf.timezone && isValidIanaTimezone(cf.timezone) ? cf.timezone : 'UTC';
      return enrichLocation({
        latitude: sanitizeCoordinate(lat),
        longitude: sanitizeCoordinate(lng),
        timezone: tz,
        city: cf.city,
        country: cf.country,
        source: 'cf_geo',
        isApproximated: true,
      });
    }
  }

  // Layer 5: Fallback default (Makkah)
  return enrichLocation({
    latitude: 21.42,
    longitude: 39.83,
    timezone: 'Asia/Riyadh',
    city: 'Makkah',
    country: 'SA',
    source: 'fallback_default',
    isApproximated: false,
  });
}
