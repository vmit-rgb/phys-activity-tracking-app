import { decode, EASE, glyphs, moving, MS, play, scrambleTo, stagger, whenDone } from '../ui/motion';
import type { StopwatchState } from './session';

/*
 * Motion of the taps inside the home sections, stage 7b (MICROINTERACTIONS.md),
 * ported from 0.81's fxOut, slideInLast, sigs / undoBack and fxActed. Home
 * draws itself anew on every change, so each move is found again on the screen
 * drawn after it.
 */

/** A control on the screen drawn now, found by its action and one data attribute. */
export function control<T extends HTMLElement = HTMLElement>(screen: ParentNode, act: string, name: string, value: string): T | undefined {
  return [...screen.querySelectorAll<T>(`[data-act="${act}"]`)].find((el) => el.dataset[name] === value);
}

/**
 * A row about to be removed: call before the change, then the returned
 * function after it. A still copy of the row leaves to the right with a fade
 * (240 ms) where the row was, while the list is already right underneath.
 */
export function rowLeaving(row: Element | null): () => void {
  if (!row || !moving()) return () => {};
  const box = row.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;
  return () => {
    ghost.classList.add('fx-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    Object.assign(ghost.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    document.body.append(ghost);
    const out = play(ghost, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(28px)' }], { duration: MS.s, easing: EASE.in, fill: 'forwards' });
    whenDone(out, () => ghost.remove());
  };
}

/** A new set, «ще раз» timer or lap floats in from the left (360 ms): the last row next to `button`. */
export function rowAdded(button: Element | undefined): void {
  const row = button?.closest('.wo-ex, .sw-block, .mv-kind')?.querySelector('.sets')?.lastElementChild;
  play(row, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: MS.m, easing: EASE.out, fill: 'backwards' });
}

const ROWS = '.set-row, .wo-ex';

/**
 * A row is known by what is in it (numbers typed, time), not by its place: a
 * row coming back shifts the others. An exercise is known by its name alone,
 * so one that got a set back is the same exercise and only the set is new.
 */
function rowSignature(row: Element): string {
  if (row.matches('.wo-ex')) return `wo-ex|${row.querySelector('.wo-ex__head')?.textContent ?? ''}`;
  const values = [...row.querySelectorAll<HTMLInputElement>('input')].map((field) => field.value);
  const time = row.querySelector('[data-sw-time]')?.textContent ?? '';
  return [row.className, time, ...values].join('|');
}

/** How many rows of each kind are on screen now. */
export function rowsNow(screen: ParentNode): Map<string, number> {
  const count = new Map<string, number>();
  for (const row of screen.querySelectorAll(ROWS)) count.set(rowSignature(row), (count.get(rowSignature(row)) ?? 0) + 1);
  return count;
}

/** What «скасувати» brought back returns with a spring (420 ms): the rows that were not there before. */
export function rowsBack(screen: ParentNode, before: Map<string, number>): void {
  const left = new Map(before);
  const fresh = [...screen.querySelectorAll(ROWS)].filter((row) => {
    const n = left.get(rowSignature(row)) ?? 0;
    left.set(rowSignature(row), n - 1);
    return n <= 0;
  });
  fresh.filter((row) => !fresh.some((other) => other !== row && other.contains(row))).slice(0, 6).forEach((row) => {
    play(row, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: MS.l, easing: EASE.spring, fill: 'backwards' });
  });
}

/** Choosing a workout, or «прибрати з цього дня»: the section assembles one by one. */
export function workoutAssembles(screen: ParentNode): void {
  const body = screen.querySelector('#sec-wo');
  if (body) stagger(body);
}

/* ---- the stopwatch: ▶ → ■ → ✓ by glyph frames; the saved time re-forms; «знову» dissolves the digits ---- */

const SW_FRAMES: Partial<Record<StopwatchState, readonly string[]>> = {
  running: ['>', '=', '#'],
  saved: ['#', '/', 'v'],
};

/** What the stopwatch shows before a tap, to tell after it what changed. */
export interface StopwatchSeen { readonly state: string | undefined; readonly time: string }

export function stopwatchSeen(button: Element): StopwatchSeen {
  const sw = button.closest<HTMLElement>('.sw');
  return { state: sw?.dataset.state, time: sw?.querySelector('[data-sw-time]')?.textContent ?? '' };
}

export function stopwatchMoved(button: HTMLElement | undefined, seen: StopwatchSeen): void {
  const sw = button?.closest<HTMLElement>('.sw');
  const time = sw?.querySelector<HTMLElement>('[data-sw-time]');
  if (!button || !sw || !time) return;
  const state = sw.dataset.state as StopwatchState;
  if (state === seen.state) return;
  const frames = SW_FRAMES[state];
  if (frames) glyphs(button, frames);
  if (state === 'saved') decode(time);
  if (state === 'running' && seen.state === 'retry') timeDissolves(time, seen.time);
}

/** The time changes by a run of glyphs, from what it was: «знову», or a timer reset to zero. */
export function timeDissolves(time: HTMLElement | null | undefined, was: string): void {
  if (!time || !moving()) return;
  const target = time.textContent ?? '';
  time.textContent = was;
  scrambleTo(time, target);
}

/* ---- the slider: saved → the thumb drops into a grey dot and the value re-forms; «скинути» → the thumb pops back ---- */

function flag(el: Element | undefined, name: string): void {
  if (!el || !moving()) return;
  el.classList.add(name);
  setTimeout(() => el.classList.remove(name), MS.l);
}

export function sliderSaved(slider: HTMLInputElement | undefined): void {
  flag(slider, 'fx-lock');
  decode(slider?.closest('.tracker')?.querySelector<HTMLElement>('.tracker__value'));
}

export function sliderReset(slider: HTMLInputElement | undefined): void {
  flag(slider, 'fx-unlock');
}
