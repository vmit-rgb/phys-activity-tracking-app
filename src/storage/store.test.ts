import { beforeEach, describe, expect, it } from 'vitest';
import { parseDiary, serializeDiary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, diaryStore, DIARY_KEY, sectionMemory } from './store';

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
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
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

  it('keeps a section open until it is closed, and remembers both', () => {
    const memory = sectionMemory(localStorage);
    expect(memory.open('mw')).toBe(true);
    memory.remember('mw', false);
    expect(sectionMemory(localStorage).open('mw')).toBe(false);
    expect(sectionMemory(localStorage).open('wo')).toBe(true);
    memory.remember('mw', true);
    expect(sectionMemory(localStorage).open('mw')).toBe(true);
  });

  it('only forgets when the phone is full', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => sectionMemory(full).remember('mw', false)).not.toThrow();
  });
});
