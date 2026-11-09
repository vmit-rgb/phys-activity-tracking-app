import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { emptyDay, hasData, readDay, writeDay, type Day } from './day';

// Invented data only: nothing from a real log.
const DATE = '2026-11-07' as DayKey;

const stored = {
  v: 2,
  date: DATE,
  t: { morning: { energy: 6, hard: 'yes', pressure: [120, 80] }, evening: { note: 'вправа 1 пішла легко' } },
  note: 'день як день',
  mw: { ticks: ['exercise-1', 'exercise-2'], times: { 'exercise-2': [31.5, null] }, rows: { 'exercise-2': 2 } },
  dw: ['back'],
  wo: { session: 'a', ex: { 'exercise-5': [{ w: 5, r: 10, s: null }, { w: 5, r: 8, s: null }] }, rows: {} },
  mv: { walk: { km: 3.2, min: 40, steps: null } },
  names: { 'exercise-1': 'вправа 1' },
};

describe('readDay', () => {
  it('reads a day saved by «бета 0.81» as it is', () => {
    expect(readDay(stored, DATE)).toEqual({ ...stored, v: undefined });
  });

  it('gives an empty day for nothing or for something else', () => {
    expect(readDay(undefined, DATE)).toEqual(emptyDay(DATE));
    expect(readDay('текст', DATE)).toEqual(emptyDay(DATE));
    expect(readDay([], DATE)).toEqual(emptyDay(DATE));
  });

  it('takes the date from the key, not from inside', () => {
    expect(readDay({ ...stored, date: '1999-01-01' }, DATE).date).toBe(DATE);
  });

  it('drops broken parts and keeps the rest', () => {
    const day = readDay({
      t: { morning: { energy: '', hard: null, pressure: [null, ''], pulse: 'NaN-ish', weight: Number.NaN, mood: {} }, evening: 'ок' },
      note: 5,
      mw: { ticks: ['a', 3], times: { a: 'x', b: [1, 'x'] }, rows: { a: 'два' } },
      dw: 'back',
      wo: { session: '', ex: {} },
      mv: { walk: { km: 'три' }, run: null },
      names: { a: 'а', b: 2 },
    }, DATE);
    expect(day).toEqual({
      date: DATE,
      t: { morning: { pulse: 'NaN-ish' }, evening: {} },
      note: '',
      mw: { ticks: ['a'], times: { b: [1, null] }, rows: {} },
      dw: [],
      wo: null,
      mv: {},
      names: { a: 'а' },
    });
  });

  it('drops an exercise whose sets are not a list', () => {
    expect(readDay({ wo: { session: 'a', ex: { x: 'три', y: [{ r: 5 }] } } }, DATE).wo!.ex).toEqual({ y: [{ w: null, r: 5, s: null }] });
  });

  it('keeps a picked workout even before any set is logged', () => {
    expect(readDay({ wo: { session: 'b' } }, DATE).wo).toEqual({ session: 'b', ex: {}, rows: {} });
  });
});

describe('hasData', () => {
  const withPart = (part: Partial<Day>): Day => ({ ...emptyDay(DATE), ...part });

  it('is false for an empty day', () => {
    expect(hasData(emptyDay(DATE))).toBe(false);
    expect(hasData(withPart({ t: { morning: {} }, mw: { ticks: [], times: { a: [null] }, rows: { a: 3 } } }))).toBe(false);
  });

  it.each<[string, Partial<Day>]>([
    ['an answer', { t: { morning: { energy: 0 } } }],
    ['a timed round', { mw: { ticks: [], times: { a: [null, 12] }, rows: {} } }],
    ['a note', { note: '.' }],
    ['a ticked exercise', { mw: { ticks: ['a'], times: {}, rows: {} } }],
    ['a daytime chip', { dw: ['back'] }],
    ['a picked workout', { wo: { session: 'a', ex: {}, rows: {} } }],
    ['movement', { mv: { walk: { km: null, min: 5, steps: null } } }],
  ])('is true with %s', (_case, part) => {
    expect(hasData(withPart(part))).toBe(true);
  });
});

describe('writeDay', () => {
  it('stores nothing for an empty day', () => {
    expect(writeDay(emptyDay(DATE))).toBeNull();
  });

  it('writes the 0.81 shape back, so 0.81 can read it', () => {
    expect(writeDay(readDay(stored, DATE))).toEqual(stored);
  });

  it('leaves out empty moments and empty sets at the end', () => {
    const day: Day = {
      ...emptyDay(DATE),
      t: { morning: {}, evening: { note: 'ок' } },
      wo: { session: 'a', ex: {
        x: [{ w: 5, r: null, s: null }, { w: null, r: null, s: null }, { w: null, r: 3, s: null }, { w: null, r: null, s: null }],
        y: [{ w: null, r: null, s: null }],
      }, rows: { x: 4 } },
    };
    expect(writeDay(day)).toMatchObject({
      t: { evening: { note: 'ок' } },
      wo: { session: 'a', ex: { x: [{ w: 5, r: null, s: null }, { w: null, r: null, s: null }, { w: null, r: 3, s: null }] }, rows: { x: 4 } },
    });
  });
});
