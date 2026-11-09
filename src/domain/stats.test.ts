import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { emptyDay, readDay, type Day } from './day';
import { readSettings } from './settings';
import {
  averages, beatsLine, bpm, dayMarks, lastSevenDays, monthCells, monthName, monthOf, shiftMonth, weekStats, type MonthKey,
} from './stats';

// Invented data only: nothing from a real log.
const key = (text: string) => text as DayKey;
const month = (text: string) => text as MonthKey;
const TODAY = key('2026-11-11'); // Wednesday

const settings = readSettings({
  morningWarmup: {
    enabled: true, weeklyTarget: 6,
    levels: [
      { id: 'l1', items: [{ exercise: 'a' }] },
      { id: 'l2', items: [{ exercise: 'a' }, { exercise: 'b' }] },
      { id: 'l3', items: [{ exercise: 'a' }, { exercise: 'b' }, { exercise: 'c' }] },
      { id: 'l4', items: [{ exercise: 'd' }] },
    ],
  },
  workout: { enabled: true, weeklyTarget: 2, sessions: [{ id: 'A' }] },
  movement: { enabled: true, weeklyTarget: 1, kinds: [{ id: 'walk' }] },
  trackers: [
    { id: 'pain', name: 'біль', kind: 'scale', ask: ['morning', 'evening'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'] },
  ],
});

const days: Record<string, Day> = {
  '2026-11-09': readDay({ mw: { ticks: ['a', 'b'] }, t: { morning: { pain: 3, pulse: 70 } } }, key('2026-11-09')),
  '2026-11-10': readDay({ wo: { session: 'A', ex: { x: [{ w: 5 }] } }, mv: { walk: { km: 2 } }, t: { morning: { pain: 4 }, evening: { pain: 1 } } }, key('2026-11-10')),
  '2026-11-11': readDay({ mw: { ticks: ['a'] }, wo: { session: 'A', ex: {} } }, key('2026-11-11')),
  '2026-11-02': readDay({ t: { morning: { pain: 10 } } }, key('2026-11-02')),
};
const dayAt = (at: DayKey) => days[at] ?? emptyDay(at);

describe('weekStats', () => {
  it('counts each switched-on kind on its own, Monday to today', () => {
    expect(weekStats(TODAY, TODAY, dayAt, settings)).toEqual([
      { kind: 'morningWarmup', label: 'розминка', done: 2, target: 6 },
      { kind: 'workout', label: 'тренування', done: 1, target: 2 },
      { kind: 'movement', label: 'рух', done: 1, target: 1 },
    ]);
  });

  it('counts the week of a past day the same way', () => {
    expect(weekStats(key('2026-11-05'), TODAY, dayAt, settings).map((stat) => stat.done)).toEqual([0, 0, 0]);
  });

  it('names both warm-ups when both are switched on', () => {
    const both = readSettings({ morningWarmup: { enabled: true }, daytimeWarmup: { enabled: true } });
    expect(weekStats(TODAY, TODAY, dayAt, both).map((stat) => stat.label)).toEqual(['ранкова розминка', 'денна розминка']);
  });

  it('has no cards without activities', () => {
    expect(weekStats(TODAY, TODAY, dayAt, readSettings({}))).toEqual([]);
  });
});

describe('lastSevenDays', () => {
  it('ends on the day shown', () => {
    expect(lastSevenDays(TODAY, TODAY)).toEqual(['2026-11-11', '2026-11-10', '2026-11-09', '2026-11-08', '2026-11-07', '2026-11-06', '2026-11-05']);
  });
});

describe('averages', () => {
  it('averages every slider at every moment it is asked, one decimal', () => {
    expect(averages(lastSevenDays(TODAY, TODAY), dayAt, settings)).toEqual([
      { label: 'біль · зранку', value: 3.5 },
      { label: 'біль · ввечері', value: 1 },
    ]);
  });

  it('rounds to one decimal', () => {
    const three: Record<string, Day> = { ...days, '2026-11-11':readDay({ t: { morning: { pain: 4 } } }, key('2026-11-11')) };
    expect(averages(lastSevenDays(TODAY, TODAY), (at) => three[at] ?? emptyDay(at), settings)[0]).toEqual({ label: 'біль · зранку', value: 3.7 });
  });

  it('leaves out a slider with no answers', () => {
    expect(averages([key('2026-11-11')], dayAt, settings)).toEqual([]);
  });

  it('names a slider without a name', () => {
    const nameless = readSettings({ trackers: [{ id: 'pain', kind: 'scale', ask: ['morning'] }] });
    expect(averages([key('2026-11-09')], dayAt, nameless)).toEqual([{ label: 'без назви · зранку', value: 3 }]);
  });
});

describe('dayMarks', () => {
  it('shows the highest level done, up to 3, and the workout and movement markers', () => {
    expect(dayMarks(dayAt(key('2026-11-09')), settings)).toEqual({ level: 2, workout: false, movement: false });
    expect(dayMarks(dayAt(key('2026-11-10')), settings)).toEqual({ level: 0, workout: true, movement: true });
    const all = readDay({ mw: { ticks: ['a', 'b', 'c', 'd'] } }, TODAY);
    expect(dayMarks(all, settings).level).toBe(3);
  });

  it('marks a workout only when a set has something in it', () => {
    expect(dayMarks(dayAt(TODAY), settings).workout).toBe(false);
  });
});

describe('months', () => {
  it('takes the month of a day and moves by months across years', () => {
    expect(monthOf(TODAY)).toBe('2026-11');
    expect(shiftMonth(month('2026-12'), 1)).toBe('2027-01');
    expect(shiftMonth(month('2026-01'), -1)).toBe('2025-12');
  });

  it('fills whole weeks, Monday first, marking the days of other months', () => {
    const cells = monthCells(month('2026-11'));
    expect(cells).toHaveLength(42);
    expect(cells[0]).toEqual({ key: '2026-10-26', inMonth: false });
    expect(cells[6]).toEqual({ key: '2026-11-01', inMonth: true });
    expect(cells.at(-1)).toEqual({ key: '2026-12-06', inMonth: false });
    expect(monthCells(month('2026-02'))).toHaveLength(35);
  });

  it('names the month, with the year when it is not this year', () => {
    expect(monthName(month('2026-11'), TODAY)).toBe('листопад');
    expect(monthName(month('2025-12'), TODAY)).toBe('грудень 2025');
  });
});

describe('pulse timer', () => {
  it('turns beats into beats per minute', () => {
    expect(bpm(42, 30)).toBe(84);
    expect(bpm(18, 15)).toBe(72);
    expect(bpm(71, 60)).toBe(71);
  });

  it('says how it counted (COPY.md)', () => {
    expect(beatsLine(42, 30)).toBe('42 удари за 30 с × 2');
    expect(beatsLine(21, 15)).toBe('21 удар за 15 с × 4');
    expect(beatsLine(15, 15)).toBe('15 ударів за 15 с × 4');
    expect(beatsLine(71, 60)).toBe('71 удар за 60 с');
  });
});
