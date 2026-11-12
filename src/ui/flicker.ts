import { MS, moving } from './motion';

/*
 * Theme and accent change (MICROINTERACTIONS.md «Перемикання теми»): two slow
 * flickers like an old TV's noise, 720 ms in all; the new look appears in the
 * middle. An accent change flickers only the accent colour. Ported from
 * 0.81's `tvFlicker` and `accentFlicker` (strength 0.7 of the first, Olesia 2026-11-03).
 */

/** When the new look is put on, as a part of 720 ms. */
const SWAP_AT = 0.55;

/** The TV layer's opacity over the 720 ms: two flickers. */
export const TV_KEYFRAMES: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.644, offset: 0.14 },
  { opacity: 0.084, offset: 0.3 },
  { opacity: 0.084, offset: 0.4 },
  { opacity: 0.672, offset: 0.55 },
  { opacity: 0.14, offset: 0.74 },
  { opacity: 0 },
];

/** A flicker still going: its timers, and the change it hasn't put on yet. */
let current: { timers: ReturnType<typeof setTimeout>[]; apply: (() => void) | null; end(): void } | null = null;

/** A new change while one still flickers: the old one is put on at once, then the new one runs. */
function finishCurrent(): void {
  if (!current) return;
  const run = current;
  current = null;
  run.timers.forEach(clearTimeout);
  run.apply?.();
  run.end();
}

/** The theme: a noise layer flickers twice over the screen; `apply` runs in the middle. */
export function tvFlicker(apply: () => void): void {
  finishCurrent();
  if (!moving()) return apply();
  const tv = document.createElement('div');
  tv.className = 'fx-tv';
  tv.setAttribute('aria-hidden', 'true');
  document.body.append(tv);
  const run = {
    apply: apply as (() => void) | null,
    timers: [] as ReturnType<typeof setTimeout>[],
    end: () => tv.remove(),
  };
  current = run;
  tv.animate?.(TV_KEYFRAMES, { duration: MS.xl, easing: 'linear', fill: 'forwards' });
  run.timers.push(
    setTimeout(() => {
      run.apply = null;
      apply();
    }, Math.round(MS.xl * SWAP_AT)),
    setTimeout(() => {
      // a newer flicker would have cleared this timer: this one is still the current
      current = null;
      tv.remove();
    }, MS.xl),
  );
}

/** `r g b` of a colour the browser computed (#rrggbb, rgb(…) or «r g b»); null when it can't tell. */
export function rgbOf(value: string): [number, number, number] | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) return [0, 2, 4].map((at) => parseInt(hex[1]!.slice(at, at + 2), 16)) as [number, number, number];
  const parts = text.replace(/^rgba?\(|\)$/g, '').split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? (parts as [number, number, number]) : null;
}

/** The accent dimmed into the page: 45 % accent (as 0.81). */
export function dimmed(accent: string, page: string): string | null {
  const a = rgbOf(accent);
  const b = rgbOf(page);
  if (!a || !b) return null;
  return a.map((v, i) => Math.round(v * 0.45 + b[i]! * 0.55)).join(' ');
}

/** When each step of the accent flicker comes, in ms: old dim, old, old dim, new, new dim, new. */
const ACCENT_STEPS = [0, 140, 300, 400, 520, 640] as const;

/**
 * The accent: only the accent colour flickers (old dim, old, dim, new, new dim,
 * new); everything else keeps still. tokens.css builds every accent tint from
 * --accent-rgb, so dimming it dims them all.
 */
export function accentFlicker(root: HTMLElement, apply: () => void): void {
  finishCurrent();
  if (!moving()) return apply();
  const style = root.style;
  const computed = () => getComputedStyle(root);
  const dim = () => {
    const css = computed();
    const value = dimmed(css.getPropertyValue('--accent-rgb'), css.getPropertyValue('--bg'));
    if (value) style.setProperty('--accent-rgb', value);
  };
  const full = () => style.removeProperty('--accent-rgb');
  const run = { apply: apply as (() => void) | null, timers: [] as ReturnType<typeof setTimeout>[], end: full };
  current = run;
  const steps: (() => void)[] = [
    dim,
    full,
    dim,
    () => {
      full();
      run.apply = null;
      apply();
    },
    dim,
    () => {
      full();
      // a newer flicker would have cleared this timer: this one is still the current
      current = null;
    },
  ];
  steps.forEach((step, i) => {
    run.timers.push(setTimeout(() => {
      // a dim step reads the colour shown now, so it needs the inline value gone first
      full();
      step();
    }, ACCENT_STEPS[i]));
  });
}
