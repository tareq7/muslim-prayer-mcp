---
layout: default
permalink: /privacy-policy/
---

<p align="center">
  <img src="../assets/icon.png" width="96" height="96" alt="Muslim Prayer Reminder MCP Logo" />
</p>

# Privacy Policy

Last updated: 2026-10-01

**Muslim Prayer Reminder** is an open-source MCP server and application designed with a strict **privacy-by-default, zero-tracking, data-minimization** architecture.

This policy clearly details every category of data processed, stored, or returned by this application across all endpoints and tools.

---

## 1. Data Categories & Processing

### A. Input Data Processed Ephemerally
To compute astronomical prayer times and determine whether an obligatory prayer is currently due, the application accepts the following optional parameters:
* **Location & Coordinates**: City name or latitude/longitude coordinates. If coordinates are provided (or inferred from edge network headers), they are immediately rounded to 2 decimal places (`~1.1 km` city-level resolution). High-precision input coordinates are not persisted or logged. An explicitly configured fixed location is stored at this reduced precision.
* **Timezone**: An IANA timezone string (e.g., `Asia/Riyadh`, `America/New_York`) to calculate local wall-clock prayer times.
* **Calculation Preferences**: Optional calculation method (e.g., Umm al-Qura, Egyptian Authority, MWL, ISNA), madhab (Shafi/Hanafi), or time offsets.

*Calculation inputs are processed in-isolate. Explicitly saved preferences and temporary deduplication markers have the retention described below.*

### B. Output Data Returned to Hosts and Models
The tools (`get_prayer_status`, `get_today_prayer_times`, `get_next_prayer`) return strictly prayer calculation results:
* **Prayer Names & Timetables**: Standard Islamic prayer names (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) and corresponding calculated times in ISO-8601 UTC and localized 24-hour time strings.
* **Prayer Status & Countdown**: Active prayer status boolean, time elapsed or remaining in minutes, and human-readable reminder strings in Arabic or English.
* **Theological Metadata**: Official calculation authority name (e.g., "Umm al-Qura University, Makkah") and theological selection justification explaining why that calculation standard applies to the region.

### C. Zero Debug Telemetry & No Sensitive Echoing
* **No Coordinate Leakage**: Geographic coordinates (latitude, longitude) and IP addresses are **never echoed or returned** in tool output payloads.
* **No Internal Debug Metadata**: Tool responses contain **no internal tracking keys, deduplication hashes (`dedupeKey`), or internal system diagnostic tags (`locationSource`)**.
* **No User Identifiers in Read Queries**: Prayer lookups can operate anonymously without requiring or returning user IDs. Preference tools also exclude identifiers and fixed coordinates from their output.

---

## 2. Persistent Storage & Retention

* **Read-Only Inquiries**: Timetable and next-prayer queries write no data. An identified `get_prayer_status` call can write a temporary deduplication marker. Anonymous status calls write no markers.
* **Explicit User Preferences**: When a user explicitly invokes the `configure_prayer_preferences` tool, the supplied user identifier, calculation and reminder settings, and any explicit fixed city, rounded coordinates, and timezone are stored in Cloudflare KV under that identifier until changed or deleted. REST preference updates store the same categories. Local stdio preferences remain in memory for the process lifetime.
* **Deduplication Flags**: Temporary deduplication markers expire at the end of their prayer window, with a maximum TTL of 24 hours. In-memory expired entries are reclaimed on access and during later writes. KV deduplication is best effort across regions; it is not an atomic global delivery guarantee.

---

## 3. Third-Party Sharing & Network Isolation

* **Local In-Isolate Computation**: All solar angles, shadows, and astronomical coordinates are computed locally inside the Cloudflare Worker isolate using deterministic astronomical algorithms (`adhan` library).
* **No External API Calls**: The server does not contact external third-party prayer APIs, ad networks, telemetry collectors, or analytics vendors.
* **Zero Monetization**: We do not sell, license, share, or monetize user data under any circumstances.

---

## 4. Host Environments & Platform Scope

When used within host platforms (such as ChatGPT, OpenAI Apps, Claude Desktop, Cursor, or Windsurf), the transmission of prompts and responses between your host client and the model is governed by the respective platform's privacy policy.

---

## 5. User Rights & Data Deletion

Users retain full control over their preferences:
* **Inspection**: You can inspect active saved calculation settings at any time using `get_prayer_preferences`.
* **Deletion**: You can update preferences with `configure_prayer_preferences`. To delete them, use `DELETE /api/preferences?userId=...` or `POST /api/preferences` with `{ "userId": "...", "reset": true }` through your authorized host. Supplying default values updates settings and does not delete the record.

---

## 6. Publisher, Ownership & Open Source Verification

* **Publisher & Entity**: [**Smart Creations**](https://github.com/Smart-Creations) (OpenAI Organization ID: `org-deULP4GGInsTcWmuaHWp3lxy`)
* **Lead Maintainer & Author**: Tareq Naji ([@tareq7](https://github.com/tareq7))
* **Official Repository**: [https://github.com/tareq7/muslim-prayer-mcp](https://github.com/tareq7/muslim-prayer-mcp)
* **Documentation**: [https://tareq7.github.io/muslim-prayer-mcp](https://tareq7.github.io/muslim-prayer-mcp)
* **Contact & Support**: [GitHub Issues](https://github.com/tareq7/muslim-prayer-mcp/issues)


