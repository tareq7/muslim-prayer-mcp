---
layout: default
---

<p align="center">
  <img src="assets/icon.png" width="140" height="140" alt="Muslim Prayer Reminder MCP Logo" />
</p>

# Muslim Prayer Reminder MCP

A production-ready Islamic prayer reminder system exposing both a **Streamable HTTP Model Context Protocol (MCP)** server on Cloudflare Workers and a local CLI runner for AI agents.

[Terms of Service](/muslim-prayer-mcp/terms-of-service/) | [Privacy Policy](/muslim-prayer-mcp/privacy-policy/) | [GitHub Repository](https://github.com/tareq7/muslim-prayer-mcp) | [NPM Package](https://www.npmjs.com/package/muslim-prayer-mcp) | [M8ven Score](https://m8ven.ai/mcp/tareq7/muslim-prayer-mcp) | [Wellknown Network](https://wellknown.network/agents/muslim-prayer-reminder-mcp) | [Agent Installation Guide](llms-install.md)

---

## Quickstart

### Option 1: Remote Streamable HTTP (Cloudflare Workers Edge - Recommended)
```json
{
  "mcpServers": {
    "muslim-prayer": {
      "url": "https://muslim-prayer-mcp.najetareqz.workers.dev/mcp"
    }
  }
}
```

### Option 2: Local NPX Runner (Claude Desktop, Cursor, Windsurf)
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

---

For VS Code `.vscode/mcp.json`, use a top-level `servers` object and `type: "stdio"`; see the [VS Code MCP configuration guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## 🛠️ MCP Tools Overview

| Tool Name | Operation | Mandatory LLM Disclosure | Description |
| :--- | :--- | :--- | :--- |
| `get_prayer_status` | Temporary state write | **Required** | Checks whether an obligatory prayer is currently due. Returns reminder status, prayer name, calculation authority, and selection reason. |
| `get_today_prayer_times` | Read-only | **Required** | Computes today's full prayer schedule (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) in UTC and formatted local time with `authorityNotice`. |
| `get_next_prayer` | Read-only | **Required** | Identifies the immediate upcoming prayer, local scheduled time, remaining countdown in minutes, and `authorityNotice`. |
| `configure_prayer_preferences` | Mutation | N/A | Stores custom calculation method, madhab, reminder mode, or fixed location in Cloudflare KV. |
| `get_prayer_preferences` | Read-only | N/A | Returns stored preferences and calculation parameters for a user ID. |

---

## ⚖️ Mandatory Authority Disclosure Directive

To ensure theological transparency and eliminate sectarian or jurisdictional ambiguity, this server enforces strict authority disclosure rules:

1. **Automatic Geographic Calibration**: Unless overridden by user preferences, the calculation authority and safety offsets automatically calibrate to the user's location coordinates or timezone.
2. **Mandatory Output Requirement**: Every AI model (Claude, Cursor, Copilot, ChatGPT, Gemini, Devin) answering prayer-related user queries **MUST EXPLICITLY STATE**:
   - The calculation authority and method used (`authorityNotice.authorityDescription`).
   - The justification for that selection (`authorityNotice.selectionReason`).

### Automatic Regional Calibration Matrix

| Region / Location | Resolved Authority | Jurisdictional Details & Solar Safety Offsets | Madhab |
| :--- | :--- | :--- | :--- |
| **Palestine** (Gaza, West Bank, Jerusalem) | Configured Palestinian regional profile (Egyptian method + service offsets) | Egyptian General Authority of Survey (`19.5°`/`17.5°`) with `{ maghrib: +3 min, dhuhr: -1 min }` service offsets; exact ministry adoption is unverified. | Shafi |
| **Saudi Arabia** | Umm al-Qura University, Makkah | Adhan Umm al-Qura method: Fajr `18.5°`, Isha `90 min` post-Maghrib. | Shafi |
| **United Arab Emirates** | Configured Adhan Dubai method | Configured Dubai method (`Dubai` method): Fajr `18.2°`, Isha `18.2°`. | Shafi |
| **Qatar** | Configured Adhan Qatar method | Configured Qatar method: Fajr `18.0°`, Isha `90 min` post-Maghrib. | Shafi |
| **Kuwait** | Configured Adhan Kuwait method | Configured Kuwait method: Fajr `18.0°`, Isha `17.5°`. | Shafi |
| **Egypt** | Egyptian General Authority of Survey | Egyptian Survey method: Fajr `19.5°`, Isha `17.5°`. | Shafi |
| **Turkey & Balkans** | Diyanet İşleri Başkanlığı (Turkey) | Adhan Diyanet approximation (less accurate outside Turkey): Fajr `18.0°`, Isha `17.0°`, Hanafi Asr. | Hanafi |
| **South Asia** (PK, IN, BD, AF) | University of Islamic Sciences, Karachi | Standard South Asian Hanafi method: Fajr `18.0°`, Isha `18.0°`, Hanafi Asr shadow ratio 2x. | Hanafi |
| **North America** (US, CA) | Islamic Society of North America (ISNA) | Continental North American standard: Fajr `15.0°`, Isha `15.0°`. | Shafi |
| **Southeast Asia** (SG, MY, ID, BN) | Configured Singapore method | Regional Southeast Asian standard: Fajr `20.0°`, Isha `18.0°`. | Shafi |
| **Global / Other** | Muslim World League (MWL) | International standard baseline: Fajr `18.0°`, Isha `17.0°`. | Shafi |

---

## 🤖 Dedicated Agent Skill (`SKILL.md`)

An official skill specification is included at [`skills/muslim-prayer-mcp/SKILL.md`](https://github.com/tareq7/muslim-prayer-mcp/blob/main/skills/muslim-prayer-mcp/SKILL.md) to instruct autonomous coding agents (Claude Code, Antigravity, Cline, Windsurf, OpenCode) on schema invocation and mandatory response formatting.

### Standard Model Response Example

When the user asks: *"What are the prayer times in Gaza today?"*

The agent calls `get_today_prayer_times({ latitude: 31.50, longitude: 34.46, timezone: "Asia/Gaza" })` and formats the response:

```markdown
### Today's Prayer Times for Gaza (Friday, Sep 4, 2026)

| Prayer | Time |
| :--- | :--- |
| **Fajr** | 04:49 AM |
| **Sunrise** | 06:20 AM |
| **Dhuhr** | 12:41 PM |
| **Asr** | 04:15 PM |
| **Maghrib** | 07:05 PM |
| **Isha** | 08:23 PM |

> **Calculation Authority**: Configured Palestinian regional profile (Egyptian method + service offsets)
> **Authority Selection Reason**: Selected by the service regional heuristic, with configured +3m Maghrib and -1m Dhuhr offsets; exact ministry adoption is unverified.
```

---

## Key Capabilities

* **Astronomical Precision**: Calculates Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha with sub-minute accuracy via the open-source Adhan engine.
* **Deterministic Host Middleware**: Zero-latency check that intercepts AI responses to append active prayer alerts without relying on model hallucination.
* **Privacy-First**: Ephemeral V8 isolate execution, 2-decimal fuzzy coordinate truncation, pseudonymous operational analytics, and no external WAN dependencies.

### Verified location and calculation disclosures (v1.1.0)

Prayer tools accept a supported `city`, coordinates with `timezone`, or complete stored fixed settings. Missing location returns `location_required`; connector/IP geolocation and automatic Makkah fallback are not used. Explicit per-call inputs override fixed preferences. Host headers must represent the end user.

`highLatitudeAdjustment` discloses twilight substitutions and polar clamping; `effectiveLatitude` is present only for the +/-48-degree substitute and never echoes the original coordinate. `calculationDetails` reports location basis and regional, user, and method offsets. Invalid offsets that reverse prayer windows return `invalid_calculation`. Preferences expose `fixedCoordinatesConfigured` and `fixedCityConfigured` while redacting coordinates.

Analytics is pseudonymous and approximate: daily buckets 60 days, subject hashes 90 days, sessions 7 days, aggregate counters without expiry. Counts are not global atomic delivery metrics. Both dashboard aliases honor configured service authentication. See the privacy policy for the full retention and trust boundaries.

### Preference and display-time contracts

Explicit coordinates require `timezone` in the same request. Stored fixed-location timezones are never inherited for new explicit coordinates. `calculationDetails.timezoneSource` identifies explicit, city, stored, or host input; explicit display timezones are not geographically validated.

Fixed mode requires a supported city or coordinates with timezone. New fixed coordinates require timezone in the same configuration request. Failed configuration updates save nothing. Switching to `auto_travel` preserves fixed location for reuse; `clearFixedLocation:true` removes city, coordinates and timezone and defaults to auto-travel, preserving unrelated preferences. Clear cannot accompany replacement location/timezone or incomplete fixed mode.

For identified users, `prayer_window` and `exact_window` emit once per prayer/date/mode; `persistent` emits throughout the prayer period. Locale changes and toggling reminders do not reset deduplication. Anonymous calls do not persist deduplication. `expiresAtUtc` retains its prayer-period meaning; `prayerWindowExpiresAtUtc` names the same boundary, and `reminderWindowExpiresAtUtc` describes eligibility, capped by the prayer boundary in exact mode. These fields appear when a reminder is emitted. Cross-region KV updates and deduplication remain best effort.

The Palestinian regional profile is a configured service heuristic using the Egyptian method with Dhuhr -1 and Maghrib +3 minute offsets. Its broad coordinate/timezone/country rules do not establish jurisdiction. Exact adoption of these parameters by the Palestinian ministry has not been verified from a primary source. Users can override method and offsets. Other regional choices are service defaults, not nationwide mandates. Method descriptions follow [Adhan documentation](https://github.com/batoulapps/adhan-js/blob/develop/METHODS.md).

The supported city vocabulary and aliases are advertised in each location input schema and generated skill. The service registers five tools only. Duplicate suffixed tools or old schemas in a connector require refreshing its registration; they are not separate server operations.
