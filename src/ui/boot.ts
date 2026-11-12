import { EASE, MS, STAGGER_MS, moving, play, whenDone } from './motion';

/*
 * Loading → home (MICROINTERACTIONS.md): the ASCII spinner of index.html runs
 * while the app loads (shown at least 240 ms, so it doesn't just blink); then
 * its characters fly apart (scale 1.7, spreading) and melt, and hero, sections
 * and calendar come in one after another. Ported from 0.81's `fxBootOut` and `bootIn`.
 * Without motion the loading screen is simply gone.
 */

/** What comes in after loading, in order: home's three parts, or the one screen shown. */
function partsOf(host: HTMLElement): Element[] {
  const home = host.querySelector(':scope > .home');
  if (!home) return host.firstElementChild ? [host.firstElementChild] : [];
  return [':scope > .hero', ':scope > .home__sections', ':scope > .cal-block']
    .map((selector) => home.querySelector(selector))
    .filter((part): part is Element => part !== null);
}

function comeIn(host: HTMLElement, after: number): void {
  partsOf(host).forEach((part, i) => {
    play(part, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
      duration: MS.l, delay: after + i * MS.xs, easing: EASE.out, fill: 'backwards',
    });
  });
  const sections = host.querySelector('.home > .home__sections');
  [...(sections?.children ?? [])].slice(0, 8).forEach((section, i) => {
    play(section, [{ opacity: 0 }, { opacity: 1 }], { duration: MS.s, delay: after + MS.xs + i * STAGGER_MS, easing: EASE.out, fill: 'backwards' });
  });
}

/**
 * Takes the loading screen away once the first screen is drawn in `host`.
 * `sinceStart`: ms since the page began to load (performance.now()).
 */
export function leaveLoading(doc: Document, host: HTMLElement, sinceStart: number): void {
  const layer = doc.getElementById('loading');
  if (!layer) return;
  if (!moving()) {
    layer.remove();
    return;
  }
  // the app under it is ready: taps go through at once
  layer.style.pointerEvents = 'none';
  layer.removeAttribute('role');
  const wait = Math.max(0, Math.round(MS.s - sinceStart));
  const melt = { duration: MS.m, delay: wait, easing: EASE.in, fill: 'forwards' } as const;
  play(layer.querySelector('.ld'), [{ transform: 'none', gap: '2px', opacity: 1 }, { transform: 'scale(1.7)', gap: '14px', opacity: 0 }], melt);
  whenDone(play(layer, [{ opacity: 1 }, { opacity: 0 }], melt), () => layer.remove());
  comeIn(host, wait + MS.s);
}
