import type { DayKey } from '../domain/dates';
import { decode, EASE, MS, play, whenDone } from '../ui/motion';

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

/* ---- the calendar: another month, the sheet from the date (0.81 calSwap, calAssemble, popIn, popOut) ---- */

const cellsOf = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('.cal__grid > *')];

interface Point { readonly x: number; readonly y: number }

function centreOf(root: ParentNode): Point {
  const box = root.querySelector('.cal__grid')?.getBoundingClientRect();
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 };
}

/** Where a cell goes in the heap: towards the centre, a little off, turned and smaller. */
function heap(cell: Element, centre: Point, pull: number): string {
  const box = cell.getBoundingClientRect();
  const dx = (centre.x - (box.left + box.width / 2)) * pull + (Math.random() - 0.5) * 26;
  const dy = (centre.y - (box.top + box.height / 2)) * pull + (Math.random() - 0.5) * 20;
  return `translate(${dx}px, ${dy}px) rotate(${(Math.random() - 0.5) * 70}deg) scale(.55)`;
}

/** The days fly apart out of a heap (240 ms); the month name re-forms. */
function assemble(root: ParentNode, fromHeap: boolean): void {
  const centre = centreOf(root);
  cellsOf(root).forEach((cell, i) => {
    play(cell, [{ transform: heap(cell, centre, fromHeap ? 0.82 : 0.6), opacity: fromHeap ? 0.85 : 0 }, { transform: 'none', opacity: 1 }], {
      duration: MS.s, delay: (i % 7) * 6, easing: EASE.spring, fill: 'backwards',
    });
  });
  if (fromHeap) decode(root.querySelector<HTMLElement>('.cal__month'));
}

const swapping = new WeakSet<HTMLElement>();

/**
 * Another month: the cells pull into a heap (120 ms), `redraw` puts the new
 * month in, and it flies apart (240 ms). A tap during the heap redraws at once.
 */
export function swapMonth(block: HTMLElement, redraw: () => void): void {
  const cells = cellsOf(block);
  if (swapping.has(block)) return redraw();
  const centre = centreOf(block);
  const runs = cells.map((cell) => play(cell, [{ transform: 'none', opacity: 1 }, { transform: heap(cell, centre, 0.82), opacity: 0.85 }], {
    duration: MS.xs, easing: EASE.in, fill: 'forwards',
  }));
  if (!runs.at(-1)) return redraw();
  swapping.add(block);
  whenDone(runs.at(-1)!, () => {
    swapping.delete(block);
    redraw();
    assemble(block, true);
  });
}

/** The circle the sheet's panel grows from: the date in the bar. */
function circleFrom(panel: Element, origin: Element): (radius: number | null) => string {
  const at = origin.getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  const x = at.left + at.width / 2 - box.left;
  const y = at.top + at.height / 2 - box.top;
  const full = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height)) + 20;
  return (radius) => `circle(${radius ?? full}px at ${x}px ${y}px)`;
}

/** The sheet opens out of the date (360 ms), the scrim fades in, the days come together. */
export function sheetIn(sheet: HTMLElement, origin: Element): void {
  const panel = sheet.querySelector('.cal-sheet__panel');
  if (!panel) return;
  const circle = circleFrom(panel, origin);
  play(panel, [{ clipPath: circle(0) }, { clipPath: circle(null) }], { duration: MS.m, easing: EASE.out });
  play(sheet.querySelector('.cal-sheet__scrim'), [{ opacity: 0 }, { opacity: 1 }], { duration: MS.m, easing: EASE.out });
  assemble(panel, false);
}

/** The sheet closes back into the date (240 ms), the scrim fades; `done` when it is gone. */
export function sheetOut(sheet: HTMLElement, origin: Element, done: () => void): void {
  const panel = sheet.querySelector('.cal-sheet__panel');
  if (!panel) return done();
  const circle = circleFrom(panel, origin);
  play(sheet.querySelector('.cal-sheet__scrim'), [{ opacity: 1 }, { opacity: 0 }], { duration: MS.s, easing: EASE.in, fill: 'forwards' });
  whenDone(play(panel, [{ clipPath: circle(null) }, { clipPath: circle(0) }], { duration: MS.s, easing: EASE.in, fill: 'forwards' }), done);
}
