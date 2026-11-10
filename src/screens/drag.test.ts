import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dropAt, LIFT_MS, wireDrag, type DragHooks } from './drag';

/*
 * A workout list: exercise 0, a group of two at 1 (a set list inside), a
 * full group of three at 2, exercise 3; and a closed level that holds
 * morning exercises, with a morning exercise to drag.
 */
const S = 'workout.sessions.0.items';
const MARKUP = `
  <div class="st-list" data-family="wo-ex" data-list="${S}" data-end="">
    <div class="st-item" id="e0" data-family="wo-ex" data-list="${S}" data-index="0"><span id="e0t">вправа</span><button class="st-actions">дії: вправа 0</button></div>
    <div class="st-item st-group" id="g1" data-family="wo-ex" data-list="${S}" data-index="1" data-group="2">
      <p id="g1p">група</p>
      <div class="st-list" id="g1l" data-family="wo-ex" data-list="${S}.1.set" data-end="">
        <div class="st-item" id="g1a" data-family="wo-ex" data-list="${S}.1.set" data-index="0"><span id="g1at">a</span></div>
        <div class="st-item" id="g1b" data-family="wo-ex" data-list="${S}.1.set" data-index="1"><span id="g1bt">b</span></div>
      </div>
    </div>
    <div class="st-item st-group" id="g2" data-family="wo-ex" data-list="${S}" data-index="2" data-group="3">
      <div class="st-list" id="g2l" data-family="wo-ex" data-list="${S}.2.set" data-end="">
        <div class="st-item" id="g2a" data-family="wo-ex" data-list="${S}.2.set" data-index="0"></div>
      </div>
    </div>
    <div class="st-item" id="e3" data-family="wo-ex" data-list="${S}" data-index="3"><button class="st-rm" id="rm3">×</button></div>
  </div>
  <div class="st-list" data-family="tk-scale" data-list="trackers" data-end="4">
    <div class="st-item" id="t0" data-family="tk-scale" data-list="trackers" data-index="0"></div>
  </div>
  <div class="st-item st-box" id="lv" data-family="lv" data-list="morningWarmup.levels" data-index="1" data-items="morningWarmup.levels.1.items" data-closed="1"><p id="lvp">рівень</p></div>
  <div class="st-item" id="mw" data-family="mw-ex" data-list="morningWarmup.levels.0.items" data-index="0"></div>
  <p id="outside">поза списками</p>`;

const $ = (id: string) => document.getElementById(id)!;
const box = (el: Element, top: number, height = 100) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, height, bottom: top + height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) });

beforeEach(() => {
  document.body.innerHTML = `<main id="root">${MARKUP}</main>`;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('dropAt', () => {
  it('finds nothing outside the lists or with nothing under the finger', () => {
    expect(dropAt($('e0'), null, 0)).toBeNull();
    expect(dropAt($('e0'), $('outside'), 0)).toBeNull();
  });

  it('puts an entry before or after another by the half it is over', () => {
    box($('e3'), 100);
    expect(dropAt($('e0'), $('rm3'), 110)).toMatchObject({ target: { kind: 'move', list: S, before: 3 }, line: 'before' });
    expect(dropAt($('e0'), $('rm3'), 190)).toMatchObject({ target: { kind: 'move', list: S, before: 4 }, line: 'after' });
  });

  it('makes a group over the middle of an exercise, or joins a group', () => {
    box($('e3'), 100);
    expect(dropAt($('e0'), $('e3'), 150)).toMatchObject({ target: { kind: 'group', onto: { list: S, index: 3 } }, mark: $('e3') });
    box($('g1'), 0);
    expect(dropAt($('e0'), $('g1p'), 50)).toMatchObject({ target: { kind: 'group', onto: { list: S, index: 1 } } });
    box($('g1a'), 0);
    expect(dropAt($('e0'), $('g1at'), 50)).toMatchObject({ target: { kind: 'group', onto: { list: `${S}.1.set`, index: 0 } } });
  });

  it('refuses a full group, but its own exercises reorder inside it', () => {
    box($('g2'), 0);
    expect(dropAt($('e0'), $('g2'), 50)).toEqual({ target: { kind: 'full' }, mark: $('g2') });
    box($('g2a'), 0);
    expect(dropAt($('e0'), $('g2a'), 10)).toEqual({ target: { kind: 'full' }, mark: $('g2') });
    // the gap in a group's list is the group itself: the entry goes before it
    expect(dropAt($('e0'), $('g2l'), 10)).toMatchObject({ target: { kind: 'move', list: S, before: 2 } });
    box($('g1b'), 0);
    expect(dropAt($('g1a'), $('g1bt'), 50)).toMatchObject({ target: { kind: 'move', list: `${S}.1.set`, before: 2 } });
  });

  it('never puts a group inside a group', () => {
    box($('g1a'), 0);
    expect(dropAt($('g2'), $('g1at'), 50)).toBeNull();
    box($('g1'), 0);
    expect(dropAt($('g2'), $('g1l'), 10)).toMatchObject({ target: { kind: 'move', list: S, before: 1 } });
    document.getElementById('g1a')!.remove();
    document.getElementById('g1b')!.remove();
    expect(dropAt($('g2'), $('g1l'), 10)).toMatchObject({ target: { kind: 'move', list: S, before: 1 } });
  });

  it('skips the dragged entry itself and finds the one around it', () => {
    box($('g1'), 0);
    expect(dropAt($('g1a'), $('g1at'), 90)).toMatchObject({ target: { kind: 'move', list: S, before: 2 } });
    expect(dropAt($('e0'), $('e0t'), 0)).toMatchObject({ target: { kind: 'move', list: S, before: null }, line: 'end' });
  });

  it('puts an entry at the end of its list or its kind, or into a closed level', () => {
    expect(dropAt($('t0'), document.querySelector('[data-family="tk-scale"].st-list'), 0)).toMatchObject({ target: { kind: 'move', list: 'trackers', before: 4 } });
    expect(dropAt($('mw'), $('lvp'), 0)).toEqual({ target: { kind: 'move', list: 'morningWarmup.levels.1.items', before: null }, mark: $('lv') });
    expect(dropAt($('e0'), $('lvp'), 0)).toBeNull();
  });

  it('reads an entry with no height as its top half', () => {
    box($('e3'), 0, 0);
    expect(dropAt($('e0'), $('e3'), 0)).toMatchObject({ target: { kind: 'move', before: 3 } });
  });
});

describe('the gesture', () => {
  let hooks: { [K in keyof DragHooks]: ReturnType<typeof vi.fn> };
  const pointer = (type: string, target: EventTarget, x: number, y: number, button = 0) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button }));

  beforeEach(() => {
    vi.useFakeTimers();
    hooks = { drop: vi.fn(), menu: vi.fn(), lifted: vi.fn() };
    wireDrag($('root'), hooks as unknown as DragHooks);
  });

  it('opens the menu when let go without moving', () => {
    pointer('pointerdown', $('e0t'), 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    expect($('e0').classList.contains('st-lift')).toBe(true);
    expect(hooks.lifted).toHaveBeenCalled();
    pointer('pointerup', document, 12, 12);
    expect(hooks.menu).toHaveBeenCalledWith({ list: S, index: 0 }, 'wo-ex');
    expect($('e0').classList.contains('st-lift')).toBe(false);
  });

  it('is a scroll when the finger moves before the lift, or a tap when it lifts early', () => {
    pointer('pointerdown', $('e0t'), 10, 10);
    pointer('pointermove', document, 10, 40);
    vi.advanceTimersByTime(LIFT_MS);
    expect(hooks.lifted).not.toHaveBeenCalled();
    pointer('pointerdown', $('e0t'), 10, 10);
    pointer('pointermove', document, 11, 11);
    pointer('pointerup', document, 11, 11);
    vi.advanceTimersByTime(LIFT_MS);
    expect(hooks.lifted).not.toHaveBeenCalled();
    expect(hooks.menu).not.toHaveBeenCalled();
  });

  it('ignores ×, the «дії» button, a second button and taps outside entries', () => {
    pointer('pointerdown', $('rm3'), 0, 0);
    pointer('pointerdown', $('root').querySelector('.st-actions')!, 0, 0);
    pointer('pointerdown', $('e0t'), 0, 0, 2);
    pointer('pointerdown', $('outside'), 0, 0);
    vi.advanceTimersByTime(LIFT_MS);
    expect(hooks.lifted).not.toHaveBeenCalled();
  });

  it('drags with a proxy, marks targets, scrolls near the edges and drops', () => {
    const scroll = vi.fn();
    vi.stubGlobal('scrollBy', scroll);
    box($('e3'), 100);
    let under: Element | null = $('e3');
    document.elementFromPoint = () => under;
    pointer('pointerdown', $('e0t'), 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    pointer('pointermove', document, 12, 12);
    expect(document.querySelector('.st-proxy')).toBeNull();
    pointer('pointermove', document, 10, 110);
    expect(document.querySelector('.st-proxy')!.textContent).toBe('вправа 0');
    expect($('e0').classList.contains('st-ghost')).toBe(true);
    expect($('e3').previousElementSibling!.className).toBe('st-line');
    pointer('pointermove', document, 10, 190);
    expect($('e3').nextElementSibling!.className).toBe('st-line');
    expect(document.querySelectorAll('.st-line')).toHaveLength(1);
    pointer('pointermove', document, 10, 50);
    expect(scroll).toHaveBeenLastCalledWith(0, -12);
    pointer('pointermove', document, 10, innerHeight - 20);
    expect(scroll).toHaveBeenLastCalledWith(0, 12);
    under = $('e3');
    pointer('pointermove', document, 10, 150);
    expect($('e3').classList.contains('st-target')).toBe(true);
    under = $('g2');
    box($('g2'), 0);
    pointer('pointermove', document, 10, 50);
    expect($('g2').classList.contains('st-full')).toBe(true);
    expect($('e3').classList.contains('st-target')).toBe(false);
    under = document.querySelector('[data-family="wo-ex"].st-list');
    pointer('pointermove', document, 10, 300);
    expect(under!.lastElementChild!.className).toBe('st-line');
    pointer('pointerup', document, 10, 300);
    expect(hooks.drop).toHaveBeenCalledWith({ list: S, index: 0 }, { kind: 'move', list: S, before: null });
    expect(document.querySelector('.st-proxy, .st-line, .st-full')).toBeNull();
  });

  it('drops nothing where nothing takes it, and nothing when cancelled', () => {
    document.elementFromPoint = () => $('outside');
    pointer('pointerdown', $('e0t'), 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    pointer('pointermove', document, 10, 300);
    pointer('pointerup', document, 10, 300);
    pointer('pointerdown', $('e0t'), 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    pointer('pointermove', document, 10, 300);
    pointer('pointercancel', document, 10, 300);
    expect(hooks.drop).not.toHaveBeenCalled();
    expect(hooks.menu).not.toHaveBeenCalled();
  });

  it('keeps the page still under a lifted entry, swallows the click after and the phone’s menu', () => {
    const before = new Event('touchmove', { cancelable: true });
    $('e0').dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    pointer('pointerdown', $('e0t'), 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    const lifted = new Event('touchmove', { bubbles: true, cancelable: true });
    $('e0').dispatchEvent(lifted);
    expect(lifted.defaultPrevented).toBe(true);
    pointer('pointerup', document, 10, 10);
    const clicked = vi.fn();
    $('root').addEventListener('click', clicked);
    $('e0t').click();
    expect(clicked).not.toHaveBeenCalled();
    $('e0t').click();
    expect(clicked).toHaveBeenCalledTimes(1);
    pointer('pointerdown', $('e0t'), 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    pointer('pointerup', document, 10, 10);
    vi.advanceTimersByTime(500);
    $('e0t').click();
    expect(clicked).toHaveBeenCalledTimes(2);
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    $('e0t').dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    const elsewhere = new Event('contextmenu', { bubbles: true, cancelable: true });
    $('outside').dispatchEvent(elsewhere);
    expect(elsewhere.defaultPrevented).toBe(false);
  });

  it('starts no second press while one is on, and a late timer does nothing', () => {
    pointer('pointerdown', $('e0t'), 10, 10);
    pointer('pointerdown', $('g1at'), 10, 10);
    pointer('pointercancel', document, 10, 10);
    vi.advanceTimersByTime(LIFT_MS);
    expect(hooks.lifted).not.toHaveBeenCalled();
  });
});
