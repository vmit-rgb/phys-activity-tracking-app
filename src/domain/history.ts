import type { DayKey } from './dates';
import { hasLap, hasSet, type Day, type MovementLog, type SetLog } from './day';
import { formatNumber, plural } from './numbers';

/* «минулого разу»: what was logged the last time before the day shown. */

/** Days before `date`, newest first. */
function earlier(days: Readonly<Record<DayKey, Day>>, date: DayKey): Day[] {
  return Object.values(days).filter((day) => day.date < date).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** The filled sets of the last earlier day that logged this exercise. */
export function lastSets(days: Readonly<Record<DayKey, Day>>, date: DayKey, exercise: string): SetLog[] | null {
  for (const day of earlier(days, date)) {
    const sets = (day.wo?.ex[exercise] ?? []).filter(hasSet);
    if (sets.length) return sets;
  }
  return null;
}

/** The filled laps of the last earlier day with this kind of movement. */
export function lastLaps(days: Readonly<Record<DayKey, Day>>, date: DayKey, kind: string): MovementLog[] | null {
  for (const day of earlier(days, date)) {
    const laps = (day.mv[kind] ?? []).filter(hasLap);
    if (laps.length) return laps;
  }
  return null;
}

const part = (value: number | null, unit: string) => (value === null ? [] : [`${formatNumber(value)}${unit}`]);

/** «5 кг × 10, 5 кг × 8» (as «бета 0.81» wrote it). */
export function formatSets(sets: readonly SetLog[]): string {
  return sets.map((set) => [...part(set.w, ' кг'), ...part(set.r, ''), ...part(set.s, ' с')].join(' × ')).join(', ');
}

const STEPS = ['крок', 'кроки', 'кроків'] as const;

/** «3 км · 40 хв, 1 км» */
export function formatLaps(laps: readonly MovementLog[]): string {
  return laps.map((lap) => [
    ...part(lap.km, ' км'),
    ...part(lap.min, ' хв'),
    ...(lap.steps === null ? [] : [`${formatNumber(lap.steps)} ${plural(lap.steps, STEPS)}`]),
  ].join(' · ')).join(', ');
}
