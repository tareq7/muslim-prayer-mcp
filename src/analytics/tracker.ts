import type { KVNamespaceLike } from '../storage/kv-store.ts';

export interface AnalyticsEvent {
  tool: string;
  subject?: string;
  session?: string;
  country?: string;
}

export interface DayAnalytics {
  date: string;
  calls: number;
  tools: Record<string, number>;
  users: string[];
  sessions: string[];
  countries: Record<string, number>;
}

export interface AnalyticsSummary {
  totalCalls: number;
  totalUniqueUsers: number;
  totalUniqueSessions: number;
  tools: Record<string, number>;
  countries: Record<string, number>;
  firstRecordedAt: string;
  lastRecordedAt: string;
}

export interface AnalyticsReport {
  status: 'active';
  metrics: {
    totalActiveUsers: number;
    dau: number;
    wau: number;
    mau: number;
    totalCalls: number;
    totalSessions: number;
    callsPerUser: number;
    toolUsage: Record<string, number>;
    countryDistribution: Record<string, number>;
    recentTrend: Array<{
      date: string;
      calls: number;
      activeUsers: number;
    }>;
  };
  lastUpdated: string;
}

export async function hashToken(token: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export async function trackAnalytics(kv: KVNamespaceLike, event: AnalyticsEvent): Promise<void> {

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();

    const userHash = event.subject ? await hashToken(event.subject) : undefined;
    const sessionHash = event.session ? await hashToken(event.session) : undefined;
    const toolName = event.tool || 'unknown';
    const country = event.country && /^[A-Z]{2}$/.test(event.country) ? event.country : 'Unknown';

    // 1. Update Daily Bucket (analytics:day:YYYY-MM-DD)
    const dayKey = `analytics:day:${today}`;
    const rawDay = await kv.get(dayKey);
    let dayData: DayAnalytics;
    if (rawDay) {
      dayData = typeof rawDay === 'object' ? rawDay : JSON.parse(rawDay);
    } else {
      dayData = {
        date: today,
        calls: 0,
        tools: {},
        users: [],
        sessions: [],
        countries: {},
      };
    }

    dayData.calls = (dayData.calls || 0) + 1;
    dayData.tools[toolName] = (dayData.tools[toolName] || 0) + 1;
    dayData.countries[country] = (dayData.countries[country] || 0) + 1;

    if (userHash && !dayData.users.includes(userHash)) {
      if (dayData.users.length < 5000) dayData.users.push(userHash);
    }
    if (sessionHash && !dayData.sessions.includes(sessionHash)) {
      if (dayData.sessions.length < 5000) dayData.sessions.push(sessionHash);
    }

    // Save daily bucket with 60 days TTL
    await kv.put(dayKey, JSON.stringify(dayData), { expirationTtl: 5184000 });

    // 2. Global Summary (analytics:summary)
    const summaryKey = 'analytics:summary';
    const rawSummary = await kv.get(summaryKey);
    let summary: AnalyticsSummary;
    if (rawSummary) {
      summary = typeof rawSummary === 'object' ? rawSummary : JSON.parse(rawSummary);
    } else {
      summary = {
        totalCalls: 0,
        totalUniqueUsers: 0,
        totalUniqueSessions: 0,
        tools: {},
        countries: {},
        firstRecordedAt: nowIso,
        lastRecordedAt: nowIso,
      };
    }

    summary.totalCalls = (summary.totalCalls || 0) + 1;
    summary.tools[toolName] = (summary.tools[toolName] || 0) + 1;
    summary.countries[country] = (summary.countries[country] || 0) + 1;
    summary.lastRecordedAt = nowIso;

    // Check if user is first-seen
    if (userHash) {
      const userKey = `analytics:user:${userHash}`;
      const existingUser = await kv.get(userKey);
      if (!existingUser) {
        summary.totalUniqueUsers = (summary.totalUniqueUsers || 0) + 1;
        await kv.put(
          userKey,
          JSON.stringify({ firstSeen: nowIso, lastSeen: nowIso, calls: 1 }),
          { expirationTtl: 7776000 } // 90 days
        );
      } else {
        const u = typeof existingUser === 'object' ? existingUser : JSON.parse(existingUser);
        await kv.put(
          userKey,
          JSON.stringify({ ...u, lastSeen: nowIso, calls: (u.calls || 0) + 1 }),
          { expirationTtl: 7776000 }
        );
      }
    }

    // Check if session is first-seen
    if (sessionHash) {
      const sessionKey = `analytics:session:${sessionHash}`;
      const existingSession = await kv.get(sessionKey);
      if (!existingSession) {
        summary.totalUniqueSessions = (summary.totalUniqueSessions || 0) + 1;
        await kv.put(
          sessionKey,
          JSON.stringify({ firstSeen: nowIso }),
          { expirationTtl: 604800 } // 7 days
        );
      }
    }

    await kv.put(summaryKey, JSON.stringify(summary));
  } catch {
    // Non-blocking telemetry failure: swallow to never fail user requests
  }
}

export async function getAnalyticsReport(kv: KVNamespaceLike): Promise<AnalyticsReport> {
  const summaryKey = 'analytics:summary';
  const rawSummary = await kv.get(summaryKey);
  const summary: AnalyticsSummary = rawSummary
    ? (typeof rawSummary === 'object' ? rawSummary : JSON.parse(rawSummary))
    : {
        totalCalls: 0,
        totalUniqueUsers: 0,
        totalUniqueSessions: 0,
        tools: {},
        countries: {},
        firstRecordedAt: new Date().toISOString(),
        lastRecordedAt: new Date().toISOString(),
      };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Fetch last 30 daily buckets for DAU, WAU, MAU
  const dayKeys: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const dayRecords = await Promise.all(
    dayKeys.map(async (dateStr) => {
      const raw = await kv.get(`analytics:day:${dateStr}`);
      if (!raw) return null;
      return typeof raw === 'object' ? (raw as DayAnalytics) : (JSON.parse(raw) as DayAnalytics);
    })
  );

  const todayRecord = dayRecords[0];
  const dau = todayRecord?.users ? todayRecord.users.length : 0;

  // WAU: Unique user hashes across past 7 days (index 0 to 6)
  const wauUsers = new Set<string>();
  for (let i = 0; i < Math.min(7, dayRecords.length); i++) {
    const rec = dayRecords[i];
    if (rec?.users) {
      for (const u of rec.users) wauUsers.add(u);
    }
  }
  const wau = wauUsers.size;

  // MAU: Unique user hashes across all 30 days
  const mauUsers = new Set<string>();
  for (const rec of dayRecords) {
    if (rec?.users) {
      for (const u of rec.users) mauUsers.add(u);
    }
  }
  const mau = mauUsers.size;

  const totalCalls = summary.totalCalls || 0;
  const totalUsers = Math.max(summary.totalUniqueUsers || 0, mau);
  const callsPerUser = totalUsers > 0 ? parseFloat((totalCalls / totalUsers).toFixed(2)) : 0;

  const recentTrend = dayKeys.slice(0, 7).reverse().map((dateStr, idx) => {
    const origIdx = 6 - idx;
    const rec = dayRecords[origIdx];
    return {
      date: dateStr,
      calls: rec?.calls || 0,
      activeUsers: rec?.users?.length || 0,
    };
  });

  return {
    status: 'active',
    metrics: {
      totalActiveUsers: totalUsers,
      dau,
      wau,
      mau,
      totalCalls,
      totalSessions: summary.totalUniqueSessions || 0,
      callsPerUser,
      toolUsage: summary.tools || {},
      countryDistribution: summary.countries || {},
      recentTrend,
    },
    lastUpdated: summary.lastRecordedAt || new Date().toISOString(),
  };
}

export function renderAnalyticsHtml(report: AnalyticsReport): string {
  const m = report.metrics;
  const toolRows = Object.entries(m.toolUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => `<tr><td><code>${tool}</code></td><td><strong>${count.toLocaleString()}</strong></td></tr>`)
    .join('') || '<tr><td colspan="2" class="empty">No tool invocations recorded yet</td></tr>';

  const countryRows = Object.entries(m.countryDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => `<tr><td><span class="flag">${code}</span></td><td>${count.toLocaleString()}</td></tr>`)
    .join('') || '<tr><td colspan="2" class="empty">No country data recorded yet</td></tr>';

  const trendBars = m.recentTrend
    .map((t) => {
      const maxCalls = Math.max(1, ...m.recentTrend.map((x) => x.calls));
      const pct = Math.min(100, Math.round((t.calls / maxCalls) * 100));
      return `
        <div class="trend-col">
          <div class="bar-container">
            <div class="bar" style="height: ${pct}%;"></div>
          </div>
          <div class="trend-label">${t.date.slice(5)}</div>
          <div class="trend-sub">${t.calls} calls</div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Muslim Prayer Reminder MCP - Edge Analytics</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --border: #1f2937;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #10b981;
      --accent-subtle: rgba(16, 185, 129, 0.15);
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 960px;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .title-group h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      background: var(--accent-subtle);
      color: var(--accent);
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .meta-sub {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
    }
    .card-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .card-val {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
    }
    .card-foot {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.4rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #fff;
    }
    .two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th, td {
      text-align: left;
      padding: 0.75rem 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      color: #34d399;
      background: rgba(52, 211, 153, 0.1);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
    }
    .empty {
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
      padding: 1.5rem 0;
    }
    .trend-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .trend-bars {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 140px;
      gap: 0.5rem;
      padding-top: 1rem;
    }
    .trend-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
    }
    .bar-container {
      flex: 1;
      width: 100%;
      max-width: 32px;
      display: flex;
      align-items: flex-end;
    }
    .bar {
      width: 100%;
      background: var(--accent);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }
    .trend-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }
    .trend-sub {
      font-size: 0.7rem;
      color: #6b7280;
    }
    footer {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 1.5rem;
    }
    footer a { color: var(--accent); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-group">
        <h1>🕌 Muslim Prayer Reminder <span class="badge">Live Edge Analytics</span></h1>
        <div class="meta-sub">Measured anonymously via Cloudflare Workers & OpenAI Subject tokens</div>
      </div>
      <div>
        <a href="/api/analytics" style="color: #10b981; font-size: 0.85rem; text-decoration: none; border: 1px solid #1f2937; padding: 0.4rem 0.8rem; border-radius: 6px;">JSON Endpoint &rarr;</a>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-title">Total Active Users</div>
        <div class="card-val">${m.totalActiveUsers.toLocaleString()}</div>
        <div class="card-foot">All-time unique subjects</div>
      </div>
      <div class="card">
        <div class="card-title">Daily Active (DAU)</div>
        <div class="card-val">${m.dau.toLocaleString()}</div>
        <div class="card-foot">Unique subjects today</div>
      </div>
      <div class="card">
        <div class="card-title">Weekly Active (WAU)</div>
        <div class="card-val">${m.wau.toLocaleString()}</div>
        <div class="card-foot">Last 7 days active</div>
      </div>
      <div class="card">
        <div class="card-title">Monthly Active (MAU)</div>
        <div class="card-val">${m.mau.toLocaleString()}</div>
        <div class="card-foot">Last 30 days active</div>
      </div>
      <div class="card">
        <div class="card-title">Total Tool Calls</div>
        <div class="card-val">${m.totalCalls.toLocaleString()}</div>
        <div class="card-foot">${m.callsPerUser} calls / user</div>
      </div>
      <div class="card">
        <div class="card-title">Active Sessions</div>
        <div class="card-val">${m.totalSessions.toLocaleString()}</div>
        <div class="card-foot">Conversational threads</div>
      </div>
    </div>

    <div class="trend-container">
      <div class="section-title">7-Day Invocation Trend</div>
      <div class="trend-bars">
        ${trendBars}
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="section-title">Tool Invocations</div>
        <table>
          <thead>
            <tr><th>Tool Name</th><th>Total Calls</th></tr>
          </thead>
          <tbody>
            ${toolRows}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="section-title">Top Countries</div>
        <table>
          <thead>
            <tr><th>Country Code</th><th>Total Calls</th></tr>
          </thead>
          <tbody>
            ${countryRows}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Powered by Cloudflare Workers &bull; Anonymized SHA-256 telemetry &bull; <a href="https://github.com/tareq7/muslim-prayer-mcp" target="_blank">Smart Creations &bull; Tareq Naji</a>
    </footer>
  </div>
</body>
</html>`;
}
