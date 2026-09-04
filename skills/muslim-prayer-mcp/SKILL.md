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

### 1. `get_prayer_status`
Checks if an obligatory prayer (Fajr, Dhuhr, Asr, Maghrib, Isha) is currently due within the active reminder window.
- **Parameters**:
  - `userId` (string, optional): User ID for fetching stored preferences. Default: `'default_user'`.
  - `lat` (number, optional): Latitude in decimal degrees (e.g., `31.50`).
  - `lng` (number, optional): Longitude in decimal degrees (e.g., `34.46`).
  - `timezone` (string, optional): IANA timezone identifier (e.g., `'Asia/Gaza'`).
- **Response Shape**:
  - `due` (boolean): `true` if a prayer is within its active reminder window.
  - `prayer` (string | null): Name of the prayer due (`'Fajr'`, `'Dhuhr'`, `'Asr'`, `'Maghrib'`, `'Isha'`).
  - `message` (string | null): Localized alert message (e.g., `"It is time for Maghrib prayer."`).
  - `prayerTimeUtc` / `prayerTimeFormatted`: Timestamp of the prayer.
  - `authorityNotice`: Mandatory authority details object.

### 2. `get_today_prayer_times`
Retrieves today's complete prayer schedule: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha.
- **Parameters**: `userId`, `lat`, `lng`, `timezone`.
- **Response Shape**:
  - `date`: Date string (`YYYY-MM-DD`).
  - `timezone`: Active IANA timezone.
  - `method`: Calculation method identifier.
  - `madhab`: Madhab used for Asr calculation (`'shafi'` or `'hanafi'`).
  - `times`: Map of prayers to `{ utc: ISOString, formatted: "HH:MM" }`.
  - `authorityNotice`: Mandatory authority details object.

### 3. `get_next_prayer`
Identifies the upcoming prayer and remaining countdown time in minutes.
- **Parameters**: `userId`, `lat`, `lng`, `timezone`.
- **Response Shape**:
  - `currentPrayer`: Currently ongoing prayer period.
  - `nextPrayer`: Name of the next incoming prayer.
  - `nextPrayerTimeFormatted`: Formatted local time.
  - `minutesRemaining`: Minutes until prayer time.
  - `authorityNotice`: Mandatory authority details object.

### 4. `configure_prayer_preferences`
Persists user prayer settings into Cloudflare KV.
- **Parameters**:
  - `userId` (string, required): Unique identifier for the user.
  - `method` (string, optional): `'UmmAlQura'`, `'Egyptian'`, `'MuslimWorldLeague'`, `'Dubai'`, `'Qatar'`, `'Kuwait'`, `'Turkey'`, `'Karachi'`, `'NorthAmerica'`, `'Singapore'`, `'Tehran'`.
  - `madhab` (string, optional): `'shafi'` or `'hanafi'`.
  - `reminderMode` (string, optional): `'gentle'`, `'standard'`, `'persistent'`.
  - `latitude` / `longitude` / `timezone` (optional): Pin a permanent fixed location.
  - `language` (string, optional): `'en'` or `'ar'`.

### 5. `get_prayer_preferences`
Inspects stored preferences in KV for a given `userId`.

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
> **Authority Selection Reason**: Automatically selected based on detected Palestine coordinates (31.50, 34.46) with official Awqaf solar safety adjustments (+3m Maghrib, -1m Dhuhr).
```

### Example 2: Next Prayer / Status Query
```markdown
🕌 **Next Prayer**: **Maghrib** in **42 minutes** (07:05 PM).

> **Calculation Method**: Palestinian Ministry of Awqaf (Egyptian Survey Authority + Awqaf Offsets)
> **Selection Reason**: Automatically calibrated for Palestine/Gaza location.
```

---

## Error Handling & Fallbacks
- If coordinates are unavailable, the MCP automatically uses client headers (`X-User-Coordinates`, `CF-Connecting-IP`, `request.cf.timezone`), or user preferences.
- If completely unresolved, it safely defaults to Makkah (`21.42, 39.83`, `Asia/Riyadh`, `UmmAlQura`) and notes the fallback in `authorityNotice.selectionReason`.
- Polar/high-latitude locations (>48°) automatically engage nearest-latitude fiqh clamping to prevent invalid twilight calculations.
