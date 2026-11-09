import { describe, expect, it } from 'vitest';
import { diaryAccent, isDayKey, parseDiary, serializeDiary, type Diary } from './diary';

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

describe('isDayKey', () => {
  it('accepts a real calendar date', () => {
    expect(isDayKey('2026-11-09')).toBe(true);
    expect(isDayKey('2028-02-29')).toBe(true);
  });
  it('refuses other text and impossible dates', () => {
    expect(isDayKey('2026-11-9')).toBe(false);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('x2026-11-09')).toBe(false);
    expect(isDayKey(20261109)).toBe(false);
  });
});

describe('parseDiary', () => {
  it('reads a copy saved by «бета 0.81»', () => {
    const diary = parseDiary(backup());
    expect(diary?.profile).toEqual(profile);
    expect(Object.keys(diary!.days)).toEqual(['2026-11-07']);
    expect(diary!.days['2026-11-07' as keyof Diary['days']]).toEqual({ v: 2, date: '2026-11-07', note: 'вправа 1' });
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
