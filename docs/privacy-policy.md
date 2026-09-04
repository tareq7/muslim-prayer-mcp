---
layout: default
permalink: /privacy-policy/
---

# Privacy Policy

Last updated: 2026-09-04

**Muslim Prayer Reminder MCP** is an open-source tool and server designed with a strict **privacy-by-default, zero-tracking** architecture.

## 1. Data Minimization & Geolocation

To calculate astronomical prayer schedules, geographical coordinates are required. Our system handles location data under strict data minimization guidelines:

* **Fuzzy Coordinate Truncation**: When coordinates are passed (either explicitly or inferred via Cloudflare edge geolocation headers), they are immediately rounded to two decimal places (`~1.1 km` city-level resolution). High-precision GPS coordinates are never stored.
* **No Coordinate Leakage**: Tool responses return only prayer names, timetables, and notification text. Geographic coordinates and IP addresses are never echoed into the LLM conversational context.
* **Ephemeral Processing**: Calculations run within an isolated Cloudflare V8 worker. No coordinates or queries are forwarded across WAN to third-party ad networks or tracking services.

## 2. Storage & Persistence

* **Default Mode**: If you query prayer times without saving preferences, no data is written to persistent storage.
* **User Preferences**: If you explicitly invoke the `configure_prayer_preferences` tool, only your chosen calculation parameters (such as `calculationMethod`, `madhab`, `locale`, or custom minutes offset) are saved under your assigned `userId` in Cloudflare Key-Value (KV) storage.
* **Deduplication Sentinels**: Time-window deduplication flags automatically expire from KV storage within 24 hours.

## 3. Third-Party Sharing & Tracking

* **No Analytics or Trackers**: We do not embed tracking pixels, telemetry probes, Google Analytics, or third-party marketing SDKs.
* **No Commercial Data Sales**: We do not sell, license, or monetize any user data.

## 4. Host Environments & Client Boundaries

When invoking this tool through host applications (such as Claude Desktop, ChatGPT, Cursor, Windsurf, or VS Code), your interaction is subject to the respective host application's privacy policy and data governance terms.

## 5. Contact & Data Deletion Requests

If you have configured persistent preferences via Cloudflare KV and wish to inspect or delete your stored records, please submit a request via [GitHub Issues](https://github.com/tareq7/muslim-prayer-mcp/issues) or reset your preferences by invoking the configuration tool with empty defaults.
