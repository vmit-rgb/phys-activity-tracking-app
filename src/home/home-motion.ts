import type { DayKey } from '../domain/dates';
import { decode, EASE, MS, play } from '../ui/motion';

/*
 * Motion on home, stage 7b (MICROINTERACTIONS.md), ported from 0.81's
 * enterAnim, popSel and the rewards. Home draws itself anew on every change,
 * so these play on the screen drawn after it.
 */

/** The chosen day jumps: on home and in the calendar sheet. */
export function popShownDay(root: ParentNode): void {
  for (const cell of root.querySelectorAll('.cal-day--shown')) {
    play(cell, [{ transform: 'scale(.6)', opacity: 0.3 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], {
      duration: MS.l, delay: MS.xs, easing: EASE.out, fill: 'backwards',
    });
  }
}

/**
 * Another day: the content comes in from the side it was swiped from (32 px),
 * the calendar fades in after it, the date in the bar re-forms, the chosen day jumps.
 */
export function dayArrives(host: HTMLElement, from: DayKey, to: DayKey): void {
  if (from === to) return;
  const dx = to > from ? 32 : -32;
  for (const part of host.querySelectorAll('.hero, .home__sections')) {
    play(part, [{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }], { duration: MS.m, easing: EASE.out, fill: 'backwards' });
  }
  play(host.querySelector('.home > .cal-block'), [{ opacity: 0 }, { opacity: 1 }], { duration: MS.m, delay: MS.xs, easing: EASE.out, fill: 'backwards' });
  decode(host.querySelector<HTMLElement>('.date-nav__date span[aria-hidden="true"]'));
  popShownDay(host.querySelector('.home > .cal-block') ?? host);
}
