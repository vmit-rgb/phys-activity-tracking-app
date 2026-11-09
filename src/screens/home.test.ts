import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayKey } from '../domain/dates';
import { readDay } from '../domain/day';
import { readSettings } from '../domain/settings';
import { homeSession } from '../home/session';
import { showHome, type HomeActions, type HomeState } from './home';

// Invented data only: nothing from a real log.
const key = (text: string) => text as DayKey;
const TODAY = key('2026-11-11'); // Wednesday

const settings = readSettings({
  encouragement: ['<b>ти</b> тут'],
  goal: { enabled: true, days: 5, done: ['daytimeWarmup'] },
  daytimeWarmup: { enabled: true, groups: [{ id: 'back', name: 'для спини' }] },
  trackers: [{ id: 'energy', kind: 'scale', ask: ['morning'] }],
});

let host: HTMLElement;
let actions: HomeActions & { goTo: ReturnType<typeof vi.fn<(date: DayKey) => void>>; openMenu: ReturnType<typeof vi.fn<() => void>> };
let closed: Set<string>;
let leave: () => void;

function show(over: Partial<HomeState> = {}): void {
  leave?.();
  leave = showHome(host, {
    settings,
    days: { [key('2026-11-09')]: readDay({ dw: ['back'] }, key('2026-11-09')) },
    date: TODAY,
    today: TODAY,
    session: homeSession(),
    ...over,
  }, actions);
}

const text = (selector: string) => host.querySelector(selector)?.textContent;
const titles = () => [...host.querySelectorAll('.accordion--section .accordion__title')].map((title) => title.textContent);
const nextDay = () => host.querySelector<HTMLButtonElement>('[aria-label="наступний день"]')!;
const prevDay = () => host.querySelector<HTMLButtonElement>('[aria-label="попередній день"]')!;

function touch(type: 'touchstart' | 'touchend', x: number, y: number): void {
  const point = { clientX: x, clientY: y } as Touch;
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, type === 'touchstart' ? 'touches' : 'changedTouches', { value: [point] });
  host.querySelector('.date-nav')!.dispatchEvent(event);
}

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  closed = new Set();
  actions = {
    goTo: vi.fn<(date: DayKey) => void>(),
    openMenu: vi.fn<() => void>(),
    sectionOpen: (id) => !closed.has(id),
    rememberSection: (id, open) => (open ? closed.delete(id) : closed.add(id)),
    edit: () => ({}),
    refresh: () => {},
    toast: () => {},
  };
  show();
});

describe('home', () => {
  it('shows the phrase of the day as text, never as HTML', () => {
    expect(text('.hero__text')).toBe('<b>ти</b> тут');
    expect(host.querySelector('.hero__text b')).toBeNull();
  });

  it('shows the sections that are switched on, in order', () => {
    expect(titles()).toEqual(['самопочуття зранку', 'денна розминка', 'нотатка']);
    expect(text('#sec-dw')).toContain('слухай тіло. якщо щось не так — зупинись <3');
  });

  it('remembers a closed section', () => {
    host.querySelector<HTMLButtonElement>('[data-section="dw"]')!.click();
    expect(host.querySelector<HTMLElement>('#sec-dw')!.hidden).toBe(true);
    show();
    expect(host.querySelector<HTMLElement>('#sec-dw')!.hidden).toBe(true);
    expect(host.querySelector('[data-section="dw"]')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('still opens and closes a section with one tap after the day changed', () => {
    show({ date: key('2026-11-10') });
    host.querySelector<HTMLButtonElement>('[data-section="dw"]')!.click();
    expect(host.querySelector<HTMLElement>('#sec-dw')!.hidden).toBe(true);
    expect(closed.has('dw')).toBe(true);
  });

  it('gives a long phrase the largest header that fits in 3 lines', () => {
    const lineHeights: Record<string, number> = { 't-h1': 60, 't-h2': 50, 't-h3': 42, 't-h4': 38 };
    const linesTaken: Record<string, number> = { 't-h1': 5, 't-h2': 4, 't-h3': 3, 't-h4': 3 };
    const style = (element: Element) => Object.keys(lineHeights).find((name) => element.classList.contains(name)) ?? 't-h1';
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { height: lineHeights[style(this)]! * linesTaken[style(this)]! } as DOMRect;
    });
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => ({ lineHeight: `${lineHeights[style(element)]}px` }) as CSSStyleDeclaration);
    show();
    vi.restoreAllMocks();
    expect(host.querySelector('.hero__text')!.className).toBe('hero__text t-h3');
  });

  it('ends with the footer', () => {
    expect(text('.footer')).toContain('(Олеся + Нитка / AI)');
  });
});

describe('bottom bar', () => {
  it('shows the day and the weekly goal', () => {
    expect(text('.date-nav__date [aria-hidden]')).toBe('ср, 11.11.2026');
    expect(text('.date-nav__date .visually-hidden')).toBe('середа, 11.11.2026');
    expect(text('.bar__goal')).toBe('цей тиждень: 1 з 5 днів');
    expect(host.querySelector('.date-nav__date')!.classList.contains('t-h5')).toBe(true);
  });

  it('makes the date larger when there is no goal', () => {
    show({ settings: readSettings({}) });
    expect(host.querySelector<HTMLElement>('.bar__goal')!.hidden).toBe(true);
    expect(host.querySelector('.date-nav__date')!.classList.contains('t-h4')).toBe(true);
  });

  it('goes to the previous day, but not past today', () => {
    prevDay().click();
    expect(actions.goTo).toHaveBeenCalledWith('2026-11-10');
    expect(nextDay().disabled).toBe(true);
    nextDay().click();
    expect(actions.goTo).toHaveBeenCalledTimes(1);
  });

  it('on a past day goes forward and says whose record it is', () => {
    show({ date: key('2026-11-09') });
    expect(text('.hero__text')).toBe('це запис за пн, 09.11.2026.\nзміни збережуться в цей день.');
    expect(nextDay().disabled).toBe(false);
    nextDay().click();
    expect(actions.goTo).toHaveBeenCalledWith('2026-11-10');
  });

  it('changes the day with a swipe on the date', () => {
    touch('touchstart', 200, 700);
    touch('touchend', 300, 705);
    expect(actions.goTo).toHaveBeenCalledWith('2026-11-10');
    touch('touchstart', 200, 700);
    touch('touchend', 190, 700);
    expect(actions.goTo).toHaveBeenCalledTimes(1);
  });

  it('ignores a two-finger move on the date', () => {
    const event = new Event('touchstart', { bubbles: true });
    Object.defineProperty(event, 'touches', { value: [{ clientX: 200, clientY: 700 }, { clientX: 250, clientY: 700 }] });
    host.querySelector('.date-nav')!.dispatchEvent(event);
    touch('touchend', 320, 700);
    expect(actions.goTo).not.toHaveBeenCalled();
  });

  it('opens the menu', () => {
    host.querySelector<HTMLButtonElement>('.bar__menu')!.click();
    expect(actions.openMenu).toHaveBeenCalledTimes(1);
  });
});

describe('scrolling', () => {
  function scrollTo(y: number): void {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
  }
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
    scrollTo(0);
  });

  it('hides the bar going down and brings it and «вгору» back going up', () => {
    const bar = host.querySelector('.bar')!;
    const toTop = host.querySelector<HTMLButtonElement>('.to-top')!;
    scrollTo(1000);
    expect(bar.classList.contains('bar--hidden')).toBe(true);
    expect(toTop.hidden).toBe(true);
    scrollTo(900);
    expect(bar.classList.contains('bar--hidden')).toBe(false);
    expect(toTop.hidden).toBe(false);
  });

  it('brings the bar back when it gets keyboard focus', () => {
    scrollTo(1000);
    prevDay().focus();
    expect(host.querySelector('.bar')!.classList.contains('bar--hidden')).toBe(false);
  });

  it('«вгору» takes the page back to the top', () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    host.querySelector<HTMLButtonElement>('.to-top')!.click();
    expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scroll.mockRestore();
  });

  it('stops listening once another screen takes over', () => {
    const bar = host.querySelector('.bar')!;
    leave();
    scrollTo(1000);
    expect(bar.classList.contains('bar--hidden')).toBe(false);
  });
});
