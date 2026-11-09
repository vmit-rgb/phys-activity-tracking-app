import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { emptyDay, readDay } from './day';
import { diaryAccent, parseDiary, serializeDiary } from './diary';

// Invented data only: nothing from a real log.
const profile = { format: 'phys-activity-profile', version: 1, theme: { accent: 'blue' }, exercises: [] };
const backup = (extra: object = {}) => JSON.stringify({
  format: 'phys-activity-backup',
  version: 1,
  savedAt: '2026-11-08T10:00:00.000Z',
  app: 'бета 0.81',
  profile,
  days: { '2026-11-07': { v: 2, date: '2026-11-07', note: 'вправа 1' } },
  ...extra,
});

describe('parseDiary', () => {
  it('reads a copy saved by «бета 0.81»', () => {
    const diary = parseDiary(backup());
    expect(diary?.profile).toEqual(profile);
    expect(Object.keys(diary!.days)).toEqual(['2026-11-07']);
    const date = '2026-11-07' as DayKey;
    expect(diary!.days[date]).toEqual({ ...emptyDay(date), note: 'вправа 1' });
  });

  it('keeps only days with a real date and an object inside', () => {
    const diary = parseDiary(backup({ days: { '2026-11-07': {}, 'нотатки': {}, '2026-11-08': 'текст', '2026-11-09': null } }));
    expect(Object.keys(diary!.days)).toEqual(['2026-11-07']);
  });

  it('accepts a copy with no days yet', () => {
    expect(parseDiary(backup({ days: {} }))?.days).toEqual({});
  });

  it.each([
    ['not JSON', 'привіт'],
    ['JSON that is not an object', '[1, 2]'],
    ['another format', backup({ format: 'phys-activity-log' })],
    ['a newer version', backup({ version: 2 })],
    ['no settings', backup({ profile: null })],
    ['settings that are not an object', backup({ profile: ['a'] })],
    ['days that are not an object', backup({ days: [] })],
    ['the settings alone, pasted from an AI', JSON.stringify(profile)],
  ])('refuses %s', (_case, text) => {
    expect(parseDiary(text)).toBeNull();
  });
});

describe('serializeDiary', () => {
  it('writes what parseDiary reads back', () => {
    const diary = parseDiary(backup())!;
    const text = serializeDiary(diary, new Date('2026-11-09T08:00:00.000Z'));
    expect(parseDiary(text)).toEqual(diary);
    expect(JSON.parse(text)).toMatchObject({ format: 'phys-activity-backup', version: 1, savedAt: '2026-11-09T08:00:00.000Z', app: 'бета 0.9' });
  });

  it('writes days in the «бета 0.81» shape and leaves empty days out', () => {
    const full = '2026-11-07' as DayKey;
    const empty = '2026-11-08' as DayKey;
    const diary = { profile, days: { [full]: readDay({ note: 'ок' }, full), [empty]: emptyDay(empty) } };
    const days = JSON.parse(serializeDiary(diary, new Date())).days;
    expect(Object.keys(days)).toEqual([full]);
    expect(days[full]).toEqual({ v: 2, date: full, t: {}, note: 'ок', mw: { ticks: [], times: {}, rows: {} }, dw: [], wo: null, mv: {}, names: {} });
  });
});

describe('diaryAccent', () => {
  it('takes the accent from the settings', () => {
    expect(diaryAccent(parseDiary(backup())!)).toBe('blue');
  });
  it('moves a removed accent to the nearest one', () => {
    expect(diaryAccent(parseDiary(backup({ profile: { theme: { accent: 'red' } } }))!)).toBe('orange');
  });
  it('uses the default when there is no accent', () => {
    expect(diaryAccent(parseDiary(backup({ profile: {} }))!)).toBe('pink');
    expect(diaryAccent(parseDiary(backup({ profile: { theme: 'blue' } }))!)).toBe('pink');
  });
});
