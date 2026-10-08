---
name: muslim-prayer
description: Query prayer times and status using verified user location; explain calculation authority and applied approximations.
---

# Muslim Prayer Reminder MCP

Generated from src/mcp/schemas.ts by scripts/generate-skill.mjs. Regenerate with npm run docs:generate; verify with npm run docs:check.

## Location and error handling

Use an explicit supported city, a latitude/longitude pair with an IANA timezone, or a stored complete fixed location. Explicit per-call location overrides stored settings. Supply city or coordinates, never both. Explicit coordinates require timezone in the same request; a stored timezone or a standalone timezone header is never paired with new explicit coordinates. City timezones must match the canonical city zone or its IANA alias. Coordinates are validated using an approximate offline timezone lookup and nearby boundary cells; default authority follows the geographic lookup rather than the supplied display zone. Contradictions return location_timezone_mismatch with expectedTimezone. Exact poles have no unique civil timezone and retain explicit choices; ocean cells require a matching nautical zone or nearby civil zone. Disclose calculationDetails.timezoneValidation and the approximate lookup limits. Trusted host headers may supply end-user coordinates/timezone or a supported city. Never infer the user location from connector/server IP or Cloudflare network geolocation. A timezone alone cannot locate the user.

If a prayer tool returns isError:true and structuredContent.code is location_required, ask for a supported city or coordinates/timezone. Do not substitute Makkah or guess a location. If code is invalid_calculation, ask the user to correct a nonexistent local date or minute adjustments that reverse prayer windows. For invalid_location or location_timezone_mismatch, correct the conflicting location/timezone; never guess. For invalid_preferences, correct the configuration; failed transactions save nothing.

Public coordinates are rounded before calculation/storage and never echoed. Preferences expose fixedCoordinatesConfigured/fixedCityConfigured indicators. Read-only prayer queries do not return user identifiers.

Always disclose authorityNotice.authorityDescription and authorityNotice.selectionReason. When highLatitudeAdjustment.applied is true, also disclose its explanation: clamped sunrise/sunset are substitutes, not observed local events. calculationDetails explains timezone source, location basis, overrides, regional/custom/method offsets, and calendar alignment. Use the actual returned values; never invent timings or transformations.

MCP endpoint: https://muslim-prayer-mcp.najetareqz.workers.dev/mcp
Local runner: npx -y muslim-prayer-mcp
Supported cities: makkah, madinah, riyadh, cairo, gaza, jerusalem, alquds, ramallah, hebron, nablus, rafah, khanyunis, dubai, abudhabi, kuwait, doha, amman, istanbul, london, paris, newyork, toronto, jakarta, singapore, karachi, kualalumpur, tehran, sydney, tromso. Aliases: gazacity, nyc, kuwaitcity.

## Status response layout

get_prayer_status and REST /api/status keep detailed provenance in top-level calculationDetails/highLatitudeAdjustment. authorityNotice contains the mandatory authority/selection/display notice without duplicating those objects. nextPrayerCalculation always names the next event's localDate. When usesCurrentCalculation is true, use the top-level metadata for that event; otherwise use its own distinct metadata. Do not interpret omitted inherited adjustments as no adjustment. Other prayer tools retain their full timetable/next-prayer contracts. MCP responses preserve structuredContent plus a compact JSON text fallback; clients should consume one representation, not concatenate both.

## Tool contracts

Omitted preference fields preserve existing settings. Fixed mode requires a supported fixedCity or fixedCoordinates plus timezone. New coordinates require timezone in the same configuration request. auto_travel does not discover location: the caller supplies its current city or coordinates/timezone on each request; method preferences still follow the user. Switching to auto_travel preserves the saved fixed location for later reuse; clearFixedLocation:true removes the saved city, coordinates and timezone and defaults to auto_travel, preserving other preferences. Clear cannot be combined with a replacement location/timezone or incomplete fixed mode. Fixed city configurations store their canonical city timezone; contradictory supplied timezones are rejected before saving. New preferences inherit geographic/service defaults. exact_window defaults to the saved duration, or the service default of 20 minutes when unset (operators may override it). Omitting the duration does not reset an existing value. Status calls with userId can write expiring deduplication markers; persistent mode bypasses deduplication, and enabled:false suppresses reminders. For identified users, prayer_window and exact_window emit once per prayer/date/mode; changing locale or disabling/re-enabling does not reset the marker. Anonymous calls have no persistent deduplication. expiresAtUtc is the legacy prayer period end; prayerWindowExpiresAtUtc names that same boundary, while reminderWindowExpiresAtUtc is the exact eligibility end capped by the prayer period. Expiry fields appear when a reminder is emitted. KV deduplication and partial preference updates are best effort across regions.

### get_prayer_status

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `city` | string | optional | Supported cities: makkah, madinah, riyadh, cairo, gaza, jerusalem, alquds, ramallah, hebron, nablus, rafah, khanyunis, dubai, abudhabi, kuwait, doha, amman, istanbul, london, paris, newyork, toronto, jakarta, singapore, karachi, kualalumpur, tehran, sydney, tromso. Aliases: gazacity, nyc, kuwaitcity. Case, spaces and punctuation are ignored. |
| `userId` | string | optional | Nonblank user identifier; at most 256 UTF-8 bytes and 256 characters. Whitespace in nonblank identifiers is preserved. |
| `latitude` | number | optional | Optional explicit latitude override |
| `longitude` | number | optional | Optional explicit longitude override |
| `timezone` | string | optional | IANA timezone; required in the same request when latitude/longitude are supplied. Must agree with the city or be compatible with the coordinate timezone lookup. |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional | Optional calculation authority override (auto-resolved from location by default) |
| `madhab` | `Shafi`, `Hanafi` | optional | Optional Asr shadow jurisprudence override (Shafi or Hanafi) |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `nextPrayerCalculation` | object | optional | Adjustment disclosure for the actual schedule of the next event, including tomorrow |
| `nextPrayerCalculation.localDate` | string | required |  |
| `nextPrayerCalculation.usesCurrentCalculation` | boolean | required | If true, this next event uses the top-level calculationDetails, highLatitudeAdjustment and authorityNotice; duplicate fields are omitted. Otherwise its own distinct metadata is included. |
| `nextPrayerCalculation.highLatitudeAdjustment` | object | optional |  |
| `nextPrayerCalculation.highLatitudeAdjustment.applied` | boolean | required |  |
| `nextPrayerCalculation.highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `nextPrayerCalculation.highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `nextPrayerCalculation.highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `nextPrayerCalculation.highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `nextPrayerCalculation.highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `nextPrayerCalculation.highLatitudeAdjustment.explanation` | string | required |  |
| `nextPrayerCalculation.calculationDetails` | object | optional |  |
| `nextPrayerCalculation.calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `nextPrayerCalculation.calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `nextPrayerCalculation.calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `nextPrayerCalculation.calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `nextPrayerCalculation.calculationDetails.locationIsApproximate` | boolean | optional |  |
| `nextPrayerCalculation.calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `nextPrayerCalculation.calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `nextPrayerCalculation.calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `nextPrayerCalculation.calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments` | object | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `nextPrayerCalculation.calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `nextPrayerCalculation.calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
| `nextPrayerCalculation.authorityNotice` | object | optional |  |
| `nextPrayerCalculation.authorityNotice.method` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | The calculation authority method |
| `nextPrayerCalculation.authorityNotice.madhab` | `Shafi`, `Hanafi` | required | The Asr jurisprudence school |
| `nextPrayerCalculation.authorityNotice.authorityDescription` | string | required | Full descriptive name of the calculation authority |
| `nextPrayerCalculation.authorityNotice.selectionReason` | string | required | Rationale for selecting this authority |
| `nextPrayerCalculation.authorityNotice.requiredDisplayInstruction` | string | required | Mandatory theological notice for AI presentation |
| `reminderDue` | boolean | required | Whether a prayer is currently due for reminder |
| `prayer` | string | optional | The name of the currently due prayer if applicable |
| `localDate` | string | required | Current local date in YYYY-MM-DD |
| `startedAtUtc` | string | optional | UTC start time of the active prayer window |
| `expiresAtUtc` | string | optional | UTC expiration time of the active prayer window |
| `prayerWindowExpiresAtUtc` | string | optional | End of the active prayer period; same boundary as legacy expiresAtUtc |
| `reminderWindowExpiresAtUtc` | string | optional | Reminder eligibility end; exact_window is capped by the prayer period boundary. Fields appear when a reminder is emitted. |
| `nextPrayer` | string | required | The name of the next upcoming prayer |
| `nextPrayerAtUtc` | string | required | UTC timestamp of the next upcoming prayer |
| `timezone` | string | required | Resolved IANA timezone |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | Active calculation authority |
| `madhab` | `Shafi`, `Hanafi` | required | Active Asr jurisprudence |
| `minuteAdjustments` | object | optional | Applied minute adjustments |
| `minuteAdjustments.fajr` | integer | optional |  |
| `minuteAdjustments.sunrise` | integer | optional |  |
| `minuteAdjustments.dhuhr` | integer | optional |  |
| `minuteAdjustments.asr` | integer | optional |  |
| `minuteAdjustments.maghrib` | integer | optional |  |
| `minuteAdjustments.isha` | integer | optional |  |
| `authorityDescription` | string | optional | Description of the calculation authority |
| `selectionReason` | string | optional | Reason for authority selection |
| `highLatitudeAdjustment` | object | optional |  |
| `highLatitudeAdjustment.applied` | boolean | required |  |
| `highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `highLatitudeAdjustment.explanation` | string | required |  |
| `calculationDetails` | object | optional |  |
| `calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `calculationDetails.locationIsApproximate` | boolean | optional |  |
| `calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments` | object | optional |  |
| `calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
| `authorityNotice` | object | required | Mandatory theological transparency notice; detailed provenance is at top level |
| `authorityNotice.method` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | The calculation authority method |
| `authorityNotice.madhab` | `Shafi`, `Hanafi` | required | The Asr jurisprudence school |
| `authorityNotice.authorityDescription` | string | required | Full descriptive name of the calculation authority |
| `authorityNotice.selectionReason` | string | required | Rationale for selecting this authority |
| `authorityNotice.requiredDisplayInstruction` | string | required | Mandatory theological notice for AI presentation |
| `reminderText` | string | optional | Localized reminder message |

### get_today_prayer_times

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `city` | string | optional | Supported cities: makkah, madinah, riyadh, cairo, gaza, jerusalem, alquds, ramallah, hebron, nablus, rafah, khanyunis, dubai, abudhabi, kuwait, doha, amman, istanbul, london, paris, newyork, toronto, jakarta, singapore, karachi, kualalumpur, tehran, sydney, tromso. Aliases: gazacity, nyc, kuwaitcity. Case, spaces and punctuation are ignored. |
| `userId` | string | optional | Nonblank user identifier; at most 256 UTF-8 bytes and 256 characters. Whitespace in nonblank identifiers is preserved. |
| `date` | string | optional | Date in YYYY-MM-DD format (defaults to today) |
| `latitude` | number | optional | Optional explicit latitude override |
| `longitude` | number | optional | Optional explicit longitude override |
| `timezone` | string | optional | IANA timezone; required in the same request when latitude/longitude are supplied. Must agree with the city or be compatible with the coordinate timezone lookup. |
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
| `minuteAdjustments.fajr` | integer | optional |  |
| `minuteAdjustments.sunrise` | integer | optional |  |
| `minuteAdjustments.dhuhr` | integer | optional |  |
| `minuteAdjustments.asr` | integer | optional |  |
| `minuteAdjustments.maghrib` | integer | optional |  |
| `minuteAdjustments.isha` | integer | optional |  |
| `authorityDescription` | string | optional |  |
| `selectionReason` | string | optional |  |
| `highLatitudeAdjustment` | object | optional |  |
| `highLatitudeAdjustment.applied` | boolean | required |  |
| `highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `highLatitudeAdjustment.explanation` | string | required |  |
| `calculationDetails` | object | optional |  |
| `calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `calculationDetails.locationIsApproximate` | boolean | optional |  |
| `calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments` | object | optional |  |
| `calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
| `authorityNotice` | object | optional |  |
| `authorityNotice.method` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | The calculation authority method |
| `authorityNotice.madhab` | `Shafi`, `Hanafi` | required | The Asr jurisprudence school |
| `authorityNotice.authorityDescription` | string | required | Full descriptive name of the calculation authority |
| `authorityNotice.selectionReason` | string | required | Rationale for selecting this authority |
| `authorityNotice.requiredDisplayInstruction` | string | required | Mandatory theological notice for AI presentation |
| `authorityNotice.highLatitudeAdjustment` | object | optional |  |
| `authorityNotice.highLatitudeAdjustment.applied` | boolean | required |  |
| `authorityNotice.highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `authorityNotice.highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `authorityNotice.highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `authorityNotice.highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `authorityNotice.highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `authorityNotice.highLatitudeAdjustment.explanation` | string | required |  |
| `authorityNotice.calculationDetails` | object | optional |  |
| `authorityNotice.calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `authorityNotice.calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `authorityNotice.calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `authorityNotice.calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `authorityNotice.calculationDetails.locationIsApproximate` | boolean | optional |  |
| `authorityNotice.calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `authorityNotice.calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `authorityNotice.calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `authorityNotice.calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `authorityNotice.calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
| `timesUtc` | object | required |  |
| `timesUtc.fajr` | string | required | Fajr UTC timestamp |
| `timesUtc.sunrise` | string | required | Sunrise UTC timestamp |
| `timesUtc.dhuhr` | string | required | Dhuhr UTC timestamp |
| `timesUtc.asr` | string | required | Asr UTC timestamp |
| `timesUtc.maghrib` | string | required | Maghrib UTC timestamp |
| `timesUtc.isha` | string | required | Isha UTC timestamp |
| `timesLocal` | object | required |  |
| `timesLocal.Fajr` | string | required | Fajr local 24h time HH:mm |
| `timesLocal.Sunrise` | string | required | Sunrise local 24h time HH:mm |
| `timesLocal.Dhuhr` | string | required | Dhuhr local 24h time HH:mm |
| `timesLocal.Asr` | string | required | Asr local 24h time HH:mm |
| `timesLocal.Maghrib` | string | required | Maghrib local 24h time HH:mm |
| `timesLocal.Isha` | string | required | Isha local 24h time HH:mm |

### get_next_prayer

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `city` | string | optional | Supported cities: makkah, madinah, riyadh, cairo, gaza, jerusalem, alquds, ramallah, hebron, nablus, rafah, khanyunis, dubai, abudhabi, kuwait, doha, amman, istanbul, london, paris, newyork, toronto, jakarta, singapore, karachi, kualalumpur, tehran, sydney, tromso. Aliases: gazacity, nyc, kuwaitcity. Case, spaces and punctuation are ignored. |
| `userId` | string | optional | Nonblank user identifier; at most 256 UTF-8 bytes and 256 characters. Whitespace in nonblank identifiers is preserved. |
| `latitude` | number | optional | Optional explicit latitude override |
| `longitude` | number | optional | Optional explicit longitude override |
| `timezone` | string | optional | IANA timezone; required in the same request when latitude/longitude are supplied. Must agree with the city or be compatible with the coordinate timezone lookup. |
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
| `highLatitudeAdjustment.applied` | boolean | required |  |
| `highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `highLatitudeAdjustment.explanation` | string | required |  |
| `calculationDetails` | object | optional |  |
| `calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `calculationDetails.locationIsApproximate` | boolean | optional |  |
| `calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments` | object | optional |  |
| `calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
| `authorityNotice` | object | optional |  |
| `authorityNotice.method` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | required | The calculation authority method |
| `authorityNotice.madhab` | `Shafi`, `Hanafi` | required | The Asr jurisprudence school |
| `authorityNotice.authorityDescription` | string | required | Full descriptive name of the calculation authority |
| `authorityNotice.selectionReason` | string | required | Rationale for selecting this authority |
| `authorityNotice.requiredDisplayInstruction` | string | required | Mandatory theological notice for AI presentation |
| `authorityNotice.highLatitudeAdjustment` | object | optional |  |
| `authorityNotice.highLatitudeAdjustment.applied` | boolean | required |  |
| `authorityNotice.highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `authorityNotice.highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `authorityNotice.highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `authorityNotice.highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `authorityNotice.highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `authorityNotice.highLatitudeAdjustment.explanation` | string | required |  |
| `authorityNotice.calculationDetails` | object | optional |  |
| `authorityNotice.calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `authorityNotice.calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `authorityNotice.calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `authorityNotice.calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `authorityNotice.calculationDetails.locationIsApproximate` | boolean | optional |  |
| `authorityNotice.calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `authorityNotice.calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `authorityNotice.calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `authorityNotice.calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `authorityNotice.calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `authorityNotice.calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `authorityNotice.calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `authorityNotice.calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `authorityNotice.calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
| `minuteAdjustments` | object | optional |  |
| `minuteAdjustments.fajr` | integer | optional |  |
| `minuteAdjustments.sunrise` | integer | optional |  |
| `minuteAdjustments.dhuhr` | integer | optional |  |
| `minuteAdjustments.asr` | integer | optional |  |
| `minuteAdjustments.maghrib` | integer | optional |  |
| `minuteAdjustments.isha` | integer | optional |  |

### configure_prayer_preferences

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `clearFixedLocation` | boolean | optional | Remove stored fixedCity, fixedCoordinates and timezone. Switches to auto_travel unless locationMode is supplied. Cannot combine with a new fixed location/timezone. |
| `userId` | string | required | Nonblank user identifier; at most 256 UTF-8 bytes and 256 characters. Whitespace in nonblank identifiers is preserved. |
| `locationMode` | `auto_travel`, `fixed` | optional | Location strategy: fixed uses saved location; auto_travel requires the caller to supply current city or coordinates/timezone on each query and never uses IP geolocation. |
| `fixedCity` | string | optional | Supported cities: makkah, madinah, riyadh, cairo, gaza, jerusalem, alquds, ramallah, hebron, nablus, rafah, khanyunis, dubai, abudhabi, kuwait, doha, amman, istanbul, london, paris, newyork, toronto, jakarta, singapore, karachi, kualalumpur, tehran, sydney, tromso. Aliases: gazacity, nyc, kuwaitcity. Case, spaces and punctuation are ignored. |
| `fixedCoordinates` | object | optional | Fixed geographical coordinates |
| `fixedCoordinates.latitude` | number | required |  |
| `fixedCoordinates.longitude` | number | required |  |
| `timezone` | string | optional | IANA timezone identifier (e.g. Asia/Riyadh, Europe/London) |
| `calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional | Islamic prayer calculation authority |
| `madhab` | `Shafi`, `Hanafi` | optional | Jurisprudential Asr shadow calculation: Shafi or Hanafi |
| `highLatitudeRule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | optional | High latitude twilight adjustment rule |
| `reminderMode` | `prayer_window`, `exact_window`, `persistent` | optional | Reminder display policy: prayer_window, exact_window, persistent |
| `exactWindowMinutes` | integer | optional | Duration in minutes for exact_window mode. Omitted updates preserve the saved value; if unset, the service default is 20 minutes unless the operator overrides it. |
| `locale` | `en`, `ar` | optional | Language for reminder text: en or ar |
| `minuteAdjustments` | object | optional | Custom per-prayer minute offsets (-60 to +60) |
| `minuteAdjustments.fajr` | integer | optional |  |
| `minuteAdjustments.sunrise` | integer | optional |  |
| `minuteAdjustments.dhuhr` | integer | optional |  |
| `minuteAdjustments.asr` | integer | optional |  |
| `minuteAdjustments.maghrib` | integer | optional |  |
| `minuteAdjustments.isha` | integer | optional |  |
| `enabled` | boolean | optional | Whether prayer reminders are enabled |

Output

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `success` | boolean | required | Whether configuration succeeded |
| `preferences` | object | required |  |
| `preferences.fixedCoordinatesConfigured` | boolean | required |  |
| `preferences.fixedCityConfigured` | boolean | required |  |
| `preferences.locationMode` | `auto_travel`, `fixed` | optional |  |
| `preferences.fixedCity` | string | optional |  |
| `preferences.timezone` | string | optional |  |
| `preferences.calculationMethod` | `UmmAlQura`, `MuslimWorldLeague`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `MoonsightingCommittee`, `Singapore`, `Turkey`, `Tehran` | optional |  |
| `preferences.madhab` | `Shafi`, `Hanafi` | optional |  |
| `preferences.highLatitudeRule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | optional |  |
| `preferences.reminderMode` | `prayer_window`, `exact_window`, `persistent` | optional |  |
| `preferences.exactWindowMinutes` | number | optional |  |
| `preferences.locale` | `en`, `ar` | optional |  |
| `preferences.minuteAdjustments` | object | optional |  |
| `preferences.minuteAdjustments.fajr` | integer | optional |  |
| `preferences.minuteAdjustments.sunrise` | integer | optional |  |
| `preferences.minuteAdjustments.dhuhr` | integer | optional |  |
| `preferences.minuteAdjustments.asr` | integer | optional |  |
| `preferences.minuteAdjustments.maghrib` | integer | optional |  |
| `preferences.minuteAdjustments.isha` | integer | optional |  |
| `preferences.enabled` | boolean | optional |  |
| `preferences.updatedAtUtc` | string | optional |  |
| `preferences.message` | string | optional |  |

### get_prayer_preferences

Input

| Field | Type / allowed values | Presence | Description |
| --- | --- | --- | --- |
| `userId` | string | required | Nonblank user identifier; at most 256 UTF-8 bytes and 256 characters. Whitespace in nonblank identifiers is preserved. |

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
| `minuteAdjustments.fajr` | integer | optional |  |
| `minuteAdjustments.sunrise` | integer | optional |  |
| `minuteAdjustments.dhuhr` | integer | optional |  |
| `minuteAdjustments.asr` | integer | optional |  |
| `minuteAdjustments.maghrib` | integer | optional |  |
| `minuteAdjustments.isha` | integer | optional |  |
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
| `expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `locationIsApproximate` | boolean | optional |  |
| `fallbackLocationUsed` | boolean | optional |  |
| `methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `regionalMinuteAdjustments` | object | optional |  |
| `regionalMinuteAdjustments.fajr` | integer | optional |  |
| `regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `regionalMinuteAdjustments.asr` | integer | optional |  |
| `regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `regionalMinuteAdjustments.isha` | integer | optional |  |
| `customMinuteAdjustments` | object | optional |  |
| `customMinuteAdjustments.fajr` | integer | optional |  |
| `customMinuteAdjustments.sunrise` | integer | optional |  |
| `customMinuteAdjustments.dhuhr` | integer | optional |  |
| `customMinuteAdjustments.asr` | integer | optional |  |
| `customMinuteAdjustments.maghrib` | integer | optional |  |
| `customMinuteAdjustments.isha` | integer | optional |  |
| `methodMinuteAdjustments` | object | optional |  |
| `methodMinuteAdjustments.fajr` | integer | optional |  |
| `methodMinuteAdjustments.sunrise` | integer | optional |  |
| `methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `methodMinuteAdjustments.asr` | integer | optional |  |
| `methodMinuteAdjustments.maghrib` | integer | optional |  |
| `methodMinuteAdjustments.isha` | integer | optional |  |
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
| `highLatitudeAdjustment.applied` | boolean | required |  |
| `highLatitudeAdjustment.rule` | `MiddleOfTheNight`, `SeventhOfTheNight`, `TwilightAngle` | required |  |
| `highLatitudeAdjustment.methodSpecificTwilightRule` | `MoonsightingCommittee` | optional |  |
| `highLatitudeAdjustment.astronomicalLatitudeClamped` | boolean | required |  |
| `highLatitudeAdjustment.effectiveLatitude` | `48` or `-48` | optional | Substitute latitude only; never the user coordinate |
| `highLatitudeAdjustment.adjustedPrayers` | array of `Fajr`, `Sunrise`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` | required |  |
| `highLatitudeAdjustment.explanation` | string | required |  |
| `calculationDetails` | object | optional |  |
| `calculationDetails.expectedTimezone` | string | optional | Timezone from city registry or approximate coordinate lookup |
| `calculationDetails.timezoneValidation` | `coordinate_lookup`, `nearby_boundary`, `city_registry`, `polar_choice`, `ocean_choice` | optional | Validation basis; ocean locations require the matching nautical timezone or an adjacent coastal civil timezone; mathematical poles allow an explicit civil timezone with disclosure |
| `calculationDetails.timezoneSource` | `explicit_override`, `stored_preference`, `city_default`, `host_header` | optional | Source of the validated timezone or disclosed ocean/pole choice |
| `calculationDetails.locationBasis` | `explicit_coordinates`, `explicit_city`, `stored_fixed_coordinates`, `stored_fixed_city`, `host_coordinates`, `host_city`, `network_geolocation`, `default_location` | optional |  |
| `calculationDetails.locationIsApproximate` | boolean | optional |  |
| `calculationDetails.fallbackLocationUsed` | boolean | optional |  |
| `calculationDetails.methodSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.madhabSource` | `explicit_override`, `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.highLatitudeRuleSource` | `stored_preference`, `geographic_default` | optional |  |
| `calculationDetails.regionalMinuteAdjustments` | object | optional |  |
| `calculationDetails.regionalMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.regionalMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments` | object | optional |  |
| `calculationDetails.customMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.customMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments` | object | optional |  |
| `calculationDetails.methodMinuteAdjustments.fajr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.sunrise` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.dhuhr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.asr` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.maghrib` | integer | optional |  |
| `calculationDetails.methodMinuteAdjustments.isha` | integer | optional |  |
| `calculationDetails.appliedMinuteAdjustments` | object | optional |  |
| `calculationDetails.calendarAlignmentAdjusted` | boolean | optional |  |
