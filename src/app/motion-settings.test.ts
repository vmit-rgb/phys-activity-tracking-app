import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayKey } from '../domain/dates';
import type { Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, diaryStore, sectionMemory } from '../storage/store';
import { LIFT_MS } from '../screens/drag';
import { fakeAnimate } from '../ui/test-animate';
import { mountToast } from '../ui/toast';
import { startApp } from './app';
import { fakeDevice } from './test-env';

// Stage 7c2 (MICROINTERACTIONS.md): dragging in the settings, groups, the action menu. Invented data only.
let host: HTMLElement;
let fake: ReturnType<typeof fakeAnimate>;

function start(diary: Diary = EXAMPLE_DIARY): void {
  diaryStore(localStorage, () => new Date()).save(diary);
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

const named = (b: HTMLElement) => (b.getAttribute('aria-label') ?? (b.querySelector('.accordion__title') ?? b).textContent!.trim());
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => named(b) === name)!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tap = async (name: string) => {
  button(name).click();
  await settle();
};
const choose = async (label: string) => {
  [...host.querySelectorAll<HTMLButtonElement>('.st-menu button')].find((b) => b.textContent === label)!.click();
  await settle();
};
const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
const box = (el: Element, top: number, height = 100) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, height, bottom: top + height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) });

const exercises = () => [...host.querySelectorAll<HTMLElement>('.st-item[data-family="wo-ex"]')];
const entry = (name: string) => exercises().find((el) => el.querySelector('.st-actions')!.textContent === `дії: ${name}`)!;
const springs = (el: Element | null) => fake.on(el).filter((run) => run.options.easing === 'cubic-bezier(.34,1.56,.64,1)');

async function openWorkout(): Promise<void> {
  start();
  await tap('меню');
  await tap('налаштування');
  await tap('тренування');
  await tap('розгорнути: тренування А');
  fake.played.length = 0;
}

/** Holds an entry until it lifts (fake timers only around the hold). */
function lift(el: HTMLElement, y = 300): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  pointer('pointerdown', el.querySelector('.st-text')!, 10, y);
  vi.advanceTimersByTime(LIFT_MS);
}

beforeEach(() => {
  localStorage.clear();
  fake = fakeAnimate();
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
});
afterEach(() => {
  fake.restore();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-no-motion');
});

describe('an entry lifted for dragging', () => {
  it('rises with a spring and the other workout exercises shake lightly, until it is let go', async () => {
    await openWorkout();
    const lifted = entry('вправа 8');
    lift(lifted);
    expect(springs(lifted).map((run) => run.keyframes.map((frame) => frame.transform))).toEqual([['scale(1)', 'scale(1.03)', 'scale(1.02)']]);
    expect(host.querySelector('.settings-screen')!.classList.contains('st-shaking')).toBe(true);
    pointer('pointercancel', document, 10, 300);
    vi.useRealTimers();
    expect(host.querySelector('.settings-screen')!.classList.contains('st-shaking')).toBe(false);
  });

  it('shakes nothing for an entry that can’t make a group (a level)', async () => {
    start();
    await tap('меню');
    await tap('налаштування');
    await tap('ранкова розминка');
    const level = host.querySelector<HTMLElement>('.st-item[data-family="lv"]')!;
    lift(level);
    expect(level.classList.contains('st-lift')).toBe(true);
    expect(host.querySelector('.settings-screen')!.classList.contains('st-shaking')).toBe(false);
    pointer('pointercancel', document, 10, 300);
  });

  it('shows only its name and description under the finger', async () => {
    await openWorkout();
    lift(entry('вправа 8'));
    document.elementFromPoint = () => null;
    pointer('pointermove', document, 10, 200);
    const proxy = document.querySelector('.st-proxy')!;
    expect(proxy.querySelector('.st-proxy__name')!.textContent).toBe('вправа 8');
    expect(proxy.querySelector('.st-proxy__how')!.textContent).toBe('тут буде коротко, як її робити.');
    pointer('pointercancel', document, 10, 200);
  });
});

describe('letting go', () => {
  it('settles the moved entry in its new place with a spring (360)', async () => {
    await openWorkout();
    const [first] = exercises();
    box(first!, 0);
    document.elementFromPoint = () => first!;
    lift(entry('вправа 8'));
    pointer('pointermove', document, 10, 10);
    pointer('pointerup', document, 10, 10);
    vi.useRealTimers();
    const moved = exercises()[0]!;
    expect(moved.querySelector('.st-actions')!.textContent).toBe('дії: вправа 8');
    const settled = springs(moved).find((run) => run.keyframes[0]!.transform === 'scale(1.03)');
    expect(settled?.options.duration).toBe(360);
  });

  it('pulls an exercise into the group it makes: the frame flashes, its rows come one by one', async () => {
    await openWorkout();
    const [first] = exercises();
    box(first!, 0);
    document.elementFromPoint = () => first!;
    lift(entry('вправа 8'));
    pointer('pointermove', document, 10, 50);
    pointer('pointerup', document, 10, 50);
    vi.useRealTimers();
    const group = host.querySelector('.st-group')!;
    const flash = fake.on(group).find((run) => run.keyframes.some((frame) => String(frame.outline).includes('solid')));
    expect(flash?.options.duration).toBe(360);
    const rows = [...group.querySelector('.st-list')!.children];
    expect(rows.map((row) => fake.on(row).find((run) => run.options.delay !== undefined)?.options.delay)).toEqual([0, 40]);
    // the dragged one is pulled from where it was let go
    expect(springs(entry('вправа 8')).some((run) => String(run.keyframes[0]!.transform).startsWith('translate('))).toBe(true);
  });
});

describe('the action menu (Н)', () => {
  it('opens out of its entry as a circle (240) and its choices come in one by one', async () => {
    await openWorkout();
    await tap('дії: вправа 8');
    const menu = host.querySelector('.st-menu')!;
    const circle = fake.on(menu).find((run) => String(run.keyframes[0]!.clipPath).startsWith('circle(0px'));
    expect(circle?.options.duration).toBe(240);
    expect([...menu.children].map((item) => fake.on(item)[0]?.options.delay)).toEqual([0, 40, 80]);
  });

  it('a choice that opens a second list brings its choices in one by one, without a new circle', async () => {
    await openWorkout();
    await tap('дії: вправа 8');
    fake.played.length = 0;
    await tap('об’єднати в групу з…');
    const menu = host.querySelector('.st-menu')!;
    expect(fake.on(menu)).toEqual([]);
    expect([...menu.children].map((item) => fake.on(item)[0]?.options.delay)).toEqual([0, 40, 80]);
  });

  it('settles an entry moved through it, and flashes the group it makes', async () => {
    await openWorkout();
    await tap('дії: вправа 6');
    await tap('нижче');
    expect(springs(entry('вправа 6')).some((run) => run.keyframes[0]!.transform === 'scale(1.03)')).toBe(true);
    fake.played.length = 0;
    await tap('дії: вправа 8');
    await tap('об’єднати в групу з…');
    await choose('вправа 7');
    expect(fake.on(host.querySelector('.st-group')).some((run) => run.options.duration === 360)).toBe(true);
  });
});

describe('the action menu: the other ways out', () => {
  const settledHere = (el: Element) => springs(el).some((run) => run.keyframes[0]!.transform === 'scale(1.03)');

  it('settles an exercise taken out of its group in the list around it', async () => {
    await openWorkout();
    await tap('дії: вправа 8');
    await tap('об’єднати в групу з…');
    await choose('вправа 7');
    fake.played.length = 0;
    await tap('дії: вправа 8');
    await tap('вийти з групи');
    const out = entry('вправа 8');
    expect(out.dataset.list).toBe('workout.sessions.0.items');
    expect(settledHere(out)).toBe(true);
  });

  it('settles an exercise moved to another workout there, and «скасувати» moves nothing', async () => {
    await openWorkout();
    await tap('додати тренування');
    (document.querySelector('.text-edit__input') as HTMLTextAreaElement).value = 'б';
    await tap('готово');
    await tap('дії: вправа 7');
    fake.played.length = 0;
    await tap('скасувати');
    expect(fake.played.filter((run) => run.el.matches('.st-item'))).toEqual([]);
    await tap('дії: вправа 7');
    await tap('перемістити в…');
    await choose('тренування Б');
    const moved = entry('вправа 7');
    expect(moved.dataset.list).toBe('workout.sessions.1.items');
    expect(settledHere(moved)).toBe(true);
  });
});

describe('where exactly things move', () => {
  it('settles the one in its own level when the same exercise is in two', async () => {
    start();
    await tap('меню');
    await tap('налаштування');
    await tap('ранкова розминка');
    await tap('розгорнути: рівень 1');
    await tap('розгорнути: рівень 2');
    [...document.querySelectorAll<HTMLButtonElement>('button')].filter((b) => named(b) === 'дії: вправа 1')[1]!.click();
    await settle();
    fake.played.length = 0;
    await tap('нижче');
    const moved = fake.played.find((run) => run.keyframes[0]!.transform === 'scale(1.03)')!;
    expect((moved.el as HTMLElement).dataset).toMatchObject({ list: 'morningWarmup.levels.1.items', index: '1' });
  });

  it('pulls the grouped exercise in from where it was let go', async () => {
    await openWorkout();
    const [first] = exercises();
    const lifted = entry('вправа 8');
    // the entry was let go at 16 / 300; every entry drawn anew lies at 4 / 100
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      const [left, top] = this === lifted ? [16, 300] : this.matches('.st-item') ? [4, 100] : [0, 0];
      return { top, left, height: 100, bottom: top + 100, right: left + 300, width: 300, x: left, y: top, toJSON: () => ({}) };
    });
    document.elementFromPoint = () => first!;
    lift(lifted);
    pointer('pointermove', document, 10, 150);
    pointer('pointerup', document, 10, 150);
    vi.useRealTimers();
    const pulled = springs(entry('вправа 8')).find((run) => String(run.keyframes[0]!.transform).startsWith('translate('));
    expect(pulled!.keyframes[0]!.transform).toBe('translate(12px, 200px) scale(1.03)');
  });

  it('opens the menu from just above the row, 80 px in, and its choices fade in from 6 px above', async () => {
    await openWorkout();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, height: 100, bottom: 100, right: 300, width: 300, x: 0, y: 0, toJSON: () => ({}) });
    await tap('дії: вправа 8');
    const menu = host.querySelector('.st-menu')!;
    expect(String(fake.on(menu)[0]!.keyframes[0]!.clipPath)).toBe('circle(0px at 80px -8px)');
    expect(fake.on(menu.firstElementChild)[0]!.keyframes.map((frame) => [frame.opacity, frame.transform])).toEqual([[0, 'translateY(-6px)'], [1, 'none']]);
  });

  it('opens nothing for an entry with nothing to offer', async () => {
    start();
    await tap('меню');
    await tap('налаштування');
    await tap('самопочуття');
    // «пульс» is the only «одне число»: no neighbour to step to, nowhere to move
    await tap('розгорнути: одне число');
    const actions = host.querySelector<HTMLButtonElement>('.st-item[data-family="tk-number"] .st-actions')!;
    expect(() => actions.click()).not.toThrow();
    expect(host.querySelector('.st-menu')).toBeNull();
  });
});

describe('«створити групу»', () => {
  it('flashes the group gathered from the chosen exercises', async () => {
    await openWorkout();
    await tap('створити групу');
    await tap('вправа 6');
    await tap('вправа 7');
    fake.played.length = 0;
    await tap('зібрати групу');
    expect(fake.on(host.querySelector('.st-group')).some((run) => run.options.duration === 360)).toBe(true);
  });
});

describe('without motion', () => {
  it('lifts with the frame only: no spring, no shaking, nothing after the drop', async () => {
    await openWorkout();
    document.documentElement.setAttribute('data-no-motion', '');
    const [first] = exercises();
    box(first!, 0);
    document.elementFromPoint = () => first!;
    const lifted = entry('вправа 8');
    lift(lifted);
    expect(lifted.classList.contains('st-lift')).toBe(true);
    expect(host.querySelector('.settings-screen')!.classList.contains('st-shaking')).toBe(false);
    pointer('pointermove', document, 10, 10);
    pointer('pointerup', document, 10, 10);
    vi.useRealTimers();
    await tap('дії: вправа 6');
    expect(fake.played).toEqual([]);
  });
});
