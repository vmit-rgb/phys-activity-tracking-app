/**
 * Calendar days. A day is the date on the person's phone (local time),
 * written `YYYY-MM-DD`, the same keys «бета 0.81» uses in a copy.
 */

/** A calendar date as `YYYY-MM-DD`. */
export type DayKey = string & { readonly brand: 'DayKey' };

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyOf(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DayKey;
}

// noon keeps the date safe from clock changes
function dateOf(key: DayKey): Date {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day, 12);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = dateOf(key);
  date.setDate(date.getDate() + days);
  return dayKeyOf(date);
}

export function mondayOf(key: DayKey): DayKey {
  return addDays(key, -((dateOf(key).getDay() + 6) % 7));
}

const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAYS_LONG = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];

function withDots(key: DayKey): string {
  const [year, month, day] = key.split('-');
  return `${day}.${month}.${year}`;
}

/** `ср, 28.10.2026`, as in the bottom bar (Figma `navigation/date`). */
export function formatShort(key: DayKey): string {
  return `${WEEKDAYS_SHORT[dateOf(key).getDay()]}, ${withDots(key)}`;
}

/** `середа, 28.10.2026`, for screen readers and day cards. */
export function formatLong(key: DayKey): string {
  return `${WEEKDAYS_LONG[dateOf(key).getDay()]}, ${withDots(key)}`;
}

const DAY_MS = 86_400_000;

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / DAY_MS);
}
