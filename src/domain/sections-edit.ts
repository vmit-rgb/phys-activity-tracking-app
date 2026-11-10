import type { JsonObject } from './diary';
import type { ProfileEdit } from './profile-edit';
import type { ActivityKind, Tracker } from './settings';

/*
 * Stage 6d: the changes the settings make inside the sections
 * (PROFILE-FORMAT.md «In-app editing»): trackers, morning levels, daytime
 * «для чого», workouts and their groups of exercises, movement. Lists are
 * named by their path in the profile («morningWarmup.levels.0.items»,
 * «workout.sessions.0.items.2.set»), entries by their index in that list.
 * The array order is the order on screen.
 *
 * Every change first drops what `readSettings` drops (entries without an
 * id or an exercise), so an index on screen is the same index here, and
 * keeps every field it doesn't touch.
 */

type Obj = Record<string, unknown>;

/** An entry: its list and its index there. */
export interface Slot {
  readonly list: string;
  readonly index: number;
}

/** Where a moved entry goes: before the entry at `before` (its index before the move), or at the end. */
export interface Place {
  readonly list: string;
  readonly before: number | null;
}

export const LIST_OF: Record<ActivityKind, string> = {
  morningWarmup: 'morningWarmup.levels',
  daytimeWarmup: 'daytimeWarmup.groups',
  workout: 'workout.sessions',
  movement: 'movement.kinds',
};
export const TRACKERS = 'trackers';

/** A group of exercises holds 2–3 (Olesia, 2026-10-30). */
export const GROUP_MAX = 3;

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const obj = (value: unknown): Obj => (isObj(value) ? value : {});
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const named = (key: string) => (value: unknown): value is Obj => typeof obj(value)[key] === 'string' && obj(value)[key] !== '';
const hasId = named('id');
const hasExercise = named('exercise');

function workoutItems(value: unknown): unknown[] {
  return arr(value).flatMap((entry) => {
    const set = obj(entry).set;
    if (!Array.isArray(set)) return hasExercise(entry) ? [entry] : [];
    const kept = set.filter(hasExercise);
    return kept.length ? [{ ...obj(entry), set: kept }] : [];
  });
}

function section(value: unknown, key: string, each: (entry: Obj) => Obj): Obj {
  const kept = obj(value);
  return { ...kept, [key]: arr(kept[key]).filter(hasId).map(each) };
}

const warmup = (entry: Obj): Obj => ({ ...entry, items: arr(entry.items).filter(hasExercise) });

/** Drops what can't be shown (as `readSettings` does), so indices on screen match the profile. */
export function tidy(profile: JsonObject): JsonObject {
  return {
    ...profile,
    trackers: arr(profile.trackers).filter(hasId),
    exercises: arr(profile.exercises).filter(hasId),
    morningWarmup: section(profile.morningWarmup, 'levels', warmup),
    daytimeWarmup: section(profile.daytimeWarmup, 'groups', warmup),
    workout: section(profile.workout, 'sessions', (entry) => ({ ...entry, items: workoutItems(entry.items) })),
    movement: section(profile.movement, 'kinds', (entry) => entry),
  } as JsonObject;
}

/* ---- paths in a working copy ---- */

const keys = (path: string) => path.split('.');

function at(root: Obj, path: string): unknown {
  return keys(path).reduce<unknown>((value, key) => (isObj(value) || Array.isArray(value) ? (value as Obj)[key] : undefined), root);
}

/** What sits at a path of a (tidy) profile. */
export const valueAt = (profile: JsonObject, path: string): unknown => at(profile as Obj, path);

/** The list at `path` (an empty one if something odd sits there). */
function listAt(root: Obj, path: string): unknown[] {
  const list = at(root, path);
  return Array.isArray(list) ? list : [];
}

/** Sets a value, making the objects on the way; `undefined` removes the key. */
function put(root: Obj, path: string, value: unknown): void {
  const parts = keys(path);
  const last = parts.pop()!;
  let node: Obj = root;
  for (const key of parts) {
    if (!isObj(node[key]) && !Array.isArray(node[key])) node[key] = {};
    node = node[key] as Obj;
  }
  if (value === undefined) delete node[last];
  else node[last] = value;
}

/** A change made on a tidy working copy. */
const change = (edit: (copy: Obj) => void): ProfileEdit => (profile) => {
  const copy = structuredClone(tidy(profile)) as Obj;
  edit(copy);
  return copy as JsonObject;
};

/* ---- values ---- */

/** Any plain value at a path («trackers.0.name», «workout.hint»…); `undefined` removes it. */
export const withValue = (path: string, value: unknown): ProfileEdit => change((copy) => put(copy, path, value));

/** A link someone typed: `source: link` (by the person), or back to `user` when emptied. */
export function linkSource(url: string): Obj {
  const trimmed = url.trim();
  if (trimmed === '') return { type: 'user' };
  return { type: 'link', url: /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`, by: 'user' };
}

function exerciseEntry(copy: Obj, id: string): Obj {
  const list = listAt(copy, 'exercises') as Obj[];
  const found = list.find((exercise) => exercise.id === id);
  if (found) return found;
  const made: Obj = { id, name: '', how: '', source: { type: 'user' } };
  list.push(made);
  return made;
}

/** An exercise's name, «як робити» or link; one exercise may sit in several lists. */
export const withExercise = (id: string, key: 'name' | 'how' | 'source', value: unknown): ProfileEdit =>
  change((copy) => {
    exerciseEntry(copy, id)[key] = value;
  });

/** One of a list of choices on or off («питати зранку», «n кг»…), kept in `order`. */
export const withChoice = (path: string, value: string, on: boolean, order: readonly string[]): ProfileEdit =>
  change((copy) => {
    const now = arr(at(copy, path));
    put(copy, path, order.filter((option) => (option === value ? on : now.includes(option))));
  });

/** A section on home or not, and its days per week (0–7). */
export const withActivity = (kind: ActivityKind, update: { readonly enabled?: boolean; readonly weeklyTarget?: number }): ProfileEdit =>
  change((copy) => {
    if (update.enabled !== undefined) put(copy, `${kind}.enabled`, update.enabled);
    if (update.weeklyTarget !== undefined) put(copy, `${kind}.weeklyTarget`, Math.min(7, Math.max(0, update.weeklyTarget)));
  });

/**
 * A warm-up exercise done by time («n с») or by count. The seconds go to
 * `seconds` (0.81's `timed` + seconds in `reps` is read, then dropped).
 */
export const withTimed = (path: string, on: boolean, seconds: number | null, reps: string): ProfileEdit =>
  change((copy) => {
    const item = obj(at(copy, path));
    delete item.timed;
    if (on) {
      item.seconds = seconds ?? (Number(reps) || 30);
      item.reps = '';
    } else {
      item.reps = reps || (seconds === null ? '' : String(seconds));
      delete item.seconds;
    }
  });

/** «3 × 10–12»: sets and reps of a workout exercise; plain «10» leaves no number of sets. */
export const withPrescription = (path: string, typed: string): ProfileEdit =>
  change((copy) => {
    const item = obj(at(copy, path));
    const match = /^\s*(\d+)\s*[×xх*]\s*(.+)$/i.exec(typed);
    delete item.side;
    if (match) {
      item.sets = Number(match[1]);
      item.reps = match[2]!.trim();
    } else {
      delete item.sets;
      item.reps = typed.trim();
    }
  });

/* ---- lists ---- */

/** Every id in the profile, so a new one is new. */
function ids(profile: JsonObject): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (isObj(value)) {
      if (typeof value.id === 'string') found.add(value.id);
      Object.values(value).forEach(walk);
    }
  };
  walk(profile);
  return found;
}

/** «tracker-3»: the first free number for the prefix. */
export function freeId(profile: JsonObject, prefix: string): string {
  const taken = ids(profile);
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** A new question of a kind (0.81: asked in the morning, a scale 0–10). */
export function newTracker(kind: Tracker['kind'], id: string, name: string): Obj {
  const base = { id, name, hint: '', kind, ask: ['morning'] };
  if (kind === 'scale') return { ...base, min: 0, max: 10 };
  if (kind === 'number') return { ...base, units: [''] };
  if (kind === 'numbers') return { ...base, units: ['', ''] };
  return base;
}

/** Puts an entry at the end of a list (tidy makes every section's list). */
export const withAdded = (list: string, entry: Obj): ProfileEdit => change((copy) => {
  listAt(copy, list).push(entry);
});

/** A new exercise in the catalogue and in a list; a workout one counts sets of weight and reps (0.81). */
export const withNewExercise = (list: string, id: string, name: string): ProfileEdit => change((copy) => {
  listAt(copy, 'exercises').push({ id, name, how: '', source: { type: 'user' } });
  const item = list.startsWith('workout.') ? { exercise: id, reps: '', sets: 3, fields: ['weight', 'reps'] } : { exercise: id, reps: '' };
  listAt(copy, list).push(item);
});

/** The group a list belongs to, when it is a group's `set`. */
function groupOf(copy: Obj, list: string): { owner: Obj; parent: unknown[] } | null {
  const match = /^(.*)\.\d+\.set$/.exec(list);
  if (!match) return null;
  return { owner: obj(at(copy, list.slice(0, -'.set'.length))), parent: listAt(copy, match[1]!) };
}

/** A group left with one exercise becomes that exercise; an empty one goes. */
function settle(group: { owner: Obj; parent: unknown[] } | null): void {
  if (!group) return;
  const where = group.parent.indexOf(group.owner);
  const set = arr(group.owner.set);
  if (where < 0 || set.length > 1) return;
  group.parent.splice(where, 1, ...set);
}

function moveIn(copy: Obj, from: Slot, to: Place): void {
  const source = listAt(copy, from.list);
  const entry = source[from.index];
  const target = listAt(copy, to.list);
  const anchor = to.before === null ? undefined : target[to.before];
  const group = groupOf(copy, from.list);
  source.splice(from.index, 1);
  const where = anchor === entry ? from.index : anchor === undefined ? target.length : target.indexOf(anchor);
  target.splice(where, 0, entry);
  settle(group);
}

/** Moves an entry inside its list or to another list of its kind (another level, «для чого», workout, group). */
export const withMoved = (from: Slot, to: Place): ProfileEdit => change((copy) => moveIn(copy, from, to));

/** Takes an exercise out of its group, right after the group. */
export const withLeft = (from: Slot): ProfileEdit => change((copy) => {
  const match = /^(.*)\.(\d+)\.set$/.exec(from.list)!;
  moveIn(copy, from, { list: match[1]!, before: Number(match[2]) + 1 });
});

/** Removes an entry; a group left with one exercise dissolves. The exercise stays in the catalogue, so old days keep its name. */
export const withRemoved = (slot: Slot): ProfileEdit => change((copy) => {
  const group = groupOf(copy, slot.list);
  listAt(copy, slot.list).splice(slot.index, 1);
  settle(group);
});

export type JoinResult = 'ok' | 'full';

/**
 * Drops a workout exercise onto another (a new group of two, like apps in a
 * folder) or onto a group (it joins the end). A group of 3 refuses.
 */
export function joinGroup(profile: JsonObject, from: Slot, onto: Slot): { readonly profile: JsonObject; readonly result: JoinResult } {
  const copy = structuredClone(tidy(profile)) as Obj;
  const target = obj(listAt(copy, onto.list)[onto.index]);
  const group = groupOf(copy, onto.list)?.owner ?? (Array.isArray(target.set) ? target : null);
  if (group && arr(group.set).length >= GROUP_MAX) return { profile, result: 'full' };
  const source = listAt(copy, from.list);
  const entry = source[from.index];
  const left = groupOf(copy, from.list);
  source.splice(from.index, 1);
  if (group) arr(group.set).push(entry);
  else {
    const list = listAt(copy, onto.list);
    list.splice(list.indexOf(target), 1, { set: [target, entry] });
  }
  settle(left);
  return { profile: copy as JsonObject, result: 'ok' };
}

/** «створити групу»: the chosen exercises of one workout (2–3, not in a group) become a group where the first one was. */
export const withGroup = (list: string, indices: readonly number[]): ProfileEdit => change((copy) => {
  const items = listAt(copy, list);
  const order = [...indices].sort((a, b) => a - b);
  const chosen = order.map((index) => items[index]);
  for (const index of order.slice(1).reverse()) items.splice(index, 1);
  items.splice(order[0]!, 1, { set: chosen });
});
