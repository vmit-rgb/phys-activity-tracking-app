import { EASE, MS, moving, play, whenDone } from './motion';

/*
 * Chips and tabs switch in stripes (MICROINTERACTIONS.md: «чип / таб
 * увімкнено», «таби експорту»; Figma tabs/segmented 179:3188, frames «middle
 * of animation 1» and «selected4»; ported from 0.81's `stripeRun`). The accent
 * fill breaks into vertical stripes of uneven width in a light neutral, the
 * stripes thin out, then gather into the new state; the text colour changes
 * halfway. 360 ms in all: each stripe runs 270 and starts up to 90 later,
 * by its place in the direction of the move.
 */

/** Whether the point at `x` (0 … 1 across the host) is filled. */
type Filled = (x: number) => boolean;

const LAG = MS.m / 4;
const RUN = MS.m - LAG;

/** Uneven widths, wide and narrow bars mixed, as in the Figma frames. */
function cuts(n: number): { left: number; width: number }[] {
  const widths = Array.from({ length: n }, () => 0.55 + Math.random() * 1.1);
  const sum = widths.reduce((a, b) => a + b, 0);
  let x = 0;
  return widths.map((w) => {
    const cut = { left: x / sum, width: w / sum };
    x += w;
    return cut;
  });
}

const hex = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) : null);

/** The light neutral of the stripes in the middle: ink and page, 72 : 28. */
function tone(css: CSSStyleDeclaration): string {
  const ink = hex(css.getPropertyValue('--ink').trim());
  const bg = hex(css.getPropertyValue('--bg').trim());
  if (!ink || !bg) return 'rgb(185 179 189)';
  return `rgb(${ink.map((v, i) => Math.round(v * 0.72 + bg[i]! * 0.28)).join(' ')})`;
}

const colours = () => {
  const css = getComputedStyle(document.documentElement);
  return { accent: `rgb(${css.getPropertyValue('--accent-rgb').trim()})`, tone: tone(css) };
};

/** Stripes over `host`; `dir` 1 runs left to right, -1 right to left. `done` once they are gone. */
function stripeRun(host: HTMLElement, was: Filled, will: Filled, dir: 1 | -1, done: () => void): void {
  const n = Math.max(6, Math.round(host.getBoundingClientRect().width / 30));
  const { accent, tone: middle } = colours();
  const box = document.createElement('span');
  box.className = 'fx-stripes';
  box.setAttribute('aria-hidden', 'true');
  host.append(box);
  const runs = cuts(n).map(({ left, width }) => {
    const stripe = document.createElement('i');
    stripe.style.left = `${left * 100}%`;
    stripe.style.width = `${width * 100 + 0.3}%`;
    box.append(stripe);
    const mid = left + width / 2;
    const thin = (from: number, spread: number) => `scaleX(${(from + Math.random() * spread).toFixed(2)})`;
    return play(stripe, [
      { backgroundColor: accent, opacity: was(mid) ? 1 : 0, transform: 'scaleX(1)' },
      { backgroundColor: middle, opacity: 1, transform: thin(0.5, 0.35), offset: 0.35 },
      { backgroundColor: middle, opacity: 1, transform: thin(0.25, 0.35), offset: 0.7 },
      { backgroundColor: accent, opacity: will(mid) ? 1 : 0, transform: 'scaleX(1)' },
    ], { duration: RUN, delay: Math.round((dir < 0 ? 1 - mid : mid) * LAG), easing: EASE.out, fill: 'both' });
  });
  let left = runs.length;
  const one = () => {
    left -= 1;
    if (left > 0) return;
    box.remove();
    done();
  };
  runs.forEach((run) => whenDone(run, one));
}

/** The label turns from `from` to `to` halfway through. */
function swapText(el: HTMLElement, from: string, to: string): void {
  play(el, [{ color: from }, { color: from, offset: 0.5 }, { color: to, offset: 0.51 }, { color: to }], { duration: MS.m });
}

/** A chip just turned on (or off): the stripes left to right inside it. */
export function chipFill(chip: HTMLElement, on: boolean): void {
  if (!moving() || typeof chip.animate !== 'function') return;
  const now = getComputedStyle(chip).color;
  const before = on ? colours().accent : getComputedStyle(document.documentElement).getPropertyValue('--on-accent').trim();
  chip.classList.add('fx-run');
  stripeRun(chip, () => !on, () => on, 1, () => chip.classList.remove('fx-run'));
  swapText(chip, before, now);
}

/** Tabs side by side: the fill flows out of `from` and gathers in `to`. */
export function tabFlow(group: HTMLElement, from: HTMLElement, to: HTMLElement): void {
  if (!moving() || typeof group.animate !== 'function') return;
  const all = group.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const over = (r: DOMRect): Filled => (x) => {
    const px = all.left + x * all.width;
    return px >= r.left && px <= r.right;
  };
  group.classList.add('fx-run');
  stripeRun(group, over(a), over(b), b.left > a.left ? 1 : -1, () => group.classList.remove('fx-run'));
  const [was, will] = [getComputedStyle(from).color, getComputedStyle(to).color];
  swapText(to, was, will);
  swapText(from, will, was);
}
