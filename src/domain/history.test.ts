import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { readDay, type Day } from './day';
import { formatLaps, formatSets, lastLaps, lastSets } from './history';

// Invented data only: nothing from a real log.
const key = (text: string) => text as DayKey;
const days: Record<DayKey, Day> = {
  [key('2026-11-02')]: readDay({ wo: { session: 'a', ex: { x: [{ w: 4, r: 10 }] } }, mv: { walk: { km: 2 } } }, key('2026-11-02')),
  [key('2026-11-05')]: readDay({ wo: { session: 'a', ex: { x: [{ w: 5, r: 10 }, {}, { w: 5, r: 8 }], y: [{}] } } }, key('2026-11-05')),
  [key('2026-11-07')]: readDay({ wo: { session: 'b', ex: { z: [{ r: 3 }] } }, mv: { walk: { km: 3, min: 40, more: [{ km: 1 }] } } }, key('2026-11-07')),
  [key('2026-11-09')]: readDay({ wo: { session: 'a', ex: { x: [{ w: 9, r: 9 }] } } }, key('2026-11-09')),
};

describe('lastSets', () => {
  it('finds the last earlier day that logged the exercise, keeping only filled sets', () => {
    expect(lastSets(days, key('2026-11-08'), 'x')).toEqual([{ w: 5, r: 10, s: null }, { w: 5, r: 8, s: null }]);
  });

  it('skips a day where the exercise has only empty sets', () => {
    expect(lastSets(days, key('2026-11-08'), 'y')).toBeNull();
  });

  it('looks only before the day shown', () => {
    expect(lastSets(days, key('2026-11-05'), 'x')).toEqual([{ w: 4, r: 10, s: null }]);
    expect(lastSets(days, key('2026-11-02'), 'x')).toBeNull();
  });
});

describe('lastLaps', () => {
  it('finds the last earlier day with this kind of movement', () => {
    expect(lastLaps(days, key('2026-11-09'), 'walk')).toEqual([{ km: 3, min: 40, steps: null }, { km: 1, min: null, steps: null }]);
    expect(lastLaps(days, key('2026-11-07'), 'walk')).toEqual([{ km: 2, min: null, steps: null }]);
    expect(lastLaps(days, key('2026-11-02'), 'walk')).toBeNull();
  });
});

describe('formatSets («минулого разу: 5 кг × 10, 8»)', () => {
  it.each<[string, Parameters<typeof formatSets>[0], string]>([
    ['weight and reps', [{ w: 5, r: 10, s: null }, { w: 5, r: 8, s: null }], '5 кг × 10, 5 кг × 8'],
    ['decimal weight', [{ w: 2.5, r: 12, s: null }], '2,5 кг × 12'],
    ['reps only', [{ w: null, r: 10, s: null }, { w: null, r: 8, s: null }], '10, 8'],
    ['seconds only', [{ w: null, r: null, s: 30 }], '30 с'],
    ['reps and seconds', [{ w: null, r: 5, s: 30 }], '5 × 30 с'],
  ])('%s', (_case, sets, text) => {
    expect(formatSets(sets)).toBe(text);
  });
});

describe('formatLaps («минулого разу: 3 км · 40 хв»)', () => {
  it('writes each lap with its units, laps after a comma', () => {
    expect(formatLaps([{ km: 3, min: 40, steps: null }, { km: 1.5, min: null, steps: 2000 }])).toBe('3 км · 40 хв, 1,5 км · 2000 кроків');
  });

  it('uses the right word for steps', () => {
    expect(formatLaps([{ km: null, min: null, steps: 1 }])).toBe('1 крок');
    expect(formatLaps([{ km: null, min: null, steps: 3 }])).toBe('3 кроки');
  });
});
