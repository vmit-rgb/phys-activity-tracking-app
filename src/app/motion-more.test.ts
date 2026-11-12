import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayKey } from '../domain/dates';
import type { Diary } from '../domain/diary';
import { readDay } from '../domain/day';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, diaryStore, sectionMemory } from '../storage/store';
import { fakeAnimate } from '../ui/test-animate';
import { mountToast } from '../ui/toast';
import { editText } from '../ui/dialog';
import { startApp } from './app';
import { fakeDevice } from './test-env';

// Stage 7c1 (MICROINTERACTIONS.md): the menu, search, the text overlay, export. Invented data only.
let host: HTMLElement;
let fake: ReturnType<typeof fakeAnimate>;
let device: ReturnType<typeof fakeDevice>['device'];
const vibrate = vi.fn();

function start(diary: Diary = EXAMPLE_DIARY): void {
  diaryStore(localStorage, () => new Date()).save(diary);
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  const phone = fakeDevice();
  device = phone.device;
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
    ...phone.env,
  });
}

const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
  .find((b) => (b.getAttribute('aria-label') ?? (b.querySelector('.accordion__title') ?? b).textContent!.trim()) === name)!;
const tap = (name: string) => button(name).click();
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  fake = fakeAnimate();
  vibrate.mockClear();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});
afterEach(() => {
  fake.restore();
  document.documentElement.removeAttribute('data-no-motion');
});

describe('the menu opens from ≡ and closes back into it', () => {
  it('grows as a circle from the button, the blocks flying in with a turn and a spring', () => {
    start();
    tap('меню');
    const menu = host.querySelector('.menu');
    const circle = fake.on(menu).find((run) => String(run.keyframes[0]?.clipPath).startsWith('circle(0px'));
    expect(circle?.options.duration).toBe(360);
    const blocks = [host.querySelector('.menu__top'), ...host.querySelector('.menu__content')!.children];
    const flights = blocks.map((block) => fake.on(block)[0]!);
    expect(flights.map((run) => run.options.delay)).toEqual(blocks.map((_, i) => i * 40));
    expect(flights.every((run) => /rotate\(-?[\d.]+deg\) scale\(\.6\)/.test(String(run.keyframes[0]!.transform)))).toBe(true);
    expect(flights[0]!.options.easing).toBe('cubic-bezier(.34,1.56,.64,1)');
  });

  it('doesn’t open again when it is drawn anew in place (a copy saved)', () => {
    start();
    tap('меню');
    fake.played.length = 0;
    tap('зберегти копію');
    expect(fake.on(host.querySelector('.menu'))).toEqual([]);
  });

  it('folds back into ✕, then home', () => {
    start();
    tap('меню');
    tap('закрити меню');
    const menu = host.querySelector<HTMLElement>('.menu')!;
    expect(menu.inert).toBe(true);
    const fold = fake.on(menu).find((run) => String(run.keyframes.at(-1)?.clipPath).startsWith('circle(0px'))!;
    expect(fold.options.duration).toBe(240);
    expect(device.depth()).toBe(1);
    fold.finish();
    expect(device.depth()).toBe(0);
  });

  it('closes at once without motion', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    start();
    tap('меню');
    tap('закрити меню');
    expect(fake.played).toEqual([]);
    expect(device.depth()).toBe(0);
  });
});

describe('export, copy for AI, a copy of the settings: the fill and a light vibration', () => {
  async function openBackup(): Promise<void> {
    start();
    tap('меню');
    tap('налаштування');
    await settle();
    tap('копія й експорт');
    await settle();
  }
  // while the label re-forms the button holds glyphs, so it is found by what it does
  const filled = (act: string) => fake.on(host.querySelector(`[data-act="${act}"]`)).some((run) => run.options.duration === 1200);

  it('fills «зберегти JSON» once the file is saved, and buzzes 18 ms', async () => {
    await openBackup();
    tap('зберегти JSON');
    expect(filled('export-json')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(18);
  });

  it('keeps still when the phone refuses the file: errors never animate', async () => {
    await openBackup();
    device.saveWorks = false;
    tap('зберегти JSON');
    expect(filled('export-json')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('fills «скопіювати для ШІ» once the text is on the clipboard', async () => {
    await openBackup();
    tap('скопіювати для ШІ');
    await vi.waitFor(() => expect(filled('export-ai')).toBe(true));
  });

  it('shows the spinner on «зберегти PDF» while the font loads', async () => {
    await openBackup();
    tap('зберегти PDF');
    const pdf = host.querySelector('[data-act="export-pdf"]')!;
    expect(pdf.getAttribute('aria-busy')).toBe('true');
    expect(pdf.querySelector('.spin')).not.toBeNull();
    await vi.waitFor(() => expect(device.saved).toHaveLength(1), { timeout: 5000 });
    await vi.waitFor(() => expect(pdf.textContent).toBe('зберегти PDF'), { timeout: 3000 });
    expect(filled('export-pdf')).toBe(true);
  });

  it('doesn’t buzz with «вимкнути вібровідгук»', async () => {
    const profile = { ...EXAMPLE_DIARY.profile, accessibility: { noVibration: true } };
    start({ ...EXAMPLE_DIARY, profile });
    tap('меню');
    tap('зберегти копію');
    expect(fake.on(host.querySelector('[data-menu="backup"]')).some((run) => run.options.duration === 1200)).toBe(true);
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('search in notes', () => {
  const at = (date: string, note: string) => [date, readDay({ note }, date as DayKey)] as const;
  const NOTES: Diary = { ...EXAMPLE_DIARY, days: Object.fromEntries([at('2026-11-08', 'коліно трохи болить'), at('2026-11-05', 'знову коліно')]) };

  it('opens from 🔍 as a circle and brings each result in from the left, one by one', () => {
    start(NOTES);
    tap('меню');
    tap('пошук у нотатках');
    const panel = document.querySelector('.search');
    expect(fake.on(panel).some((run) => String(run.keyframes[0]?.clipPath).startsWith('circle(0px'))).toBe(true);
    const input = document.querySelector<HTMLInputElement>('.search__input')!;
    input.value = 'коліно';
    input.dispatchEvent(new Event('input'));
    const hits = [...document.querySelectorAll('.search__hit')].map((hit) => fake.on(hit)[0]!);
    expect(hits).toHaveLength(2);
    expect(hits[0]!.keyframes).toEqual([{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }]);
    expect(hits.map((run) => run.options.delay)).toEqual([0, 40]);
  });
});

describe('the text overlay', () => {
  it('fills the screen gradually, gaining brightness (420 ms)', () => {
    document.body.innerHTML = '';
    void editText({ label: 'фраза', value: 'ok', maxLength: 40 });
    const run = fake.on(document.querySelector('.text-edit'))[0]!;
    expect(run.options.duration).toBe(420);
    expect(run.keyframes[0]).toMatchObject({ filter: 'brightness(.3)', clipPath: 'inset(30% 0 30% 0)' });
    expect(run.keyframes.at(-1)).toMatchObject({ filter: 'brightness(1)', clipPath: 'inset(0 0 0 0)' });
  });
});
