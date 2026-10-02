---
name: muslim-prayer-mcp
description: Query prayer times and status using verified user location; explain calculation authority and applied approximations.
---

# Muslim Prayer Reminder MCP

Generated from src/mcp/schemas.ts by scripts/generate-skill.mjs. Regenerate with npm run docs:generate; verify with npm run docs:check.

## Location and error handling

Use an explicit supported city, a latitude/longitude pair with an IANA timezone, or a stored complete fixed location. Explicit per-call location overrides stored settings. Trusted host headers may supply end-user coordinates/timezone or a supported city. Never infer the user location from connector/server IP or Cloudflare network geolocation. A timezone alone cannot locate the user.

If a prayer tool returns isError:true and structuredContent.code is location_required, ask for a supported city or coordinates/timezone. Do not substitute Makkah or guess a location. If code is invalid_calculation, ask the user to correct minute adjustments that reverse prayer windows.

Public coordinates are rounded before calculation/storage and never echoed. Preferences expose fixedCoordinatesConfigured/fixedCityConfigured indicators. Read-only prayer queries do not return user identifiers.

Always disclose authorityNotice.authorityDescription and authorityNotice.selectionReason. When highLatitudeAdjustment.applied is true, also disclose its explanation: clamped sunrise/sunset are substitutes, not observed local events. calculationDetails explains location basis, overrides, regional/custom/method offsets, and calendar alignment. Use the actual returned values; never invent timings or transformations.

MCP endpoint: https://muslim-prayer-mcp.najetareqz.workers.dev/mcp
Local runner: npx -y muslim-prayer-mcp
Supported cities: makkah, madinah, riyadh, cairo, gaza, jerusalem, alquds, ramallah, hebron, nablus, rafah, khanyunis, dubai, kuwait, doha, amman, istanbul, london, paris, newyork, toronto, jakarta, singapore, karachi, kualalumpur, tehran, sydney, tromso.

## Tool contracts

Omitted preference fields preserve existing settings. New preferences inherit geographic/service defaults. Status calls with userId can write expiring deduplication markers; persistent mode bypasses deduplication, and enabled:false suppresses reminders. KV deduplication is best effort across regions.

### get_prayer_status

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `city` | string | optional | Supported predefined city. Supply city or coordinates with an IANA timezone; connector/IP geolocation is never used. |
| `userId` | string | optional | Optional unique user identifier to load stored preferences. If omitted, pure geographic auto-resolution is applied. |
| `latitude` | number | optional | Optional explicit latitude override |
| `longitude` | number | optional | Optional explicit longitude override |
| `timezone` | string | optional | Optional IANA timezone override (e.g. Asia/Riyadh) |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional | Optional calculation authority override (auto-resolved from location by default) |
| `madhab` | `Shafi`, `Hanafi` | optional | Optional Asr shadow jurisprudence override (Shafi or Hanafi) |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `nextPrayerCalculation` | object | optional | Adjustment disclosure for the actual schedule of the next event, including tomorrow |
| `reminderDue` | boolean | required | Whether a prayer is currently due for reminder |
| `prayer` | string | optional | The name of the currently due prayer if applicable |
| `localDate` | string | required | Current local date in YYYY-MM-DD |
| `startedAtUtc` | string | optional | UTC start time of the active prayer window |
| `expiresAtUtc` | string | optional | UTC expiration time of the active prayer window |
| `nextPrayer` | string | required | The name of the next upcoming prayer |
| `nextPrayerAtUtc` | string | required | UTC timestamp of the next upcoming prayer |
| `timezone` | string | required | Resolved IANA timezone |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | Active calculation authority |
| `madhab` | `Shafi`, `Hanafi` | required | Active Asr jurisprudence |
| `minuteAdjustments` | object | optional | Applied minute adjustments |
| `authorityDescription` | string | optional | Description of the calculation authority |
| `selectionReason` | string | optional | Reason for authority selection |
| `highLatitudeAdjustment` | object | optional |  |
| `calculationDetails` | object | optional |  |
| `authorityNotice` | object | optional | Mandatory theological transparency notice |
| `reminderText` | string | optional | Localized reminder message |

### get_today_prayer_times

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `city` | string | optional | Supported predefined city. Supply city or coordinates with an IANA timezone; connector/IP geolocation is never used. |
| `userId` | string | optional | Optional unique user identifier to load stored preferences. If omitted, pure geographic auto-resolution is applied. |
| `date` | string | optional | Date in YYYY-MM-DD format (defaults to today) |
| `latitude` | number | optional | Optional explicit latitude override |
| `longitude` | number | optional | Optional explicit longitude override |
| `timezone` | string | optional | Optional IANA timezone override |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional | Optional calculation authority override (auto-resolved from location by default) |
| `madhab` | `Shafi`, `Hanafi` | optional | Optional Asr shadow jurisprudence override (Shafi or Hanafi) |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `localDate` | string | required | Local schedule date YYYY-MM-DD |
| `timezone` | string | required | Resolved IANA timezone |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | Active calculation authority |
| `madhab` | `Shafi`, `Hanafi` | required | Active Asr jurisprudence |
| `minuteAdjustments` | object | optional |  |
| `authorityDescription` | string | optional |  |
| `selectionReason` | string | optional |  |
| `highLatitudeAdjustment` | object | optional |  |
| `calculationDetails` | object | optional |  |
| `authorityNotice` | object | optional |  |
| `timesUtc` | object | required |  |
| `timesLocal` | object | required |  |

### get_next_prayer

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `city` | string | optional | Supported predefined city. Supply city or coordinates with an IANA timezone; connector/IP geolocation is never used. |
| `userId` | string | optional | Optional unique user identifier to load stored preferences. If omitted, pure geographic auto-resolution is applied. |
| `latitude` | number | optional | Optional explicit latitude override |
| `longitude` | number | optional | Optional explicit longitude override |
| `timezone` | string | optional | Optional IANA timezone override |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional | Optional calculation authority override (auto-resolved from location by default) |
| `madhab` | `Shafi`, `Hanafi` | optional | Optional Asr shadow jurisprudence override (Shafi or Hanafi) |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `currentLocalDate` | string | required | Current local date YYYY-MM-DD |
| `timezone` | string | required | Resolved IANA timezone |
| `nextPrayer` | string | required | Name of the upcoming prayer |
| `nextPrayerAtUtc` | string | required | UTC timestamp of the upcoming prayer |
| `nextPrayerLocalTime` | string | required | Formatted local time HH:mm |
| `remainingMinutes` | integer | required | Minutes remaining until prayer start |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | Active calculation authority |
| `madhab` | `Shafi`, `Hanafi` | required | Active Asr jurisprudence |
| `authorityDescription` | string | optional |  |
| `selectionReason` | string | optional |  |
| `highLatitudeAdjustment` | object | optional |  |
| `calculationDetails` | object | optional |  |
| `authorityNotice` | object | optional |  |
| `minuteAdjustments` | object | optional |  |

### configure_prayer_preferences

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `userId` | string | required | Unique user identifier |
| `locationMode` | `auto_travel`, `fixed` | optional | Location strategy: auto_travel or fixed |
| `fixedCity` | string | optional | Predefined city name for fixed location (e.g. Riyadh, London) |
| `fixedCoordinates` | object | optional | Fixed geographical coordinates |
| `fixedCoordinates.latitude` | number | required |  |
| `fixedCoordinates.longitude` | number | required |  |
| `timezone` | string | optional | IANA timezone identifier (e.g. Asia/Riyadh, Europe/London) |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional | Islamic prayer calculation authority |
| `madhab` | `Shafi`, `Hanafi` | optional | Jurisprudential Asr shadow calculation: Shafi or Hanafi |
| `highLatitudeRule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | optional | High latitude twilight adjustment rule |
| `reminderMode` | `prayer_window`, `exact_window`, `persistent` | optional | Reminder display policy: prayer_window, exact_window, persistent |
| `exactWindowMinutes` | integer | optional | Duration in minutes for exact_window mode |
| `locale` | `en`, `ar` | optional | Language for reminder text: en or ar |
| `minuteAdjustments` | object | optional | Custom per-prayer minute offsets (-60 to +60) |
| `enabled` | boolean | optional | Whether prayer reminders are enabled |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `success` | boolean | required | Whether configuration succeeded |
| `preferences` | object | required |  |

### get_prayer_preferences

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `userId` | string | required | Unique user identifier |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `fixedCoordinatesConfigured` | boolean | required |  |
| `fixedCityConfigured` | boolean | required |  |
| `locationMode` | `auto_travel`, `fixed` | optional |  |
| `fixedCity` | string | optional |  |
| `timezone` | string | optional |  |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional |  |
| `madhab` | `Shafi`, `Hanafi` | optional |  |
| `highLatitudeRule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | optional |  |
| `reminderMode` | `prayer_window`, `exact_window`, `persistent` | optional |  |
| `exactWindowMinutes` | number | optional |  |
| `locale` | `en`, `ar` | optional |  |
| `minuteAdjustments` | object | optional |  |
| `enabled` | boolean | optional |  |
| `updatedAtUtc` | string | optional |  |
| `message` | string | optional |  |

The `preferences` configuration result uses the same fields as `get_prayer_preferences`. Nested disclosure objects are defined below once for all prayer tools.

## highLatitudeAdjustment

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `applied` | boolean | required |  |
| `rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `astronomicalLatitudeClamped` | boolean | required |  |
| `effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `explanation` | string | required |  |

## calculationDetails

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `locationIsApproximate` | boolean | optional |  |
| `fallbackLocationUsed` | boolean | optional |  |
| `methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `regionalMinuteAdjustments` | object | optional |  |
| `customMinuteAdjustments` | object | optional |  |
| `methodMinuteAdjustments` | object | optional |  |
| `appliedMinuteAdjustments` | object | optional |  |
| `calendarAlignmentAdjusted` | boolean | optional |  |

## authorityNotice

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `method` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | The calculation authority method |
| `madhab` | `Shafi`, `Hanafi` | required | The Asr jurisprudence school |
| `authorityDescription` | string | required | Full descriptive name of the calculation authority |
| `selectionReason` | string | required | Rationale for selecting this authority |
| `requiredDisplayInstruction` | string | required | Mandatory theological notice for AI presentation |
| `highLatitudeAdjustment` | object | optional |  |
| `calculationDetails` | object | optional |  |
