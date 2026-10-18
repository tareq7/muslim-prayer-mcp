import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PRAYER_CALCULATION_GUIDE = [
  '# Muslim Prayer Reminder — calculation and safety guide',
  '',
  'Prayer times are calculated from solar position and user-selected or geographically selected calculation rules.',
  'The calculation authority and selection reason must be disclosed with each timetable or countdown.',
  'The Asr juristic convention (Shafi/standard or Hanafi) can affect the Asr time.',
  'Fajr and Isha twilight conventions, minute adjustments, timezone and daylight-saving rules can alter results.',
  'High-latitude twilight substitutes are approximations and must be identified when applied.',
  'A location must be provided explicitly as a supported city or as coordinates plus an IANA timezone, or be available as a previously configured fixed location.',
  'Do not guess user location from IP addresses or infer it from the model host.',
  'Compare results with your local mosque or official timetable; this service does not claim religious authority over local practices.',
  '',
  'Useful tools: get_today_prayer_times, get_next_prayer, get_prayer_status, get_prayer_preferences, configure_prayer_preferences.'
].join('\n');

export function registerPrayerContextFeatures(server: McpServer) {
  server.registerPrompt(
    'check_prayer_times_with_disclosure',
    {
      title: 'Check prayer times with calculation disclosure',
      description: 'Get today\'s prayer times for an explicitly supplied city or location, including regional calculation provenance and potential mosque differences.',
    },
    () => ({
      description: 'Prayer-time workflow with mandatory calculation disclosure.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Ask me for a supported city or explicit coordinates and timezone unless I have already supplied a valid location.',
              'Use get_today_prayer_times to obtain the actual times; never invent or estimate them.',
              'Present the local Fajr, sunrise, Dhuhr, Asr, Maghrib, and Isha times.',
              'Disclose the returned calculation authority and why it was selected.',
              'Explain any returned high-latitude adjustment and any material time offsets.',
              'Explain that times can differ from local mosque timetables.',
              'If the tool returns location_required, ask for location instead of guessing.'
            ].join(' ')
          }
        }
      ]
    })
  );

  server.registerResource(
    'prayer-calculation-guide',
    'prayer://calculation-guide',
    {
      title: 'Prayer calculation and interpretation guide',
      description: 'Reference for location selection, Asr convention, twilight calculation, high-latitude limitations, and local mosque differences.',
      mimeType: 'text/markdown'
    },
    async (uri) => ({
      contents: [
        { uri: uri.toString(), mimeType: 'text/markdown', text: PRAYER_CALCULATION_GUIDE }
      ]
    })
  );
}
