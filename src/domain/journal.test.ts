import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { emptyDay, readDay, type Day } from './day';
import {
  dayBlocks, dayMeta, exerciseName, formatSetRuns, monthDays, monthSummary, searchNotes, sessionName,
} from './journal';
import { readSettings } from './settings';
import type { MonthKey } from './stats';

// Invented data only: nothing from a real log.
const key = (text: string) => text as DayKey;
const month = (text: string) => text as MonthKey;
const TODAY = key('2026-11-11');

const settings = readSettings({
  morningWarmup: {
    enabled: true, weeklyTarget: 6,
    levels: [
      { id: 'l1', name: 'легкий', items: [{ exercise: 'a' }] },
      { id: 'l2', name: '', items: [{ exercise: 'a' }, { exercise: 'b' }] },
    ],
  },
  daytimeWarmup: { enabled: true, groups: [{ id: 'back', name: 'для спини' }, { id: 'nameless', name: '' }] },
  workout: { enabled: true, weeklyTarget: 2, sessions: [{ id: 'A', name: 'а' }, { id: 'B', name: 'тренування на ноги' }] },
  movement: { enabled: true, weeklyTarget: 1, kinds: [{ id: 'walk', name: 'прогулянка' }] },
  exercises: [{ id: 'a', name: 'вправа а' }, { id: 'b', name: 'вправа б' }, { id: 'x', name: 'присід' }, { id: 'blank', name: '' }],
  trackers: [
    { id: 'pain', name: 'біль', kind: 'scale', ask: ['morning', 'evening'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'] },
    { id: 'bp', name: 'тиск', kind: 'numbers', units: ['мм рт. ст.', 'мм рт. ст.'], ask: ['morning'] },
    { id: 'dizzy', name: 'паморочилось?', kind: 'yesno', ask: ['afterWorkout'] },
    { id: 'how', name: 'як пройшло', kind: 'note', ask: ['afterWorkout'] },
    { id: 'pair', name: 'пара', kind: 'numbers', units: ['кг', 'см'], ask: ['evening'] },
  ],
});

const day = (date: string, raw: object): Day => readDay(raw, key(date));

describe('exerciseName', () => {
  it('takes the name from the settings', () => {
    expect(exerciseName(settings, [], 'a')).toBe('вправа а');
    expect(exerciseName(settings, [], 'blank')).toBe('вправа без назви');
  });

  it('falls back to a name kept with any day, then says it is gone', () => {
    const kept = day('2026-11-01', { names: { gone: 'стара вправа' } });
    expect(exerciseName(settings, [emptyDay(TODAY), kept], 'gone')).toBe('стара вправа');
    expect(exerciseName(settings, [kept], 'other')).toBe('вправа, якої вже немає');
  });
});

describe('sessionName', () => {
  it('adds «тренування» and capitals unless the name starts with it', () => {
    expect(sessionName('а')).toBe('тренування А');
    expect(sessionName('Тренування на ноги')).toBe('Тренування на ноги');
  });
});

describe('formatSetRuns («3 × 12 повт. · 10 кг», COPY.md History)', () => {
  it('counts the same sets in a row once', () => {
    const set = { w: 10, r: 12, s: null };
    expect(formatSetRuns([set, set, set])).toBe('3 × 12 повт. · 10 кг');
    expect(formatSetRuns([{ w: null, r: null, s: 45 }, { w: null, r: null, s: 45 }])).toBe('2 × 45 с');
  });

  it('lists different sets one by one, a single set without «1 ×»', () => {
    expect(formatSetRuns([{ w: 10, r: 12, s: null }, { w: 10, r: 12, s: null }, { w: 12.5, r: 8, s: null }]))
      .toBe('2 × 12 повт. · 10 кг, 8 повт. · 12,5 кг');
    expect(formatSetRuns([{ w: null, r: 5, s: 30 }])).toBe('5 повт. · 30 с');
  });

  it('counts each run after the first on its own', () => {
    const a = { w: null, r: 5, s: null };
    const b = { w: null, r: 8, s: null };
    expect(formatSetRuns([a, b, b])).toBe('5 повт., 2 × 8 повт.');
    expect(formatSetRuns([a, a, b, b, b, a])).toBe('2 × 5 повт., 3 × 8 повт., 5 повт.');
  });
});

describe('dayMeta (the line under the date, as «бета 0.81» wrote it)', () => {
  it('names what the day holds', () => {
    const full = day('2026-11-10', {
      mw: { ticks: ['a', 'b'] }, dw: ['back'], wo: { session: 'A', ex: { x: [{ w: 5, r: 10 }] } },
      mv: { walk: { min: 20 } }, note: 'текст',
    });
    expect(dayMeta(full, settings)).toBe('розминка: рівень 2 · денна розминка · тренування · рух · нотатка');
  });

  it('says «частково» for ticks without a whole level', () => {
    expect(dayMeta(day('2026-11-10', { mw: { ticks: ['b'] } }), settings)).toBe('розминка: частково');
  });

  it('leaves the warm-up out when it is switched off', () => {
    const off = readSettings({ morningWarmup: { enabled: false, levels: [{ id: 'l1', items: [{ exercise: 'a' }] }] } });
    expect(dayMeta(day('2026-11-10', { mw: { ticks: ['a'] }, note: 'x' }), off)).toBe('нотатка');
  });

  it('says «самопочуття» when only questions were answered', () => {
    expect(dayMeta(day('2026-11-10', { t: { morning: { pain: 2 } } }), settings)).toBe('самопочуття');
  });

  it('says nothing for a day with only stopwatch times', () => {
    expect(dayMeta(day('2026-11-10', { mw: { times: { a: [30] } } }), settings)).toBe('');
  });

  it('does not count a picked workout without sets', () => {
    expect(dayMeta(day('2026-11-10', { wo: { session: 'A', ex: {} }, note: 'x' }), settings)).toBe('нотатка');
  });
});

describe('dayBlocks (Figma history/day-card, expanded)', () => {
  it('puts the blocks in the order of the day', () => {
    const full = day('2026-11-10', {
      t: {
        morning: { pain: 3, pulse: 72, bp: [118, 76] },
        afterWorkout: { dizzy: 'no', how: 'нормально' },
        evening: { pain: 1, pair: [60, null] },
      },
      mw: { ticks: ['a', 'b', 'gone'], times: { a: [45, null, 40] } },
      dw: ['back', 'nameless', 'removed'],
      wo: { session: 'A', ex: { x: [{ w: 10, r: 12 }, { w: 10, r: 12 }], blank: [{}] } },
      mv: { walk: { km: 3, min: 40 }, gone: { min: 5 } },
      note: 'день як день',
      names: { gone: 'стара вправа' },
    });
    expect(dayBlocks(full, {}, settings)).toEqual([
      { kind: 'values', title: 'самопочуття зранку', rows: [
        { label: 'біль', value: '3', unit: '', text: false },
        { label: 'пульс', value: '72', unit: 'уд/хв', text: false },
        { label: 'тиск', value: '118/76', unit: 'мм рт. ст.', text: false },
      ] },
      { kind: 'checklist', title: 'ранкова розминка', groups: [
        { title: 'легкий · готово', items: [{ name: 'вправа а', times: '45 с, 40 с' }] },
        { title: 'рівень 2 · готово', items: [{ name: 'вправа а', times: '45 с, 40 с' }, { name: 'вправа б', times: '' }] },
        { title: 'інші вправи', items: [{ name: 'стара вправа', times: '' }] },
      ] },
      { kind: 'text', title: 'денна розминка', text: 'для спини, без назви, зона, якої вже немає' },
      { kind: 'values', title: 'тренування А', rows: [{ label: 'присід', value: '2 × 12 повт. · 10 кг', unit: '', text: false }] },
      { kind: 'values', title: 'самопочуття після тренування', rows: [
        { label: 'паморочилось?', value: 'ні', unit: '', text: false },
        { label: 'як пройшло', value: 'нормально', unit: '', text: true },
      ] },
      { kind: 'values', title: 'рух', rows: [
        { label: 'прогулянка', value: '3 км · 40 хв', unit: '', text: false },
        { label: 'рух, якого вже немає', value: '5 хв', unit: '', text: false },
      ] },
      { kind: 'values', title: 'самопочуття ввечері', rows: [
        { label: 'біль', value: '1', unit: '', text: false },
        { label: 'пара', value: '60/—', unit: 'кг/см', text: false },
      ] },
      { kind: 'text', title: 'нотатка', text: 'день як день' },
    ]);
  });

  it('keeps answers to questions that are gone, and says so', () => {
    const answers = day('2026-11-10', { t: { morning: { old: 4, oldText: 'так собі', yes: 'yes' } } });
    expect(dayBlocks(answers, {}, settings)).toEqual([{ kind: 'values', title: 'самопочуття зранку', rows: [
      { label: 'питання, якого вже немає', value: '4', unit: '', text: false },
      { label: 'питання, якого вже немає', value: 'так собі', unit: '', text: true },
      { label: 'питання, якого вже немає', value: 'yes', unit: '', text: true },
    ] }]);
  });

  it('says «так» and «без назви» where the settings have no name', () => {
    const named = readSettings({
      movement: { enabled: true, kinds: [{ id: 'run', name: '' }] },
      trackers: [{ id: 'q', name: '', kind: 'yesno', ask: ['evening'] }],
    });
    expect(dayBlocks(day('2026-11-10', { t: { evening: { q: 'yes' } }, mv: { run: { km: 2 } } }), {}, named)).toEqual([
      { kind: 'values', title: 'рух', rows: [{ label: 'без назви', value: '2 км', unit: '', text: false }] },
      { kind: 'values', title: 'самопочуття ввечері', rows: [{ label: 'без назви', value: 'так', unit: '', text: false }] },
    ]);
  });

  it('names a workout that is gone «тренування» and skips one without sets', () => {
    expect(dayBlocks(day('2026-11-10', { wo: { session: 'gone', ex: { x: [{ r: 5 }] } } }), {}, settings)[0]!.title).toBe('тренування');
    expect(dayBlocks(day('2026-11-10', { wo: { session: 'A', ex: {} } }), {}, settings)).toEqual([]);
  });

  it('shows timed rounds of an exercise only when it is ticked', () => {
    expect(dayBlocks(day('2026-11-10', { mw: { times: { a: [30] } } }), {}, settings)).toEqual([]);
  });

  it('finds the name of a deleted exercise on another day', () => {
    const days = { [key('2026-11-01')]: day('2026-11-01', { names: { gone: 'стара вправа' } }) };
    const blocks = dayBlocks(day('2026-11-10', { wo: { session: 'B', ex: { gone: [{ r: 5 }] } } }), days, settings);
    expect(blocks).toEqual([{ kind: 'values', title: 'тренування на ноги', rows: [{ label: 'стара вправа', value: '5 повт.', unit: '', text: false }] }]);
  });
});

describe('monthDays', () => {
  it('lists the days of the month with records up to today, newest first', () => {
    const days = {
      [key('2026-11-02')]: day('2026-11-02', { note: 'a' }),
      [key('2026-11-09')]: day('2026-11-09', { note: 'b' }),
      [key('2026-11-05')]: emptyDay(key('2026-11-05')),
      [key('2026-10-31')]: day('2026-10-31', { note: 'c' }),
      [key('2026-11-12')]: day('2026-11-12', { note: 'd' }),
      [TODAY]: day(TODAY, { note: 'e' }),
    };
    expect(monthDays(days, month('2026-11'), TODAY)).toEqual(['2026-11-11', '2026-11-09', '2026-11-02']);
  });
});

describe('monthSummary («жовтень: 18 днів з розминкою, 6 тренувань»)', () => {
  const days = [
    day('2026-11-02', { mw: { ticks: ['a'] }, wo: { session: 'A', ex: { x: [{ r: 1 }] } } }),
    day('2026-11-03', { mw: { ticks: ['a', 'b'] } }),
    day('2026-11-04', { mw: { ticks: ['b'] }, note: 'x' }),
  ];

  it('counts warm-up days and workouts of the month', () => {
    expect(monthSummary(month('2026-11'), TODAY, days, settings)).toBe('листопад: 2 дні з розминкою, 1 тренування');
    expect(monthSummary(month('2025-11'), TODAY, [], settings)).toBe('листопад 2025: 0 днів з розминкою, 0 тренувань');
  });

  it('counts today, but no other month and no day after today', () => {
    const around = [
      day('2026-11-11', { mw: { ticks: ['a'] } }),
      day('2026-11-12', { mw: { ticks: ['a'] } }),
      day('2026-10-31', { mw: { ticks: ['a'] } }),
    ];
    expect(monthSummary(month('2026-11'), TODAY, around, settings)).toBe('листопад: 1 день з розминкою, 0 тренувань');
  });

  it('names only the kinds that are switched on', () => {
    const noWorkout = readSettings({ morningWarmup: { enabled: true, levels: [{ id: 'l1', items: [{ exercise: 'a' }] }] } });
    expect(monthSummary(month('2026-11'), TODAY, days, noWorkout)).toBe('листопад: 2 дні з розминкою');
    const workoutOnly = readSettings({ workout: { enabled: true, sessions: [{ id: 'A' }] } });
    expect(monthSummary(month('2026-11'), TODAY, days, workoutOnly)).toBe('листопад: 1 тренування');
    expect(monthSummary(month('2026-11'), TODAY, days, readSettings({}))).toBeNull();
  });

  it('uses the plural forms', () => {
    const five = Array.from({ length: 5 }, (_, i) => day(`2026-11-0${i + 1}`, { mw: { ticks: ['a'] } }));
    expect(monthSummary(month('2026-11'), TODAY, five.slice(0, 1), settings)).toBe('листопад: 1 день з розминкою, 0 тренувань');
    expect(monthSummary(month('2026-11'), TODAY, five, settings)).toBe('листопад: 5 днів з розминкою, 0 тренувань');
  });
});

describe('searchNotes (COPY.md Search)', () => {
  const days = {
    [key('2026-11-02')]: day('2026-11-02', { note: 'Коліно трохи болить після сходів' }),
    [key('2026-11-05')]: day('2026-11-05', {
      note: 'усе добре', t: { afterWorkout: { how: 'коліно в нормі', dizzy: 'no' }, morning: { gone: 'коліно' } },
    }),
    [key('2026-11-09')]: day('2026-11-09', { note: `${'а'.repeat(30)} коліно ${'б'.repeat(100)}` }),
  };

  it('finds the words in notes and note questions, newest first, without minding capitals', () => {
    const hits = searchNotes(days, settings, '  КОЛІНО ');
    expect(hits.map((hit) => hit.date)).toEqual(['2026-11-09', '2026-11-05', '2026-11-02']);
    expect(hits[1]).toEqual({ date: '2026-11-05', before: '', match: 'коліно', after: ' в нормі' });
    expect(hits[2]).toEqual({ date: '2026-11-02', before: '', match: 'Коліно', after: ' трохи болить після сходів' });
  });

  it('keeps 20 letters before the word and 80 after it', () => {
    const [hit] = searchNotes(days, settings, 'коліно');
    expect(hit!.before).toBe(`…${'а'.repeat(19)} `);
    expect(hit!.after).toBe(` ${'б'.repeat(79)}`);
  });

  it('marks a cut start even when one letter is cut', () => {
    const one = { [key('2026-11-01')]: day('2026-11-01', { note: `${'а'.repeat(21)}сон` }) };
    expect(searchNotes(one, settings, 'сон')[0]!.before).toBe(`…${'а'.repeat(20)}`);
    const none = { [key('2026-11-01')]: day('2026-11-01', { note: `${'а'.repeat(20)}сон` }) };
    expect(searchNotes(none, settings, 'сон')[0]!.before).toBe('а'.repeat(20));
  });

  it('does not look into answers that are not notes, nor into questions that are gone', () => {
    expect(searchNotes(days, settings, 'no')).toEqual([]);
  });

  it('finds nothing for an empty query', () => {
    expect(searchNotes(days, settings, '   ')).toEqual([]);
  });

  it('finds each matching text of a day once', () => {
    const twice = { [key('2026-11-03')]: day('2026-11-03', { note: 'сон, сон' }) };
    expect(searchNotes(twice, settings, 'сон')).toHaveLength(1);
  });
});
