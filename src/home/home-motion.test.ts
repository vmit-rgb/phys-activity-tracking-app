import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDevice, openSections } from '../app/test-env';
import { startApp } from '../app/app';
import type { DayKey } from '../domain/dates';
import type { Diary } from '../domain/diary';
import { diaryStore } from '../storage/store';
import { fakeAnimate } from '../ui/test-animate';
import { mountToast } from '../ui/toast';

/*
 * Motion on home, stage 7b (MICROINTERACTIONS.md): what the person sees move
 * after a tap. jsdom has no Web Animations API, so a fake records what plays.
 * Invented data only.
 */

const TODAY = '2026-11-11' as DayKey;
const YESTERDAY = '2026-11-10' as DayKey;

const profile = {
  goal: { enabled: true, days: 3, done: ['morningWarmup'] },
  morningWarmup: { enabled: true, levels: [
    { id: 'l1', name: 'рівень 1', items: [{ exercise: 'a', reps: '10' }, { exercise: 't', seconds: 30 }] },
  ] },
  daytimeWarmup: { enabled: false, groups: [] },
  workout: { enabled: true, sessions: [
    { id: 's', name: 'а', items: [{ exercise: 'w', reps: '10', sets: 2, fields: ['weight', 'reps'] }] },
    { id: 'b', name: 'б', items: [{ exercise: 'w', reps: '10', sets: 1, fields: ['reps'] }] },
  ] },
  movement: { enabled: true, kinds: [{ id: 'walk', name: 'ходьба', fields: ['km'] }] },
  exercises: [{ id: 'a', name: 'нахили' }, { id: 't', name: 'планка' }, { id: 'w', name: 'присідання' }],
  trackers: [{ id: 'energy', name: 'енергія', kind: 'scale', min: 0, max: 10, ask: ['morning'] }],
};

let host: HTMLElement;
let fake: ReturnType<typeof fakeAnimate>;
let vibrated: (number | number[])[];

function start(days: Diary['days'] = {}, settings: Diary['profile'] = profile): void {
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  localStorage.clear();
  const store = diaryStore(localStorage, () => new Date('2026-11-11T08:00:00Z'));
  store.save({ profile: settings, days });
  startApp({
    host,
    store,
    browser: { chosen: () => true, choose: () => {} },
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    today: () => TODAY,
    sections: openSections,
    ...fakeDevice().env,
    onDiary: () => {},
    whenHidden: () => {},
  });
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`not on screen: ${selector}`);
  return element;
};
const byLabel = (label: string) => $<HTMLButtonElement>(`[aria-label="${label}"]`);
const byText = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === text)!;
/** Every animation on `selector` as it is on screen now. */
const runs = (selector: string) => fake.on(host.querySelector(selector));
const moved = (selector: string, transform: string) => runs(selector).some((run) => run.keyframes[0]?.transform === transform);

beforeEach(() => {
  vi.useFakeTimers();
  fake = fakeAnimate();
  vibrated = [];
  vi.stubGlobal('navigator', { ...navigator, vibrate: (pattern: number | number[]) => vibrated.push(pattern) });
  start({}, profile);
});
afterEach(() => {
  fake.restore();
  document.documentElement.removeAttribute('data-no-motion');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('another day (arrows, swipe, calendar)', () => {
  it('brings the earlier day in from the left, 32 px in 360 ms', () => {
    byLabel('попередній день').click();
    const [run] = runs('.home__sections');
    expect(run!.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateX(-32px)' });
    expect(run!.options.duration).toBe(360);
  });

  it('brings the later day in from the right', () => {
    start({}, profile);
    byLabel('попередній день').click();
    byLabel('наступний день').click();
    expect(moved('.home__sections', 'translateX(32px)')).toBe(true);
  });

  it('re-forms the date in the bar out of glyphs, and a screen reader still hears the whole date', () => {
    byLabel('попередній день').click();
    const date = $('.date-nav__date span[aria-hidden="true"]');
    expect(date.textContent).not.toBe('вт, 10.11.2026');
    expect($('.date-nav__date .visually-hidden').textContent).toBe('вівторок, 10.11.2026');
    vi.advanceTimersByTime(240);
    expect(date.textContent).toBe('вт, 10.11.2026');
  });

  it('makes the chosen day jump in the calendar', () => {
    byLabel('попередній день').click();
    const [run] = runs('.home .cal-day--shown');
    expect(run!.keyframes.map((k) => k.transform)).toEqual(['scale(.6)', 'scale(1.15)', 'scale(1)']);
    expect(run!.options.duration).toBe(420);
  });

  it('comes from the side of the day chosen in the calendar', () => {
    host.querySelector<HTMLButtonElement>(`[data-day="${YESTERDAY}"]`)!.click();
    expect(moved('.home__sections', 'translateX(-32px)')).toBe(true);
  });

  it('keeps the day still when only something on it changes', () => {
    byText('додати коло').click();
    expect(moved('.home__sections', 'translateX(-32px)') || moved('.home__sections', 'translateX(32px)')).toBe(false);
  });

  it('keeps everything still with «вимкнути всі анімації»', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    byLabel('попередній день').click();
    expect(fake.played).toEqual([]);
    expect($('.date-nav__date span[aria-hidden="true"]').textContent).toBe('вт, 10.11.2026');
  });
});

describe('another month in the calendar', () => {
  const block = () => $('.home > .cal-block');
  const cells = () => [...block().querySelectorAll('.cal__grid > *')];
  const month = () => block().querySelector('.cal__month')!;

  it('pulls the cells into a heap in 120 ms, then the new month flies apart in 240 ms', () => {
    const old = cells();
    $<HTMLButtonElement>('.home [data-cal="month"][data-by="-1"]').click();
    expect(fake.on(old[0]!)[0]!.options).toMatchObject({ duration: 120, fill: 'forwards' });
    expect(month().textContent).toBe('листопад');
    fake.on(old.at(-1)!)[0]!.finish();
    expect(month().textContent).not.toBe('листопад');
    expect(fake.on(cells()[0]!)[0]!.options.duration).toBe(240);
    vi.advanceTimersByTime(240);
    expect(month().textContent).toBe('жовтень');
  });

  it('keeps the focus on the arrow', () => {
    $<HTMLButtonElement>('.home [data-cal="month"][data-by="-1"]').click();
    fake.finishAll();
    expect(document.activeElement).toBe($('.home [data-cal="month"][data-by="-1"]'));
  });

  it('takes a second tap while the cells are still in the heap', () => {
    $<HTMLButtonElement>('.home [data-cal="month"][data-by="-1"]').click();
    $<HTMLButtonElement>('.home [data-cal="month"][data-by="-1"]').click();
    fake.finishAll();
    vi.advanceTimersByTime(240);
    expect(month().textContent).toBe('вересень');
  });
});

describe('the calendar sheet from the date', () => {
  const date = () => $<HTMLButtonElement>('.date-nav__date');
  const sheet = () => host.querySelector<HTMLElement>('.cal-sheet');

  it('opens out of the date in 360 ms, with the scrim fading in and the days coming together', () => {
    date().click();
    const [open] = fake.on(sheet()!.querySelector('.cal-sheet__panel'));
    expect(open!.keyframes[0]!.clipPath).toMatch(/^circle\(0px at /);
    expect(open!.options.duration).toBe(360);
    expect(fake.on(sheet()!.querySelector('.cal-sheet__scrim'))[0]!.keyframes[0]).toMatchObject({ opacity: 0 });
    expect(fake.on(sheet()!.querySelector('.cal__grid .cal-day'))).toHaveLength(1);
  });

  it('closes back into the date in 240 ms and only then leaves the screen', () => {
    date().click();
    $('.cal-sheet__scrim').click();
    expect(date().getAttribute('aria-expanded')).toBe('false');
    const close = fake.on(sheet()!.querySelector('.cal-sheet__panel')).at(-1)!;
    expect(close.keyframes.at(-1)!.clipPath).toMatch(/^circle\(0px at /);
    expect(close.options.duration).toBe(240);
    close.finish();
    expect(sheet()).toBeNull();
  });

  it('opens again at once on the date while the last one is still closing', () => {
    date().click();
    $('.cal-sheet__scrim').click();
    date().click();
    expect(host.querySelectorAll('.cal-sheet')).toHaveLength(1);
    expect(date().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes at once with «вимкнути всі анімації»', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    date().click();
    $('.cal-sheet__scrim').click();
    expect(sheet()).toBeNull();
  });
});
