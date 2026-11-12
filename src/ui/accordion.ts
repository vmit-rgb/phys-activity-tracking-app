import { iconSvg } from './icons';
import { EASE, glyphs, MS, play, stagger, STAGGER_MS, whenDone } from './motion';

const TRIGGER = 'button.accordion[aria-controls]';
/** «як робити» and other small ones drop in instead of growing. */
const SMALL = '.accordion--mini, .ex-check__more';

function iconOf(trigger: HTMLButtonElement): HTMLElement {
  let icon = trigger.querySelector<HTMLElement>('.accordion__icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'accordion__icon';
    trigger.append(icon);
  }
  return icon;
}

function setIcon(trigger: HTMLButtonElement, expanded: boolean): void {
  iconOf(trigger).innerHTML = iconSvg(expanded ? 'remove' : 'add');
}

/** The glint: a faint gradient jumps from the title onto the body and runs down with it; closing, back up. */
function glint(trigger: HTMLElement, panel: HTMLElement, open: boolean): void {
  const host = panel.parentElement;
  if (!host) return;
  const top = trigger.offsetHeight;
  const bottom = Math.max(top, host.offsetHeight - 30);
  const light = document.createElement('span');
  light.className = 'fx-glint';
  light.setAttribute('aria-hidden', 'true');
  host.classList.add('fx-glint-host');
  host.append(light);
  const run = open
    ? play(light, [{ transform: 'translateY(0)', opacity: 0.9 }, { transform: `translateY(${top}px)`, opacity: 1, offset: 0.12 }, { transform: `translateY(${bottom}px)`, opacity: 0 }], { duration: MS.m, easing: EASE.out })
    : play(light, [{ transform: `translateY(${bottom}px)`, opacity: 0 }, { transform: `translateY(${top}px)`, opacity: 0.9, offset: 0.8 }, { transform: 'translateY(0)', opacity: 0 }], { duration: MS.s, delay: MS.xs, easing: EASE.in });
  whenDone(run, () => {
    light.remove();
    if (!host.querySelector('.fx-glint')) host.classList.remove('fx-glint-host');
  });
}

function open(trigger: HTMLButtonElement, panel: HTMLElement): void {
  if (trigger.matches(SMALL)) {
    play(panel, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: MS.s, easing: EASE.out });
    return;
  }
  panel.style.overflow = 'hidden';
  const grow = play(panel, [{ height: '0px' }, { height: `${panel.scrollHeight}px` }], { duration: MS.m, easing: EASE.out });
  whenDone(grow, () => panel.style.removeProperty('overflow'));
  stagger(panel);
  glint(trigger, panel, true);
}

/** Rows leave from the bottom up, the body folds upwards; the panel hides only at the end. */
function close(trigger: HTMLButtonElement, panel: HTMLElement): void {
  const rows = [...panel.children].slice(0, 12);
  const leaving = rows.map((row, i) => play(row, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], {
    duration: MS.xs, delay: (rows.length - 1 - i) * STAGGER_MS, easing: EASE.in, fill: 'forwards',
  }));
  panel.style.overflow = 'hidden';
  const fold = trigger.matches(SMALL)
    ? play(panel, [{ opacity: 1 }, { opacity: 0 }], { duration: MS.xs, easing: EASE.in, fill: 'forwards' })
    : play(panel, [{ height: `${panel.scrollHeight}px` }, { height: '0px' }], { duration: MS.m, delay: MS.xs, easing: EASE.in, fill: 'forwards' });
  if (!trigger.matches(SMALL)) glint(trigger, panel, false);
  whenDone(fold, () => {
    panel.style.removeProperty('overflow');
    leaving.forEach((run) => run?.cancel());
    // tapped again while folding: it stays open
    if (trigger.getAttribute('aria-expanded') === 'true') return;
    fold?.cancel();
    panel.hidden = true;
  });
}

function toggle(root: HTMLElement, trigger: HTMLButtonElement): boolean {
  const id = trigger.getAttribute('aria-controls');
  const panel = root.querySelector<HTMLElement>(`#${id}`);
  if (!panel) throw new Error(`accordion: panel #${id} is missing`);
  const expanded = trigger.getAttribute('aria-expanded') !== 'true';
  trigger.setAttribute('aria-expanded', String(expanded));
  panel.getAnimations?.().forEach((run) => run.cancel());
  if (expanded) {
    panel.hidden = false;
    open(trigger, panel);
  } else {
    close(trigger, panel);
  }
  setIcon(trigger, expanded);
  // + turns into − through ASCII frames, like the checkbox
  glyphs(iconOf(trigger), expanded ? ['*', '=', '-'] : ['=', '*', '+']);
  return expanded;
}

export type OnToggle = (trigger: HTMLButtonElement, expanded: boolean) => void;

/**
 * Accordions (Figma `accordion/trigger`): a button with aria-expanded and
 * aria-controls opens and closes its panel inside `root` and swaps + for −.
 * `onToggle` hears every change, e.g. to remember it.
 */
export function wireAccordions(root: HTMLElement, onToggle: OnToggle = () => {}): void {
  for (const trigger of root.querySelectorAll<HTMLButtonElement>(TRIGGER)) {
    setIcon(trigger, trigger.getAttribute('aria-expanded') === 'true');
  }
  root.addEventListener('click', (event) => {
    // every click target inside root is an element
    const trigger = (event.target as Element).closest<HTMLButtonElement>(TRIGGER);
    if (trigger && !trigger.disabled) onToggle(trigger, toggle(root, trigger));
  });
}
