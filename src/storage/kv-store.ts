import type { PrayerSchedule, UserPreferences } from '../engine/types.ts';
import { StoredUserPreferencesSchema } from '../mcp/schemas.ts';
import { sanitizeCoordinate } from '../location/resolver.ts';

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
      throw new Error('Prayer storage is unavailable');
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
    return this.sanitizePreferences(parsed.data);
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

  async saveUserPreferences(prefs: UserPreferences): Promise<void> {
    const validated = StoredUserPreferencesSchema.parse(prefs);
    await this.backend(() => this.kv.put(`pref:${prefs.userId}`, JSON.stringify(this.sanitizePreferences(validated))));
  }

  async updateUserPreferences(input: Partial<UserPreferences> & { userId: string }): Promise<UserPreferences> {
    return this.withUserLock(input.userId, async () => {
      const existing = await this.getUserPreferences(input.userId) || {
        userId: input.userId,
        locationMode: 'auto_travel' as const,
        enabled: true,
      };
      const supplied = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      if (input.fixedCity !== undefined && input.fixedCoordinates === undefined) {
        delete supplied.fixedCoordinates;
        existing.fixedCoordinates = undefined;
        if (input.timezone === undefined) existing.timezone = undefined;
      } else if (input.fixedCoordinates !== undefined && input.fixedCity === undefined) {
        existing.fixedCity = undefined;
      }
      const updated = this.sanitizePreferences(StoredUserPreferencesSchema.parse({
        ...existing, ...supplied, updatedAtUtc: new Date().toISOString(),
      }));
      await this.saveUserPreferences(updated);
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
    await this.kv.put(`sched:${userId}:${localDate}`, JSON.stringify(schedule), {
      expirationTtl: 86400,
    });
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
    await this.kv.delete(`dedupe:${dedupeKey}`);
  }
}
