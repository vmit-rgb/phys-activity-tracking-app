import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { emptyDay, type Day, type MovementLog, type SetLog } from './day';
import {
  addLap, answer, dropSession, lapRows, markLevel, pickSession, rememberNames, removeLap, removeRound, removeSet,
  roundRows, setLap, setNote, setRound, setRows, setSet, showMoreRounds, showMoreSets, toggleChip, toggleTick,
} from './log';
import { readSettings } from './settings';

// Invented data only: nothing from a real log.
const DATE = '2026-11-11' as DayKey;
const day = (part: Partial<Day> = {}): Day => ({ ...emptyDay(DATE), ...part });
const set = (w: number | null, r: number | null = null, s: number | null = null): SetLog => ({ w, r, s });
const lap = (km: number | null, min: number | null = null): MovementLog => ({ km, min, steps: null });
const withWorkout = (ex: Record<string, SetLog[]> = {}, rows: Record<string, number> = {}) => day({ wo: { session: 'a', ex, rows } });

const settings = readSettings({
  morningWarmup: { enabled: true, levels: [{ id: 'l1', items: [{ exercise: 'a' }, { exercise: 'b' }] }] },
  exercises: [{ id: 'a', name: 'вправа а' }, { id: 'b', name: 'вправа б' }, { id: 'x', name: 'вправа х' }],
});
const level = settings.morningWarmup.levels[0]!;

describe('ticks and chips', () => {
  it('ticks an exercise and unticks it on the second tap', () => {
    const once = toggleTick('a')(day());
    expect(once.mw.ticks).toEqual(['a']);
    expect(toggleTick('a')(once).mw.ticks).toEqual([]);
  });

  it('marks a whole level and clears it again, keeping other ticks', () => {
    const marked = markLevel(level, true)(day({ mw: { ticks: ['z', 'a'], times: {}, rows: {} } }));
    expect(marked.mw.ticks).toEqual(['z', 'a', 'b']);
    expect(markLevel(level, false)(marked).mw.ticks).toEqual(['z']);
  });

  it('marks a daytime chip and unmarks it', () => {
    const once = toggleChip('back')(day());
    expect(once.dw).toEqual(['back']);
    expect(toggleChip('back')(once).dw).toEqual([]);
  });

  it('never changes the day it was given', () => {
    const before = day();
    toggleTick('a')(before);
    expect(before.mw.ticks).toEqual([]);
  });
});

describe('answers and the note', () => {
  it('stores an answer under its moment and removes it with null', () => {
    const answered = answer('morning', 'energy', 6)(day({ t: { morning: { pulse: 60 } } }));
    expect(answered.t).toEqual({ morning: { pulse: 60, energy: 6 } });
    expect(answer('morning', 'energy', null)(answered).t).toEqual({ morning: { pulse: 60 } });
  });

  it('sets the note', () => {
    expect(setNote('день як день')(day()).note).toBe('день як день');
  });
});

describe('workout', () => {
  it('picks a session with nothing logged and drops it again', () => {
    const picked = pickSession('b')(day());
    expect(picked.wo).toEqual({ session: 'b', ex: {}, rows: {} });
    expect(dropSession(picked).wo).toBeNull();
  });

  it('fills one field of a set, adding empty sets before it', () => {
    const logged = setSet('x', 2, 'r', 8)(withWorkout());
    expect(logged.wo!.ex.x).toEqual([set(null), set(null), set(null, 8)]);
    expect(setSet('x', 0, 'w', 5)(logged).wo!.ex.x![0]).toEqual(set(5));
  });

  it('does nothing to sets when no workout is picked', () => {
    expect(setSet('x', 0, 'r', 8)(day())).toEqual(day());
  });

  it('shows the planned sets until the person adds or removes a row', () => {
    expect(setRows(withWorkout(), 'x', 3)).toBe(3);
    expect(setRows(withWorkout(), 'x', null)).toBe(1);
    expect(setRows(withWorkout({ x: [set(1), set(2), set(3), set(4)] }), 'x', 3)).toBe(4);
    expect(setRows(withWorkout({}, { x: 2 }), 'x', 3)).toBe(2);
    expect(setRows(day(), 'x', 3)).toBe(3);
  });

  it('«додати підхід» shows one row more', () => {
    const more = showMoreSets('x', 3)(withWorkout());
    expect(more.wo!.rows).toEqual({ x: 4 });
    expect(showMoreSets('x', 3)(day())).toEqual(day());
  });

  it('removes a set and shows one row less, never fewer than one', () => {
    const removed = removeSet('x', 0, 3)(withWorkout({ x: [set(1), set(2)] }));
    expect(removed.wo!.ex.x).toEqual([set(2)]);
    expect(removed.wo!.rows.x).toBe(2);
    expect(removeSet('x', 0, 1)(withWorkout({ x: [set(1)] })).wo!.rows.x).toBe(1);
    expect(removeSet('x', 0, 1)(day())).toEqual(day());
  });

  it('removes an empty planned row that has nothing logged', () => {
    const removed = removeSet('x', 1, 2)(withWorkout());
    expect(removed.wo!.ex.x).toEqual([]);
    expect(removed.wo!.rows.x).toBe(1);
  });
});

describe('warm-up timer rounds', () => {
  it('saves the seconds of a round and clears them with null', () => {
    const saved = setRound('a', 1, 31)(day());
    expect(saved.mw.times.a).toEqual([null, 31]);
    expect(setRound('a', 1, null)(saved).mw.times.a).toEqual([null, null]);
  });

  it('«ще раз» shows one round more; at least one round shows', () => {
    expect(roundRows(day(), 'a')).toBe(1);
    const more = showMoreRounds('a')(day());
    expect(roundRows(more, 'a')).toBe(2);
    expect(roundRows(day({ mw: { ticks: [], times: { a: [1, 2, 3] }, rows: { a: 2 } } }), 'a')).toBe(3);
  });

  it('removes a round that was never timed', () => {
    const removed = removeRound('a', 1)(showMoreRounds('a')(day()));
    expect(removed.mw.times.a).toEqual([]);
    expect(roundRows(removed, 'a')).toBe(1);
  });

  it('removes a round and shows one less', () => {
    const removed = removeRound('a', 0)(day({ mw: { ticks: [], times: { a: [10, 20] }, rows: { a: 3 } } }));
    expect(removed.mw.times.a).toEqual([20]);
    expect(roundRows(removed, 'a')).toBe(2);
  });
});

describe('movement laps', () => {
  it('fills one field of a lap, adding empty laps before it', () => {
    const logged = setLap('walk', 1, 'km', 2)(day());
    expect(logged.mv.walk).toEqual([lap(null), lap(2)]);
    expect(setLap('walk', 0, 'min', 15)(logged).mv.walk![0]).toEqual(lap(null, 15));
  });

  it('«додати коло» adds an empty lap after the ones shown', () => {
    expect(lapRows(day(), 'walk')).toBe(1);
    const more = addLap('walk')(day());
    expect(more.mv.walk).toEqual([lap(null), lap(null)]);
    expect(lapRows(addLap('walk')(more), 'walk')).toBe(3);
  });

  it('removing a lap of a kind never logged changes nothing', () => {
    expect(removeLap('walk', 1)(day()).mv).toEqual({});
  });

  it('removes a lap; the kind goes when no lap is left', () => {
    const two = day({ mv: { walk: [lap(1), lap(2)] } });
    expect(removeLap('walk', 0)(two).mv.walk).toEqual([lap(2)]);
    expect(removeLap('walk', 0)(day({ mv: { walk: [lap(1)] } })).mv).toEqual({});
  });
});

describe('rememberNames', () => {
  it('keeps the names of the exercises used that day', () => {
    const logged = day({ mw: { ticks: ['a', 'gone'], times: {}, rows: {} }, wo: { session: 's', ex: { x: [] }, rows: {} } });
    expect(rememberNames(settings)(logged).names).toEqual({ a: 'вправа а', x: 'вправа х' });
  });

  it('keeps names it already has', () => {
    expect(rememberNames(settings)(day({ names: { old: 'стара' } })).names).toEqual({ old: 'стара' });
  });
});
