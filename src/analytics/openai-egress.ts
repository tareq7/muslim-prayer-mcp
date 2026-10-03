import { EGRESS_SNAPSHOT, EGRESS_SOURCE } from './openai-egress-snapshot.ts';

type Range = readonly [start: number, end: number];

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

export function compileRanges(prefixes: readonly string[]): Range[] {
  const out: Range[] = [];
  for (const cidr of prefixes) {
    const [ip, bitsRaw] = cidr.split('/');
    const base = ipv4ToInt(ip ?? '');
    const bits = Number(bitsRaw);
    if (base === null || !Number.isInteger(bits) || bits < 8 || bits > 32) continue;
    const size = 2 ** (32 - bits);
    const start = base - (base % size);
    out.push([start, start + size - 1]);
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of out) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

let ranges = compileRanges(EGRESS_SNAPSHOT);
let refreshedAt = 0;

export function isOpenAIEgress(ip: string | null | undefined, list: readonly Range[] = ranges): boolean {
  const n = ip ? ipv4ToInt(ip.trim()) : null;
  if (n === null) return false;
  let lo = 0, hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = list[mid];
    if (n < s) hi = mid - 1;
    else if (n > e) lo = mid + 1;
    else return true;
  }
  return false;
}

// Keeps the verified segment current when OpenAI adds ranges; the bundled snapshot stays as a fail-safe.
export async function refreshEgress(fetcher: typeof fetch, now = Date.now()): Promise<boolean> {
  if (now - refreshedAt < 86_400_000) return false;
  refreshedAt = now;
  try {
    const res = await fetcher(EGRESS_SOURCE, { cf: { cacheTtl: 86_400, cacheEverything: true }, signal: AbortSignal.timeout(5000) } as RequestInit);
    if (!res.ok) return false;
    const text = await res.text();
    if (text.length > 262_144) return false;
    const data = JSON.parse(text) as { prefixes?: { ipv4Prefix?: unknown }[] };
    const next = compileRanges((data.prefixes ?? []).map(p => p?.ipv4Prefix).filter((p): p is string => typeof p === 'string'));
    if (next.length < 10) return false;
    ranges = next;
    return true;
  } catch {
    return false;
  }
}
