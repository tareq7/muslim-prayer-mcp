export interface LegacySummary { totalCalls: number; totalUniqueUsers: number; firstRecordedAt: string | null; lastRecordedAt: string | null }

const MAX_CHARS = 524_288;
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), Number.MAX_SAFE_INTEGER) : 0;
const stamp = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

export async function readLegacySummary(kv: { get(key: string): Promise<string | null> } | undefined): Promise<LegacySummary | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get('analytics:summary');
    if (!raw || raw.length > MAX_CHARS) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    return { totalCalls: count(data.totalCalls), totalUniqueUsers: count(data.totalUniqueUsers), firstRecordedAt: stamp(data.firstRecordedAt), lastRecordedAt: stamp(data.lastRecordedAt) };
  } catch {
    return null;
  }
}
