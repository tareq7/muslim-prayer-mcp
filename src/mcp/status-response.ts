import type { AuthorityNotice, PrayerStatusResult } from '../engine/types.ts';

type StatusAuthority = Omit<AuthorityNotice, 'calculationDetails' | 'highLatitudeAdjustment'>;
type NextCalculation = NonNullable<PrayerStatusResult['nextPrayerCalculation']>;
export type PublicPrayerStatus = Omit<PrayerStatusResult, 'dedupeKey' | 'locationSource' | 'authorityNotice' | 'nextPrayerCalculation'> & {
  authorityNotice?: StatusAuthority;
  nextPrayerCalculation?: Omit<NextCalculation, 'authorityNotice'> & {
    authorityNotice?: StatusAuthority;
    usesCurrentCalculation: boolean;
  };
};

function compactAuthority(notice?: AuthorityNotice): StatusAuthority | undefined {
  if (!notice) return undefined;
  const { calculationDetails, highLatitudeAdjustment, ...authority } = notice;
  return authority;
}

/** Public projection only; internal schedules retain their full disclosures. */
export function publicPrayerStatus(status: PrayerStatusResult): PublicPrayerStatus {
  const { dedupeKey, locationSource, authorityNotice, nextPrayerCalculation, ...result } = status;
  const authority = compactAuthority(authorityNotice);
  let next: PublicPrayerStatus['nextPrayerCalculation'];
  if (nextPrayerCalculation) {
    const nextAuthority = compactAuthority(nextPrayerCalculation.authorityNotice);
    const same = JSON.stringify(result.calculationDetails) === JSON.stringify(nextPrayerCalculation.calculationDetails) &&
      JSON.stringify(result.highLatitudeAdjustment) === JSON.stringify(nextPrayerCalculation.highLatitudeAdjustment) &&
      JSON.stringify(authority) === JSON.stringify(nextAuthority);
    next = same
      ? { localDate: nextPrayerCalculation.localDate, usesCurrentCalculation: true }
      : { ...nextPrayerCalculation, authorityNotice: nextAuthority, usesCurrentCalculation: false };
  }
  return { ...result, authorityNotice: authority, nextPrayerCalculation: next };
}
