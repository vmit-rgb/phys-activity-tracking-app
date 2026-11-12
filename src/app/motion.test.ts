import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DayKey } from '../domain/dates';
import type { Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, diaryStore, sectionMemory } from '../storage/store';
import { fakeAnimate } from '../ui/test-animate';
import { mountToast } from '../ui/toast';
import { startApp } from './app';
import { fakeDevice } from './test-env';

// Invented data only.
let host: HTMLElement;
let fake: ReturnType<typeof fakeAnimate>;

function start(diary: Diary | null): void {
  if (diary) diaryStore(localStorage, () => new Date()).save(diary);
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  startApp({
    host,
    store: diaryStore(localStorage, () => new Date('2026-11-09T08:00:00Z')),
    browser: browserChoice(localStorage),
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    onDiary: () => {},
    today: () => '2026-11-09' as DayKey,
    sections: sectionMemory(localStorage),
    whenHidden: () => {},
    ...fakeDevice().env,
  });
}

const tap = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === name)!.click();
/** The screen came in: a fade and a rise of 12 px in 360 ms. */
const cameIn = () => fake.on(host.firstElementChild).some((run) =>
  run.options.duration === 360 && run.keyframes[0]?.transform === 'translateY(12px)' && run.keyframes[0]?.opacity === 0);

beforeEach(() => {
  localStorage.clear();
  fake = fakeAnimate();
});
afterEach(() => fake.restore());

describe('screens coming in (MICROINTERACTIONS.md «Інші екрани»)', () => {
  it('brings the first screen in', () => {
    start(null);
    expect(cameIn()).toBe(true);
  });

  it('brings a page over home in (the history)', () => {
    start(EXAMPLE_DIARY);
    tap('меню');
    tap('історія');
    expect(cameIn()).toBe(true);
  });

  it('keeps every screen still with «вимкнути всі анімації»', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    start(null);
    document.documentElement.removeAttribute('data-no-motion');
    expect(fake.played).toEqual([]);
  });
});
