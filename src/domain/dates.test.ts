import { describe, expect, it } from 'vitest';
import { addDays, dayKeyOf, formatLong, formatShort, isDayKey, mondayOf, type DayKey } from './dates';

const key = (text: string) => text as DayKey;

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

describe('dayKeyOf', () => {
  it('takes the date on the phone, not in Greenwich', () => {
    expect(dayKeyOf(new Date(2026, 10, 9, 0, 30))).toBe('2026-11-09');
    expect(dayKeyOf(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });
});

describe('addDays', () => {
  it('moves across months and years', () => {
    expect(addDays(key('2026-10-31'), 1)).toBe('2026-11-01');
    expect(addDays(key('2027-01-01'), -1)).toBe('2026-12-31');
    expect(addDays(key('2026-11-09'), 0)).toBe('2026-11-09');
  });
  it('keeps the day across the clock change', () => {
    expect(addDays(key('2026-10-24'), 1)).toBe('2026-10-25');
    expect(addDays(key('2026-10-25'), 1)).toBe('2026-10-26');
    expect(addDays(key('2026-03-29'), -1)).toBe('2026-03-28');
  });
});

describe('mondayOf', () => {
  it('starts the week on Monday', () => {
    expect(mondayOf(key('2026-11-09'))).toBe('2026-11-09'); // Monday
    expect(mondayOf(key('2026-11-15'))).toBe('2026-11-09'); // Sunday
    expect(mondayOf(key('2026-11-04'))).toBe('2026-11-02'); // Wednesday
  });
});

describe('dates on screen', () => {
  it('short: weekday and the date with dots', () => {
    expect(formatShort(key('2026-10-28'))).toBe('ср, 28.10.2026');
    expect(formatShort(key('2026-11-01'))).toBe('нд, 01.11.2026');
  });
  it('long: the weekday in full, for screen readers', () => {
    expect(formatLong(key('2026-10-30'))).toBe('пʼятниця, 30.10.2026');
  });
});
