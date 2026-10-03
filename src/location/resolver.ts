import type { ResolvedLocation, UserPreferences } from '../engine/types.ts';
import { validateCityTimezone, validateCoordinateTimezone } from './timezone.ts';

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
  abudhabi: { latitude: 24.4539, longitude: 54.3773, timezone: 'Asia/Dubai', country: 'AE' },
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

export const CITY_ALIASES: Record<string, string> = { gazacity: 'gaza', nyc: 'newyork', kuwaitcity: 'kuwait' };
export function getKnownCity(city: string): KnownCityCoordinates | undefined {
  const key = city.toLowerCase().replace(/[^a-z]/g, '');
  const canonical = Object.hasOwn(CITY_ALIASES, key) ? CITY_ALIASES[key] : key;
  return Object.hasOwn(MAJOR_CITIES, canonical) ? MAJOR_CITIES[canonical] : undefined;
}

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

function validCoordinatePair(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function parseCoordinate(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return NaN;
  return Number(value.trim());
}

function validTimezone(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => !!value && isValidIanaTimezone(value));
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
  // Country-specific zones from https://data.iana.org/time-zones/tzdb/zone.tab, plus legacy aliases.
  if ([
    'America/St_Johns', 'America/Halifax', 'America/Glace_Bay', 'America/Moncton', 'America/Goose_Bay',
    'America/Blanc-Sablon', 'America/Toronto', 'America/Iqaluit', 'America/Atikokan', 'America/Winnipeg',
    'America/Resolute', 'America/Rankin_Inlet', 'America/Regina', 'America/Swift_Current',
    'America/Edmonton', 'America/Cambridge_Bay', 'America/Inuvik', 'America/Vancouver', 'America/Creston',
    'America/Dawson_Creek', 'America/Fort_Nelson', 'America/Whitehorse', 'America/Dawson',
    'America/Montreal', 'America/Nipigon', 'America/Thunder_Bay', 'America/Pangnirtung',
    'America/Rainy_River', 'America/Yellowknife', 'Canada/Atlantic', 'Canada/Central', 'Canada/Eastern',
    'Canada/Mountain', 'Canada/Newfoundland', 'Canada/Pacific', 'Canada/Saskatchewan', 'Canada/Yukon',
  ].includes(t)) {
    return 'CA';
  }
  if ([
    'America/New_York', 'America/Detroit', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
    'America/Indiana/Indianapolis', 'America/Indiana/Vincennes', 'America/Indiana/Winamac',
    'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Vevay',
    'America/Indiana/Tell_City', 'America/Indiana/Knox', 'America/Chicago', 'America/Menominee',
    'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/North_Dakota/Beulah',
    'America/Denver', 'America/Boise', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage',
    'America/Juneau', 'America/Sitka', 'America/Metlakatla', 'America/Yakutat', 'America/Nome',
    'America/Adak', 'Pacific/Honolulu', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific',
    'US/Alaska', 'US/Aleutian', 'US/Arizona', 'US/Hawaii', 'US/East-Indiana', 'US/Indiana-Starke',
    'America/Indianapolis', 'America/Louisville', 'America/Knox_IN', 'America/Shiprock', 'America/Atka',
  ].includes(t)) return 'US';
  if (t.startsWith('Australia/')) return 'AU';
  return undefined;
}

export function resolveLocation(params: ResolveLocationParams): ResolvedLocation {
  const { explicitLat, explicitLng, explicitTimezone, userPrefs, headers, cf } = params;
  const timezoneOverride = validTimezone(explicitTimezone);

  const enrichLocation = (loc: ResolvedLocation): ResolvedLocation => {
    if (
      loc.latitude >= 31.0 &&
      loc.latitude <= 33.5 &&
      loc.longitude >= 34.0 &&
      loc.longitude <= 35.8
    ) {
      if (!loc.country) loc.country = 'PS';
      if (!timezoneOverride && (!loc.timezone || loc.timezone === 'UTC')) loc.timezone = 'Asia/Gaza';
    }

    if (!loc.country) {
      if (loc.timezone) {
        loc.country = inferCountryFromTimezone(loc.timezone);
      }
    }
    if (timezoneOverride) loc.timezone = timezoneOverride;
    return loc;
  };

  // Layer 1: Explicit coordinates in request
  if (typeof explicitLat === 'number' && typeof explicitLng === 'number' && validCoordinatePair(explicitLat, explicitLng)) {
    const tz = validTimezone(explicitTimezone, userPrefs?.timezone, headers?.get('X-User-Timezone') ?? undefined, cf?.timezone) || 'UTC';
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
    if (userPrefs.fixedCoordinates && validCoordinatePair(userPrefs.fixedCoordinates.latitude, userPrefs.fixedCoordinates.longitude)) {
      return enrichLocation({
        latitude: sanitizeCoordinate(userPrefs.fixedCoordinates.latitude),
        longitude: sanitizeCoordinate(userPrefs.fixedCoordinates.longitude),
        timezone: validTimezone(userPrefs.timezone) || 'Asia/Riyadh',
        city: userPrefs.fixedCity,
        source: 'user_fixed_preference',
        isApproximated: true,
      });
    }
    if (userPrefs.fixedCity) {
      const matched = getKnownCity(userPrefs.fixedCity);
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
      const values = headerCoords.split(',');
      const lat = parseCoordinate(values[0]);
      const lng = parseCoordinate(values[1]);
      if (values.length === 2 && validCoordinatePair(lat, lng)) {
        const tz = validTimezone(headerTz ?? undefined, userPrefs?.timezone, cf?.timezone) || 'UTC';
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
  if (cf) {
    const lat = parseCoordinate(cf.latitude);
    const lng = parseCoordinate(cf.longitude);
    if (validCoordinatePair(lat, lng)) {
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

export class LocationRequiredError extends Error {
  readonly code = 'location_required';
  constructor() {
    super('Provide a supported city or a latitude/longitude pair with an IANA timezone, or configure a complete fixed location. Connector/IP geolocation is not used for prayer queries.');
    this.name = 'LocationRequiredError';
  }
}

export class InvalidLocationInputError extends Error {
  readonly code = 'invalid_location';
}

export function resolveUserLocation(params: ResolveLocationParams & { explicitCity?: string }): ResolvedLocation {
  const { explicitCity, explicitLat, explicitLng, explicitTimezone, userPrefs, headers } = params;
  if (explicitCity !== undefined && (explicitLat !== undefined || explicitLng !== undefined)) {
    throw new InvalidLocationInputError('Supply city or latitude/longitude, not both.');
  }
  const knownCity = (value?: string | null) => {
    return value ? getKnownCity(value) : undefined;
  };
  const cityLocation = (city: string, basis: ResolvedLocation['basis'], timezoneInput = explicitTimezone): ResolvedLocation => {
    const found = knownCity(city);
    if (!found) throw new LocationRequiredError();
    if (timezoneInput !== undefined && !isValidIanaTimezone(timezoneInput)) {
      throw new InvalidLocationInputError('Invalid end-user timezone. Supply an IANA timezone.');
    }
    validateCityTimezone(found.timezone, timezoneInput);
    return {
      latitude: sanitizeCoordinate(found.latitude), longitude: sanitizeCoordinate(found.longitude),
      timezone: validTimezone(timezoneInput) || found.timezone, country: found.country, city,
      timezoneSource: validTimezone(timezoneInput) ? (basis === 'host_city' && !explicitTimezone ? 'host_header' : 'explicit_override') : 'city_default',
      expectedTimezone: found.timezone, timezoneValidation: 'city_registry',
      source: basis === 'stored_fixed_city' ? 'user_fixed_preference' : basis === 'host_city' ? 'host_header' : 'explicit_request',
      isApproximated: true, basis,
    };
  };
  if (explicitLat !== undefined || explicitLng !== undefined) {
    const timezone = validTimezone(explicitTimezone);
    if (typeof explicitLat !== 'number' || typeof explicitLng !== 'number' || !validCoordinatePair(explicitLat, explicitLng) || !timezone) throw new LocationRequiredError();
    const validation = validateCoordinateTimezone(explicitLat, explicitLng, timezone);
    const location = resolveLocation({ explicitLat, explicitLng, explicitTimezone: validation.expectedTimezone });
    return { ...location, ...validation, timezone, basis: 'explicit_coordinates', timezoneSource: 'explicit_override' };
  }
  if (explicitCity) return cityLocation(explicitCity, 'explicit_city');
  if (userPrefs?.locationMode === 'fixed') {
    if (userPrefs.fixedCoordinates) {
      const timezone = validTimezone(explicitTimezone, userPrefs.timezone);
      if (!timezone || !validCoordinatePair(userPrefs.fixedCoordinates.latitude, userPrefs.fixedCoordinates.longitude)) throw new LocationRequiredError();
      const { latitude, longitude } = userPrefs.fixedCoordinates;
      const validation = validateCoordinateTimezone(latitude, longitude, timezone);
      const location = resolveLocation({ explicitLat: latitude, explicitLng: longitude, explicitTimezone: validation.expectedTimezone });
      return { ...location, ...validation, timezone, source: 'user_fixed_preference', basis: 'stored_fixed_coordinates', timezoneSource: validTimezone(explicitTimezone) ? 'explicit_override' : 'stored_preference' };
    }
    if (userPrefs.fixedCity) return cityLocation(userPrefs.fixedCity, 'stored_fixed_city');
    throw new LocationRequiredError();
  }
  const headerCoordinates = headers?.get('X-User-Coordinates');
  const headerCity = headers?.get('X-User-City');
  if (headerCoordinates && headerCity) throw new InvalidLocationInputError('Supply X-User-City or X-User-Coordinates, not both.');
  if (headerCoordinates) {
    const pair = headerCoordinates.split(',');
    const latitude = parseCoordinate(pair[0]);
    const longitude = parseCoordinate(pair[1]);
    const timezone = validTimezone(explicitTimezone, headers?.get('X-User-Timezone') ?? undefined);
    if (pair.length !== 2 || !validCoordinatePair(latitude, longitude) || !timezone) throw new LocationRequiredError();
    const validation = validateCoordinateTimezone(latitude, longitude, timezone);
    return { ...resolveLocation({ explicitLat: latitude, explicitLng: longitude, explicitTimezone: validation.expectedTimezone }), ...validation, timezone, source: 'host_header', basis: 'host_coordinates', timezoneSource: validTimezone(explicitTimezone) ? 'explicit_override' : 'host_header' };
  }
  if (headerCity) return cityLocation(headerCity, 'host_city', explicitTimezone ?? headers?.get('X-User-Timezone') ?? undefined);
  throw new LocationRequiredError();
}
