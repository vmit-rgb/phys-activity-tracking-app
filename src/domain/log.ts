import type { Answer, Day, MovementLog, SetLog } from './day';
import type { Level, Moment, Settings } from './settings';

/*
 * Logging on the home screen: every change to a day is an `Edit`, a pure
 * function from the day to a new day. The screen applies edits; nothing here
 * touches the DOM or the storage. Rules follow «бета 0.81».
 *
 * Glossary
 * - row: a line shown for a set (workout) or a round (timed warm-up exercise).
 *   The plan says how many show; «додати підхід» / «ще раз» show one more,
 *   × shows one less. Shown rows live in `rows`, the logged values in `ex` / `times`.
 * - lap («коло»): one entry of a kind of movement; «додати коло» adds an empty one.
 */

export type Edit = (day: Day) => Day;

const toggle = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const padTo = <T>(list: readonly T[], index: number, empty: T): T[] => [...list, ...Array<T>(Math.max(0, index + 1 - list.length)).fill(empty)];
const replaceAt = <T>(list: readonly T[], index: number, value: T, empty: T): T[] => padTo(list, index, empty).map((x, i) => (i === index ? value : x));
const without = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);
const omit = <T>(table: Readonly<Record<string, T>>, key: string): Record<string, T> => Object.fromEntries(Object.entries(table).filter(([k]) => k !== key));

export const toggleTick = (exercise: string): Edit => (day) => ({ ...day, mw: { ...day.mw, ticks: toggle(day.mw.ticks, exercise) } });

/** «позначити весь рівень» / «зняти позначки з рівня» */
export const markLevel = (level: Level, done: boolean): Edit => (day) => {
  const ids = level.items.map((item) => item.exercise);
  const ticks = done ? [...day.mw.ticks, ...ids.filter((id) => !day.mw.ticks.includes(id))] : day.mw.ticks.filter((id) => !ids.includes(id));
  return { ...day, mw: { ...day.mw, ticks } };
};

export const toggleChip = (group: string): Edit => (day) => ({ ...day, dw: toggle(day.dw, group) });

/** An answer to a wellbeing question; null takes it back. */
export const answer = (moment: Moment, tracker: string, value: Answer | null): Edit => (day) => {
  const answers = omit(day.t[moment] ?? {}, tracker);
  return { ...day, t: { ...day.t, [moment]: value === null ? answers : { ...answers, [tracker]: value } } };
};

export const setNote = (note: string): Edit => (day) => ({ ...day, note });

export const pickSession = (session: string): Edit => (day) => ({ ...day, wo: { session, ex: {}, rows: {} } });
export const dropSession: Edit = (day) => ({ ...day, wo: null });

const EMPTY_SET: SetLog = { w: null, r: null, s: null };

/** Edits the picked workout; without one there is nothing to change. */
const inWorkout = (change: (wo: NonNullable<Day['wo']>) => NonNullable<Day['wo']>): Edit => (day) => (day.wo ? { ...day, wo: change(day.wo) } : day);

/** Rows shown for an exercise: the plan's sets (or one) until the person adds or removes a row. */
export function setRows(day: Day, exercise: string, planned: number | null): number {
  const logged = day.wo?.ex[exercise]?.length ?? 0;
  return Math.max(day.wo?.rows[exercise] ?? planned ?? 1, logged);
}

export const setSet = (exercise: string, index: number, field: keyof SetLog, value: number | null): Edit => inWorkout((wo) => {
  const sets = wo.ex[exercise] ?? [];
  const current = sets[index] ?? EMPTY_SET;
  return { ...wo, ex: { ...wo.ex, [exercise]: replaceAt(sets, index, { ...current, [field]: value }, EMPTY_SET) } };
});

/** «додати підхід» */
export const showMoreSets = (exercise: string, planned: number | null): Edit => (day) =>
  inWorkout((wo) => ({ ...wo, rows: { ...wo.rows, [exercise]: setRows(day, exercise, planned) + 1 } }))(day);

export const removeSet = (exercise: string, index: number, planned: number | null): Edit => (day) => inWorkout((wo) => ({
  ...wo,
  ex: { ...wo.ex, [exercise]: without(wo.ex[exercise] ?? [], index) },
  rows: { ...wo.rows, [exercise]: Math.max(1, setRows(day, exercise, planned) - 1) },
}))(day);

/** Rounds shown for a timed warm-up exercise: one until «ще раз». */
export function roundRows(day: Day, exercise: string): number {
  return Math.max(day.mw.rows[exercise] ?? 1, day.mw.times[exercise]?.length ?? 0);
}

/** The seconds of one round; null clears it. */
export const setRound = (exercise: string, index: number, seconds: number | null): Edit => (day) => ({
  ...day, mw: { ...day.mw, times: { ...day.mw.times, [exercise]: replaceAt(day.mw.times[exercise] ?? [], index, seconds, null) } },
});

/** «ще раз» */
export const showMoreRounds = (exercise: string): Edit => (day) => ({
  ...day, mw: { ...day.mw, rows: { ...day.mw.rows, [exercise]: roundRows(day, exercise) + 1 } },
});

export const removeRound = (exercise: string, index: number): Edit => (day) => ({
  ...day,
  mw: {
    ...day.mw,
    times: { ...day.mw.times, [exercise]: without(day.mw.times[exercise] ?? [], index) },
    rows: { ...day.mw.rows, [exercise]: Math.max(1, roundRows(day, exercise) - 1) },
  },
});

const EMPTY_LAP: MovementLog = { km: null, min: null, steps: null };

/** Laps shown for a kind of movement: at least one. */
export function lapRows(day: Day, kind: string): number {
  return Math.max(1, day.mv[kind]?.length ?? 0);
}

export const setLap = (kind: string, index: number, field: keyof MovementLog, value: number | null): Edit => (day) => {
  const laps = day.mv[kind] ?? [];
  const current = laps[index] ?? EMPTY_LAP;
  return { ...day, mv: { ...day.mv, [kind]: replaceAt(laps, index, { ...current, [field]: value }, EMPTY_LAP) } };
};

/** «додати коло» */
export const addLap = (kind: string): Edit => (day) => ({ ...day, mv: { ...day.mv, [kind]: padTo(day.mv[kind] ?? [], lapRows(day, kind), EMPTY_LAP) } });

export const removeLap = (kind: string, index: number): Edit => (day) => {
  const laps = without(day.mv[kind] ?? [], index);
  return { ...day, mv: laps.length ? { ...day.mv, [kind]: laps } : omit(day.mv, kind) };
};

/** Keeps the names of the exercises used that day, so a deleted exercise still reads fine later (0.81). */
export const rememberNames = (settings: Settings): Edit => (day) => {
  const used = [...day.mw.ticks, ...Object.keys(day.wo?.ex ?? {})];
  const named = settings.exercises.filter((exercise) => used.includes(exercise.id));
  return { ...day, names: { ...day.names, ...Object.fromEntries(named.map((exercise) => [exercise.id, exercise.name])) } };
};
