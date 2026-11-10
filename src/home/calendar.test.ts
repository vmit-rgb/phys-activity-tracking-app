import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDevice } from '../app/test-env';
import { SAVE_DELAY_MS, startApp } from '../app/app';
import type { DayKey } from '../domain/dates';
import { readDay } from '../domain/day';
import type { Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { diaryStore, sectionMemory, type DiaryStore } from '../storage/store';
import { mountToast } from '../ui/toast';

/*
 * Stage 5c, the way the person uses it: the calendar block under the
 * sections, the calendar sheet from the date, the pulse timer.
 * Invented data only: nothing from a real log.
 */

const TODAY = '2026-11-11' as DayKey; // Wednesday
const MONDAY = '2026-11-09' as DayKey;
const TUESDAY = '2026-11-10' as DayKey;

const profile = {
  goal: { enabled: true, days: 3, done: ['workout'] },
  morningWarmup: { enabled: true, weeklyTarget: 6, levels: [
    { id: 'l1', name: 'рівень 1', items: [{ exercise: 'a' }] },
    { id: 'l2', name: 'рівень 2', items: [{ exercise: 'a' }, { exercise: 'b' }] },
  ] },
  workout: { enabled: true, weeklyTarget: 2, sessions: [{ id: 's', name: 'а', items: [{ exercise: 'w', fields: ['reps'] }] }] },
  movement: { enabled: true, weeklyTarget: 0, kinds: [{ id: 'walk', name: 'ходьба', fields: ['km'] }] },
  exercises: [{ id: 'a', name: 'нахили' }, { id: 'b', name: 'оберти' }, { id: 'w', name: 'присідання' }],
  trackers: [
    { id: 'pain', name: 'біль', kind: 'scale', ask: ['morning'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'], timer: { enabled: true, seconds: 30 } },
  ],
};

const DAYS: Diary['days'] = {
  [MONDAY]: readDay({ mw: { ticks: ['a', 'b'] }, t: { morning: { pain: 3 } } }, MONDAY),
  [TUESDAY]: readDay({ wo: { session: 's', ex: { w: [{ r: 10 }] } }, mv: { walk: { km: 2 } }, t: { morning: { pain: 4 } } }, TUESDAY),
};

let host: HTMLElement;
let store: DiaryStore;

function start(days: Diary['days'] = DAYS, settings: Diary['profile'] = profile): void {
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  localStorage.clear();
  store = diaryStore(localStorage, () => new Date('2026-11-11T08:00:00Z'));
  store.save({ profile: settings, days });
  startApp({
    host,
    store,
    browser: { chosen: () => true, choose: () => {} },
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    today: () => TODAY,
    sections: sectionMemory(localStorage),
    ...fakeDevice().env,
    onDiary: () => {},
    whenHidden: () => {},
  });
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = host) => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`not on screen: ${selector}`);
  return element;
};
const all = (selector: string, root: ParentNode = host) => [...root.querySelectorAll<HTMLElement>(selector)];
const texts = (selector: string, root: ParentNode = host) => all(selector, root).map((element) => element.textContent!.trim());
const byText = (text: string, root: ParentNode = host) => all('button', root).find((b) => b.textContent!.trim() === text)!;
const byLabel = (label: string, root: ParentNode = host) => $<HTMLButtonElement>(`[aria-label="${label}"]`, root);
const block = () => $('.home .cal-block');
const sheet = () => host.querySelector<HTMLElement>('.cal-sheet');
const shownDate = () => $('.date-nav__date .visually-hidden').textContent;
const type = (field: HTMLInputElement, value: string) => {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};
const saved = () => {
  vi.advanceTimersByTime(SAVE_DELAY_MS);
  return store.load()!.days[TODAY];
};

beforeEach(() => {
  vi.useFakeTimers();
  start();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('calendar block on home', () => {
  it('comes after the sections, before the footer', () => {
    const order = [...$('.home').children].map((child) => child.className.split(' ')[0]);
    expect(order.indexOf('cal-block')).toBe(order.indexOf('home__sections') + 1);
  });

  it('counts this week per activity, with the target when there is one', () => {
    expect(texts('.stat__label', block())).toEqual(['розминка', 'тренування', 'рух']);
    expect(texts('.stat__value', block())).toEqual(['1 з 6 днів', '1 з 2 днів', '1']);
  });

  it('says «з 1 дня» for one day a week', () => {
    start(DAYS, { ...profile, movement: { ...profile.movement, weeklyTarget: 1 } });
    expect(texts('.stat__value', block())[2]).toBe('1 з 1 дня');
  });

  it('does nothing on a tap beside the days', () => {
    $('.legend', block()).click();
    expect(shownDate()).toBe('середа, 11.11.2026');
  });

  it('averages the sliders over the last 7 days', () => {
    expect(texts('.avg', block())).toEqual(['біль · зранку 3,5']);
  });

  it('has no averages heading when nothing was answered', () => {
    start({});
    expect(texts('h3', block())).toEqual(['цей тиждень', 'листопад']);
  });

  it('shows the month: levels, markers, today and the day shown', () => {
    expect($('h3.cal__month', block()).textContent).toBe('листопад');
    const monday = byLabel('понеділок, 09.11.2026, розминка рівень 2', block());
    expect(monday.classList.contains('cal-day--lv2')).toBe(true);
    const tuesday = byLabel('вівторок, 10.11.2026, тренування, рух', block());
    expect(tuesday.className).toContain('cal-day--workout');
    expect(tuesday.className).toContain('cal-day--movement');
    const today = byLabel('середа, 11.11.2026', block());
    expect(today.className).toContain('cal-day--today');
    expect(today.getAttribute('aria-current')).toBe('date');
  });

  it('lets only past days and today be tapped', () => {
    const days = all('.cal__grid .cal-day', block());
    expect(days).toHaveLength(42);
    expect(all('.cal__grid button', block())).toHaveLength(11);
    expect(days.find((day) => day.textContent === '12')!.tagName).toBe('SPAN');
  });

  it('shows the legend for what is switched on, three levels at most', () => {
    expect(texts('.legend li', block())).toEqual(['рівень 1', 'рівень 2', 'тренування', 'рух']);
    const fiveLevels = { ...profile, morningWarmup: { enabled: true, levels: [1, 2, 3, 4, 5].map((n) => ({ id: `l${n}`, items: [] })) }, workout: { enabled: false } };
    start({}, fiveLevels);
    expect(texts('.legend li', block())).toEqual(['рівень 1', 'рівень 2', 'рівень 3', 'рух']);
  });

  it('opens a day from the calendar', () => {
    byLabel('понеділок, 09.11.2026, розминка рівень 2', block()).click();
    expect(shownDate()).toBe('понеділок, 09.11.2026');
    expect($('.hero__text').textContent).toContain('це запис за пн, 09.11.2026.');
  });

  it('goes to earlier months, never past this one, and keeps the focus on the arrow', () => {
    const next = byLabel('наступний місяць', block());
    expect(next.disabled).toBe(true);
    byLabel('попередній місяць', block()).click();
    expect($('h3.cal__month', block()).textContent).toBe('жовтень');
    expect(document.activeElement).toBe(byLabel('попередній місяць', block()));
    expect(byLabel('наступний місяць', block()).disabled).toBe(false);
    byLabel('наступний місяць', block()).click();
    expect($('h3.cal__month', block()).textContent).toBe('листопад');
  });

  it('shows the month of the day picked', () => {
    byLabel('попередній місяць', block()).click();
    byLabel('пʼятниця, 30.10.2026', block()).click();
    expect($('h3.cal__month', block()).textContent).toBe('жовтень');
    byLabel('наступний день').click();
    byLabel('наступний день').click();
    expect($('h3.cal__month', block()).textContent).toBe('листопад');
  });

  it('starts «почати без ШІ» with the legend and no marks (Olesia, 2026-11-09)', () => {
    start(EXAMPLE_DIARY.days, EXAMPLE_DIARY.profile);
    expect(texts('.legend li', block())).toEqual(['рівень 1', 'рівень 2', 'тренування', 'рух']);
    expect(all('[class*="cal-day--lv"], .cal-day--workout, .cal-day--movement', block())).toHaveLength(0);
  });
});

describe('calendar sheet from the date', () => {
  const date = () => $<HTMLButtonElement>('.date-nav__date');

  it('opens over the page with the week, the averages and the month', () => {
    date().click();
    expect(sheet()!.getAttribute('role')).toBe('dialog');
    expect(date().getAttribute('aria-expanded')).toBe('true');
    expect(texts('h3', sheet()!)).toEqual(['цей тиждень', 'середнє за 7 днів', 'листопад']);
    expect(document.activeElement).toBe(byLabel('середа, 11.11.2026', sheet()!));
  });

  it('closes with Escape, a tap beside it or the date, and gives the focus back to the date', () => {
    date().click();
    sheet()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(date());
    date().click();
    $('.cal-sheet__scrim').click();
    expect(sheet()).toBeNull();
    date().click();
    date().click();
    expect(sheet()).toBeNull();
    expect(date().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a day and closes', () => {
    date().click();
    byLabel('вівторок, 10.11.2026, тренування, рух', sheet()!).click();
    expect(sheet()).toBeNull();
    expect(shownDate()).toBe('вівторок, 10.11.2026');
  });

  it('changes the month inside the sheet without closing it', () => {
    date().click();
    byLabel('попередній місяць', sheet()!).click();
    expect($('h3.cal__month', sheet()!).textContent).toBe('жовтень');
    expect(document.activeElement).toBe(byLabel('попередній місяць', sheet()!));
  });

  it('brings the bar back when it opens', () => {
    $('.bar').classList.add('bar--hidden');
    date().click();
    expect($('.bar').classList.contains('bar--hidden')).toBe(false);
  });
});

describe('pulse timer', () => {
  const pulse = () => $('[data-pulse]');
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  });

  it('offers the timer next to the field', () => {
    expect(byText('таймер · 30 с', pulse())).toBeTruthy();
    expect(pulse().querySelector('input')!.getAttribute('aria-label')).toBe('пульс, уд/хв');
  });

  it('counts down with no stop, then signals, asks for the beats and saves beats per minute', () => {
    byText('таймер · 30 с', pulse()).click();
    expect($('[data-pulse-left]').textContent).toBe('0:30');
    expect(pulse().textContent).toContain('рахуй удари. наприкінці буде вібрація, звук і спалах екрана.');
    expect(pulse().querySelector('button')).toBeNull();
    vi.advanceTimersByTime(12_000);
    expect($('[data-pulse-left]').textContent).toBe('0:18');
    vi.advanceTimersByTime(18_000);
    expect(vibrate).toHaveBeenCalled();
    expect(document.body.querySelector('.flash')).not.toBeNull();
    expect(pulse().textContent).toContain('скільки ударів за 30 с?');
    const beats = $<HTMLInputElement>('[data-input="beats"]');
    expect(document.activeElement).toBe(beats);
    type(beats, '42');
    byText('готово', pulse()).click();
    expect(saved()!.t.morning!.pulse).toBe(84);
    expect($('.pulse__result').textContent).toBe('84 уд/хв');
    expect(pulse().textContent).toContain('42 удари за 30 с × 2');
  });

  it('waits for a number before «готово» saves anything', () => {
    byText('таймер · 30 с', pulse()).click();
    vi.advanceTimersByTime(30_000);
    byText('готово', pulse()).click();
    type($<HTMLInputElement>('[data-input="beats"]'), '0');
    byText('готово', pulse()).click();
    expect(saved()).toBeUndefined();
    expect(document.activeElement).toBe($('[data-input="beats"]'));
    expect(pulse().textContent).toContain('скільки ударів за 30 с?');
  });

  it('counts again from the result', () => {
    byText('таймер · 30 с', pulse()).click();
    vi.advanceTimersByTime(30_000);
    type($<HTMLInputElement>('[data-input="beats"]'), '40');
    byText('готово', pulse()).click();
    byText('порахувати ще раз', pulse()).click();
    expect($('[data-pulse-left]').textContent).toBe('0:30');
  });

  it('shows the saved number in the field once the result is gone', () => {
    byText('таймер · 30 с', pulse()).click();
    vi.advanceTimersByTime(30_000);
    type($<HTMLInputElement>('[data-input="beats"]'), '36');
    byText('готово', pulse()).click();
    byLabel('попередній день').click();
    byLabel('наступний день').click();
    expect(pulse().querySelector('input')!.value).toBe('72');
  });
});
