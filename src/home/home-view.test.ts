import { describe, expect, it } from 'vitest';
import type { DayKey } from '../domain/dates';
import { readSettings } from '../domain/settings';
import { EXAMPLE_DIARY } from '../domain/examples';
import { goalLine, heroFor, homeSections, phraseFor } from './home-view';

const key = (text: string) => text as DayKey;

describe('homeSections', () => {
  it('shows every section of the example settings in the fixed order', () => {
    expect(homeSections(readSettings(EXAMPLE_DIARY.profile)).map((section) => section.title)).toEqual([
      'самопочуття зранку', 'ранкова розминка', 'денна розминка', 'тренування', 'рух', 'самопочуття ввечері', 'нотатка',
    ]);
  });

  it('keeps only the note for empty settings', () => {
    expect(homeSections(readSettings({}))).toEqual([
      { id: 'note', title: 'нотатка', description: 'усе, що хочеш запамʼятати про цей день.' },
    ]);
  });

  it('shows a check-in only when a question is asked at that moment', () => {
    const settings = readSettings({ trackers: [{ id: 'e', ask: ['evening', 'afterWorkout'] }], workout: { enabled: true } });
    expect(homeSections(settings).map((section) => section.id)).toEqual(['wo', 'ck-evening', 'note']);
  });

  it('gives the sections with exercises the same reminder (Olesia, 2026-11-08)', () => {
    const settings = readSettings({ morningWarmup: { enabled: true }, daytimeWarmup: { enabled: true }, movement: { enabled: true }, trackers: [{ id: 'm', ask: ['morning'] }] });
    expect(homeSections(settings).map((section) => section.description)).toEqual([
      'відміть, як ти зараз. правильних відповідей тут немає.',
      'слухай тіло. якщо щось не так — зупинись <3',
      'слухай тіло. якщо щось не так — зупинись <3',
      'запиши, скільки вийшло.',
      'усе, що хочеш запамʼятати про цей день.',
    ]);
  });
});

describe('phraseFor', () => {
  const phrases = ['перша', 'друга', 'третя'];
  it('changes the phrase every day and comes back round', () => {
    expect(phraseFor(key('2026-01-01'), phrases)).toBe('перша');
    expect(phraseFor(key('2026-01-02'), phrases)).toBe('друга');
    expect(phraseFor(key('2026-01-03'), phrases)).toBe('третя');
    expect(phraseFor(key('2026-01-04'), phrases)).toBe('перша');
    expect(phraseFor(key('2025-12-31'), phrases)).toBe('друга');
  });
  it('is empty without phrases', () => {
    expect(phraseFor(key('2026-11-09'), [])).toBe('');
  });
});

describe('heroFor', () => {
  const settings = readSettings({ encouragement: ['ти тут — це вже половина справи :)'] });
  it('shows the phrase today', () => {
    expect(heroFor(key('2026-11-09'), key('2026-11-09'), settings)).toEqual({ kind: 'phrase', text: 'ти тут — це вже половина справи :)' });
  });
  it('says whose record a past day is', () => {
    expect(heroFor(key('2026-10-26'), key('2026-11-09'), settings)).toEqual({
      kind: 'past', text: 'це запис за пн, 26.10.2026.\nзміни збережуться в цей день.', bold: 'пн, 26.10.2026',
    });
  });
});

describe('goalLine', () => {
  it('reads «з N днів» with the right ending', () => {
    expect(goalLine({ done: 3, target: 6 })).toBe('цей тиждень: 3 з 6 днів');
    expect(goalLine({ done: 0, target: 1 })).toBe('цей тиждень: 0 з 1 дня');
    expect(goalLine({ done: 2, target: 2 })).toBe('цей тиждень: 2 з 2 днів');
  });
  it('is hidden without a goal', () => {
    expect(goalLine(null)).toBeNull();
  });
});
