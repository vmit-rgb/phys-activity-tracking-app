import { addDays, mondayOf, type DayKey } from './dates';
import type { Day } from './day';
import { plural } from './numbers';
import { kindDone, levelDone, weekSoFar } from './progress';
import { ACTIVITY_KINDS, MOMENTS, type ActivityKind, type Moment, type Settings } from './settings';

/*
 * The calendar block (Figma `calendar/month` 131:2314): «цей тиждень»,
 * «середнє за 7 днів» and the month. Rules from «бета 0.81»: each kind counts
 * on its own, Monday to today; averages of sliders only; a day shows the
 * highest warm-up level done (up to 3) and markers for workout and movement.
 */

export interface WeekStat {
  readonly kind: ActivityKind;
  readonly label: string;
  readonly done: number;
  /** Days a week the person aims for; 0 shows the number alone. */
  readonly target: number;
}

/** Figma names the morning warm-up «розминка»; with both warm-ups on they need their full names. */
function kindLabel(kind: ActivityKind, settings: Settings): string {
  const bothWarmups = settings.morningWarmup.enabled && settings.daytimeWarmup.enabled;
  const labels: Record<ActivityKind, string> = {
    morningWarmup: bothWarmups ? 'ранкова розминка' : 'розминка',
    daytimeWarmup: bothWarmups ? 'денна розминка' : 'розминка',
    workout: 'тренування',
    movement: 'рух',
  };
  return labels[kind];
}

export function weekStats(date: DayKey, today: DayKey, dayAt: (key: DayKey) => Day, settings: Settings): WeekStat[] {
  const week = weekSoFar(date, today).map(dayAt);
  return ACTIVITY_KINDS.filter((kind) => settings[kind].enabled).map((kind) => ({
    kind,
    label: kindLabel(kind, settings),
    done: week.filter((day) => kindDone(day, kind, settings)).length,
    target: settings[kind].weeklyTarget,
  }));
}

/** The day shown and the six before it (0.81 `last7`). */
export function lastSevenDays(date: DayKey, today: DayKey): DayKey[] {
  return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(date, -n)).filter((key) => key <= today);
}

export const MOMENT_SHORT: Record<Moment, string> = {
  morning: 'зранку',
  afterMorningWarmup: 'після розминки',
  beforeDaytimeWarmup: 'до денної',
  afterDaytimeWarmup: 'після денної',
  beforeWorkout: 'до тренування',
  afterWorkout: 'після тренування',
  beforeMovement: 'до руху',
  afterMovement: 'після руху',
  evening: 'ввечері',
};

export interface Average { readonly label: string; readonly value: number }

/** «біль · зранку 2,7»: every slider at every moment it is asked; none without answers. */
export function averages(keys: readonly DayKey[], dayAt: (key: DayKey) => Day, settings: Settings): Average[] {
  const sliders = settings.trackers.filter((tracker) => tracker.kind === 'scale');
  return sliders.flatMap((tracker) => MOMENTS.filter((moment) => tracker.ask.includes(moment)).flatMap((moment) => {
    const values = keys.map((key) => dayAt(key).t[moment]?.[tracker.id]).filter((value) => typeof value === 'number');
    if (values.length === 0) return [];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [{ label: `${tracker.name || 'без назви'} · ${MOMENT_SHORT[moment]}`, value: Math.round(mean * 10) / 10 }];
  }));
}

export interface DayMarks { readonly level: number; readonly workout: boolean; readonly movement: boolean }

/** The last level done, counted from 1; the calendar has three shades, so 3 at most. */
export function dayMarks(day: Day, settings: Settings): DayMarks {
  const level = settings.morningWarmup.levels.reduce((reached, level, i) => (levelDone(day, level) ? i + 1 : reached), 0);
  return { level: Math.min(3, level), workout: kindDone(day, 'workout', settings), movement: kindDone(day, 'movement', settings) };
}

/** A month as `YYYY-MM`. */
export type MonthKey = string & { readonly brand: 'MonthKey' };

export const monthOf = (key: DayKey) => key.slice(0, 7) as MonthKey;

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const total = year * 12 + m - 1 + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}` as MonthKey;
}

export interface MonthCell { readonly key: DayKey; readonly inMonth: boolean }

/** Whole weeks around the month, Monday first; days of other months are only shown. */
export function monthCells(month: MonthKey): MonthCell[] {
  const first = `${month}-01` as DayKey;
  const start = mondayOf(first);
  const next = `${shiftMonth(month, 1)}-01` as DayKey;
  const weeks = Math.ceil((Date.parse(next) - Date.parse(start)) / (7 * 86_400_000));
  return Array.from({ length: weeks * 7 }, (_, n) => {
    const key = addDays(start, n);
    return { key, inMonth: monthOf(key) === month };
  });
}

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];

export function monthName(month: MonthKey, today: DayKey): string {
  const [year, m] = month.split('-');
  const name = MONTHS[Number(m) - 1]!;
  return year === today.slice(0, 4) ? name : `${name} ${year}`;
}

/* ---- pulse timer (ACCESSIBILITY.md; COPY.md «Pulse timer») ---- */

export const bpm = (beats: number, seconds: number) => Math.round((beats * 60) / seconds);

const BEATS = ['удар', 'удари', 'ударів'] as const;

/** «42 удари за 30 с × 2» */
export function beatsLine(beats: number, seconds: number): string {
  const times = 60 / seconds;
  return `${beats} ${plural(beats, BEATS)} за ${seconds} с${times === 1 ? '' : ` × ${times}`}`;
}
