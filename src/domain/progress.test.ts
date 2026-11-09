import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { emptyDay, type Day } from './day';
import { dayDone, kindDone, levelDone, weekGoal, weekSoFar } from './progress';
import { readSettings } from './settings';

// Invented data only: nothing from a real log.
const key = (text: string) => text as DayKey;
const DATE = key('2026-11-11'); // Wednesday

const settings = readSettings({
  goal: { enabled: true, days: 4, done: ['morningWarmup', 'workout', 'movement'] },
  morningWarmup: { enabled: true, levels: [
    { id: 'l1', items: [{ exercise: 'a' }, { exercise: 'b' }] },
    { id: 'l2', items: [] },
  ] },
  daytimeWarmup: { enabled: true, groups: [{ id: 'back' }] },
  workout: { enabled: true, sessions: [{ id: 's' }] },
  movement: { enabled: false, kinds: [{ id: 'walk' }] },
});

const day = (part: Partial<Day> = {}): Day => ({ ...emptyDay(DATE), ...part });
const ticks = (...ids: string[]): Day['mw'] => ({ ticks: ids, times: {}, rows: {} });
const workout = (w: number | null): Day['wo'] => ({ session: 's', ex: { x: [{ w, r: null, s: null }] }, rows: {} });

describe('levelDone', () => {
  const [level1, level2] = settings.morningWarmup.levels;
  it('needs every exercise of the level ticked', () => {
    expect(levelDone(day({ mw: ticks('a') }), level1!)).toBe(false);
    expect(levelDone(day({ mw: ticks('b', 'a', 'z') }), level1!)).toBe(true);
  });
  it('never counts an empty level', () => {
    expect(levelDone(day({ mw: ticks('a', 'b') }), level2!)).toBe(false);
  });
});

describe('kindDone', () => {
  it('morning warm-up: one full level', () => {
    expect(kindDone(day({ mw: ticks('a') }), 'morningWarmup', settings)).toBe(false);
    expect(kindDone(day({ mw: ticks('a', 'b') }), 'morningWarmup', settings)).toBe(true);
  });
  it('daytime warm-up: one chip', () => {
    expect(kindDone(day(), 'daytimeWarmup', settings)).toBe(false);
    expect(kindDone(day({ dw: ['back'] }), 'daytimeWarmup', settings)).toBe(true);
  });
  it('workout: a set with something in it, not just a picked session', () => {
    expect(kindDone(day({ wo: workout(null) }), 'workout', settings)).toBe(false);
    expect(kindDone(day({ wo: workout(5) }), 'workout', settings)).toBe(true);
    expect(kindDone(day({ wo: { session: 's', ex: { x: [{ w: null, r: null, s: 30 }] }, rows: {} } }), 'workout', settings)).toBe(true);
  });
  it('movement: any logged kind', () => {
    expect(kindDone(day(), 'movement', settings)).toBe(false);
    expect(kindDone(day({ mv: { walk: [{ km: null, min: 10, steps: null }] } }), 'movement', settings)).toBe(true);
    expect(kindDone(day({ mv: { walk: [{ km: null, min: null, steps: null }] } }), 'movement', settings)).toBe(false);
  });
});

describe('dayDone', () => {
  it('needs every goal kind that is switched on (movement is off here)', () => {
    expect(dayDone(day({ mw: ticks('a', 'b') }), settings)).toBe(false);
    expect(dayDone(day({ mw: ticks('a', 'b'), wo: workout(5) }), settings)).toBe(true);
  });
  it('is never done when the goal has no kind switched on', () => {
    const noKinds = readSettings({ goal: { done: ['movement'] }, movement: { enabled: false } });
    expect(dayDone(day({ mv: { walk: [{ km: 1, min: null, steps: null }] } }), noKinds)).toBe(false);
  });
});

describe('weekSoFar', () => {
  it('runs from Monday up to today', () => {
    expect(weekSoFar(DATE, DATE)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(weekSoFar(key('2026-11-03'), DATE)).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
  });
});

describe('weekGoal', () => {
  const done = day({ mw: ticks('a', 'b'), wo: workout(5) });
  const log: Record<string, Day> = { '2026-11-09': done, '2026-11-11': done, '2026-11-12': done };
  const dayAt = (k: DayKey) => log[k] ?? emptyDay(k);

  it('counts the done days of the week up to today', () => {
    expect(weekGoal(DATE, DATE, dayAt, settings)).toEqual({ done: 2, target: 4 });
    expect(weekGoal(key('2026-11-10'), DATE, dayAt, settings)).toEqual({ done: 2, target: 4 });
  });
  it('shows nothing when the goal is off or has no kind to count', () => {
    expect(weekGoal(DATE, DATE, dayAt, readSettings({ goal: { enabled: false, done: ['workout'] }, workout: { enabled: true } }))).toBeNull();
    expect(weekGoal(DATE, DATE, dayAt, readSettings({ goal: { done: [] } }))).toBeNull();
  });
});
