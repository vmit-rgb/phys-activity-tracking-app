import { daysBetween, type DayKey } from './dates';

/*
 * The copy in the menu (COPY.md, Menu; «бета 0.81» `backupLine`, `needBackup`).
 * The day of the last copy is kept on this phone only, not in the copy itself.
 */

/** The reminder shows from this many days after the last copy (Olesia, 2026-10-29: fixed). */
export const REMIND_AFTER_DAYS = 3;

/** «1 день», «3 дні», «5 днів», «21 день»… */
function dayWord(n: number): string {
  const last = n % 10;
  const tens = n % 100;
  if (last === 1 && tens !== 11) return 'день';
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return 'дні';
  return 'днів';
}

/** Days since the copy; a copy dated after today (the clock moved back) counts as today. */
const daysSince = (saved: DayKey, today: DayKey) => Math.max(0, daysBetween(saved, today));

export function backupLine(saved: DayKey | null, today: DayKey): string {
  if (saved === null) return 'копії ще немає';
  const n = daysSince(saved, today);
  return n === 0 ? 'остання копія — сьогодні' : `остання копія — ${n} ${dayWord(n)} тому`;
}

/** Remind when there are records and no copy, or the copy is 3 days old or older. */
export function needsBackup(saved: DayKey | null, today: DayKey, hasRecords: boolean): boolean {
  return saved === null ? hasRecords : daysSince(saved, today) >= REMIND_AFTER_DAYS;
}

/** The same name «бета 0.81» gives its copies. */
export function copyFileName(today: DayKey): string {
  return `trekr-kopiya-${today}.json`;
}
