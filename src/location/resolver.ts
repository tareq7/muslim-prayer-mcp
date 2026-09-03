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
  karachi: { latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi', country: 'PK' },
  kualalumpur: { latitude: 3.1390, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur', country: 'MY' },
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

export function resolveLocation(params: ResolveLocationParams): ResolvedLocation {
  const { explicitLat, explicitLng, explicitTimezone, userPrefs, headers, cf } = params;

  // Layer 1: Explicit coordinates in request
  if (typeof explicitLat === 'number' && typeof explicitLng === 'number') {
    const tz = explicitTimezone && isValidIanaTimezone(explicitTimezone)
      ? explicitTimezone
      : (userPrefs?.timezone || cf?.timezone || 'UTC');
    return {
      latitude: sanitizeCoordinate(explicitLat),
      longitude: sanitizeCoordinate(explicitLng),
      timezone: tz,
      source: 'explicit_request',
      isApproximated: true,
    };
  }

  // Layer 2: User configured fixed preferences
  if (userPrefs && userPrefs.locationMode === 'fixed') {
    if (userPrefs.fixedCoordinates) {
      return {
        latitude: sanitizeCoordinate(userPrefs.fixedCoordinates.latitude),
        longitude: sanitizeCoordinate(userPrefs.fixedCoordinates.longitude),
        timezone: userPrefs.timezone || 'Asia/Riyadh',
        city: userPrefs.fixedCity,
        source: 'user_fixed_preference',
        isApproximated: true,
      };
    }
    if (userPrefs.fixedCity) {
      const normalizedCity = userPrefs.fixedCity.toLowerCase().replace(/[^a-z]/g, '');
      const matched = MAJOR_CITIES[normalizedCity];
      if (matched) {
        return {
          latitude: sanitizeCoordinate(matched.latitude),
          longitude: sanitizeCoordinate(matched.longitude),
          timezone: matched.timezone,
          city: userPrefs.fixedCity,
          country: matched.country,
          source: 'user_fixed_preference',
          isApproximated: false,
        };
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
        return {
          latitude: sanitizeCoordinate(lat),
          longitude: sanitizeCoordinate(lng),
          timezone: tz,
          city: headerCity ?? undefined,
          source: 'host_header',
          isApproximated: true,
        };
      }
    }
  }

  // Layer 4: Cloudflare Geolocation
  if (cf && cf.latitude && cf.longitude) {
    const lat = typeof cf.latitude === 'string' ? parseFloat(cf.latitude) : cf.latitude;
    const lng = typeof cf.longitude === 'string' ? parseFloat(cf.longitude) : cf.longitude;
    if (!isNaN(lat) && !isNaN(lng)) {
      const tz = cf.timezone && isValidIanaTimezone(cf.timezone) ? cf.timezone : 'UTC';
      return {
        latitude: sanitizeCoordinate(lat),
        longitude: sanitizeCoordinate(lng),
        timezone: tz,
        city: cf.city,
        country: cf.country,
        source: 'cf_geo',
        isApproximated: true,
      };
    }
  }

  // Layer 5: Fallback default (Makkah)
  return {
    latitude: 21.42,
    longitude: 39.83,
    timezone: 'Asia/Riyadh',
    city: 'Makkah',
    country: 'SA',
    source: 'fallback_default',
    isApproximated: false,
  };
}
