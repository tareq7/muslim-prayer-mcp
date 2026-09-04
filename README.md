<p align="center">
  <img src="assets/icon.png" width="160" height="160" alt="Muslim Prayer Reminder MCP Logo" />
</p>

# Muslim Prayer Reminder System (Cloudflare Remote MCP + Hybrid Middleware)

[![npm version](https://img.shields.io/npm/v/muslim-prayer-mcp.svg?color=CB3837&logo=npm)](https://www.npmjs.com/package/muslim-prayer-mcp)
[![CI](https://github.com/tareq7/muslim-prayer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/tareq7/muslim-prayer-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-blue)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org)

Production-ready Muslim prayer reminder system running on **Cloudflare Workers**, exposing both a **Streamable HTTP Model Context Protocol (MCP)** server and an ultra-fast edge REST API with deterministic host middleware.

---

## 🕌 Architecture Overview

1. **Remote Cloudflare MCP Worker (`src/index.ts`)**:
   * Uses modern Web Standard Streamable HTTP transport (`@modelcontextprotocol/sdk`).
   * Backed by Cloudflare KV for user preference storage and deduplication sentinels.
   * Calculates prayer times in-isolate via `adhan` (`<1ms` astronomical solar computation).
   * Layered location resolver (explicit coordinates -> user preference -> host headers -> `request.cf` geolocation -> Makkah fallback).
   * High-latitude polar day/night handling (fiqh-compliant 48° clamping).

2. **Deterministic Host Middleware (`src/middleware/host-connector.ts`)**:
   * Bridges the protocol limitation: generic MCP tools cannot intercept arbitrary model prompts or force response appending.
   * Runs alongside the LLM call (`<5ms` latency overhead), and deterministically appends `\n\n🕌 It is time for [Prayer] prayer.` to the final answer whenever a prayer is due.
   * Fail-open: network timeouts or worker outages never disrupt the primary AI conversation.

---

## 🛠️ MCP Tools

| Tool Name | Type | Description |
| :--- | :--- | :--- |
| `get_prayer_status` | Read-only | Checks whether an obligatory prayer is currently due and returns reminder text, window bounds, and dedupe key. |
| `get_today_prayer_times` | Read-only | Returns today's full timetable (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) in UTC and formatted local time. |
| `get_next_prayer` | Read-only | Returns the immediate next prayer name, scheduled time, and remaining countdown in minutes. |
| `configure_prayer_preferences` | State mutation | Sets user calculation method, madhab, reminder mode, location mode (fixed vs auto), and language. |
| `get_prayer_preferences` | Read-only | Inspects active user calculation settings and preferences. |

---

## 🚀 Quick Start & Deployment

### 1. Run Automated Test Suite Locally
```bash
npm test
```
Executes 39 automated tests covering 10 benchmark cities, DST transitions, Hanafi/Shafi Asr differences, deduplication, JSON-RPC MCP conformance, and end-to-end middleware post-processing.

### 2. Deploy to Cloudflare Workers
```bash
# 1. Create Cloudflare KV namespace
npx wrangler kv:namespace create PRAYER_KV

# 2. Update wrangler.toml with the returned namespace ID
# 3. Deploy
npx wrangler deploy
```

---

## 🔌 Connecting to AI Hosts

### Option 1: Local Stdio via NPX (Claude Desktop, Cursor, Windsurf, VS Code)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "command": "npx",
      "args": ["-y", "muslim-prayer-mcp"]
    }
  }
}
```

### Option 2: Remote Streamable HTTP (Cloudflare Workers)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### Deterministic Host Middleware (Node.js / Express / Vercel AI SDK)
```typescript
import { PrayerReminderMiddleware } from './src/middleware/host-connector.ts';

const prayerMiddleware = new PrayerReminderMiddleware({
  workerBaseUrl: 'https://muslim-prayer-mcp.najetareqz.workers.dev',
  userId: 'user_123',
});

// Wrap any LLM completion
const rawAnswer = await callYourLlm('What is the best database for this project?');
const { responseText, reminderAppended } = await prayerMiddleware.processResponse(rawAnswer, {
  'X-User-Coordinates': '24.71, 46.68',
  'X-User-Timezone': 'Asia/Riyadh',
});

console.log(responseText);
// If Maghrib is due:
// PostgreSQL is the recommended database...
//
// 🕌 It is time for Maghrib prayer.
```

---

## 🔒 Privacy & Data Minimization
* **Coordinate Truncation**: All incoming latitude/longitude values are rounded to 2 decimal places (`~1.1km` precision), preventing street-level tracking while preserving sub-minute solar calculation accuracy.
* **No Coordinate Leakage**: MCP tool outputs return prayer names and reminders; raw coordinates are never passed into the LLM context.
* **In-Isolate Execution**: Calculations run directly within the Cloudflare V8 isolate; no user coordinates are sent across WAN to third-party prayer APIs.
