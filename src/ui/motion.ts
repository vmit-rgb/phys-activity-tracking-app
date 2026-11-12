/*
 * Motion of «бета 0.9» (MICROINTERACTIONS.md), ported from 0.81's motion
 * code. No library: the Web Animations API and CSS.
 * Durations only from the scale; 120–420 for ordinary work, 720 and 1200 for
 * rewards. The stagger step and glyph frames are steps, not durations.
 * Errors never animate.
 */

export const MS = { xs: 120, s: 240, m: 360, l: 420, xl: 720, xxl: 1200 } as const;
/** Between the items that come in one by one. */
export const STAGGER_MS = 40;
/** One glyph frame of the checkbox and of + → −. */
export const FRAME_MS = 80;

export const EASE = {
  out: 'cubic-bezier(.2,.8,.2,1)',
  in: 'cubic-bezier(.4,0,1,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
} as const;

/** Motion is allowed: neither «вимкнути всі анімації» nor the phone's «reduce motion». */
export function moving(): boolean {
  if (document.documentElement.hasAttribute('data-no-motion')) return false;
  return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Plays the keyframes when motion is allowed and the browser can; null otherwise. */
export function play(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  if (!el || typeof el.animate !== 'function' || !moving()) return null;
  return el.animate(keyframes, options);
}

/** Runs `done` once, when the animation ends or is cancelled; at once when nothing plays. */
export function whenDone(run: Animation | null, done: () => void): void {
  if (!run) {
    done();
    return;
  }
  let ran = false;
  run.onfinish = run.oncancel = () => {
    if (ran) return;
    ran = true;
    done();
  };
}

/** The small spring after a tap (no decode on ordinary buttons). */
export function pop(el: Element | null | undefined, scale = 1.06): void {
  play(el, [{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.45 }, { transform: 'scale(1)' }], { duration: MS.s, easing: EASE.spring });
}

/** A screen other than home comes in: a fade and a rise of 12 px. */
export function enter(screen: Element | null): void {
  play(screen, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: MS.m, easing: EASE.out });
}

const fading = new WeakMap<HTMLElement, boolean>();

/** A floating button («вгору») fades in and out; a call that changes nothing does nothing. */
export function fadeShown(el: HTMLElement, shown: boolean): void {
  if (shown === (fading.get(el) ?? !el.hidden)) return;
  fading.set(el, shown);
  el.getAnimations?.().forEach((run) => run.cancel());
  if (shown) {
    el.hidden = false;
    play(el, [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: MS.s, easing: EASE.out });
    return;
  }
  const out = play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: MS.xs, easing: EASE.in, fill: 'forwards' });
  whenDone(out, () => {
    if (fading.get(el)) return;
    el.hidden = true;
    out?.cancel();
  });
}

/** The interface assembles before the eyes: children one by one, 40 ms apart, from 8 px below. */
export function stagger(container: Element): void {
  [...container.children].slice(0, 12).forEach((child, i) => {
    play(child, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
      duration: MS.s, delay: i * STAGGER_MS, easing: EASE.out, fill: 'backwards',
    });
  });
}

const glyphTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Shows text frames in `data-g` (the CSS draws them instead of the usual look),
 * 80 ms each with a fade, then the drawn state comes back. A new run replaces one still going.
 */
export function glyphs(el: HTMLElement, frames: readonly string[], done: () => void = () => {}): void {
  clearTimeout(glyphTimers.get(el));
  if (!moving()) {
    delete el.dataset.g;
    done();
    return;
  }
  const step = (i: number) => {
    const frame = frames[i];
    if (frame === undefined) {
      delete el.dataset.g;
      done();
      return;
    }
    el.dataset.g = frame;
    play(el, [{ opacity: 0.35 }, { opacity: 1 }], { duration: FRAME_MS, easing: EASE.out });
    glyphTimers.set(el, setTimeout(() => step(i + 1), FRAME_MS));
  };
  step(0);
}

/** Letter by letter within 360 ms; an element inside comes in whole, as one letter. */
export function typeIn(el: HTMLElement): void {
  if (!moving()) return;
  const parts: Element[] = [];
  for (const node of [...el.childNodes]) {
    if (node instanceof Element) {
      parts.push(node);
      continue;
    }
    const letters = [...(node.textContent ?? '')].map((letter) => {
      const span = document.createElement('span');
      span.className = 'fx-ch';
      span.textContent = letter;
      return span;
    });
    node.replaceWith(...letters);
    parts.push(...letters);
  }
  const step = parts.length > 1 ? Math.min(MS.m, parts.length * 14) / (parts.length - 1) : 0;
  parts.forEach((part, i) => {
    play(part, [{ opacity: 0 }, { opacity: 1 }], { duration: MS.xs, delay: Math.round(step * i), easing: EASE.out, fill: 'backwards' });
  });
}
