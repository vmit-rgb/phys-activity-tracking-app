import { addDays, mondayOf, type DayKey } from './dates';
import { hasLap, hasSet, type Day } from './day';
import type { ActivityKind, Level, Settings } from './settings';

/*
 * Counting rules (Olesia, 2026-10-29; PROFILE-FORMAT.md):
 * - a warm-up level counts only when all its exercises are ticked;
 * - a day is «зроблено» only when every activity kind ticked in the main goal is done;
 * - the week starts on Monday and counts days up to today.
 */

export function levelDone(day: Day, level: Level): boolean {
  return level.items.length > 0 && level.items.every((item) => day.mw.ticks.includes(item.exercise));
}

const hasSets = (day: Day) => day.wo !== null && Object.values(day.wo.ex).some((sets) => sets.some(hasSet));

export function kindDone(day: Day, kind: ActivityKind, settings: Settings): boolean {
  switch (kind) {
    case 'morningWarmup': return settings.morningWarmup.levels.some((level) => levelDone(day, level));
    case 'daytimeWarmup': return day.dw.length > 0;
    case 'workout': return hasSets(day);
    case 'movement': return Object.values(day.mv).some((laps) => laps.some(hasLap));
  }
}

/** The kinds that make a day count: ticked in the goal and switched on. */
export function goalKinds(settings: Settings): ActivityKind[] {
  return settings.goal.done.filter((kind) => settings[kind].enabled);
}

export function dayDone(day: Day, settings: Settings): boolean {
  const kinds = goalKinds(settings);
  return kinds.length > 0 && kinds.every((kind) => kindDone(day, kind, settings));
}

/** Days of the week of `date`, Monday first, up to today. */
export function weekSoFar(date: DayKey, today: DayKey): DayKey[] {
  const monday = mondayOf(date);
  return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(monday, n)).filter((key) => key <= today);
}

export interface WeekGoal { readonly done: number; readonly target: number }

/** «цей тиждень: 3 з 5 днів», or null when there is no goal to show. */
export function weekGoal(date: DayKey, today: DayKey, dayAt: (key: DayKey) => Day, settings: Settings): WeekGoal | null {
  if (!settings.goal.enabled || goalKinds(settings).length === 0) return null;
  const done = weekSoFar(date, today).filter((key) => dayDone(dayAt(key), settings)).length;
  return { done, target: settings.goal.days };
}

/** What an edit of a day finished: warm-up levels that just got done, and whether the day just counted for the goal. */
export interface Completed {
  readonly levels: readonly string[];
  readonly day: boolean;
}

export function completed(before: Day, after: Day, settings: Settings): Completed {
  const levels = settings.morningWarmup.levels.filter((level) => levelDone(after, level) && !levelDone(before, level)).map((level) => level.id);
  const day = settings.goal.enabled && dayDone(after, settings) && !dayDone(before, settings);
  return { levels, day };
}
