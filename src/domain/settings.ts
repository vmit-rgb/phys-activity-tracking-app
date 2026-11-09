import { parseAccent, type Accent } from './accents';

/**
 * Settings as the screens read them. The stored profile stays as it came
 * (PROFILE-FORMAT.md, version 1, also written by «бета 0.81»); this is a
 * checked, filled-in view of it: anything missing or broken gets a default
 * (mostly the one 0.81 gives it; a missing section is switched off), so a
 * screen never meets a hole.
 *
 * Glossary
 * - activity kind: one of the four fixed sections with exercises.
 * - moment: when a wellbeing question is asked («зранку», «після тренування»…).
 * - tracker: one wellbeing question (scale, yes/no, one or two numbers, note).
 * - level: a morning warm-up variant («рівень 1»); it counts when all its exercises are ticked.
 * - «для чого» (`groups` in the format): a daytime warm-up chip.
 * - session: one workout («тренування а»); its items are exercises or groups of exercises (`set`).
 */

export const ACTIVITY_KINDS = ['morningWarmup', 'daytimeWarmup', 'workout', 'movement'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const MOMENTS = [
  'morning', 'afterMorningWarmup', 'beforeDaytimeWarmup', 'afterDaytimeWarmup',
  'beforeWorkout', 'afterWorkout', 'beforeMovement', 'afterMovement', 'evening',
] as const;
export type Moment = (typeof MOMENTS)[number];

export type Source = { readonly type: 'user' } | { readonly type: 'link'; readonly url: string; readonly by: 'ai' | 'user' };

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly how: string;
  readonly source: Source;
}

/** A warm-up exercise: done by count (`reps`, free text like «10» or «8–10») or by time (`seconds`). */
export interface WarmupItem {
  readonly exercise: string;
  readonly reps: string;
  readonly seconds: number | null;
}

export type WorkoutField = 'weight' | 'reps' | 'seconds';

export interface WorkoutItem {
  readonly exercise: string;
  readonly reps: string;
  readonly seconds: number | null;
  readonly weight: number | null;
  readonly sets: number | null;
  readonly side: string;
  readonly fields: readonly WorkoutField[];
}

export type WorkoutEntry = WorkoutItem | { readonly set: readonly WorkoutItem[] };

export interface Level { readonly id: string; readonly name: string; readonly duration: string; readonly items: readonly WarmupItem[] }
export interface DaytimeGroup { readonly id: string; readonly name: string; readonly items: readonly WarmupItem[] }
export interface Session { readonly id: string; readonly name: string; readonly how: string; readonly items: readonly WorkoutEntry[] }

export type MovementField = 'km' | 'minutes' | 'steps';
export interface MovementKind { readonly id: string; readonly name: string; readonly fields: readonly MovementField[]; readonly source: Source }

interface TrackerBase { readonly id: string; readonly name: string; readonly hint: string; readonly ask: readonly Moment[] }
export type Tracker = TrackerBase & (
  | { readonly kind: 'scale'; readonly min: number; readonly max: number }
  | { readonly kind: 'yesno' }
  | { readonly kind: 'number'; readonly unit: string }
  | { readonly kind: 'numbers'; readonly units: readonly [string, string] }
  | { readonly kind: 'note' }
);

interface Activity { readonly enabled: boolean; readonly weeklyTarget: number; readonly hint: string }

export interface Settings {
  readonly accent: Accent;
  readonly goal: { readonly enabled: boolean; readonly days: number; readonly done: readonly ActivityKind[] };
  readonly encouragement: readonly string[];
  readonly morningWarmup: Activity & { readonly levels: readonly Level[] };
  readonly daytimeWarmup: Activity & { readonly groups: readonly DaytimeGroup[] };
  readonly workout: Activity & { readonly sessions: readonly Session[] };
  readonly movement: Activity & { readonly kinds: readonly MovementKind[] };
  readonly exercises: readonly Exercise[];
  readonly trackers: readonly Tracker[];
}

type Raw = { readonly [key: string]: unknown };

const isRaw = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const raw = (value: unknown): Raw => (isRaw(value) ? value : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const numberOr = <T>(value: unknown, fallback: T): number | T => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const list = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);
const oneOf = <T extends string>(options: readonly T[], value: unknown): value is T => options.includes(value as T);
const pick = <T extends string>(options: readonly T[], value: unknown): T[] => list(value).filter((x): x is T => oneOf(options, x));
const id = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** Keeps the entries that have an id; the rest can't be logged against and are left out. */
function withIds<T>(value: unknown, read: (entry: Raw, id: string) => T): T[] {
  return list(value).flatMap((entry) => {
    const entryId = id(raw(entry).id);
    return entryId === null ? [] : [read(raw(entry), entryId)];
  });
}

function readSource(value: unknown): Source {
  const source = raw(value);
  const url = text(source.url);
  if (source.type !== 'link' || !/^https?:\/\//i.test(url)) return { type: 'user' };
  return { type: 'link', url, by: source.by === 'ai' ? 'ai' : 'user' };
}

function readWarmupItems(value: unknown): WarmupItem[] {
  return list(value).flatMap((entry) => {
    const item = raw(entry);
    const exercise = id(item.exercise);
    if (exercise === null) return [];
    // «бета 0.81» marks a timed exercise with `timed` and keeps the seconds in `reps`
    const timedReps = item.timed === true ? numberOr(Number(text(item.reps).replace(',', '.')), null) : null;
    const seconds = numberOr(item.seconds, timedReps);
    return [{ exercise, reps: seconds === null ? text(item.reps) : '', seconds }];
  });
}

const WORKOUT_FIELDS: readonly WorkoutField[] = ['weight', 'reps', 'seconds'];

function readWorkoutItem(entry: unknown): WorkoutItem | null {
  const item = raw(entry);
  const exercise = id(item.exercise);
  if (exercise === null) return null;
  const fields = pick(WORKOUT_FIELDS, item.fields);
  return {
    exercise,
    reps: text(item.reps),
    seconds: numberOr(item.seconds, null),
    weight: numberOr(item.weight, null),
    sets: numberOr(item.sets, null),
    side: text(item.side),
    fields: fields.length ? fields : ['reps'],
  };
}

function readWorkoutEntries(value: unknown): WorkoutEntry[] {
  return list(value).flatMap((entry): WorkoutEntry[] => {
    const group = raw(entry).set;
    if (Array.isArray(group)) {
      const set = group.map(readWorkoutItem).filter((item) => item !== null);
      return set.length ? [{ set }] : [];
    }
    const item = readWorkoutItem(entry);
    return item ? [item] : [];
  });
}

const MOVEMENT_FIELDS: readonly MovementField[] = ['km', 'minutes', 'steps'];

function readTracker(entry: Raw, trackerId: string): Tracker {
  const base = { id: trackerId, name: text(entry.name), hint: text(entry.hint), ask: pick(MOMENTS, entry.ask) };
  const units = list(entry.units).map(text);
  switch (entry.kind) {
    case 'yesno':
    case 'note':
      return { ...base, kind: entry.kind };
    case 'number':
      return { ...base, kind: 'number', unit: units[0] ?? '' };
    case 'numbers':
      return { ...base, kind: 'numbers', units: [units[0] ?? '', units[1] ?? ''] };
    default:
      return { ...base, kind: 'scale', min: numberOr(entry.min, 0), max: numberOr(entry.max, 10) };
  }
}

function readActivity(value: Raw): Activity {
  return { enabled: value.enabled === true, weeklyTarget: numberOr(value.weeklyTarget, 0), hint: text(value.hint) };
}

export function readSettings(profile: Raw): Settings {
  const theme = raw(profile.theme);
  const goal = raw(profile.goal);
  const morning = raw(profile.morningWarmup);
  const daytime = raw(profile.daytimeWarmup);
  const workout = raw(profile.workout);
  const movement = raw(profile.movement);
  return {
    accent: parseAccent(theme.accent),
    goal: { enabled: goal.enabled !== false, days: numberOr(goal.days, 5), done: pick(ACTIVITY_KINDS, goal.done) },
    encouragement: list(profile.encouragement).map(text).filter((phrase) => phrase.trim() !== ''),
    morningWarmup: {
      ...readActivity(morning),
      levels: withIds(morning.levels, (level, levelId) => ({
        id: levelId, name: text(level.name), duration: text(level.duration), items: readWarmupItems(level.items),
      })),
    },
    daytimeWarmup: {
      ...readActivity(daytime),
      groups: withIds(daytime.groups, (group, groupId) => ({ id: groupId, name: text(group.name), items: readWarmupItems(group.items) })),
    },
    workout: {
      ...readActivity(workout),
      sessions: withIds(workout.sessions, (session, sessionId) => ({
        id: sessionId, name: text(session.name), how: text(session.how), items: readWorkoutEntries(session.items),
      })),
    },
    movement: {
      ...readActivity(movement),
      kinds: withIds(movement.kinds, (kind, kindId) => {
        const fields = pick(MOVEMENT_FIELDS, kind.fields);
        return { id: kindId, name: text(kind.name), fields: fields.length ? fields : ['minutes'], source: readSource(kind.source) };
      }),
    },
    exercises: withIds(profile.exercises, (exercise, exerciseId) => ({
      id: exerciseId, name: text(exercise.name), how: text(exercise.how), source: readSource(exercise.source),
    })),
    trackers: withIds(profile.trackers, readTracker),
  };
}
