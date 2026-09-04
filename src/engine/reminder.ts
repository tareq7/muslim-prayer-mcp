import type {
  AuthorityNotice,
  CalculationMethodName,
  HighLatitudeRuleName,
  Locale,
  MadhabName,
  MinuteAdjustments,
  ObligatoryPrayerName,
  PrayerName,
  PrayerSchedule,
  PrayerStatusResult,
  ReminderMode,
  ResolvedLocation,
} from './types.ts';
import { calculateDailySchedule, getLocalDateString } from './calculator.ts';

const ARABIC_PRAYER_NAMES: Record<ObligatoryPrayerName, string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

export function formatReminderText(prayer: ObligatoryPrayerName, locale: Locale): string {
  if (locale === 'ar') {
    return `🕌 حان وقت صلاة ${ARABIC_PRAYER_NAMES[prayer]}.`;
  }
  return `🕌 It is time for ${prayer} prayer.`;
}

export interface EvaluateStatusOptions {
  now: Date;
  location: ResolvedLocation;
  method?: CalculationMethodName;
  madhab?: MadhabName;
  highLatitudeRule?: HighLatitudeRuleName;
  minuteAdjustments?: MinuteAdjustments;
  authorityDescription?: string;
  selectionReason?: string;
  authorityNotice?: AuthorityNotice;
  reminderMode?: ReminderMode;
  exactWindowMinutes?: number;
  locale?: Locale;
  userId?: string;
  isAlreadySent?: (dedupeKey: string) => Promise<boolean> | boolean;
}

export async function evaluatePrayerStatus(options: EvaluateStatusOptions): Promise<PrayerStatusResult> {
  const {
    now,
    location,
    method = 'UmmAlQura',
    madhab = 'Shafi',
    highLatitudeRule = 'MiddleOfTheNight',
    minuteAdjustments = {},
    authorityDescription,
    selectionReason,
    authorityNotice,
    reminderMode = 'prayer_window',
    exactWindowMinutes = 20,
    locale = 'en',
    userId = 'anon',
    isAlreadySent = () => false,
  } = options;

  const localDateStr = getLocalDateString(now, location.timezone);

  // Calculate today's schedule
  const todaySchedule = calculateDailySchedule({
    latitude: location.latitude,
    longitude: location.longitude,
    date: now,
    timezone: location.timezone,
    method,
    madhab,
    highLatitudeRule,
    minuteAdjustments,
    authorityDescription,
    selectionReason,
    authorityNotice,
  });

  const nowMs = now.getTime();
  const fajrMs = new Date(todaySchedule.timesUtc.fajr).getTime();
  const sunriseMs = new Date(todaySchedule.timesUtc.sunrise).getTime();
  const dhuhrMs = new Date(todaySchedule.timesUtc.dhuhr).getTime();
  const asrMs = new Date(todaySchedule.timesUtc.asr).getTime();
  const maghribMs = new Date(todaySchedule.timesUtc.maghrib).getTime();
  const ishaMs = new Date(todaySchedule.timesUtc.isha).getTime();

  let activePrayer: ObligatoryPrayerName | null = null;
  let activeStartMs: number = 0;
  let activeExpireMs: number = 0;
  let nextPrayerName: PrayerName = 'Fajr';
  let nextPrayerMs: number = fajrMs;
  let activeLocalDate: string = localDateStr;

  if (nowMs < fajrMs) {
    // Early morning before Fajr: active prayer is Isha from yesterday
    const yesterday = new Date(nowMs - 24 * 60 * 60 * 1000);
    const ySchedule = calculateDailySchedule({
      latitude: location.latitude,
      longitude: location.longitude,
      date: yesterday,
      timezone: location.timezone,
      method,
      madhab,
      highLatitudeRule,
      minuteAdjustments,
      authorityDescription,
      selectionReason,
      authorityNotice,
    });
    activePrayer = 'Isha';
    activeStartMs = new Date(ySchedule.timesUtc.isha).getTime();
    activeExpireMs = fajrMs;
    nextPrayerName = 'Fajr';
    nextPrayerMs = fajrMs;
    activeLocalDate = ySchedule.localDate;
  } else if (nowMs >= fajrMs && nowMs < sunriseMs) {
    // Fajr window (ends at Sunrise)
    activePrayer = 'Fajr';
    activeStartMs = fajrMs;
    activeExpireMs = sunriseMs;
    nextPrayerName = 'Sunrise';
    nextPrayerMs = sunriseMs;
  } else if (nowMs >= sunriseMs && nowMs < dhuhrMs) {
    // Post-sunrise before Dhuhr: no obligatory prayer due
    activePrayer = null;
    nextPrayerName = 'Dhuhr';
    nextPrayerMs = dhuhrMs;
  } else if (nowMs >= dhuhrMs && nowMs < asrMs) {
    // Dhuhr window
    activePrayer = 'Dhuhr';
    activeStartMs = dhuhrMs;
    activeExpireMs = asrMs;
    nextPrayerName = 'Asr';
    nextPrayerMs = asrMs;
  } else if (nowMs >= asrMs && nowMs < maghribMs) {
    // Asr window
    activePrayer = 'Asr';
    activeStartMs = asrMs;
    activeExpireMs = maghribMs;
    nextPrayerName = 'Maghrib';
    nextPrayerMs = maghribMs;
  } else if (nowMs >= maghribMs && nowMs < ishaMs) {
    // Maghrib window
    activePrayer = 'Maghrib';
    activeStartMs = maghribMs;
    activeExpireMs = ishaMs;
    nextPrayerName = 'Isha';
    nextPrayerMs = ishaMs;
  } else {
    // Isha window of today (until tomorrow's Fajr)
    const tomorrow = new Date(nowMs + 24 * 60 * 60 * 1000);
    const tSchedule = calculateDailySchedule({
      latitude: location.latitude,
      longitude: location.longitude,
      date: tomorrow,
      timezone: location.timezone,
      method,
      madhab,
      highLatitudeRule,
      minuteAdjustments,
      authorityDescription,
      selectionReason,
      authorityNotice,
    });
    activePrayer = 'Isha';
    activeStartMs = ishaMs;
    activeExpireMs = new Date(tSchedule.timesUtc.fajr).getTime();
    nextPrayerName = 'Fajr';
    nextPrayerMs = activeExpireMs;
  }

  // Base payload
  const result: PrayerStatusResult = {
    reminderDue: false,
    localDate: localDateStr,
    nextPrayer: nextPrayerName,
    nextPrayerAtUtc: new Date(nextPrayerMs).toISOString(),
    timezone: location.timezone,
    calculationMethod: method,
    madhab,
    minuteAdjustments,
    authorityDescription,
    selectionReason,
    authorityNotice,
    locationSource: location.source,
  };

  if (!activePrayer) {
    return result;
  }

  // Check if current time falls within configured reminder window
  let isWithinWindow = false;
  if (reminderMode === 'exact_window') {
    const windowEndMs = activeStartMs + exactWindowMinutes * 60 * 1000;
    isWithinWindow = nowMs >= activeStartMs && nowMs < windowEndMs;
  } else {
    // 'prayer_window' and 'persistent' both use the full prayer span
    isWithinWindow = nowMs >= activeStartMs && nowMs < activeExpireMs;
  }

  if (!isWithinWindow) {
    return result;
  }

  const dedupeKey = `${userId}:${activeLocalDate}:${activePrayer}:${reminderMode}`;

  // Check deduplication unless in persistent mode
  if (reminderMode !== 'persistent') {
    const alreadySent = await isAlreadySent(dedupeKey);
    if (alreadySent) {
      return result;
    }
  }

  result.reminderDue = true;
  result.prayer = activePrayer;
  result.startedAtUtc = new Date(activeStartMs).toISOString();
  result.expiresAtUtc = new Date(activeExpireMs).toISOString();
  result.reminderText = formatReminderText(activePrayer, locale);
  result.dedupeKey = dedupeKey;

  return result;
}
