<p align="center">
  <a href="https://github.com/tareq7/muslim-prayer-mcp">
    <img src="https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/banner.png" alt="Muslim Prayer Reminder MCP Banner" width="100%" />
  </a>
</p>

<h1 align="center">🕌 Muslim Prayer Reminder MCP</h1>

<p align="center">
  <strong>The Enterprise-Grade Astronomical Prayer Calculation & Proactive Notification Engine for AI Models, Agents, and Developer Tools.</strong>
</p>

<p align="center">
  <a href="https://tareq7.github.io/muslim-prayer-mcp/demo.mp4"><img src="https://img.shields.io/badge/%E2%96%B6_Live_Demo-1080p_MP4-E50914?style=for-the-badge&logo=youtube&logoColor=white" alt="Live Demo"></a>
  <a href="https://tareq7.github.io/muslim-prayer-mcp/"><img src="https://img.shields.io/badge/%F0%9F%93%96_Documentation-Live_Portal-0052CC?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation"></a>
  <a href="cursor://anysphere.cursor-deeplink/mcp/install?name=muslim-prayer&url=https%3A%2F%2Fmuslim-prayer-mcp.najetareqz.workers.dev%2Fmcp"><img src="https://img.shields.io/badge/%E2%9A%A1_1--Click_Cursor-Install-000000?style=for-the-badge&logo=cursor&logoColor=white" alt="Install in Cursor"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/muslim-prayer-mcp"><img src="https://img.shields.io/npm/v/muslim-prayer-mcp.svg?color=CB3837&logo=npm&label=npm%20package" alt="npm version"></a>
  <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.tareq7/muslim-prayer-mcp"><img src="https://img.shields.io/badge/Anthropic_MCP_Registry-v1.0.1_Live-0052CC?logo=anthropic&logoColor=white" alt="MCP Registry"></a>
  <a href="https://glama.ai/mcp/servers/tareq7/muslim-prayer-mcp"><img src="https://img.shields.io/badge/Glama-Verified_Tier_A-7A52CC?logo=glama&logoColor=white" alt="Glama"></a>
  <a href="https://smithery.ai"><img src="https://img.shields.io/badge/Smithery-Indexed-FF7700?logo=webauthn&logoColor=white" alt="Smithery"></a>
  <a href="https://github.com/tareq7/muslim-prayer-mcp/actions/workflows/ci.yml"><img src="https://github.com/tareq7/muslim-prayer-mcp/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI Build Status"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License"></a>
  <a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/Cloudflare_Workers-Edge_%3C1ms-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node Version"></a>
</p>

---

## ⚡ Highlights: The Gold Standard for Islamic AI Tooling

* 🚀 **Sub-Millisecond Astronomical Computation**: Instantaneous in-isolate solar position math via high-precision astronomical algorithms (`adhan`). Zero external WAN dependencies, zero API rate limits, zero downtime.
* 🌍 **Autonomous Regional Calibration**: Automatically calibrates twilight angles, madhab shadow rules, and regional safety offsets to sovereign authorities (Umm Al-Qura, Egyptian Awqaf, Diyanet, Karachi, ISNA, MWL).
* ⚖️ **Mandatory Theological Disclosure**: Enforces complete transparency across AI hosts (Claude, ChatGPT, Cursor) by embedding strict disclosure directives that compel models to cite calculation authorities and selection reasons.
* 🛡️ **Zero-Leak Privacy Architecture**: Enforces coordinate truncation to 2 decimal places (~1.1 km precision). Raw latitude/longitude coordinates are never exposed to LLM context or third-party loggers.
* 🔌 **Universal Multi-Host Compatibility**: Fully compliant with Anthropic Model Context Protocol (Streamable HTTP + Stdio CLI) for Claude Desktop, ChatGPT Apps, Cursor, VS Code, Windsurf, Zed, and Autonomous Agents.
* 🔄 **Deterministic Host Middleware**: Includes optional host-side completion middleware that guarantees notification injection alongside AI completions with zero prompt-drift.

---

## 📺 Live Video Demonstration

Watch the Muslim Prayer Reminder MCP in action inside ChatGPT, Claude, and Cursor:

<p align="center">
  <a href="https://tareq7.github.io/muslim-prayer-mcp/demo.mp4">
    <img src="https://raw.githubusercontent.com/tareq7/muslim-prayer-mcp/main/assets/github-social-preview.png" alt="Muslim Prayer Reminder MCP Video Demo" width="85%" style="border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);" />
  </a>
  <br />
  <em>👉 <a href="https://tareq7.github.io/muslim-prayer-mcp/demo.mp4"><strong>Click here to watch the full 1080p demo video (MP4)</strong></a></em>
</p>

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["AI Clients & Environments"]
        Cursor["Cursor IDE"]
        Claude["Claude Desktop / Web"]
        ChatGPT["ChatGPT Apps Directory"]
        Agent["Autonomous AI Agent"]
    end

    subgraph TransportLayer ["Model Context Protocol"]
        HTTP["Streamable HTTP /mcp"]
        Stdio["Stdio Transport CLI"]
    end

    subgraph ResolverLayer ["Layered Location Resolver"]
        Explicit["Explicit Lat/Lng"] --> Truncate["2-Decimal Sanitizer ~1.1km"]
        UserPref["Stored KV Preferences"] --> Resolver["Location Normalizer"]
        Headers["X-Forwarded Headers"] --> Resolver
        GeoIP["Cloudflare request.cf GeoIP"] --> Resolver
        Fallback["Makkah Al-Mukarramah Fallback"] --> Resolver
        Truncate --> Resolver
    end

    subgraph EngineLayer ["In-Isolate Solar Calculation Engine"]
        Resolver --> Authority["Authority Selector"]
        Authority --> AdhanEngine["Astronomical Solar Solver"]
        AdhanEngine --> FiqhRules["Fiqh Clamping 48° & Madhab Calibration"]
        FiqhRules --> DueLogic["Prayer Window & Due Evaluator"]
    end

    subgraph OutputLayer ["Formatted Payloads & Disclosures"]
        DueLogic --> MCPResponse["JSON-RPC Structured Output"]
        MCPResponse --> DisclosureNotice["Mandatory Theological Notice"]
        DisclosureNotice --> Middleware["Deterministic Host Middleware"]
        Middleware --> FinalOutput["Appended AI Response: 🕌 It is time for Maghrib prayer"]
    end

    ClientLayer --> TransportLayer
    TransportLayer --> ResolverLayer
```

---

## 🛠️ MCP Tools Catalog

The server exposes 5 finely-tuned tools conforming to the latest Model Context Protocol standard with full Zod output contracts:

| Tool Name | Operation Mode | Open World | Description |
| :--- | :--- | :--- | :--- |
| **`get_prayer_status`** | Read-Only | Safe | Checks if an obligatory prayer is currently due. Returns active prayer, countdown, calculation authority, and selection justification. |
| **`get_today_prayer_times`** | Read-Only | Safe | Computes today's full timetable (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) in UTC and localized string format. |
| **`get_next_prayer`** | Read-Only | Safe | Returns the immediate upcoming prayer, exact scheduled timestamp, countdown minutes, and regional authority. |
| **`search_cities`** | Read-Only | Safe | Fuzzy search across 100+ global Islamic metropolitan areas with pre-calibrated coordinates, timezones, and authorities. |
| **`list_authorities`** | Read-Only | Safe | Enumerates all recognized Islamic calculation authorities, twilight angles, and regional jurisdictions. |

---

## 📐 Astronomical & Theological Rigor

Prayer calculations are not approximations—they represent exact solar depression angles calibrated to regional fatwa bodies:

| Sovereign Authority | Jurisdiction | Fajr Angle | Isha Angle / Interval | Default Asr Madhab |
| :--- | :--- | :--- | :--- | :--- |
| **Umm al-Qura University** | Saudi Arabia, GCC | 18.5° | +90 min (+120 min Ramadan) | Shafi / Standard |
| **Egyptian General Survey** | Egypt, Palestine, Levant | 19.5° | 17.5° | Shafi *(Palestinian Awqaf offsets applied)* |
| **Diyanet İşleri Başkanlığı** | Turkey, Balkans, Central Asia | 18.0° | 17.0° | Hanafi (Double shadow ratio) |
| **Univ. of Islamic Sciences, Karachi** | Pakistan, India, Bangladesh | 18.0° | 18.0° | Hanafi (Double shadow ratio) |
| **ISNA** | United States, Canada | 15.0° | 15.0° | Shafi / Standard |
| **Muslim World League (MWL)** | Europe, Global Fallback | 18.0° | 17.0° | Shafi / Standard |
| **MABIMS / JAKIM / MUIS** | Malaysia, Singapore, Indonesia | 20.0° | 18.0° | Shafi / Standard |

### High-Latitude Polar Adjustments
In latitudes above 48° North or South where twilight persists throughout the night in summer, the engine automatically engages fiqh-compliant clamping (**Middle of the Night** & **One-Seventh Rule**), preventing computational errors or impossible timetables.

---

## 🔌 1-Click Client Installation Matrix

### Cursor
Click the 1-click badge:  
[![Install in Cursor](https://img.shields.io/badge/Install%20in%20Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white)](cursor://anysphere.cursor-deeplink/mcp/install?name=muslim-prayer&url=https%3A%2F%2Fmuslim-prayer-mcp.najetareqz.workers.dev%2Fmcp)

Or add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### Claude Desktop
Add to your `claude_desktop_config.json`:
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

### Windsurf & Devin
Add to your `mcp_config.json`:
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### Remote Docker Deployment
```bash
docker run -d -p 8080:8080 --name muslim-prayer-mcp ghcr.io/tareq7/muslim-prayer-mcp:latest
```

---

## 💻 Deterministic Host Middleware

For platforms building autonomous AI agents (Next.js, LangChain, Vercel AI SDK), the included middleware deterministically appends prayer notices to AI responses without hallucination:

```typescript
import { PrayerReminderMiddleware } from 'muslim-prayer-mcp/middleware';

const prayerMiddleware = new PrayerReminderMiddleware({
  workerBaseUrl: 'https://muslim-prayer-mcp.najetareqz.workers.dev',
  userId: 'user_session_42',
});

// Wrap any LLM completion
const rawLlmOutput = await callLlm('Can you review this pull request?');
const { responseText, reminderAppended } = await prayerMiddleware.processResponse(rawLlmOutput, {
  'X-User-Coordinates': '24.71, 46.68', // Riyadh
  'X-User-Timezone': 'Asia/Riyadh',
});

console.log(responseText);
// => The code looks solid, but let's optimize line 42...
//
// 🕌 It is time for Asr prayer.
```

---

## 🧪 Comprehensive Test Suite

The engine includes 44 unit, integration, and end-to-end tests validating astronomical accuracy across 10 worldwide benchmark coordinates:

```bash
npm test
```

```
▶ Astronomical Prayer Calculation Suite
  ✔ calculates valid prayer timetable for Riyadh in correct chronological sequence
  ✔ calculates valid prayer timetable for Makkah in correct chronological sequence
  ✔ calculates valid prayer timetable for Cairo in correct chronological sequence
  ✔ calculates valid prayer timetable for Dubai in correct chronological sequence
  ✔ calculates valid prayer timetable for London in correct chronological sequence
  ✔ calculates valid prayer timetable for Paris in correct chronological sequence
  ✔ calculates valid prayer timetable for New York in correct chronological sequence
  ✔ calculates valid prayer timetable for Jakarta in correct chronological sequence
  ✔ calculates valid prayer timetable for Karachi in correct chronological sequence
  ✔ calculates valid prayer timetable for Sydney (Southern Hem) in correct chronological sequence
  ✔ verifies Hanafi Asr is strictly later than Shafi Asr
  ✔ handles Daylight Saving Time (DST) transitions safely
  ✔ automatically resolves Palestinian Awqaf standard for Gaza
  ✔ handles high-latitude polar city with MiddleOfTheNight rule safely
...
ℹ tests 44 | pass 44 | fail 0
```

---

## 🔒 Security & Privacy Policy

* **Coordinate Truncation**: All user coordinates are truncated to 2 decimal places upon arrival (~1.1 km resolution). Precise location is mathematically non-recoverable.
* **No Outbound Tracking**: Astronomical math is computed locally within the isolated V8 runtime; zero external requests are made to third-party tracking APIs.
* **Fail-Open Architecture**: Host middleware is designed to fail open; network issues or latency spikes will never block primary AI conversation streams.

---

## 📄 License & Community

* **License**: [MIT License](LICENSE)
* **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
* **Code of Conduct**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
* **Security Advisories**: [SECURITY.md](SECURITY.md)
* **Support & Discussions**: [GitHub Discussions](https://github.com/tareq7/muslim-prayer-mcp/discussions)

<p align="center">
  Made with precision for the global Muslim developer community.
</p>
