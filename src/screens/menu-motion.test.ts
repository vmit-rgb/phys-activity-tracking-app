import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAnimate } from '../ui/test-animate';
import { menuIn, menuOut } from './menu-motion';

// Geometry with real boxes (jsdom has none): a 400 × 800 menu, ✕ at the bottom left.
let fake: ReturnType<typeof fakeAnimate>;
let host: HTMLElement;

function box(el: Element, left: number, top: number, width: number, height: number): void {
  el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
}

beforeEach(() => {
  fake = fakeAnimate();
  document.body.innerHTML = `
    <main id="app">
      <div class="menu">
        <div class="menu__top"></div>
        <div class="menu__content"><nav></nav><section></section></div>
      </div>
      <nav class="bar"><button class="bar__menu"></button></nav>
    </main>`;
  host = document.querySelector('#app')!;
  box(host.querySelector('.menu')!, 0, 0, 400, 800);
  box(host.querySelector('.bar__menu')!, 20, 820, 40, 40);
  box(host.querySelector('.menu__top')!, 0, 0, 100, 60);
  box(host.querySelector('.menu__content nav')!, 0, 100, 400, 200);
  box(host.querySelector('.menu__content section')!, 0, 400, 200, 100);
});
afterEach(() => {
  fake.restore();
  document.documentElement.removeAttribute('data-no-motion');
});

const blocks = () => [host.querySelector('.menu__top'), host.querySelector('.menu__content nav'), host.querySelector('.menu__content section')];

describe('the menu from ≡', () => {
  it('grows as a circle from the middle of ✕ until it covers the menu', () => {
    menuIn(host);
    const circle = fake.on(host.querySelector('.menu'))[0]!;
    // ✕'s middle (40, 840); the far corner (400, 0): hypot(360, 840) = 913.9 + 40
    expect(circle.keyframes).toEqual([{ clipPath: 'circle(0px at 40px 840px)' }, { clipPath: 'circle(954px at 40px 840px)' }]);
  });

  it('starts each block a third of the way to ✕, turned the other way from the one before, small', () => {
    menuIn(host);
    const starts = blocks().map((block) => fake.on(block)[0]!.keyframes[0]);
    expect(starts).toEqual([
      { opacity: 0, transform: 'translate(-3px, 284px) rotate(-4deg) scale(.6)' },
      { opacity: 0, transform: 'translate(-56px, 224px) rotate(5.5deg) scale(.6)' },
      { opacity: 0, transform: 'translate(-21px, 137px) rotate(-7deg) scale(.6)' },
    ]);
    expect(fake.on(blocks()[0]!)[0]!.keyframes[1]).toEqual({ opacity: 1, transform: 'none' });
  });

  it('folds back the same way: blocks to ✕ and fading, the circle closing', () => {
    const done = vi.fn();
    menuOut(host, done);
    expect(fake.on(blocks()[1]!)[0]!.keyframes).toEqual([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translate(-56px, 224px) rotate(5.5deg) scale(.6)' },
    ]);
    const fold = fake.on(host.querySelector('.menu')).at(-1)!;
    expect(fold.keyframes.at(-1)).toEqual({ clipPath: 'circle(0px at 40px 840px)' });
    expect(done).not.toHaveBeenCalled();
    fold.finish();
    expect(done).toHaveBeenCalledOnce();
  });

  it('folds only once, however many times ✕ is tapped', () => {
    const done = vi.fn();
    menuOut(host, done);
    const played = fake.played.length;
    menuOut(host, done);
    expect(fake.played).toHaveLength(played);
  });

  it('is still without motion, and leaves at once', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    const done = vi.fn();
    menuIn(host);
    menuOut(host, done);
    expect(fake.played).toEqual([]);
    expect(done).toHaveBeenCalledOnce();
  });

  it('does nothing to a screen that has no menu', () => {
    host.innerHTML = '<div class="page"></div>';
    const done = vi.fn();
    menuIn(host);
    menuOut(host, done);
    expect(fake.played).toEqual([]);
    expect(done).toHaveBeenCalledOnce();
  });

  it('grows from the bottom left corner when there is no ✕', () => {
    host.querySelector('.bar')!.remove();
    menuIn(host);
    expect(fake.on(host.querySelector('.menu'))[0]!.keyframes[0]).toEqual({ clipPath: `circle(0px at 0px ${innerHeight}px)` });
  });
});
