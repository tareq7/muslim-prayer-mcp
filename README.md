<p align="center">
  <img src="https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/icon.png" width="160" height="160" alt="Muslim Prayer Reminder MCP Logo" />
</p>

# Muslim Prayer Reminder System (Cloudflare Remote MCP + Hybrid Middleware)

[![npm version](https://img.shields.io/npm/v/muslim-prayer-mcp.svg?color=CB3837&logo=npm)](https://www.npmjs.com/package/muslim-prayer-mcp)
[![Smithery](https://img.shields.io/badge/Smithery-indexed-orange)](https://smithery.ai/server/@najetareqz/muslim-prayer-mcp)
[![Glama](https://img.shields.io/badge/Glama-indexed-purple)](https://glama.ai/mcp/servers)
[![Cursor](https://img.shields.io/badge/Cursor-Ready-000000?logo=cursor&logoColor=white)](cursor://anysphere.cursor-deeplink/mcp/install?name=muslim-prayer&url=https%3A%2F%2Fmuslim-prayer-mcp.najetareqz.workers.dev%2Fmcp)
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

### ⚡ 1-Click Client Installation Matrix

| Client / Environment | Support Mode | 1-Click Deeplink / Quick Command |
| :--- | :--- | :--- |
| **Cursor** | Remote HTTP | [![Add to Cursor](https://img.shields.io/badge/Install%20in%20Cursor-000000?style=flat-square&logo=cursor&logoColor=white)](cursor://anysphere.cursor-deeplink/mcp/install?name=muslim-prayer&url=https%3A%2F%2Fmuslim-prayer-mcp.najetareqz.workers.dev%2Fmcp) |
| **Claude Desktop** | Remote HTTP | Add URL `https://muslim-prayer-mcp.najetareqz.workers.dev/mcp` to config |
| **VS Code** | Local / NPX | `npx -y muslim-prayer-mcp` via `.vscode/mcp.json` |
| **Windsurf / Devin** | Remote HTTP | Add `https://muslim-prayer-mcp.najetareqz.workers.dev/mcp` to `mcp_config.json` |
| **Gemini CLI** | Auto-indexed | `gemini-cli --mcp-server https://muslim-prayer-mcp.najetareqz.workers.dev/mcp` |
| **Autonomous Agents** | All Modes | Direct agent setup: [`llms-install.md`](llms-install.md) |

---

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

---

## 🎨 Official Branding Assets

Official high-resolution branding assets with antialiased transparent corners:

* **Official Icon (512×512 PNG)**: [`assets/icon.png`](https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/icon.png)
* **Master High-Res (1024×1024 PNG)**: [`assets/official-logo-1024.png`](https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/official-logo-1024.png)
* **Documentation Favicon & Icons**: [`docs/assets/`](https://github.com/tareq7/muslim-prayer-mcp/tree/main/docs/assets)

---

## 📜 Legal & Compliance

* **Terms of Service**: [https://tareq7.github.io/muslim-prayer-mcp/terms-of-service/](https://tareq7.github.io/muslim-prayer-mcp/terms-of-service/)
* **Privacy Policy**: [https://tareq7.github.io/muslim-prayer-mcp/privacy-policy/](https://tareq7.github.io/muslim-prayer-mcp/privacy-policy/)
* **Documentation Portal**: [https://tareq7.github.io/muslim-prayer-mcp/](https://tareq7.github.io/muslim-prayer-mcp/)
