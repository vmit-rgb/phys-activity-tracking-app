import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { readDay } from './day';
import type { Diary, JsonObject } from './diary';
import { EXAMPLE_DIARY } from './examples';
import { exercisesText, exportFile, pdfDocument, recordsText, type PdfLine } from './export';
import { readSettings } from './settings';

// Invented data only.
const TODAY = '2026-11-09' as DayKey;
const d = (key: string) => key as DayKey;
const DIARY: Diary = {
  ...EXAMPLE_DIARY,
  days: {
    [d('2026-11-07')]: readDay({ t: { morning: { energy: 4 } }, dw: ['back'] }, d('2026-11-07')),
    [d('2026-11-08')]: readDay({ note: 'перший рядок\nдругий', mw: { ticks: ['exercise-1'], times: { 'exercise-2': [30] } } }, d('2026-11-08')),
    [d('2026-11-09')]: readDay({}, d('2026-11-09')),
  },
};
const SETTINGS = readSettings(DIARY.profile);

describe('recordsText', () => {
  const text = recordsText(DIARY.days, SETTINGS, TODAY);

  it('starts with what it is and that values are not diagnoses', () => {
    expect(text.split('\n')[0]).toBe('Мій щоденник руху й самопочуття (експорт з трекера, 09.11.2026). Це записи, а не діагнози: не інтерпретуй значення як медичні.');
  });

  it('lists days with records, newest first, one line per block', () => {
    const days = text.split('\n\n').slice(1);
    expect(days).toHaveLength(2);
    expect(days[0]).toBe('нд, 08.11.2026\n  ранкова розминка: рівень 1 (вправа 1); рівень 2 (вправа 1)\n  нотатка: перший рядок / другий');
    expect(days[1]).toBe('сб, 07.11.2026\n  самопочуття зранку: енергія 4\n  денна розминка: для спини');
  });

  it('shows the times of timed exercises and units', () => {
    const timed = recordsText({
      [d('2026-11-08')]: readDay({ mw: { ticks: ['exercise-2'], times: { 'exercise-2': [30] } }, t: { morning: { pulse: 72 } } }, d('2026-11-08')),
    }, SETTINGS, TODAY);
    expect(timed).toContain('ранкова розминка: рівень 1 (вправа 2 30 с); рівень 2 (вправа 2 30 с)');
    expect(timed).toContain('самопочуття зранку: пульс 72 уд/хв');
  });
});

describe('exercisesText', () => {
  it('lists every section that is on with its exercises', () => {
    const text = exercisesText(SETTINGS, TODAY);
    expect(text).toContain('Мої вправи (з трекера, 09.11.2026):');
    expect(text).toContain('ранкова розминка\n  рівень 1 · 5 хв\n    • вправа 1 — 10\n      тут буде коротко, як її робити.');
    expect(text).toContain('    • вправа 2 — 30 с');
    expect(text).toContain('денна розминка — коли довго сидиш\n  для спини');
    expect(text).toContain('тренування — через день\n  тренування А\n    розімнися перед початком.\n    • вправа 6 — 3 × 10, 5 кг');
    expect(text).toContain('рух\n  • рух 1');
  });

  it('shows groups, links and names that are missing', () => {
    const profile: JsonObject = {
      morningWarmup: { enabled: true, levels: [{ id: 'l', name: '', items: [{ exercise: 'x', reps: '' }] }] },
      daytimeWarmup: { enabled: true, groups: [{ id: 'g', name: '', items: [{ exercise: 'z' }] }] },
      workout: { enabled: true, sessions: [{ id: 's', name: 'б', items: [{ set: [{ exercise: 'y', reps: '8' }] }] }] },
      movement: { enabled: true, hint: 'щодня', kinds: [{ id: 'm', name: '', source: { type: 'link', url: 'https://example.com/walk', by: 'user' } }] },
      exercises: [
        { id: 'y', name: 'тяга', how: '', source: { type: 'link', url: 'https://example.com/y', by: 'ai' } },
        { id: 'x', name: 'своя', how: '', source: { type: 'link', url: 'https://example.com/x', by: 'user' } },
      ],
    };
    const text = exercisesText(readSettings(profile), TODAY);
    expect(text).toContain('  рівень 1\n    • своя\n      посилання: https://example.com/x');
    expect(text).toContain('денна розминка\n  без назви\n    • вправа');
    expect(text).toContain('    група вправ:\n      • тяга — 8\n        посилання (від ШІ, перевір): https://example.com/y');
    expect(text).toContain('рух — щодня\n  • без назви — https://example.com/walk');
  });

  it('leaves out sections that are off', () => {
    expect(exercisesText(readSettings({}), TODAY)).toBe('Мої вправи (з трекера, 09.11.2026):');
  });
});

describe('exportFile', () => {
  const now = new Date('2026-11-09T08:00:00Z');

  it('saves the records as «бета 0.81» does', () => {
    const file = exportFile('records', DIARY, TODAY, now);
    expect(file.name).toBe('trekr-zapysy-2026-11-09.json');
    const data = JSON.parse(file.text);
    expect(data).toMatchObject({ format: 'phys-activity-log', version: 2, exported: '2026-11-09T08:00:00.000Z' });
    expect(data.exercises[0]).toEqual({ id: 'exercise-1', name: 'вправа 1' });
    expect(Object.keys(data.days)).toEqual(['2026-11-07', '2026-11-08']);
    expect(JSON.parse(exportFile('records', { profile: {}, days: {} }, TODAY, now).text).exercises).toEqual([]);
  });

  it('saves the exercises', () => {
    const file = exportFile('exercises', DIARY, TODAY, now);
    expect(file.name).toBe('trekr-vpravy-2026-11-09.json');
    const data = JSON.parse(file.text);
    expect(data).toMatchObject({ format: 'phys-activity-exercises', version: 1 });
    expect(data.workout).toEqual(EXAMPLE_DIARY.profile.workout);
    expect(data.trackers).toBeUndefined();
  });
});

describe('pdfDocument', () => {
  const FOOT = 'трекер · бета 0.9';
  const texts = (lines: readonly PdfLine[]) => lines.map((line) => line.text);

  it('lays out the records as «бета 0.81» did: title, days in bold, blocks indented, the app at the bottom', () => {
    const pdf = pdfDocument('records', DIARY.days, SETTINGS, TODAY, FOOT);
    expect(pdf.name).toBe('trekr-zapysy-2026-11-09.pdf');
    expect(pdf.lines.slice(0, 4)).toEqual([
      { text: 'щоденник руху й самопочуття', size: 16, bold: true, indent: 0 },
      { text: 'експорт пн, 09.11.2026 · це щоденник, а не медичний документ', size: 9, bold: false, indent: 0 },
      { text: '', size: 6, bold: false, indent: 0 },
      { text: 'нд, 08.11.2026', size: 12, bold: true, indent: 0 },
    ]);
    expect(pdf.lines[4]).toEqual({ text: 'ранкова розминка: рівень 1 (вправа 1); рівень 2 (вправа 1)', size: 9.5, bold: false, indent: 12 });
    expect(texts(pdf.lines)).toEqual([
      'щоденник руху й самопочуття', 'експорт пн, 09.11.2026 · це щоденник, а не медичний документ', '',
      'нд, 08.11.2026', 'ранкова розминка: рівень 1 (вправа 1); рівень 2 (вправа 1)', 'нотатка: перший рядок / другий', '',
      'сб, 07.11.2026', 'самопочуття зранку: енергія 4', 'денна розминка: для спини', '',
      '', 'трекер · бета 0.9',
    ]);
    expect(pdf.lines.at(-1)).toEqual({ text: FOOT, size: 8, bold: false, indent: 0 });
  });

  it('lays out the exercises by depth: sections large, levels and sessions bold, exercises indented', () => {
    const pdf = pdfDocument('exercises', DIARY.days, SETTINGS, TODAY, FOOT);
    expect(pdf.name).toBe('trekr-vpravy-2026-11-09.pdf');
    expect(pdf.lines.slice(0, 7)).toEqual([
      { text: 'мої вправи', size: 16, bold: true, indent: 0 },
      { text: 'експорт пн, 09.11.2026', size: 9, bold: false, indent: 0 },
      { text: '', size: 6, bold: false, indent: 0 },
      { text: 'ранкова розминка', size: 13, bold: true, indent: 0 },
      { text: 'рівень 1 · 5 хв', size: 9.5, bold: true, indent: 6 },
      { text: '• вправа 1 — 10', size: 9.5, bold: false, indent: 12 },
      { text: 'тут буде коротко, як її робити.', size: 9.5, bold: false, indent: 18 },
    ]);
    expect(texts(pdf.lines)).toContain('денна розминка — коли довго сидиш');
    expect(pdf.lines.find((l) => l.text === '• рух 1')).toEqual({ text: '• рух 1', size: 9.5, bold: false, indent: 6 });
    expect(texts(pdf.lines).at(-1)).toBe(FOOT);
  });

  it('has only the title and the app when there is nothing to show', () => {
    expect(texts(pdfDocument('exercises', {}, readSettings({}), TODAY, FOOT).lines))
      .toEqual(['мої вправи', 'експорт пн, 09.11.2026', '', '', FOOT]);
  });
});

describe('exportFile layout', () => {
  it('writes the JSON one key per line, as «бета 0.81» did', () => {
    const now = new Date('2026-11-09T08:00:00Z');
    expect(exportFile('records', DIARY, TODAY, now).text).toMatch(/^\{\n "format": "phys-activity-log",\n/);
    expect(exportFile('exercises', DIARY, TODAY, now).text).toMatch(/^\{\n "format": "phys-activity-exercises",\n/);
  });
});
