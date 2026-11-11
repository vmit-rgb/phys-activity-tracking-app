import { beforeEach, describe, expect, it } from 'vitest';
import type { DayKey } from '../domain/dates';
import { readDay } from '../domain/day';
import type { Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, diaryStore, sectionMemory } from '../storage/store';
import { mountToast } from '../ui/toast';
import { startApp } from './app';
import { fakeDevice } from './test-env';

// Invented data only.
const TODAY = '2026-11-09' as DayKey;
const at = (date: string, raw: object) => [date, readDay(raw, date as DayKey)] as const;
const DIARY: Diary = {
  ...EXAMPLE_DIARY,
  days: Object.fromEntries([
    at('2026-11-08', {
      note: 'коліно трохи болить', mw: { ticks: ['exercise-1', 'exercise-2'], times: { 'exercise-2': [30, 25] } },
      t: { morning: { energy: 6 }, evening: { gone: 'так собі' } },
    }),
    at('2026-11-05', { note: 'усе <b>добре</b>', wo: { session: 'a', ex: { 'exercise-6': [{ w: 5, r: 10 }, { w: 5, r: 10 }] } }, t: { morning: { energy: 4 } } }),
    at('2026-11-03', { t: { evening: { tired: 3 } } }),
    at('2026-10-20', { note: 'жовтневе коліно', mv: { 'movement-1': { min: 25 } } }),
  ]),
};

let host: HTMLElement;
let device: ReturnType<typeof fakeDevice>['device'];

function start(diary: Diary = DIARY): void {
  diaryStore(localStorage, () => new Date()).save(diary);
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  const fake = fakeDevice();
  device = fake.device;
  startApp({
    host,
    store: diaryStore(localStorage, () => new Date('2026-11-09T08:00:00Z')),
    browser: browserChoice(localStorage),
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    onDiary: () => {},
    today: () => TODAY,
    sections: sectionMemory(localStorage),
    whenHidden: () => {},
    ...fake.env,
  });
}

const heading = () => host.querySelector('h1')!.textContent;
const toastSays = () => {
  const shown = document.querySelector<HTMLElement>('.toast:not([hidden])');
  if (!shown) return undefined;
  const check = shown.querySelector('.toast__check:not([hidden])') ? '✓ ' : '';
  return check + shown.querySelector('.toast__message')!.textContent;
};
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === name);
const tap = (name: string) => {
  const found = button(name);
  if (!found) throw new Error(`no button «${name}»`);
  found.click();
};
const cards = () => [...host.querySelectorAll<HTMLElement>('.day-card')];
const cardTitle = (card: HTMLElement) => card.querySelector('.accordion__title')!.textContent;
const isOpen = (card: HTMLElement) => card.querySelector('button.accordion')!.getAttribute('aria-expanded') === 'true';
const openHistory = () => {
  tap('меню');
  tap('історія');
};
const calDay = (date: string) => host.querySelector<HTMLButtonElement>(`.history [data-cal="day"][data-day="${date}"]`)!;
const searchInput = () => host.querySelector<HTMLInputElement>('.search__input');
const type = (text: string) => {
  const input = searchInput()!;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeEach(() => localStorage.clear());

describe('«історія» (Figma screen/log-history 165:2758)', () => {
  beforeEach(() => {
    start();
    openHistory();
  });

  it('opens from the menu with the week, the month line and the calendar', () => {
    expect(heading()).toBe('історія');
    expect(host.querySelector('.history__goal')!.textContent).toBe('цей тиждень: 0 з 5 днів');
    expect(host.querySelector('.history__summary')!.textContent).toBe('листопад: 1 день з розминкою, 1 тренування');
    expect(calDay('2026-11-08')).toBeTruthy();
    expect(host.querySelector('footer')).toBeTruthy();
  });

  it('shows the month’s averages', () => {
    const averages = host.querySelector<HTMLElement>('.history__averages')!;
    expect(averages.querySelector('h2')!.textContent).toBe('середнє за період');
    expect(averages.textContent).toContain('за місяць, який відкрито в календарі');
    expect([...averages.querySelectorAll('.avg')].map((row) => row.textContent!.replace(/\s+/g, ' ').trim()))
      .toEqual(['енергія · зранку 5', 'втома · ввечері 3']);
    // history/period-averages: one column, «назва · 2,7» at 14 px (VISUAL-AUDIT п. 24)
    expect(averages.querySelector('.avgs')!.classList).toContain('avgs--column');
    expect([...averages.querySelector('.avg')!.children].map((part) => part.className)).toEqual(['avg__label t-2nd-regular', 'avg__value t-2nd-bold']);
  });

  it('has 🔍 as a switch that is off', () => {
    expect(button('пошук у нотатках')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('lists the days with records, newest first, the first one open', () => {
    expect(cards().map(cardTitle)).toEqual(['неділя, 08.11.2026', 'четвер, 05.11.2026', 'вівторок, 03.11.2026']);
    expect(cards().map(isOpen)).toEqual([true, false, false]);
    expect(cards()[0]!.querySelector('.accordion__meta')!.textContent).toBe('розминка: рівень 1 · нотатка');
  });

  it('shows what was logged inside an open card', () => {
    const first = cards()[0]!;
    const titles = [...first.querySelectorAll('.day-block__title')].map((t) => t.textContent);
    expect(titles).toEqual(['самопочуття зранку', 'ранкова розминка', 'самопочуття ввечері', 'нотатка']);
    expect(first.querySelector('.day-check')!.textContent).toContain('вправа 1');
    expect([...first.querySelectorAll('.day-check')][1]!.textContent).toContain('вправа 2 · 30 с, 25 с');
    expect(first.querySelector('.value-row--text')!.textContent).toContain('питання, якого вже немає·так собі');
    // as in «бета 0.81»: an exercise ticked once shows under every level that has it
    expect(first.querySelectorAll('.day-block .checkbox__box')).toHaveLength(4);
    expect([...first.querySelectorAll('.day-block__group')].map((g) => g.textContent)).toEqual(['рівень 1 · готово', 'рівень 2']);
    expect(first.textContent).toContain('коліно трохи болить');
  });

  it('opens and closes a card', () => {
    const second = cards()[1]!;
    second.querySelector<HTMLButtonElement>('button.accordion')!.click();
    expect(isOpen(cards()[1]!)).toBe(true);
    expect(cards()[1]!.textContent).toContain('2 × 10 повт. · 5 кг');
    // units small and muted, the row one flowing line (history/day-block, п. 25, Н10)
    expect([...cards()[1]!.querySelectorAll('.value-row__value')].find((v) => v.textContent!.includes('повт'))!.innerHTML).toBe('2 × 10 <span class="unit">повт.</span> · 5 <span class="unit">кг</span>');
    cards()[1]!.querySelector<HTMLButtonElement>('button.accordion')!.click();
    expect(isOpen(cards()[1]!)).toBe(false);
  });

  it('writes typed text as text, never as markup', () => {
    cards()[1]!.querySelector<HTMLButtonElement>('button.accordion')!.click();
    const note = [...cards()[1]!.querySelectorAll('.day-block__text')].at(-1)!;
    expect(note.children).toHaveLength(0);
    expect(note.textContent).toBe('усе <b>добре</b>');
  });

  it('leads home on that day from «редагувати цей день»', () => {
    tap('редагувати цей день');
    expect(heading()).toBe('головна');
    expect(host.querySelector('.hero__text')!.textContent).toContain('нд, 08.11.2026');
    expect(device.depth()).toBe(0);
  });

  it('opens the card of a day tapped in the calendar', () => {
    calDay('2026-11-05').click();
    expect(isOpen(cards()[1]!)).toBe(true);
    expect(document.activeElement).toBe(cards()[1]!.querySelector('button.accordion'));
    expect(host.querySelector('[data-cal="day"][aria-current="date"]')!.getAttribute('data-day')).toBe('2026-11-05');
  });

  it('says so for a day without records', () => {
    calDay('2026-11-02').click();
    expect(toastSays()).toBe('за цей день записів немає');
    expect(heading()).toBe('історія');
  });

  it('shows the month chosen with the arrows: its line, averages and days', () => {
    tap('попередній місяць');
    expect(host.querySelector('.history__summary')!.textContent).toBe('жовтень: 0 днів з розминкою, 0 тренувань');
    expect(cards().map(cardTitle)).toEqual(['вівторок, 20.10.2026']);
    expect(isOpen(cards()[0]!)).toBe(true);
    expect(host.querySelector('.history__averages')!.textContent).toContain('ще немає значень за цей місяць');
    expect(document.activeElement).toBe(button('попередній місяць'));
    tap('попередній місяць');
    expect(host.querySelector('.history__empty')!.textContent).toBe('цього місяця записів немає. зате попереду ще купа днів :3');
  });

  it('goes to the menu with ≡, home with ✕ and back with the phone', () => {
    tap('меню');
    expect(heading()).toBe('меню');
    tap('історія');
    tap('закрити');
    expect(heading()).toBe('головна');
    expect(device.depth()).toBe(0);
    openHistory();
    device.pressBack();
    expect(heading()).toBe('меню');
  });
});

describe('«середнє за період»', () => {
  it('counts today, but not the days of the next or last month shown in the grid', () => {
    start({
      ...DIARY,
      days: Object.fromEntries([
        at('2026-11-09', { t: { morning: { energy: 2 } } }),
        at('2026-11-03', { t: { morning: { energy: 4 } } }),
        at('2026-10-30', { t: { morning: { energy: 10 } } }),
      ]),
    });
    openHistory();
    expect(host.querySelector('.history__averages .avg')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('енергія · зранку 3');
  });
});

describe('the week line', () => {
  it('is hidden without a goal', () => {
    const profile = { ...(EXAMPLE_DIARY.profile as object), goal: { enabled: false, days: 5, done: [] } };
    start({ ...DIARY, profile });
    openHistory();
    expect(host.querySelector<HTMLElement>('.history__goal')).toBeNull();
  });

  it('goes with the month line when neither warm-up nor workout is on', () => {
    const profile = { ...(EXAMPLE_DIARY.profile as object), goal: { enabled: false }, morningWarmup: { enabled: false }, workout: { enabled: false } };
    start({ ...DIARY, profile });
    openHistory();
    expect(host.querySelector('.history__summary')).toBeNull();
    expect(cards()).toHaveLength(3);
  });
});

describe('search in notes (Figma search/panel 210:4110)', () => {
  beforeEach(() => start());

  it('opens from the menu over the history, ready to type', () => {
    tap('меню');
    tap('пошук у нотатках');
    expect(heading()).toBe('історія');
    expect(document.activeElement).toBe(searchInput());
    expect(searchInput()!.placeholder).toBe('пошук у нотатках');
    expect(button('пошук у нотатках')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('finds words in the notes and marks them', () => {
    openHistory();
    tap('пошук у нотатках');
    type('коліно');
    expect(host.querySelector('.search__count')!.textContent).toBe('знайдено: 2');
    const hits = [...host.querySelectorAll<HTMLButtonElement>('.search__hit')];
    expect(hits.map((hit) => hit.querySelector('.search__date')!.textContent)).toEqual(['нд, 08.11.2026', 'вт, 20.10.2026']);
    expect(hits[0]!.querySelector('mark')!.textContent).toBe('коліно');
  });

  it('says when nothing is found', () => {
    openHistory();
    tap('пошук у нотатках');
    type('плавання');
    expect(host.querySelector('.search__none')!.textContent).toBe('нічого не знайшлося :( спробуй інше слово');
    expect(host.querySelector('.search__hit')).toBeNull();
  });

  it('writes the found text as text', () => {
    openHistory();
    tap('пошук у нотатках');
    type('добре');
    expect(host.querySelector('.search__hit b')).toBeNull();
    expect(host.querySelector('.search__hit')!.textContent).toContain('<b>');
  });

  it('clears the query with ×, which shows only with a query', () => {
    openHistory();
    tap('пошук у нотатках');
    expect(button('очистити')!.hidden).toBe(true);
    type('коліно');
    expect(button('очистити')!.hidden).toBe(false);
    tap('очистити');
    expect(button('очистити')!.hidden).toBe(true);
    expect(searchInput()!.value).toBe('');
    expect(host.querySelector('.search__hit')).toBeNull();
    expect(document.activeElement).toBe(searchInput());
  });

  it('stays open on a tap beside the results and on other keys', () => {
    openHistory();
    tap('пошук у нотатках');
    type('коліно');
    host.querySelector<HTMLElement>('.search__count')!.click();
    searchInput()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(heading()).toBe('історія');
    expect(searchInput()).toBeTruthy();
  });

  it('keeps the bar out while the panel sits on it', () => {
    openHistory();
    tap('пошук у нотатках');
    const scrollTo = (y: number) => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
      window.dispatchEvent(new Event('scroll'));
    };
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
    scrollTo(1000);
    expect(host.querySelector('.bar')!.classList.contains('bar--hidden')).toBe(false);
    expect(host.querySelector<HTMLElement>('.to-top')!.hidden).toBe(true);
    tap('пошук у нотатках');
    // closing gives the focus to 🔍, which keeps the bar out on its own
    (document.activeElement as HTMLElement).blur();
    scrollTo(2000);
    expect(host.querySelector('.bar')!.classList.contains('bar--hidden')).toBe(true);
    scrollTo(0);
  });

  it('opens home on the day of a result', () => {
    openHistory();
    tap('пошук у нотатках');
    type('жовтневе');
    host.querySelector<HTMLButtonElement>('.search__hit')!.click();
    expect(heading()).toBe('головна');
    expect(host.querySelector('.hero__text')!.textContent).toContain('вт, 20.10.2026');
    expect(device.depth()).toBe(0);
  });

  it('closes with 🔍 again or Escape, giving the focus back to 🔍', () => {
    openHistory();
    tap('пошук у нотатках');
    tap('пошук у нотатках');
    expect(searchInput()).toBeNull();
    tap('пошук у нотатках');
    searchInput()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(searchInput()).toBeNull();
    expect(document.activeElement).toBe(button('пошук у нотатках'));
  });

  it('opens over the history from 🔍 on «що нового»; ≡ goes back to the menu', () => {
    tap('меню');
    tap('що нового в застосунку');
    // there 🔍 leads somewhere, it is not a switch
    expect(button('пошук у нотатках')!.hasAttribute('aria-pressed')).toBe(false);
    tap('пошук у нотатках');
    expect(heading()).toBe('історія');
    expect(searchInput()).toBeTruthy();
    tap('меню');
    expect(heading()).toBe('меню');
  });
});
