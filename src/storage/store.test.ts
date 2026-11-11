import { beforeEach, describe, expect, it } from 'vitest';
import { parseDiary, serializeDiary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import type { DayKey } from '../domain/dates';
import { backupMemory, browserChoice, diaryStore, DIARY_KEY, sectionMemory, storageFor, themeMemory } from './store';

const now = () => new Date('2026-11-09T08:00:00.000Z');

describe('diaryStore', () => {
  beforeEach(() => localStorage.clear());

  it('has nothing on the first launch', () => {
    expect(diaryStore(localStorage, now).load()).toBeNull();
  });

  it('gives back what it saved', () => {
    const store = diaryStore(localStorage, now);
    store.save(EXAMPLE_DIARY);
    expect(diaryStore(localStorage, now).load()).toEqual(EXAMPLE_DIARY);
  });

  it('keeps the diary as a copy that «бета 0.81» can restore', () => {
    diaryStore(localStorage, now).save(EXAMPLE_DIARY);
    expect(JSON.parse(localStorage.getItem(DIARY_KEY)!)).toMatchObject({ format: 'phys-activity-backup', version: 1 });
  });

  it('reads a broken entry as nothing, and keeps it aside before writing over it', () => {
    localStorage.setItem(DIARY_KEY, '{ broken');
    const store = diaryStore(localStorage, now);
    expect(store.load()).toBeNull();
    store.save(EXAMPLE_DIARY);
    expect(localStorage.getItem(`${DIARY_KEY}/unreadable`)).toBe('{ broken');
    expect(store.load()).toEqual(EXAMPLE_DIARY);
  });

  it('does not keep a readable entry aside', () => {
    localStorage.setItem(DIARY_KEY, serializeDiary(EXAMPLE_DIARY, now()));
    diaryStore(localStorage, now).save(EXAMPLE_DIARY);
    expect(localStorage.getItem(`${DIARY_KEY}/unreadable`)).toBeNull();
    expect(parseDiary(localStorage.getItem(DIARY_KEY)!)).toEqual(EXAMPLE_DIARY);
  });

  it('lets a full storage fail loudly, so the screen can say so', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    expect(() => diaryStore(full, now).save(EXAMPLE_DIARY)).toThrow('QuotaExceededError');
  });
});

describe('browserChoice («подивитися тут, без встановлення»)', () => {
  beforeEach(() => localStorage.clear());

  it('is off until the person picks it, then stays on', () => {
    expect(browserChoice(localStorage).chosen()).toBe(false);
    browserChoice(localStorage).choose();
    expect(browserChoice(localStorage).chosen()).toBe(true);
  });
});

describe('sectionMemory (closed home sections)', () => {
  beforeEach(() => localStorage.clear());

  it('keeps a section closed until it is opened, and remembers both (Olesia, 2026-11-11: closed by default)', () => {
    const memory = sectionMemory(localStorage);
    expect(memory.open('mw')).toBe(false);
    memory.remember('mw', true);
    expect(sectionMemory(localStorage).open('mw')).toBe(true);
    expect(sectionMemory(localStorage).open('wo')).toBe(false);
    memory.remember('mw', false);
    expect(sectionMemory(localStorage).open('mw')).toBe(false);
  });

  it('only forgets when the phone is full', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    expect(() => sectionMemory(full).remember('mw', false)).not.toThrow();
  });
});

describe('storageFor (Olesia, 2026-11-09: the app in a browser tab keeps nothing)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the diary on the phone only in the installed app', () => {
    expect(storageFor(true, { local: localStorage, session: sessionStorage })).toBe(localStorage);
  });

  it('keeps it in the tab otherwise, and never touches what the installed app keeps', () => {
    diaryStore(localStorage, now).save(EXAMPLE_DIARY);
    const tab = storageFor(false, { local: localStorage, session: sessionStorage });
    expect(diaryStore(tab, now).load()).toBeNull();
    diaryStore(tab, now).save({ ...EXAMPLE_DIARY, days: {} });
    expect(diaryStore(localStorage, now).load()).toEqual(EXAMPLE_DIARY);
  });
});

describe('remembered on this phone only: theme and the last copy', () => {
  beforeEach(() => localStorage.clear());
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };

  it('follows the phone until a theme is chosen, then keeps the choice', () => {
    expect(themeMemory(localStorage).chosen()).toBeNull();
    themeMemory(localStorage).choose('light');
    expect(themeMemory(localStorage).chosen()).toBe('light');
    themeMemory(localStorage).choose('dark');
    expect(themeMemory(localStorage).chosen()).toBe('dark');
  });

  it('ignores a theme it does not know', () => {
    localStorage.setItem('phys-activity-tracking-app/theme', 'sepia');
    expect(themeMemory(localStorage).chosen()).toBeNull();
  });

  it('remembers the day of the last copy', () => {
    expect(backupMemory(localStorage).last()).toBeNull();
    backupMemory(localStorage).remember('2026-11-20' as DayKey);
    expect(backupMemory(localStorage).last()).toBe('2026-11-20');
  });

  it('ignores a broken day', () => {
    localStorage.setItem('phys-activity-tracking-app/last-copy', 'yesterday');
    expect(backupMemory(localStorage).last()).toBeNull();
  });

  it('only forgets when the phone is full', () => {
    expect(() => themeMemory(full).choose('light')).not.toThrow();
    expect(() => backupMemory(full).remember('2026-11-20' as DayKey)).not.toThrow();
  });
});
