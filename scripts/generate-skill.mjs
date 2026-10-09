import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import * as schemas from '../src/mcp/schemas.ts';
import { MAJOR_CITIES, CITY_ALIASES } from '../src/location/resolver.ts';
import { skillZip } from './skill-zip.mjs';

const tools = [
  ['get_prayer_status', schemas.GetPrayerStatusInputSchema, schemas.PrayerStatusOutputSchema],
  ['get_today_prayer_times', schemas.GetTodayPrayerTimesInputSchema, schemas.PrayerScheduleOutputSchema],
  ['get_next_prayer', schemas.GetNextPrayerInputSchema, schemas.NextPrayerOutputSchema],
  ['configure_prayer_preferences', schemas.ConfigurePrayerPreferencesInputSchema, schemas.ConfigurePrayerPreferencesOutputSchema],
  ['get_prayer_preferences', schemas.GetPrayerPreferencesInputSchema, schemas.GetPrayerPreferencesOutputSchema],
];
const clean = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
function typeOf(field) {
  if (field.enum) return field.enum.map(value => '`' + value + '`').join(', ');
  if (field.const !== undefined) return '`' + field.const + '`';
  if (field.anyOf) return field.anyOf.map(typeOf).join(' or ');
  return field.type === 'array' ? 'array of ' + typeOf(field.items || {}) : field.type || 'value';
}
function fields(schema, prefix = '', root = schema, ancestors = new Set()) {
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/') || ancestors.has(schema.$ref)) return [];
    const target = schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root);
    return target ? fields(target, prefix, root, new Set([...ancestors, schema.$ref])) : [];
  }
  const rows = [];
  for (const [name, field] of Object.entries(schema.properties || {})) {
    const key = prefix + name;
    rows.push(`| \`${key}\` | ${clean(typeOf(field))} | ${schema.required?.includes(name) ? 'required' : 'optional'} | ${clean(field.description)} |`);
    const variants = field.anyOf || field.oneOf || [field];
    for (const variant of variants) {
      const nested = variant.type === 'array' ? variant.items : variant;
      if (nested) rows.push(...fields(nested, key + (variant.type === 'array' ? '[].' : '.'), root, ancestors));
    }
  }
  return [...new Set(rows)];
}
let body = `# Muslim Prayer Reminder MCP

Generated from src/mcp/schemas.ts by scripts/generate-skill.mjs. Regenerate with npm run docs:generate; verify with npm run docs:check.

## Location and error handling

Use an explicit supported city, a latitude/longitude pair with an IANA timezone, or a stored complete fixed location. Explicit per-call location overrides stored settings. Supply city or coordinates, never both. Explicit coordinates require timezone in the same request; a stored timezone or a standalone timezone header is never paired with new explicit coordinates. City timezones must match the canonical city zone or its IANA alias. Coordinates are validated using an approximate offline timezone lookup and nearby boundary cells; default authority follows the geographic lookup rather than the supplied display zone. Contradictions return location_timezone_mismatch with expectedTimezone. Only exact latitude +90 or -90 permits an arbitrary explicit civil timezone with polar_choice disclosure. Other polar coordinates follow ordinary coordinate validation. Ocean cells require the canonical matching nautical zone or a civil zone found in the approximate ±0.05-degree boundary neighborhood; matching UTC offsets alone is insufficient. Disclose calculationDetails.timezoneValidation and the approximate lookup limits. Trusted host headers may supply end-user coordinates/timezone or a supported city. Never infer the user location from connector/server IP or Cloudflare network geolocation. A timezone alone cannot locate the user.

If a prayer tool returns isError:true and structuredContent.code is location_required, ask for a supported city or coordinates/timezone. Do not substitute Makkah or guess a location. If code is invalid_calculation, ask the user to correct a nonexistent local date or minute adjustments that reverse prayer windows. For invalid_location or location_timezone_mismatch, correct the conflicting location/timezone; never guess. For invalid_preferences, correct the configuration; failed transactions save nothing. When a fixed location is configured, calculation-setting changes must produce an ordered timetable on the current and next local day before they are saved. Rejected combinations preserve the previous preferences. This check is not a guarantee for every future season or travel destination; query-time chronology validation remains mandatory. Auto-travel settings without a current fixed location are validated when location is supplied to a prayer query.

Public coordinates are rounded before calculation/storage and never echoed. Preferences expose fixedCoordinatesConfigured/fixedCityConfigured indicators. Read-only prayer queries do not return user identifiers.

Always disclose authorityNotice.authorityDescription and authorityNotice.selectionReason. When highLatitudeAdjustment.applied is true, also disclose its explanation: clamped sunrise/sunset are substitutes, not observed local events. calculationDetails explains timezone source, location basis, overrides, regional/custom/method offsets, and calendar alignment. Use the actual returned values; never invent timings or transformations.

MCP endpoint: https://muslim-prayer-mcp.najetareqz.workers.dev/mcp
Local runner: npx -y muslim-prayer-mcp
Supported cities: ${Object.keys(MAJOR_CITIES).join(', ')}. Aliases: ${Object.keys(CITY_ALIASES).join(', ')}.

## Status response layout

get_prayer_status and REST /api/status keep detailed provenance in top-level calculationDetails/highLatitudeAdjustment. authorityNotice contains the mandatory authority/selection/display notice without duplicating those objects. nextPrayerCalculation always names the next event's localDate. When usesCurrentCalculation is true, use the top-level metadata for that event; otherwise use its own distinct metadata. Do not interpret omitted inherited adjustments as no adjustment. Other prayer tools retain their full timetable/next-prayer contracts. MCP responses preserve structuredContent plus a compact JSON text fallback; clients should consume one representation, not concatenate both.

## Tool contracts

Omitted preference fields preserve existing settings. Fixed mode requires a supported fixedCity or fixedCoordinates plus timezone. New coordinates require timezone in the same configuration request. auto_travel does not discover location: the caller supplies its current city or coordinates/timezone on each request; method preferences still follow the user. Switching to auto_travel preserves the saved fixed location for later reuse; clearFixedLocation:true removes the saved city, coordinates and timezone and defaults to auto_travel, preserving other preferences. Clear cannot be combined with a replacement location/timezone or incomplete fixed mode. Fixed city configurations store their canonical city timezone; contradictory supplied timezones are rejected before saving. New preferences inherit geographic/service defaults. exact_window defaults to the saved duration, or the service default of 20 minutes when unset (operators may override it). Omitting the duration does not reset an existing value. Status calls with userId can write expiring deduplication markers; persistent mode bypasses deduplication, and enabled:false suppresses reminders. For identified users, prayer_window and exact_window emit once per prayer/date/mode; changing locale or disabling/re-enabling does not reset the marker. Anonymous calls have no persistent deduplication. expiresAtUtc is the legacy prayer period end; prayerWindowExpiresAtUtc names that same boundary, while reminderWindowExpiresAtUtc is the exact eligibility end capped by the prayer period. Expiry fields appear when a reminder is emitted. KV deduplication and partial preference updates are best effort across regions.
`;
for (const [name, input, output] of tools) {
  body += `\n### ${name}\n\nInput\n\n| Field | Type / allowed values | Presence | Description |\n| --- | --- | --- | --- |\n`;
  body += fields(z.toJSONSchema(input, { unrepresentable: 'any' })).join('\n') + '\n';
  body += '\nOutput\n\n| Field | Type / allowed values | Presence | Description |\n| --- | --- | --- | --- |\n';
  body += fields(z.toJSONSchema(output, { unrepresentable: 'any' })).join('\n') + '\n';
}
body += '\nThe `preferences` configuration result uses the same fields as `get_prayer_preferences`. Nested disclosure objects are defined below once for all prayer tools.\n';
for (const [name, schema] of [
  ['highLatitudeAdjustment', schemas.HighLatitudeAdjustmentSchema],
  ['calculationDetails', schemas.CalculationDetailsSchema],
  ['authorityNotice', schemas.AuthorityNoticeOutputSchema],
]) {
  body += `\n## ${name}\n\n| Field | Type / allowed values | Presence | Description |\n| --- | --- | --- | --- |\n`;
  body += fields(z.toJSONSchema(schema, { unrepresentable: 'any' })).join('\n') + '\n';
}
const check = process.argv.includes('--check');
if (check) {
  // These integration fields must remain discoverable to skill consumers.
  // Checking the generated text catches accidental loss of nested traversal.
  for (const field of [
    'minuteAdjustments.fajr',
    'fixedCoordinates.latitude',
    'timesUtc.fajr',
    'timesLocal.Fajr',
    'nextPrayerCalculation.calculationDetails.timezoneValidation',
  ]) {
    if (!body.includes(`| \`${field}\` |`)) throw new Error(`Skill omits nested contract field: ${field}`);
  }
}
let canonicalContents;
for (const name of ['muslim-prayer-mcp', 'muslim-prayer']) {
  const path = fileURLToPath(new URL(`../skills/${name}/SKILL.md`, import.meta.url));
  const contents = `---\nname: ${name}\ndescription: Query prayer times and status using verified user location; explain calculation authority and applied approximations.\n---\n\n` + body;
  if (name === 'muslim-prayer-mcp') canonicalContents = contents;
  if (check) {
    if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== contents) {
      throw new Error(`Generated skill is stale: ${name}`);
    }
  } else {
    await mkdir(fileURLToPath(new URL(`../skills/${name}/`, import.meta.url)), { recursive: true });
    await writeFile(path, contents, 'utf8');
  }
}
const archivePath = fileURLToPath(new URL('../assets/muslim-prayer-skill.zip', import.meta.url));
const archive = skillZip(canonicalContents);
if (check) {
  if (!(await readFile(archivePath)).equals(archive)) throw new Error('Generated skill ZIP is stale.');
} else {
  await writeFile(archivePath, archive);
}
console.log(check ? 'Generated skill contracts and ZIP match schemas.' : 'Generated both skill contracts and ZIP from schemas.');
