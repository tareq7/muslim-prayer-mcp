---
name: muslim-prayer-mcp
description: Teaches LLMs how to query Muslim prayer times, check current prayer due status, countdown to next prayer, and enforce mandatory calculation authority and selection justification disclosure.
---

# Muslim Prayer Reminder MCP

This skill instructs LLMs (Claude, GPT, Cursor, Copilot, Gemini, Devin, etc.) on interacting with the Muslim Prayer Reminder MCP server (`muslim-prayer-mcp`), executing prayer-time tools, interpreting results, and formatting prayer outputs.

## Server Endpoints
- **Streamable HTTP (Remote Worker)**: `https://muslim-prayer-mcp.najetareqz.workers.dev/mcp`
- **Local Stdio (NPX)**: `npx -y muslim-prayer-mcp`

---

## ⚠️ MANDATORY DIRECTIVE: Authority and Selection Reason Disclosure

Every time you present prayer times, next prayer countdowns, or prayer status to a user, you **MUST EXPLICITLY STATE**:
1. **The calculation authority and method used** (e.g., Palestinian Ministry of Awqaf, Umm al-Qura University Makkah, Egyptian General Authority of Survey, Diyanet İşleri Başkanlığı, etc.).
2. **Why that authority was selected** (e.g., automatically selected based on Gaza/Palestine coordinates with regional Awqaf safety offsets, matched user timezone Asia/Riyadh, user explicitly configured method, etc.).

**Zero Exception Rule**: Never omit this disclosure. The `authorityNotice` object returned in all tool payloads contains the exact strings to use.

---

## Tool Reference

Calculation tools accept optional `userId`, `latitude`, `longitude`, `timezone`, `calculationMethod`, and `madhab`. Supply coordinates as a pair. Omit `userId` for anonymous calculation without saved preferences or deduplication. Read the advertised input schema before calling a tool.

### 1. `get_prayer_status`
Returns `reminderDue`, optional `prayer`, `reminderText`, `startedAtUtc`, and `expiresAtUtc`, plus `localDate`, `nextPrayer`, `nextPrayerAtUtc`, `timezone`, `calculationMethod`, `madhab`, and `authorityNotice`. An identified user can receive one reminder per prayer window; this tool writes a temporary deduplication marker. `persistent` mode bypasses deduplication, and `enabled: false` suppresses reminders.

### 2. `get_today_prayer_times`
Also accepts optional `date` as a real calendar date in `YYYY-MM-DD` format. Returns `localDate`, `timezone`, `calculationMethod`, `madhab`, `timesUtc` (lowercase prayer keys), `timesLocal` (`Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`), and `authorityNotice`.

### 3. `get_next_prayer`
Returns `currentLocalDate`, `nextPrayer`, `nextPrayerAtUtc`, `nextPrayerLocalTime`, `remainingMinutes`, `timezone`, `calculationMethod`, `madhab`, and `authorityNotice`.

### 4. `configure_prayer_preferences`
Requires `userId`. Optional settings are `locationMode` (`auto_travel` or `fixed`), `fixedCity` (a supported predefined city), `fixedCoordinates` (`{ latitude, longitude }`), `timezone`, `calculationMethod`, `madhab` (`Shafi` or `Hanafi`), `highLatitudeRule`, `reminderMode` (`prayer_window`, `exact_window`, or `persistent`), `exactWindowMinutes` (5–120), `locale` (`en` or `ar`), `minuteAdjustments`, and `enabled`.

Omitted settings preserve existing preferences. New preferences retain geographic calculation defaults unless the user explicitly chooses a method or madhab. Switching to a city replaces old fixed coordinates; switching to coordinates replaces the old city. Coordinates are rounded before storage and excluded from tool output. Returns `success` and public `preferences`.

### 5. `get_prayer_preferences`
Requires `userId`. Returns public saved settings or a message when unset. User identifiers and fixed coordinates are excluded from output.

---

## Automatic Geographic Authority Resolution Matrix

When the user has not explicitly configured a preferred method, the system automatically resolves the calculation authority based on location coordinates and timezone:

| Region / Location | Resolved Authority | Jurisdictional Reason / Solar Offsets | Madhab |
| :--- | :--- | :--- | :--- |
| **Palestine** (Gaza, West Bank, Jerusalem) | Palestinian Ministry of Awqaf (Egyptian Survey Authority + Awqaf Offsets) | Official Palestinian Awqaf standard: Egyptian Survey (`19.5°`/`17.5°`) with `{ maghrib: +3 min, dhuhr: -1 min }` safety offsets matching local mosque calendars. | Shafi |
| **Saudi Arabia** | Umm al-Qura University, Makkah | Official Saudi government standard: Fajr `18.5°`, Isha `90 min` after Maghrib. | Shafi |
| **United Arab Emirates** | General Authority of Islamic Affairs & Endowments (Awqaf UAE) | Official UAE standard (`Dubai` method): Fajr `18.2°`, Isha `18.2°`. | Shafi |
| **Qatar** | Ministry of Endowments and Islamic Affairs (Awqaf Qatar) | Official Qatari standard: Fajr `18.0°`, Isha `90 min` after Maghrib. | Shafi |
| **Kuwait** | Ministry of Awqaf and Islamic Affairs (Kuwait) | Official Kuwaiti standard: Fajr `18.0°`, Isha `17.5°`. | Shafi |
| **Egypt** | Egyptian General Authority of Survey | Official Egyptian standard: Fajr `19.5°`, Isha `17.5°`. | Shafi |
| **Turkey & Balkans** | Diyanet İşleri Başkanlığı (Turkey) | Official Turkish Presidency of Religious Affairs standard: Fajr `18.0°`, Isha `17.0°`, Hanafi Asr. | Hanafi |
| **South Asia** (PK, IN, BD, AF) | University of Islamic Sciences, Karachi | Standard South Asian Hanafi method: Fajr `18.0°`, Isha `18.0°`, Hanafi Asr shadow ratio 2x. | Hanafi |
| **North America** (US, CA) | Islamic Society of North America (ISNA) | Continental North American standard: Fajr `15.0°`, Isha `15.0°`. | Shafi |
| **Southeast Asia** (SG, MY, ID, BN) | MUIS / JAKIM / MABIMS | Standard Southeast Asian regional authority: Fajr `20.0°`, Isha `18.0°`. | Shafi |
| **Global / Other** | Muslim World League (MWL) | International consensus baseline: Fajr `18.0°`, Isha `17.0°`. | Shafi |

---

## Required Response Formatting

When generating user-facing responses containing prayer times or alerts, format the output cleanly:

### Example 1: Timetable Query
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
> **Authority Selection Reason**: Automatically selected based on the supplied Palestine location with official Awqaf solar safety adjustments (+3m Maghrib, -1m Dhuhr).
```

### Example 2: Next Prayer / Status Query
```markdown
🕌 **Next Prayer**: **Maghrib** in **42 minutes** (07:05 PM).

> **Calculation Method**: Palestinian Ministry of Awqaf (Egyptian Survey Authority + Awqaf Offsets)
> **Selection Reason**: Automatically calibrated for Palestine/Gaza location.
```

---

## Error Handling & Fallbacks
- If coordinates are unavailable, the MCP automatically uses saved fixed preferences, host headers (`X-User-Coordinates`, `X-User-Timezone`), or Cloudflare edge geolocation. Explicit tool coordinates take priority.
- If completely unresolved, it safely defaults to Makkah (`21.42, 39.83`, `Asia/Riyadh`, `UmmAlQura`) and notes the fallback in `authorityNotice.selectionReason`.
- Polar/high-latitude locations (>48°) automatically engage nearest-latitude fiqh clamping to prevent invalid twilight calculations.
