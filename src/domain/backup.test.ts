import { describe, expect, it } from 'vitest';
import type { DayKey } from './dates';
import { backupLine, copyFileName, needsBackup } from './backup';

const key = (text: string) => text as DayKey;
const TODAY = key('2026-11-20');

describe('backupLine (COPY.md, Menu)', () => {
  it('says there is no copy yet', () => {
    expect(backupLine(null, TODAY)).toBe('копії ще немає');
  });

  it('says today for a copy saved today', () => {
    expect(backupLine(TODAY, TODAY)).toBe('остання копія — сьогодні');
  });

  it.each([
    ['2026-11-19', 'остання копія — 1 день тому'],
    ['2026-11-17', 'остання копія — 3 дні тому'],
    ['2026-11-15', 'остання копія — 5 днів тому'],
    ['2026-11-09', 'остання копія — 11 днів тому'],
    ['2026-10-30', 'остання копія — 21 день тому'],
    ['2026-10-29', 'остання копія — 22 дні тому'],
  ])('counts the days since %s', (saved, line) => {
    expect(backupLine(key(saved), TODAY)).toBe(line);
  });

  it('reads a date after today (a phone clock moved back) as today', () => {
    expect(backupLine(key('2026-11-22'), TODAY)).toBe('остання копія — сьогодні');
  });
});

describe('needsBackup: the reminder every 3 days (Olesia, 2026-10-29)', () => {
  it('reminds when there are records and no copy', () => {
    expect(needsBackup(null, TODAY, true)).toBe(true);
  });

  it('stays quiet with no records and no copy', () => {
    expect(needsBackup(null, TODAY, false)).toBe(false);
  });

  it('reminds from the third day after the copy', () => {
    expect(needsBackup(key('2026-11-18'), TODAY, true)).toBe(false);
    expect(needsBackup(key('2026-11-17'), TODAY, true)).toBe(true);
  });
});

describe('copyFileName', () => {
  it('names the file as «бета 0.81» does, so both apps know it', () => {
    expect(copyFileName(TODAY)).toBe('trekr-kopiya-2026-11-20.json');
  });
});
