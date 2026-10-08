import type { PrayerSchedule, UserPreferences } from '../engine/types.ts';
import { StoredUserPreferencesSchema } from '../mcp/schemas.ts';
import { sanitizeCoordinate, getKnownCity } from '../location/resolver.ts';
import { validateCityTimezone, validateCoordinateTimezone } from '../location/timezone.ts';

export interface KVNamespaceLike {
  get(key: string, type?: 'text' | 'json'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryKV implements KVNamespaceLike {
  private nextCleanupAt = 0;
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string, type: 'text' | 'json' = 'text'): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() >= item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (type === 'json') {
      try {
        return JSON.parse(item.value);
      } catch {
        return null;
      }
    }
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const now = Date.now();
    if (now >= this.nextCleanupAt) {
      for (const [key, item] of this.store) {
        if (item.expiresAt !== undefined && item.expiresAt <= now) this.store.delete(key);
      }
      this.nextCleanupAt = now + 60000;
    }
    const expiresAt = options?.expirationTtl
      ? now + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.nextCleanupAt = 0;
  }
}

const defaultMemoryKV = new MemoryKV();
const userQueues = new WeakMap<KVNamespaceLike, Map<string, Promise<void>>>();

export class InvalidPreferencesError extends Error {
  readonly code = 'invalid_preferences';
}

export class StorageUnavailableError extends Error {
  readonly code = 'storage_unavailable';

  constructor() {
    super('Prayer storage is unavailable');
    this.name = 'StorageUnavailableError';
  }
}

export class PrayerStorage {
  private kv: KVNamespaceLike;

  constructor(kv?: KVNamespaceLike) {
    this.kv = kv || defaultMemoryKV;
  }

  getKV(): KVNamespaceLike {
    return this.kv;
  }

  async withUserLock<T>(userId: string | undefined, action: () => Promise<T>): Promise<T> {
    if (!userId) return action();
    let queues = userQueues.get(this.kv);
    if (!queues) {
      queues = new Map();
      userQueues.set(this.kv, queues);
    }
    const running = (queues.get(userId) || Promise.resolve()).then(action);
    // Keep the queue usable after a failure; the caller still receives the rejection.
    const tail = running.then(() => undefined, () => undefined);
    queues.set(userId, tail);
    try {
      return await running;
    } finally {
      if (queues.get(userId) === tail) queues.delete(userId);
    }
  }

  private async backend<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new StorageUnavailableError();
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const raw = await this.backend(() => this.kv.get(`pref:${userId}`));
    if (!raw) return null;
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
      }
    }
    const parsed = StoredUserPreferencesSchema.safeParse(value);
    if (!parsed.success || parsed.data.userId !== userId) return null;
    const prefs = this.sanitizePreferences(parsed.data);
    // Older records could contain an ignored display timezone alongside a city.
    // Canonicalize that view without rewriting other saved preferences on a read.
    const city = prefs.fixedCity && !prefs.fixedCoordinates ? getKnownCity(prefs.fixedCity) : undefined;
    return city ? { ...prefs, timezone: city.timezone } : prefs;
  }

  private sanitizePreferences(prefs: UserPreferences): UserPreferences {
    return {
      ...prefs,
      ...(prefs.fixedCoordinates ? { fixedCoordinates: {
        latitude: sanitizeCoordinate(prefs.fixedCoordinates.latitude),
        longitude: sanitizeCoordinate(prefs.fixedCoordinates.longitude),
      } } : {}),
    };
  }

  private normalizeLocation(prefs: UserPreferences): UserPreferences {
    if (prefs.fixedCoordinates) {
      if (!prefs.timezone) throw new InvalidPreferencesError('Fixed coordinates require timezone.');
      validateCoordinateTimezone(prefs.fixedCoordinates.latitude, prefs.fixedCoordinates.longitude, prefs.timezone);
    } else if (prefs.fixedCity) {
      const city = getKnownCity(prefs.fixedCity);
      if (!city) throw new InvalidPreferencesError('Unsupported fixed city.');
      validateCityTimezone(city.timezone, prefs.timezone);
      return { ...prefs, timezone: city.timezone };
    }
    return prefs;
  }

  async saveUserPreferences(prefs: UserPreferences): Promise<void> {
    const validated = this.normalizeLocation(StoredUserPreferencesSchema.parse(prefs));
    if (validated.locationMode === 'fixed' && (validated.fixedCoordinates ? !validated.timezone : !validated.fixedCity)) {
      throw new InvalidPreferencesError('Fixed mode requires a supported fixedCity or fixedCoordinates with timezone. No preferences were saved.');
    }
    await this.backend(() => this.kv.put(`pref:${prefs.userId}`, JSON.stringify(this.sanitizePreferences(validated))));
  }

  async updateUserPreferences(input: Partial<UserPreferences> & { userId: string; clearFixedLocation?: boolean }): Promise<UserPreferences> {
    return this.withUserLock(input.userId, async () => {
      const previous = await this.getUserPreferences(input.userId);
      const validateLocation = !previous || input.fixedCity !== undefined || input.fixedCoordinates !== undefined ||
        input.timezone !== undefined || !!input.clearFixedLocation || input.locationMode === 'fixed';
      const existing = previous || {
        userId: input.userId,
        locationMode: 'auto_travel' as const,
        enabled: true,
      };
      if (input.clearFixedLocation && (input.fixedCity !== undefined || input.fixedCoordinates !== undefined || input.timezone !== undefined)) {
        throw new InvalidPreferencesError('clearFixedLocation cannot be combined with a new fixed location or timezone.');
      }
      if (input.fixedCity !== undefined && input.fixedCoordinates !== undefined) {
        throw new InvalidPreferencesError('Supply fixedCity or fixedCoordinates, not both.');
      }
      if (input.fixedCoordinates !== undefined && input.timezone === undefined) {
        throw new InvalidPreferencesError('New fixedCoordinates require timezone in the same configuration request.');
      }
      const { clearFixedLocation, ...settings } = input;
      const supplied = Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined));
      if (clearFixedLocation) {
        delete existing.fixedCity;
        delete existing.fixedCoordinates;
        delete existing.timezone;
        existing.locationMode = input.locationMode ?? 'auto_travel';
      }
      if (input.fixedCity !== undefined && input.fixedCoordinates === undefined) {
        delete supplied.fixedCoordinates;
        existing.fixedCoordinates = undefined;
        if (input.timezone === undefined) existing.timezone = undefined;
      } else if (input.fixedCoordinates !== undefined && input.fixedCity === undefined) {
        existing.fixedCity = undefined;
      }
      const parsed = this.sanitizePreferences(StoredUserPreferencesSchema.parse({
        ...existing, ...supplied, updatedAtUtc: new Date().toISOString(),
      }));
      const updated = validateLocation ? this.normalizeLocation(parsed) : parsed;
      if (validateLocation) {
        await this.saveUserPreferences(updated);
      } else {
        // Preserve legacy location fields on unrelated edits (including disable).
        // New/activated locations and calculations still enforce timezone validation.
        await this.backend(() => this.kv.put(`pref:${updated.userId}`, JSON.stringify(updated)));
      }
      return updated;
    });
  }

  async deleteUserPreferences(userId: string): Promise<void> {
    await this.withUserLock(userId, () => this.backend(() => this.kv.delete(`pref:${userId}`)));
  }


  async getCachedSchedule(userId: string, localDate: string): Promise<PrayerSchedule | null> {
    try {
      const raw = await this.kv.get(`sched:${userId}:${localDate}`);
      if (!raw) return null;
      if (typeof raw === 'object') return raw as PrayerSchedule;
      return JSON.parse(raw) as PrayerSchedule;
    } catch {
      return null;
    }
  }

  async saveCachedSchedule(userId: string, localDate: string, schedule: PrayerSchedule): Promise<void> {
    // Cache for 24 hours (86400s)
    await this.backend(() => this.kv.put(`sched:${userId}:${localDate}`, JSON.stringify(schedule), {
      expirationTtl: 86400,
    }));
  }

  async isDedupeSent(dedupeKey: string): Promise<boolean> {
    const val = await this.backend(() => this.kv.get(`dedupe:${dedupeKey}`, 'text'));
    return val !== null;
  }

  async recordDedupeSent(dedupeKey: string, ttlSeconds: number = 7200): Promise<void> {
    // Default TTL 2 hours (covers standard prayer window)
    await this.backend(() => this.kv.put(
      `dedupe:${dedupeKey}`,
      JSON.stringify({ sentAt: new Date().toISOString() }),
      { expirationTtl: Math.max(60, Math.ceil(ttlSeconds)) }
    ));
  }

  async clearDedupe(dedupeKey: string): Promise<void> {
    await this.backend(() => this.kv.delete(`dedupe:${dedupeKey}`));
  }
}
