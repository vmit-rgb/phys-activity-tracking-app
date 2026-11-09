/*
 * Small movement rules of the home screen, without the DOM.
 */

export interface Point { readonly x: number; readonly y: number }

/**
 * Swipe on the date changes the day (Olesia, 2026-10-29): a clear sideways
 * move of more than 50 px. Left goes to the next day, right to the previous.
 */
export function swipeDays(start: Point, end: Point): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) <= 50 || Math.abs(dx) <= Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export interface ScrollFacts {
  readonly y: number;
  readonly lastY: number;
  /** the furthest the page can scroll */
  readonly maxY: number;
  readonly barFocused: boolean;
  readonly barShown: boolean;
}

/**
 * The bottom bar hides while scrolling down and comes back on scroll up, near
 * the top and bottom, and while it has keyboard focus (as in «бета 0.81»).
 * Moves under 6 px change nothing.
 */
export function barShown({ y, lastY, maxY, barFocused, barShown: shown }: ScrollFacts): boolean {
  if (barFocused || y < 80 || y >= maxY - 4) return true;
  if (y > lastY + 6) return false;
  if (y < lastY - 6) return true;
  return shown;
}

/** «вгору» floats once the page is scrolled down and the bar is out (Figma `note/back-to-top`). */
export function toTopShown(y: number, bar: boolean): boolean {
  return bar && y > 500;
}
