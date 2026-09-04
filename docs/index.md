---
layout: default
---

<p align="center">
  <img src="assets/icon.png" width="140" height="140" alt="Muslim Prayer Reminder MCP Logo" />
</p>

# Muslim Prayer Reminder MCP

A production-ready Islamic prayer reminder system exposing both a **Streamable HTTP Model Context Protocol (MCP)** server on Cloudflare Workers and a local CLI runner for AI agents.

[Terms of Service](/muslim-prayer-mcp/terms-of-service/) | [Privacy Policy](/muslim-prayer-mcp/privacy-policy/) | [GitHub Repository](https://github.com/tareq7/muslim-prayer-mcp) | [NPM Package](https://www.npmjs.com/package/muslim-prayer-mcp) | [Agent Installation Guide](llms-install.md)

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

### Option 2: Local NPX Runner (Claude Desktop, Cursor, VS Code, Windsurf)
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

## 🛠️ MCP Tools Overview

| Tool Name | Operation | Mandatory LLM Disclosure | Description |
| :--- | :--- | :--- | :--- |
| `get_prayer_status` | Read-only | **Required** | Checks whether an obligatory prayer is currently due. Returns reminder status, prayer name, calculation authority, and selection reason. |
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
| **Palestine** (Gaza, West Bank, Jerusalem) | Palestinian Ministry of Awqaf (Egyptian Survey + Awqaf Offsets) | Egyptian General Authority of Survey (`19.5°`/`17.5°`) with `{ maghrib: +3 min, dhuhr: -1 min }` safety offsets matching official Palestinian printed calendars. | Shafi |
| **Saudi Arabia** | Umm al-Qura University, Makkah | Official Saudi government standard: Fajr `18.5°`, Isha `90 min` post-Maghrib. | Shafi |
| **United Arab Emirates** | General Authority of Islamic Affairs & Endowments (Awqaf UAE) | Official UAE standard (`Dubai` method): Fajr `18.2°`, Isha `18.2°`. | Shafi |
| **Qatar** | Ministry of Endowments and Islamic Affairs (Awqaf Qatar) | Official Qatari standard: Fajr `18.0°`, Isha `90 min` post-Maghrib. | Shafi |
| **Kuwait** | Ministry of Awqaf and Islamic Affairs (Kuwait) | Official Kuwaiti standard: Fajr `18.0°`, Isha `17.5°`. | Shafi |
| **Egypt** | Egyptian General Authority of Survey | Official Egyptian standard: Fajr `19.5°`, Isha `17.5°`. | Shafi |
| **Turkey & Balkans** | Diyanet İşleri Başkanlığı (Turkey) | Official Turkish Presidency of Religious Affairs standard: Fajr `18.0°`, Isha `17.0°`, Hanafi Asr. | Hanafi |
| **South Asia** (PK, IN, BD, AF) | University of Islamic Sciences, Karachi | Standard South Asian Hanafi method: Fajr `18.0°`, Isha `18.0°`, Hanafi Asr shadow ratio 2x. | Hanafi |
| **North America** (US, CA) | Islamic Society of North America (ISNA) | Continental North American standard: Fajr `15.0°`, Isha `15.0°`. | Shafi |
| **Southeast Asia** (SG, MY, ID, BN) | MUIS / JAKIM / MABIMS | Regional Southeast Asian standard: Fajr `20.0°`, Isha `18.0°`. | Shafi |
| **Global / Other** | Muslim World League (MWL) | International standard baseline: Fajr `18.0°`, Isha `17.0°`. | Shafi |

---

## 🤖 Dedicated Agent Skill (`SKILL.md`)

An official skill specification is included at [`skills/muslim-prayer-mcp/SKILL.md`](https://github.com/tareq7/muslim-prayer-mcp/blob/main/skills/muslim-prayer-mcp/SKILL.md) to instruct autonomous coding agents (Claude Code, Antigravity, Cline, Windsurf, OpenCode) on schema invocation and mandatory response formatting.

### Standard Model Response Example

When the user asks: *"What are the prayer times in Gaza today?"*

The agent calls `get_today_prayer_times({ lat: 31.50, lng: 34.46, timezone: "Asia/Gaza" })` and formats the response:

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

> **Calculation Authority**: Palestinian Ministry of Awqaf (Egyptian Survey Authority + Awqaf Offsets)
> **Authority Selection Reason**: Automatically selected based on detected Palestine coordinates (31.50, 34.46) with official Awqaf solar safety adjustments (+3m Maghrib, -1m Dhuhr).
```

---

## Key Capabilities

* **Astronomical Precision**: Calculates Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha with sub-minute accuracy via the open-source Adhan engine.
* **Deterministic Host Middleware**: Zero-latency check that intercepts AI responses to append active prayer alerts without relying on model hallucination.
* **Privacy-First**: Ephemeral V8 isolate execution, 2-decimal fuzzy coordinate truncation, zero tracking, and no external WAN dependencies.
