import type { DayKey } from './dates';

/**
 * What was logged on one day, in the shape «бета 0.81» stores (`v: 2`),
 * so a copy moves between the two without conversion.
 *
 * Glossary (stored key → meaning)
 * - `t`: answers to wellbeing questions, by moment, then by tracker id.
 *   scale and number → a number; yes/no → 'yes' | 'no'; two numbers → [a, b]; note → text.
 * - `note`: the day's note.
 * - `mw`: morning warm-up. `ticks` = ticked exercise ids; `times` = seconds per
 *   round of a timed exercise; `rows` = how many timer rows the person opened.
 * - `dw`: the daytime warm-up chips («для чого») marked today.
 * - `wo`: the workout picked today (`session`), sets per exercise (`ex`: weight `w`,
 *   reps `r`, seconds `s`) and opened set rows (`rows`); null when none was picked.
 * - `mv`: movement per kind: `km`, `min`, `steps`.
 * - `names`: the names of exercises used that day, so a deleted exercise still reads fine.
 */

export type Answer = number | string | readonly (number | null)[];
export interface SetLog { readonly w: number | null; readonly r: number | null; readonly s: number | null }
export interface MovementLog { readonly km: number | null; readonly min: number | null; readonly steps: number | null }

type Table<T> = Readonly<Record<string, T>>;

export interface Day {
  readonly date: DayKey;
  readonly t: Table<Table<Answer>>;
  readonly note: string;
  readonly mw: { readonly ticks: readonly string[]; readonly times: Table<readonly (number | null)[]>; readonly rows: Table<number> };
  readonly dw: readonly string[];
  readonly wo: { readonly session: string; readonly ex: Table<readonly SetLog[]>; readonly rows: Table<number> } | null;
  readonly mv: Table<MovementLog>;
  readonly names: Table<string>;
}

type Raw = { readonly [key: string]: unknown };

const isRaw = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const raw = (value: unknown): Raw => (isRaw(value) ? value : {});
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []);

/** Keeps the entries `read` can make sense of. */
function table<T>(value: unknown, read: (entry: unknown) => T | null): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, entry] of Object.entries(raw(value))) {
    const parsed = read(entry);
    if (parsed !== null) result[key] = parsed;
  }
  return result;
}

const isBlank = (value: unknown) => value === null || value === undefined || value === '';

function readAnswer(value: unknown): Answer | null {
  if (typeof value === 'string') return value === '' ? null : value;
  if (Array.isArray(value)) return value.every(isBlank) ? null : value.map(num);
  return num(value);
}

const readNumbers = (value: unknown) => (Array.isArray(value) ? value.map(num) : null);
const readSet = (value: unknown): SetLog => ({ w: num(raw(value).w), r: num(raw(value).r), s: num(raw(value).s) });
const hasSet = (set: SetLog) => set.w !== null || set.r !== null || set.s !== null;

function readWorkout(value: unknown): Day['wo'] {
  const workout = raw(value);
  if (typeof workout.session !== 'string' || workout.session === '') return null;
  return {
    session: workout.session,
    ex: table(workout.ex, (sets) => (Array.isArray(sets) ? sets.map(readSet) : null)),
    rows: table(workout.rows, num),
  };
}

function readMovement(value: unknown): MovementLog | null {
  const movement: MovementLog = { km: num(raw(value).km), min: num(raw(value).min), steps: num(raw(value).steps) };
  return movement.km === null && movement.min === null && movement.steps === null ? null : movement;
}

export function emptyDay(date: DayKey): Day {
  return { date, t: {}, note: '', mw: { ticks: [], times: {}, rows: {} }, dw: [], wo: null, mv: {}, names: {} };
}

/** Reads a stored day; anything broken inside is dropped, never guessed. */
export function readDay(value: unknown, date: DayKey): Day {
  const day = raw(value);
  const mw = raw(day.mw);
  const names = table(day.names, (name) => (typeof name === 'string' ? name : null));
  return {
    date,
    t: table(day.t, (answers) => table(answers, readAnswer)),
    note: typeof day.note === 'string' ? day.note : '',
    mw: { ticks: strings(mw.ticks), times: table(mw.times, readNumbers), rows: table(mw.rows, num) },
    dw: strings(day.dw),
    wo: readWorkout(day.wo),
    mv: table(day.mv, readMovement),
    names,
  };
}

/** Sets without anything in them at the end of the list are left out, as 0.81 does. */
function trimSets(sets: readonly SetLog[]): SetLog[] {
  const last = sets.reduce((found, set, index) => (hasSet(set) ? index : found), -1);
  return sets.slice(0, last + 1);
}

const someTime = (times: Day['mw']['times']) => Object.values(times).some((list) => list.some((x) => x !== null));
const someAnswer = (t: Day['t']) => Object.values(t).some((answers) => Object.keys(answers).length > 0);

/** Whether anything at all was logged (0.81 `hasData`); an empty day isn't stored. */
export function hasData(day: Day): boolean {
  return someAnswer(day.t) || someTime(day.mw.times) || day.note !== '' || day.mw.ticks.length > 0
    || day.dw.length > 0 || day.wo !== null || Object.keys(day.mv).length > 0;
}

/** The day as stored, or null when there is nothing to keep (0.81 `compactDay`). */
export function writeDay(day: Day): Raw | null {
  if (!hasData(day)) return null;
  const t = Object.fromEntries(Object.entries(day.t).filter(([, answers]) => Object.keys(answers).length > 0));
  const wo = day.wo && {
    ...day.wo,
    ex: Object.fromEntries(Object.entries(day.wo.ex).map(([id, sets]) => [id, trimSets(sets)] as const).filter(([, sets]) => sets.length > 0)),
  };
  return { v: 2, date: day.date, t, note: day.note, mw: day.mw, dw: day.dw, wo, mv: day.mv, names: day.names };
}
