import tzLookup from '@photostructure/tz-lookup';

export type TimezoneValidation = 'coordinate_lookup' | 'nearby_boundary' | 'city_registry' | 'polar_choice' | 'ocean_choice';

export class LocationTimezoneMismatchError extends Error {
  readonly code = 'location_timezone_mismatch';
  readonly timezoneMismatchDetected = true;
  readonly expectedTimezone: string;
  constructor(expectedTimezone: string) {
    super(`The supplied timezone contradicts the location. Use ${expectedTimezone}, or correct the location.`);
    this.expectedTimezone = expectedTimezone;
  }
}

function canonicalTimezone(zone: string): string {
  return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
}
function equivalentTimezone(first: string, second: string): boolean {
  // Matching sampled offsets is insufficient: zones can switch DST on different days.
  return canonicalTimezone(first) === canonicalTimezone(second);
}

export function validateCityTimezone(expectedTimezone: string, suppliedTimezone?: string): void {
  if (suppliedTimezone && canonicalTimezone(suppliedTimezone) !== canonicalTimezone(expectedTimezone)) {
    throw new LocationTimezoneMismatchError(expectedTimezone);
  }
}

export function validateCoordinateTimezone(latitude: number, longitude: number, suppliedTimezone: string): {
  expectedTimezone: string; timezoneValidation: TimezoneValidation;
} {
  const expectedTimezone = tzLookup(latitude, longitude);
  // The mathematical poles have no single local civil timezone. Ocean cells
  // describe nautical zones, not an inhabited jurisdiction; retain explicit choices.
  if (Math.abs(latitude) === 90) return { expectedTimezone, timezoneValidation: 'polar_choice' };
  if (expectedTimezone.startsWith('Etc/GMT') && equivalentTimezone(expectedTimezone, suppliedTimezone)) return { expectedTimezone, timezoneValidation: 'ocean_choice' };
  if (equivalentTimezone(expectedTimezone, suppliedTimezone)) return { expectedTimezone, timezoneValidation: 'coordinate_lookup' };
  // The compact dataset is approximate. Check a small neighborhood to avoid
  // rejecting valid adjacent zones at boundaries or due to coordinate rounding.
  for (const latDelta of [-0.05, 0, 0.05]) {
    for (const lngDelta of [-0.05, 0, 0.05]) {
      if (!latDelta && !lngDelta) continue;
      const lat = Math.max(-90, Math.min(90, latitude + latDelta));
      const lng = ((longitude + lngDelta + 180) % 360 + 360) % 360 - 180;
      const candidate = tzLookup(lat, lng);
      if (equivalentTimezone(candidate, suppliedTimezone)) return { expectedTimezone, timezoneValidation: 'nearby_boundary' };
    }
  }
  throw new LocationTimezoneMismatchError(expectedTimezone);
}
