import type { PrayerSchedule, UserPreferences } from '../engine/types.ts';

export interface KVNamespaceLike {
  get(key: string, type?: 'text' | 'json'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryKV implements KVNamespaceLike {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string, type: 'text' | 'json' = 'text'): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
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
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class PrayerStorage {
  private kv: KVNamespaceLike;

  constructor(kv?: KVNamespaceLike) {
    this.kv = kv || new MemoryKV();
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return (await this.kv.get(`pref:${userId}`, 'json')) as UserPreferences | null;
  }

  async saveUserPreferences(prefs: UserPreferences): Promise<void> {
    await this.kv.put(`pref:${prefs.userId}`, JSON.stringify(prefs));
  }

  async getCachedSchedule(userId: string, localDate: string): Promise<PrayerSchedule | null> {
    return (await this.kv.get(`sched:${userId}:${localDate}`, 'json')) as PrayerSchedule | null;
  }

  async saveCachedSchedule(userId: string, localDate: string, schedule: PrayerSchedule): Promise<void> {
    // Cache for 24 hours (86400s)
    await this.kv.put(`sched:${userId}:${localDate}`, JSON.stringify(schedule), {
      expirationTtl: 86400,
    });
  }

  async isDedupeSent(dedupeKey: string): Promise<boolean> {
    const val = await this.kv.get(`dedupe:${dedupeKey}`, 'text');
    return val !== null;
  }

  async recordDedupeSent(dedupeKey: string, ttlSeconds: number = 7200): Promise<void> {
    // Default TTL 2 hours (covers standard prayer window)
    await this.kv.put(
      `dedupe:${dedupeKey}`,
      JSON.stringify({ sentAt: new Date().toISOString() }),
      { expirationTtl: Math.max(60, ttlSeconds) }
    );
  }

  async clearDedupe(dedupeKey: string): Promise<void> {
    await this.kv.delete(`dedupe:${dedupeKey}`);
  }
}
