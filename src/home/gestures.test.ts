import { describe, expect, it } from 'vitest';
import { barShown, swipeDays, toTopShown, type ScrollFacts } from './gestures';

describe('swipeDays', () => {
  const start = { x: 200, y: 700 };
  it('left goes to the next day, right to the previous', () => {
    expect(swipeDays(start, { x: 120, y: 705 })).toBe(1);
    expect(swipeDays(start, { x: 290, y: 690 })).toBe(-1);
  });
  it('ignores short moves and mostly vertical ones', () => {
    expect(swipeDays(start, { x: 150, y: 700 })).toBe(0);
    expect(swipeDays(start, { x: 120, y: 760 })).toBe(0);
    expect(swipeDays(start, start)).toBe(0);
  });
});

describe('barShown', () => {
  const facts = (over: Partial<ScrollFacts>): ScrollFacts => ({ y: 1000, lastY: 1000, maxY: 5000, barFocused: false, barShown: true, ...over });
  it('hides on scroll down and comes back on scroll up', () => {
    expect(barShown(facts({ y: 1010, lastY: 1000 }))).toBe(false);
    expect(barShown(facts({ y: 990, lastY: 1000, barShown: false }))).toBe(true);
  });
  it('keeps its state for small moves', () => {
    expect(barShown(facts({ y: 1004, lastY: 1000, barShown: false }))).toBe(false);
    expect(barShown(facts({ y: 996, lastY: 1000, barShown: true }))).toBe(true);
  });
  it('always shows near the top, at the bottom and with keyboard focus', () => {
    expect(barShown(facts({ y: 79, lastY: 40, barShown: false }))).toBe(true);
    expect(barShown(facts({ y: 4996, lastY: 4000, barShown: false }))).toBe(true);
    expect(barShown(facts({ y: 2000, lastY: 1000, barFocused: true }))).toBe(true);
  });
});

describe('toTopShown', () => {
  it('shows once scrolled down, only with the bar', () => {
    expect(toTopShown(501, true)).toBe(true);
    expect(toTopShown(500, true)).toBe(false);
    expect(toTopShown(2000, false)).toBe(false);
  });
});
