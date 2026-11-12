import { circleOver, EASE, middleOf, MS, STAGGER_MS, moving, play, whenDone } from '../ui/motion';

/*
 * The menu opens from ≡: a circle grows from the button, the blocks fly to
 * their places with a turn and a spring; it closes back into the button
 * (MICROINTERACTIONS.md «Меню», Olesia 2026-11-03). Ported from 0.81's
 * `menuIn` / `menuOut`. In the menu the bar's ≡ is ✕, in the same place.
 */

interface Point {
  readonly x: number;
  readonly y: number;
}

/** The middle of ≡ / ✕, on the screen. */
function buttonMiddle(host: HTMLElement): Point {
  const button = host.querySelector('.bar__menu');
  return button ? middleOf(button) : { x: 0, y: innerHeight };
}

/** The circle from the button that just covers the menu. */
const circle = (menu: Element, at: Point) => circleOver(menu, at, 40);

/** The blocks that fly: the theme switch, then the groups of the menu (at most 10). */
function blocks(menu: Element): Element[] {
  return [menu.querySelector('.menu__top'), ...menu.querySelector('.menu__content')!.children]
    .filter((block): block is Element => block !== null)
    .slice(0, 10);
}

/** Where a block sits when it is still at the button: a third of the way there, turned, small. */
function atButton(block: Element, i: number, at: Point): string {
  const box = block.getBoundingClientRect();
  const dx = Math.round((at.x - (box.left + box.width / 2)) * 0.35);
  const dy = Math.round((at.y - (box.top + box.height / 2)) * 0.35);
  const turn = (i % 2 ? 1 : -1) * (4 + i * 1.5);
  return `translate(${dx}px, ${dy}px) rotate(${turn}deg) scale(.6)`;
}

export function menuIn(host: HTMLElement): void {
  const menu = host.querySelector('.menu');
  if (!menu || !moving()) return;
  const at = buttonMiddle(host);
  const { from, to } = circle(menu, at);
  play(menu, [{ clipPath: from }, { clipPath: to }], { duration: MS.m, easing: EASE.out });
  blocks(menu).forEach((block, i) => {
    play(block, [{ opacity: 0, transform: atButton(block, i, at) }, { opacity: 1, transform: 'none' }], {
      duration: MS.m, delay: i * STAGGER_MS, easing: EASE.spring, fill: 'backwards',
    });
  });
}

/** Folds the menu back into ✕, then `done` (at once without motion). */
export function menuOut(host: HTMLElement, done: () => void): void {
  const menu = host.querySelector<HTMLElement>('.menu');
  if (!menu || !moving()) return done();
  if (menu.inert) return;
  menu.inert = true;
  const at = buttonMiddle(host);
  const { from, to } = circle(menu, at);
  blocks(menu).forEach((block, i) => {
    play(block, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: atButton(block, i, at) }], { duration: MS.s, easing: EASE.in, fill: 'forwards' });
  });
  const fold = play(menu, [{ clipPath: to }, { clipPath: from }], { duration: MS.s, easing: EASE.in, fill: 'forwards' });
  whenDone(fold, done);
}
