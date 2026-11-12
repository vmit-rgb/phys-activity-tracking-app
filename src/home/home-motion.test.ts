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

describe('rewards: a warm-up level done, a day counted', () => {
  const tick = (exercise: string) => $<HTMLInputElement>(`[data-input="tick"][data-ex="${exercise}"]`).click();
  const levelPanel = () => document.getElementById($('.sub .accordion--group').getAttribute('aria-controls')!);

  it('strikes the level through in 720 ms, folds it and buzzes 30 ms', () => {
    tick('a');
    expect(vibrated).toEqual([]);
    tick('t');
    const [strike] = runs('.sub .accordion__title .fx-strk');
    expect(strike!.keyframes[0]).toMatchObject({ backgroundSize: '0% 2px' });
    expect(strike!.options.duration).toBe(720);
    expect(vibrated[0]).toBe(30);
    expect(fake.on(levelPanel()).some((run) => run.keyframes.at(-1)?.height === '0px')).toBe(true);
    fake.finishAll();
    expect($('.sub .accordion__title').textContent).toBe('рівень 1');
    expect(host.querySelector('.fx-strk')).toBeNull();
    expect(levelPanel()!.hidden).toBe(true);
  });

  it('counts the day after the level: the goal line re-forms and grows, a glow round the day and up from the bar, buzz [40, 180, 40]', () => {
    tick('a');
    tick('t');
    expect(vibrated).toEqual([30]);
    vi.advanceTimersByTime(720);
    expect(vibrated).toEqual([30, [40, 180, 40]]);
    const goal = runs('.bar__goal').find((run) => run.options.duration === 1200);
    expect(goal!.keyframes.map((k) => k.transform)).toContain('scale(1.12)');
    expect($('.bar__goal .visually-hidden').textContent).toBe('цей тиждень: 1 з 3 днів');
    expect(runs('.home .cal-day--shown').some((run) => run.options.duration === 1200 && 'boxShadow' in run.keyframes[0]!)).toBe(true);
    const glow = document.querySelector('.fx-barglow');
    expect(fake.on(glow)[0]!.options.duration).toBe(1200);
    fake.on(glow)[0]!.finish();
    expect(document.querySelector('.fx-barglow')).toBeNull();
    vi.advanceTimersByTime(1200);
    expect($('.bar__goal').textContent).toBe('цей тиждень: 1 з 3 днів');
  });

  it('shows the same with «вимкнути вібровідгук», without a buzz', () => {
    start({}, { ...profile, accessibility: { noVibration: true } });
    tick('a');
    tick('t');
    vi.advanceTimersByTime(720);
    expect(vibrated).toEqual([]);
    expect(runs('.sub .accordion__title .fx-strk')).toHaveLength(1);
    expect(document.querySelector('.fx-barglow')).not.toBeNull();
  });

  it('buzzes with «вимкнути всі анімації» but nothing moves', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    tick('a');
    tick('t');
    vi.advanceTimersByTime(720);
    expect(vibrated).toEqual([30, [40, 180, 40]]);
    expect(fake.played).toEqual([]);
    expect(document.querySelector('.fx-barglow')).toBeNull();
  });

  it('gives nothing for taking a tick away', () => {
    tick('a');
    tick('t');
    vi.advanceTimersByTime(720);
    fake.played.length = 0;
    tick('t');
    vi.advanceTimersByTime(720);
    expect(vibrated).toHaveLength(2);
    expect(host.querySelector('.fx-strk')).toBeNull();
  });
});

describe('rows: added, removed, brought back', () => {
  const pick = () => byText('тренування А').click();
  const lastRow = (selector: string) => [...host.querySelectorAll(`${selector} .sets > .set-row`)].at(-1)!;
  const cameFromLeft = (row: Element) => fake.on(row).some((run) => run.keyframes[0]?.transform === 'translateX(-24px)' && run.options.duration === 360);

  it('floats a new set in from the left', () => {
    pick();
    byText('додати підхід').click();
    expect(cameFromLeft(lastRow('.wo-ex'))).toBe(true);
  });

  it('floats a new lap and a new «ще раз» timer in from the left', () => {
    byText('додати коло').click();
    expect(cameFromLeft(lastRow('.mv-kind'))).toBe(true);
    byText('ще раз').click();
    expect(cameFromLeft(lastRow('.sw-block'))).toBe(true);
  });

  it('sends a removed set out to the right with a fade in 240 ms, and it leaves the page', () => {
    pick();
    byLabel('видалити підхід 2').click();
    byLabel('точно видалити підхід 2').click();
    expect(host.querySelectorAll('.wo-ex .sets > .set-row')).toHaveLength(1);
    const ghost = document.querySelector('.fx-ghost')!;
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    const [out] = fake.on(ghost);
    expect(out!.keyframes.at(-1)).toMatchObject({ opacity: 0, transform: 'translateX(28px)' });
    expect(out!.options.duration).toBe(240);
    out!.finish();
    expect(document.querySelector('.fx-ghost')).toBeNull();
  });

  it('brings back with a spring what «скасувати» returns', () => {
    pick();
    byLabel('видалити підхід 2').click();
    byLabel('точно видалити підхід 2').click();
    document.querySelector<HTMLButtonElement>('.toast:not([hidden]) .toast__action')!.click();
    expect(fake.on(lastRow('.wo-ex')).some((run) => run.keyframes[0]?.transform === 'scale(.94)' && run.options.easing === 'cubic-bezier(.34,1.56,.64,1)')).toBe(true);
    expect(fake.on(host.querySelector('.wo-ex .sets > .set-row')).some((run) => run.keyframes[0]?.transform === 'scale(.94)')).toBe(false);
  });

  it('removes at once, with no ghost, with «вимкнути всі анімації»', () => {
    pick();
    document.documentElement.setAttribute('data-no-motion', '');
    byLabel('видалити підхід 2').click();
    byLabel('точно видалити підхід 2').click();
    expect(document.querySelector('.fx-ghost')).toBeNull();
  });
});

describe('choosing a workout', () => {
  const body = () => $('#sec-wo');
  const staggered = () => [...body().children].map((child) => fake.on(child).find((run) => run.keyframes[0]?.transform === 'translateY(8px)')?.options.delay);

  it('assembles the workout one by one, 40 ms apart', () => {
    byText('тренування А').click();
    expect(staggered().slice(0, 3)).toEqual([0, 40, 80]);
  });

  it('assembles the choice again after «прибрати з цього дня»', () => {
    byText('тренування А').click();
    byText('прибрати з цього дня').click();
    expect(byText('тренування Б')).toBeDefined();
    expect(staggered().slice(0, 3)).toEqual([0, 40, 80]);
  });
});

describe('the stopwatch', () => {
  const button = () => $('.sw__btn');
  const time = () => $('[data-sw-time]');

  it('turns ▶ into ■ by glyph frames', () => {
    button().click();
    expect(button().dataset.g).toBe('>');
    vi.advanceTimersByTime(240);
    expect(button().dataset.g).toBeUndefined();
  });

  it('turns ■ into ✓ by frames and the saved time re-forms', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    button().click();
    now.mockReturnValue(32_400);
    vi.advanceTimersByTime(240);
    button().click();
    expect(button().dataset.g).toBe('#');
    expect(time().textContent).not.toBe('00.31.00');
    vi.advanceTimersByTime(240);
    expect(time().textContent).toBe('00.31.00');
    now.mockRestore();
  });

  it('dissolves the old digits on «знову» before counting from zero', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    button().click();
    now.mockReturnValue(32_400);
    button().click();
    vi.advanceTimersByTime(240);
    button().click();
    button().click();
    expect(time().dataset.busy).toBeDefined();
    vi.advanceTimersByTime(240);
    expect(time().dataset.busy).toBeUndefined();
    vi.advanceTimersByTime(50);
    expect(time().textContent).toBe('00.00.00');
    now.mockRestore();
  });

  it('changes a reset timer by a run of glyphs, the row stays', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    button().click();
    now.mockReturnValue(32_400);
    button().click();
    byLabel('скинути таймер до нуля').click();
    byLabel('точно скинути таймер до нуля').click();
    expect(document.querySelector('.fx-ghost')).toBeNull();
    expect(time().dataset.busy).toBeDefined();
    vi.advanceTimersByTime(240);
    expect(time().textContent).toBe('00.00.00');
    now.mockRestore();
  });
});

describe('the slider', () => {
  const slider = () => $<HTMLInputElement>('input.slider');
  const slide = (value: string) => {
    slider().value = value;
    slider().dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('drops the thumb into a grey dot on «зберегти» and the value re-forms', () => {
    slide('6');
    byText('зберегти').click();
    expect(slider().classList.contains('fx-lock')).toBe(true);
    expect($('.tracker__value').dataset.busy).toBeDefined();
    vi.advanceTimersByTime(420);
    expect(slider().classList.contains('fx-lock')).toBe(false);
    expect($('.tracker__value').textContent).toBe('6/10');
  });

  it('brings the thumb back with a pop on «скинути»', () => {
    slide('6');
    byText('зберегти').click();
    byText('скинути').click();
    expect(slider().classList.contains('fx-unlock')).toBe(true);
    vi.advanceTimersByTime(420);
    expect(slider().classList.contains('fx-unlock')).toBe(false);
  });

  it('keeps the thumb still with «вимкнути всі анімації»', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    slide('6');
    byText('зберегти').click();
    expect(slider().classList.contains('fx-lock')).toBe(false);
  });
});
