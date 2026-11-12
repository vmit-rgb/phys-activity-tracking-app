import type { DayKey } from '../domain/dates';
import type { Completed } from '../domain/progress';
import type { Accessibility } from '../domain/settings';
import { foldShut } from '../ui/accordion';
import { decode, EASE, moving, MS, play, whenDone } from '../ui/motion';
import { buzz } from './signal';

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
  const last = runs.at(-1);
  // nothing plays (no motion, or a browser that can't animate): the new month at once, nothing to assemble
  if (!last) return redraw();
  swapping.add(block);
  whenDone(last, () => {
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

/* ---- rewards: what an edit finished (0.81 rewLevel, rewDay) ---- */

/** The level's title is struck through (720 ms); the drawn line-through takes over at the end. */
function strike(title: Element): void {
  if (!moving()) return;
  const text = title.textContent ?? '';
  const line = document.createElement('span');
  line.className = 'fx-strk';
  line.textContent = text;
  title.classList.add('fx-striking');
  title.replaceChildren(line);
  whenDone(play(line, [{ backgroundSize: '0% 2px' }, { backgroundSize: '100% 2px' }], { duration: MS.xl, easing: EASE.out, fill: 'forwards' }), () => {
    title.classList.remove('fx-striking');
    title.textContent = text;
  });
}

/** A warm-up level done: struck through, folded, vibration 30 ms. */
function levelDoneMotion(host: HTMLElement, memo: string, off: Pick<Accessibility, 'noVibration'>): void {
  buzz(30, off);
  const trigger = [...host.querySelectorAll<HTMLButtonElement>('button.accordion[data-memo]')].find((button) => button.dataset.memo === memo);
  if (!trigger) return;
  const title = trigger.querySelector('.accordion__title');
  if (title) strike(title);
  foldShut(trigger);
}

const accent = (alpha: number) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '185 179 189'} / ${alpha})`;

/** An accent glow rises from the bottom bar (1200 ms), then leaves the page. */
function barGlow(): void {
  if (!moving()) return;
  const glow = document.createElement('div');
  glow.className = 'fx-barglow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.append(glow);
  whenDone(play(glow, [{ opacity: 0, transform: 'scaleY(.2)' }, { opacity: 1, transform: 'scaleY(1)', offset: 0.35 }, { opacity: 0, transform: 'scaleY(1.6)' }], {
    duration: MS.xxl, easing: EASE.out,
  }), () => glow.remove());
}

/**
 * A day counted / +1 to the weekly goal: the goal line re-forms (1200 ms) and
 * grows for about half a second; an accent glow spreads round the day and up
 * from the bar (1200 ms); vibration [40, 180, 40].
 */
function dayCounted(host: HTMLElement, date: DayKey, off: Pick<Accessibility, 'noVibration'>): void {
  buzz([40, 180, 40], off);
  // a day counts only with the goal on, so its line is always shown
  const goal = host.querySelector<HTMLElement>('.bar__goal');
  if (goal) {
    decode(goal, MS.xxl);
    play(goal, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.15 }, { transform: 'scale(1.12)', offset: 0.55 }, { transform: 'scale(1)' }], {
      duration: MS.xxl, easing: EASE.out,
    });
  }
  for (const cell of host.querySelectorAll<HTMLElement>(`.cal-day--shown[data-day="${date}"]`)) {
    play(cell, [{ boxShadow: `0 0 0 0 ${accent(0)}` }, { boxShadow: `0 0 14px 8px ${accent(0.55)}`, offset: 0.35 }, { boxShadow: `0 0 26px 18px ${accent(0)}` }], {
      duration: MS.xxl, easing: EASE.out,
    });
  }
  barGlow();
}

/** Plays what an edit of `date` finished: each level done, then the day counted after them. */
export function reward(host: HTMLElement, date: DayKey, done: Completed, off: Pick<Accessibility, 'noVibration'>): void {
  for (const id of done.levels) levelDoneMotion(host, `${date}|level|${id}`, off);
  if (!done.day) return;
  if (done.levels.length === 0) dayCounted(host, date, off);
  else setTimeout(() => dayCounted(host, date, off), MS.xl);
}
