import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_HEIGHT, wireNotes } from './notes';
import { fakeAnimate } from './test-animate';

/*
 * The note and the text fields (MICROINTERACTIONS.md, «нотатка й поля в
 * діалогах»): «зберігається, поки пишеш» runs through glyphs at most every
 * 4 s while typing; the corner grip stretches the field up to 2/3 of the
 * screen, like dough; the height is not kept between days.
 */

const field = (key = '2026-11-09|note') => `<span class="field-wrap"><textarea class="field" data-input="note" data-key="${key}"></textarea><span class="field-grip" aria-hidden="true"></span></span>
  <p class="t-3rd-regular muted" data-saving>зберігається, поки пишеш</p>`;

let fake: ReturnType<typeof fakeAnimate>;
let host: HTMLElement;
const area = () => host.querySelector<HTMLTextAreaElement>('textarea')!;
const hint = () => host.querySelector<HTMLElement>('[data-saving]')!;
const typing = () => area().dispatchEvent(new Event('input', { bubbles: true }));
const pointer = (type: string, target: EventTarget, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 10, clientY: y, pointerId: 1 }));
/** jsdom lays nothing out: the field says how tall it is now. */
const tall = (px: number) => Object.defineProperty(area(), 'offsetHeight', { value: px, configurable: true });

wireNotes(document);

beforeEach(() => {
  fake = fakeAnimate();
  host = document.createElement('div');
  host.innerHTML = field();
  document.body.append(host);
});
afterEach(() => {
  fake.restore();
  host.remove();
  document.documentElement.removeAttribute('data-no-motion');
  vi.useRealTimers();
});

describe('«зберігається, поки пишеш»', () => {
  it('runs through glyphs while typing, at most once every 4 s', () => {
    vi.useFakeTimers();
    typing();
    expect(hint().dataset.busy).toBe('');
    vi.advanceTimersByTime(240);
    expect(hint().dataset.busy).toBeUndefined();
    expect(hint().textContent).toBe('зберігається, поки пишеш');
    vi.advanceTimersByTime(1000);
    typing();
    expect(hint().dataset.busy).toBeUndefined();
    vi.advanceTimersByTime(3000);
    typing();
    expect(hint().dataset.busy).toBe('');
  });

  it('stays still without motion, and fields without the line are left alone', () => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(10_000);
    document.documentElement.setAttribute('data-no-motion', '');
    typing();
    expect(hint().dataset.busy).toBeUndefined();
    host.innerHTML = '<textarea class="field"></textarea>';
    expect(() => area().dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
  });
});

describe('stretching by the corner grip', () => {
  const grip = () => host.querySelector('.field-grip')!;
  const pull = (from: number, to: number) => {
    pointer('pointerdown', grip(), from);
    pointer('pointermove', document, to);
  };

  it('follows the finger, and settles with a spring when let go', () => {
    tall(90);
    pull(100, 300);
    expect(area().style.height).toBe('290px');
    expect(grip().classList.contains('field-grip--on')).toBe(true);
    pointer('pointerup', document, 300);
    expect(area().style.height).toBe('290px');
    expect(grip().classList.contains('field-grip--on')).toBe(false);
    const settle = fake.on(area()).find((run) => run.keyframes.at(-1)?.height === '290px');
    expect(settle?.options).toMatchObject({ duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });

  it('past 2/3 of the screen it stretches only a little, like dough, and goes back to 2/3', () => {
    tall(90);
    const max = Math.round((innerHeight * 2) / 3);
    pull(100, 100 + (max - 90) + 100);
    // 100 px past the limit shows as 18
    expect(area().style.height).toBe(`${max + 18}px`);
    pointer('pointerup', document, 0);
    expect(area().style.height).toBe(`${max}px`);
  });

  it('never gets shorter than three lines; below that it resists the same way', () => {
    tall(120);
    pull(300, 300 - (120 - MIN_HEIGHT) - 50);
    expect(area().style.height).toBe(`${MIN_HEIGHT - 9}px`);
    pointer('pointercancel', document, 0);
    expect(area().style.height).toBe(`${MIN_HEIGHT}px`);
  });

  it('keeps the height while the day is drawn anew, but not on another day', async () => {
    tall(90);
    pull(100, 200);
    pointer('pointerup', document, 200);
    host.innerHTML = field();
    await Promise.resolve();
    expect(area().style.height).toBe('190px');
    host.innerHTML = field('2026-11-10|note');
    await Promise.resolve();
    expect(area().style.height).toBe('');
  });

  it('jumps to the size without a spring when motion is off; a move with no pull does nothing', async () => {
    // a day no other test stretched
    host.innerHTML = field('2026-11-11|note');
    await Promise.resolve();
    pointer('pointermove', document, 500);
    expect(area().style.height).toBe('');
    document.documentElement.setAttribute('data-no-motion', '');
    tall(90);
    pull(100, 150);
    pointer('pointerup', document, 150);
    expect(area().style.height).toBe('140px');
    expect(fake.played).toEqual([]);
  });
});
