import { circleOver, EASE, moving, MS, play, stagger, STAGGER_MS } from '../ui/motion';

/*
 * Motion of dragging in «налаштування» (MICROINTERACTIONS.md, «перетягування
 * в налаштуваннях», «легке тремтіння в режимі групи»; ported from 0.81's
 * liftFx, settleFx, groupFx, amenuIn). The entry rises with a spring, the
 * other workout exercises shake lightly while a group can be made, and once
 * let go it settles where it landed. «об’єднати в групу» and the action menu
 * were TODO in the spec: Нитка's drafts (Н), from 0.81.
 * The page draws itself anew after every change, so a moved entry is found
 * again by its `data-key` (screens/settings-sections.ts entryKey).
 */

/** Lifted: a spring up to 1.03, resting at 1.02 until it is let go. */
export function liftUp(el: HTMLElement): void {
  play(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: 0.6 }, { transform: 'scale(1.02)' }], {
    duration: MS.s, easing: EASE.spring, fill: 'forwards',
  });
}

/** Let go: the lift comes off. */
export function putDown(el: HTMLElement): void {
  el.getAnimations?.().forEach((run) => run.cancel());
}

/** While a workout exercise is up, the others shake: it could make a group with any of them. */
export function shakeWhile(root: HTMLElement, lifted: HTMLElement): void {
  if (moving() && lifted.dataset.family === 'wo-ex' && lifted.dataset.group === undefined) root.classList.add('st-shaking');
}

export function stopShaking(root: HTMLElement): void {
  root.classList.remove('st-shaking');
}

/**
 * The entry with `key` on the page now; when the same exercise is in more than
 * one list, the one in `list`.
 */
export function entryNow(key: string, list?: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`.st-item[data-key="${key.replace(/["\\]/g, '\\$&')}"]`)];
  return all.find((el) => el.dataset.list === list) ?? all[0] ?? null;
}

/** Released: it settles into its place (360, spring). */
export function settled(el: HTMLElement | null): void {
  play(el, [{ transform: 'scale(1.03)', boxShadow: '0 8px 24px rgb(0 0 0 / 45%)' }, { transform: 'none', boxShadow: '0 0 0 rgb(0 0 0 / 0%)' }], {
    duration: MS.m, easing: EASE.spring,
  });
}

/**
 * Grouped (Н): the exercise is pulled in from where it was let go, the
 * group's frame flashes in the accent, its rows come one by one (360).
 */
export function joined(el: HTMLElement | null, from?: DOMRect): void {
  if (!el) return;
  const group = el.closest<HTMLElement>('.st-group');
  if (!group) return;
  if (from) {
    const to = el.getBoundingClientRect();
    play(el, [{ transform: `translate(${Math.round(from.left - to.left)}px, ${Math.round(from.top - to.top)}px) scale(1.03)` }, { transform: 'none' }], {
      duration: MS.m, easing: EASE.spring,
    });
  }
  play(group, [
    { outline: '1.3px solid transparent', outlineOffset: '6px' },
    { outline: '1.3px solid rgb(var(--accent-rgb))', outlineOffset: '0px', offset: 0.6 },
    { outline: '1.3px solid transparent', outlineOffset: '0px' },
  ], { duration: MS.m, easing: EASE.out });
  const rows = group.querySelector(':scope > .st-list');
  if (rows) stagger(rows);
}

/** The action menu opens out of its entry as a circle (240), its choices one by one (Н). */
export function menuOpened(menu: HTMLElement | null): void {
  // no menu when the entry has nothing to offer
  if (!menu) return;
  const box = menu.closest('.st-item')!.getBoundingClientRect();
  const { from, to } = circleOver(menu, { x: box.left + Math.min(box.width, 80), y: menu.getBoundingClientRect().top - 8 }, 20);
  play(menu, [{ clipPath: from }, { clipPath: to }], { duration: MS.s, easing: EASE.out });
  menuChoices(menu);
}

/** The choices of the menu come in from 6 px above, 40 ms apart. */
export function menuChoices(menu: HTMLElement): void {
  [...menu.children].slice(0, 8).forEach((choice, i) => {
    play(choice, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], {
      duration: MS.s, delay: i * STAGGER_MS, easing: EASE.out, fill: 'backwards',
    });
  });
}
