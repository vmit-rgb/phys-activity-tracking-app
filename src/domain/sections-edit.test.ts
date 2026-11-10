import { describe, expect, it } from 'vitest';
import type { JsonObject } from './diary';
import {
  freeId, joinGroup, linkSource, newTracker, tidy, valueAt, withActivity, withAdded, withChoice, withExercise, withGroup, withLeft, withMoved,
  withNewExercise, withPrescription, withRemoved, withTimed, withValue,
} from './sections-edit';
import { MOMENTS, readSettings } from './settings';

// Invented data only.
const item = (exercise: string, extra: JsonObject = {}) => ({ exercise, reps: '10', ...extra });
const PROFILE: JsonObject = {
  format: 'phys-activity-profile',
  future: { kept: true },
  trackers: [
    { id: 't1', name: 'біль', kind: 'scale', ask: ['morning'] },
    { name: 'без id' },
    { id: 't2', name: 'тиск', kind: 'numbers', ask: [] },
    { id: 't3', name: 'втома', kind: 'scale', ask: [] },
  ],
  exercises: [{ id: 'e1', name: 'вправа 1' }, { id: 'e2', name: 'вправа 2' }, { name: 'без id' }],
  morningWarmup: {
    enabled: true,
    levels: [
      { id: 'l1', name: 'рівень 1', items: [item('e1'), { reps: 'без вправи' }, item('e2', { timed: true, reps: '30' })] },
      { id: 'l2', name: 'рівень 2', items: [] },
    ],
  },
  workout: {
    sessions: [{
      id: 's1', name: 'а', items: [item('e1'), { set: [item('e2'), item('e3')] }, item('e4'), { set: [{ no: 'exercise' }] }, item('e5')],
    }, { id: 's2', name: 'б', items: [item('e6')] }],
  },
};

const items = (profile: JsonObject, path: string) => valueAt(profile, path) as JsonObject[];
const exercisesOf = (profile: JsonObject, path: string) =>
  items(profile, path).map((entry) => (Array.isArray(entry.set) ? (entry.set as JsonObject[]).map((x) => x.exercise) : entry.exercise));
const S1 = 'workout.sessions.0.items';

describe('tidy', () => {
  it('drops what readSettings drops, so indices match', () => {
    const tidied = tidy(PROFILE);
    expect(items(tidied, 'trackers').map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(items(tidied, 'exercises')).toHaveLength(2);
    expect(exercisesOf(tidied, 'morningWarmup.levels.0.items')).toEqual(['e1', 'e2']);
    expect(exercisesOf(tidied, S1)).toEqual(['e1', ['e2', 'e3'], 'e4', 'e5']);
    expect(readSettings(tidied).trackers.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(tidied.future).toEqual({ kept: true });
  });

  it('makes empty lists for missing sections and is the same twice', () => {
    const tidied = tidy({});
    expect(tidied.daytimeWarmup).toEqual({ groups: [] });
    expect(tidy(tidied)).toEqual(tidied);
  });
});

describe('values', () => {
  it('sets a value at a path, making the way, and removes with undefined', () => {
    const named = withValue('trackers.0.name', 'шия')(PROFILE);
    expect(items(named, 'trackers')[0]!.name).toBe('шия');
    expect(PROFILE.trackers).toHaveLength(4);
    expect((withValue('movement.hint', 'гуляй')({}).movement as JsonObject).hint).toBe('гуляй');
    const removed = withValue('workout.sessions.0.items.0.reps', undefined)(PROFILE);
    expect(items(removed, S1)[0]).toEqual({ exercise: 'e1' });
    expect((withValue('a.b', 1)({ a: 'текст' }).a as JsonObject).b).toBe(1);
  });

  it('makes links from what was typed', () => {
    expect(linkSource('  ')).toEqual({ type: 'user' });
    expect(linkSource('example.com/x')).toEqual({ type: 'link', url: 'https://example.com/x', by: 'user' });
    expect(linkSource('http://example.com')).toEqual({ type: 'link', url: 'http://example.com', by: 'user' });
  });

  it('changes an exercise in the catalogue, or adds one that was missing', () => {
    const renamed = withExercise('e2', 'name', 'присідання')(PROFILE);
    expect(items(renamed, 'exercises')[1]!.name).toBe('присідання');
    const made = withExercise('e9', 'how', 'повільно')(PROFILE);
    expect(items(made, 'exercises')[2]).toEqual({ id: 'e9', name: '', how: 'повільно', source: { type: 'user' } });
  });

  it('turns choices on and off in their order', () => {
    const asked = withChoice('trackers.0.ask', 'evening', true, MOMENTS)(PROFILE);
    expect(items(asked, 'trackers')[0]!.ask).toEqual(['morning', 'evening']);
    const first = withChoice('trackers.0.ask', 'morning', false, MOMENTS)(asked);
    expect(items(first, 'trackers')[0]!.ask).toEqual(['evening']);
    expect(items(withChoice('trackers.2.ask', 'afterWorkout', true, MOMENTS)(PROFILE), 'trackers')[2]!.ask).toEqual(['afterWorkout']);
  });

  it('switches a section and keeps its days within 0–7', () => {
    const on = withActivity('movement', { enabled: true })(PROFILE);
    expect(on.movement).toMatchObject({ enabled: true, kinds: [] });
    expect((withActivity('movement', { weeklyTarget: 9 })(PROFILE).movement as JsonObject).weeklyTarget).toBe(7);
    expect((withActivity('movement', { weeklyTarget: -1 })(PROFILE).movement as JsonObject).weeklyTarget).toBe(0);
  });

  it('makes a warm-up exercise timed and back', () => {
    const path = 'morningWarmup.levels.0.items.0';
    const timed = withTimed(path, true, null, '10')(PROFILE);
    expect(valueAt(timed, path)).toEqual({ exercise: 'e1', reps: '', seconds: 10 });
    expect(valueAt(withTimed(path, true, null, 'багато')(PROFILE), path)).toMatchObject({ seconds: 30 });
    expect(valueAt(withTimed(path, false, 10, '')(timed), path)).toEqual({ exercise: 'e1', reps: '10' });
    const old = 'morningWarmup.levels.0.items.1';
    expect(valueAt(withTimed(old, false, 30, '')(PROFILE), old)).toEqual({ exercise: 'e2', reps: '30' });
    expect(valueAt(withTimed(old, true, 30, '')(PROFILE), old)).toEqual({ exercise: 'e2', reps: '', seconds: 30 });
    expect(valueAt(withTimed(path, false, null, '')(PROFILE), path)).toEqual({ exercise: 'e1', reps: '' });
  });

  it('reads «3 × 10–12» as sets and reps, and plain reps without sets', () => {
    const path = `${S1}.0`;
    const both = withPrescription(path, ' 3 x 10–12 ')(withValue(`${path}.side`, 'на кожну')(PROFILE));
    expect(valueAt(both, path)).toEqual({ exercise: 'e1', reps: '10–12', sets: 3 });
    expect(valueAt(withPrescription(path, ' 15 ')(both), path)).toEqual({ exercise: 'e1', reps: '15' });
  });
});

describe('lists', () => {
  it('finds a free id', () => {
    expect(freeId(PROFILE, 'tracker')).toBe('tracker-1');
    expect(freeId({ trackers: [{ id: 'tracker-1' }, { id: 'tracker-2' }] }, 'tracker')).toBe('tracker-3');
  });

  it('makes a new question of each kind', () => {
    expect(newTracker('scale', 'x', 'біль')).toEqual({ id: 'x', name: 'біль', hint: '', kind: 'scale', ask: ['morning'], min: 0, max: 10 });
    expect(newTracker('number', 'x', 'пульс')).toMatchObject({ units: [''] });
    expect(newTracker('numbers', 'x', 'тиск')).toMatchObject({ units: ['', ''] });
    expect(newTracker('note', 'x', 'нотатка')).not.toHaveProperty('units');
  });

  it('adds at the end, making a missing list', () => {
    expect(items(withAdded('trackers', { id: 'n' })(PROFILE), 'trackers').map((t) => t.id)).toEqual(['t1', 't2', 't3', 'n']);
    expect(withAdded('movement.kinds', { id: 'k' })({ movement: { kinds: 'зламано' } }).movement).toEqual({ kinds: [{ id: 'k' }] });
  });

  it('adds a new exercise to the catalogue and the list', () => {
    const warm = withNewExercise('morningWarmup.levels.1.items', 'n', 'нова')(PROFILE);
    expect(items(warm, 'morningWarmup.levels.1.items')).toEqual([{ exercise: 'n', reps: '' }]);
    expect(items(warm, 'exercises').at(-1)).toEqual({ id: 'n', name: 'нова', how: '', source: { type: 'user' } });
    const workout = withNewExercise('workout.sessions.1.items', 'n', 'нова')(PROFILE);
    expect(items(workout, 'workout.sessions.1.items')[1]).toEqual({ exercise: 'n', reps: '', sets: 3, fields: ['weight', 'reps'] });
  });

  it('moves inside a list, to its end, and to its own place', () => {
    expect(exercisesOf(withMoved({ list: S1, index: 0 }, { list: S1, before: 3 })(PROFILE), S1)).toEqual([['e2', 'e3'], 'e4', 'e1', 'e5']);
    expect(exercisesOf(withMoved({ list: S1, index: 0 }, { list: S1, before: null })(PROFILE), S1)).toEqual([['e2', 'e3'], 'e4', 'e5', 'e1']);
    expect(exercisesOf(withMoved({ list: S1, index: 2 }, { list: S1, before: 2 })(PROFILE), S1)).toEqual(['e1', ['e2', 'e3'], 'e4', 'e5']);
    expect(exercisesOf(withMoved({ list: S1, index: 2 }, { list: S1, before: 3 })(PROFILE), S1)).toEqual(['e1', ['e2', 'e3'], 'e4', 'e5']);
  });

  it('moves to another workout, and out of a group, which then dissolves', () => {
    const moved = withMoved({ list: S1, index: 0 }, { list: 'workout.sessions.1.items', before: 0 })(PROFILE);
    expect(exercisesOf(moved, 'workout.sessions.1.items')).toEqual(['e1', 'e6']);
    const out = withMoved({ list: `${S1}.1.set`, index: 0 }, { list: S1, before: 0 })(PROFILE);
    expect(exercisesOf(out, S1)).toEqual(['e2', 'e1', 'e3', 'e4', 'e5']);
  });

  it('moves into a group and reorders inside it', () => {
    const into = withMoved({ list: S1, index: 2 }, { list: `${S1}.1.set`, before: 0 })(PROFILE);
    expect(exercisesOf(into, S1)).toEqual(['e1', ['e4', 'e2', 'e3'], 'e5']);
    const inside = withMoved({ list: `${S1}.1.set`, index: 1 }, { list: `${S1}.1.set`, before: 0 })(PROFILE);
    expect(exercisesOf(inside, S1)).toEqual(['e1', ['e3', 'e2'], 'e4', 'e5']);
  });

  it('takes an exercise out of its group, right after it', () => {
    expect(exercisesOf(withLeft({ list: `${S1}.1.set`, index: 0 })(PROFILE), S1)).toEqual(['e1', 'e3', 'e2', 'e4', 'e5']);
    const three = withMoved({ list: S1, index: 2 }, { list: `${S1}.1.set`, before: null })(PROFILE);
    expect(exercisesOf(withLeft({ list: `${S1}.1.set`, index: 0 })(three), S1)).toEqual(['e1', ['e3', 'e4'], 'e2', 'e5']);
  });

  it('removes an entry, dissolving a group of one, and keeps the exercise in the catalogue', () => {
    const removed = withRemoved({ list: `${S1}.1.set`, index: 1 })(PROFILE);
    expect(exercisesOf(removed, S1)).toEqual(['e1', 'e2', 'e4', 'e5']);
    expect(items(removed, 'exercises')).toHaveLength(2);
    expect(items(withRemoved({ list: 'trackers', index: 1 })(PROFILE), 'trackers').map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('drops a broken group with nothing left', () => {
    const odd = { workout: { sessions: [{ id: 's', items: [{ set: [item('e1')] }] }] } };
    expect(exercisesOf(withRemoved({ list: 'workout.sessions.0.items.0.set', index: 0 })(odd), 'workout.sessions.0.items')).toEqual([]);
  });

  it('groups two exercises, adds to a group, refuses a full one', () => {
    const pair = joinGroup(PROFILE, { list: S1, index: 3 }, { list: S1, index: 0 });
    expect(pair.result).toBe('ok');
    expect(exercisesOf(pair.profile, S1)).toEqual([['e1', 'e5'], ['e2', 'e3'], 'e4']);
    const third = joinGroup(PROFILE, { list: S1, index: 0 }, { list: `${S1}.1.set`, index: 1 });
    expect(exercisesOf(third.profile, S1)).toEqual([['e2', 'e3', 'e1'], 'e4', 'e5']);
    const full = joinGroup(third.profile, { list: S1, index: 1 }, { list: S1, index: 0 });
    expect(full).toEqual({ profile: third.profile, result: 'full' });
  });

  it('moves an exercise from one group into another, dissolving the old', () => {
    const two = joinGroup(PROFILE, { list: S1, index: 3 }, { list: S1, index: 2 }).profile;
    const moved = joinGroup(two, { list: `${S1}.1.set`, index: 0 }, { list: S1, index: 2 });
    expect(exercisesOf(moved.profile, S1)).toEqual(['e1', 'e3', ['e4', 'e5', 'e2']]);
  });

  it('makes a group from chosen exercises where the first was', () => {
    expect(exercisesOf(withGroup(S1, [3, 0])(PROFILE), S1)).toEqual([['e1', 'e5'], ['e2', 'e3'], 'e4']);
    expect(exercisesOf(withGroup(S1, [2, 3])(PROFILE), S1)).toEqual(['e1', ['e2', 'e3'], ['e4', 'e5']]);
  });
});
