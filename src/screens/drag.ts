import type { Slot } from '../domain/sections-edit';
import { entryNow, joined, liftUp, putDown, settled, shakeWhile, stopShaking } from './drag-motion';

/*
 * Dragging in «налаштування» (brief, Decisions 2026-10-30; Figma
 * example/edit-profile-drag-and-group 262:10843; «бета 0.81» drStart…drEnd).
 * A long press lifts an entry (outline and fill, a short vibration); moving
 * the finger drags it; letting go without moving opens its menu, the same
 * actions without dragging (WCAG 2.5.7). Between two entries an accent line
 * shows where it goes; over the middle of a workout exercise the target is
 * outlined: a group. A group of 3 is outlined in the error colour.
 */

export type DropTarget =
  | { readonly kind: 'move'; readonly list: string; readonly before: number | null }
  | { readonly kind: 'group'; readonly onto: Slot }
  | { readonly kind: 'full' };

export interface DragHooks {
  drop(from: Slot, target: DropTarget): void;
  menu(from: Slot, family: string): void;
  /** The entry is up: vibrate, if allowed. */
  lifted(): void;
}

interface Found {
  readonly target: DropTarget;
  readonly mark: HTMLElement;
  readonly line?: 'before' | 'after' | 'end';
}

export const LIFT_MS = 450;
const SLOP = 8;
/** A closed level, «для чого» or workout takes exercises of its kind. */
const HOLDS: Record<string, string> = { lv: 'mw-ex', dg: 'dw-ex', ss: 'wo-ex' };

export const slotOf = (element: HTMLElement): Slot => ({ list: element.dataset.list!, index: Number(element.dataset.index) });
const isGroup = (element: HTMLElement) => element.dataset.group !== undefined;

/** A group's own list refuses another group, and a stranger when it holds 3. `undefined`: it may go in. */
function refusedBy(dragged: HTMLElement, list: HTMLElement): Found | null | undefined {
  const path = list.dataset.list!;
  if (!path.endsWith('.set')) return undefined;
  if (isGroup(dragged)) return null;
  const group = list.closest<HTMLElement>('.st-group')!;
  return Number(group.dataset.group) >= 3 && dragged.dataset.list !== path ? { target: { kind: 'full' }, mark: group } : undefined;
}

/** A single workout exercise held over the middle of another can make a group with it. */
const grouping = (dragged: HTMLElement, rel: number) => dragged.dataset.family === 'wo-ex' && !isGroup(dragged) && rel > 0.25 && rel < 0.75;

/** A group with `item` (or with the group it is in); «full» at 3; null over the dragged one's own group. */
function groupAt(dragged: HTMLElement, item: HTMLElement, slot: Slot): Found | null {
  const group = isGroup(item) ? item : slot.list.endsWith('.set') ? item.parentElement!.closest<HTMLElement>('.st-group') : null;
  if (group && dragged.dataset.list === `${group.dataset.list}.${group.dataset.index}.set`) return null;
  return group && Number(group.dataset.group) >= 3 ? { target: { kind: 'full' }, mark: group } : { target: { kind: 'group', onto: slot }, mark: item };
}

function overItem(dragged: HTMLElement, item: HTMLElement, y: number): Found | null {
  const rect = item.getBoundingClientRect();
  const rel = rect.height ? (y - rect.top) / rect.height : 0;
  const slot = slotOf(item);
  const grouped = grouping(dragged, rel) ? groupAt(dragged, item, slot) : null;
  if (grouped) return grouped;
  const refused = refusedBy(dragged, item.parentElement!);
  if (refused !== undefined) return refused;
  const after = rel >= 0.5;
  return { target: { kind: 'move', list: slot.list, before: after ? slot.index + 1 : slot.index }, mark: item, line: after ? 'after' : 'before' };
}

/** The nearest entry of the dragged one's family under the finger, not the dragged one or inside it. */
function itemUnder(dragged: HTMLElement, under: Element): HTMLElement | null {
  const same = `.st-item[data-family="${dragged.dataset.family}"]`;
  let item = under.closest<HTMLElement>(same);
  while (item && dragged.contains(item)) item = item.parentElement!.closest<HTMLElement>(same);
  return item;
}

/** A closed level, «для чого» or workout takes the exercise at its end. */
function intoClosed(dragged: HTMLElement, under: Element): Found | null {
  const closed = under.closest<HTMLElement>('.st-item[data-closed]');
  if (!closed || HOLDS[closed.dataset.family!] !== dragged.dataset.family) return null;
  return { target: { kind: 'move', list: closed.dataset.items!, before: null }, mark: closed };
}

/** Over a list but no entry: its end. */
function atListEnd(dragged: HTMLElement, under: Element): Found | null {
  const list = under.closest<HTMLElement>(`.st-list[data-family="${dragged.dataset.family}"]`);
  if (!list) return null;
  const refused = refusedBy(dragged, list);
  if (refused !== undefined) return refused;
  return { target: { kind: 'move', list: list.dataset.list!, before: list.dataset.end ? Number(list.dataset.end) : null }, mark: list, line: 'end' };
}

/** Where the dragged entry would land with the finger over `under`, at height `y`. */
export function dropAt(dragged: HTMLElement, under: Element | null, y: number): Found | null {
  if (!under) return null;
  const item = itemUnder(dragged, under);
  if (item) return overItem(dragged, item, y);
  return intoClosed(dragged, under) ?? atListEnd(dragged, under);
}

/* ---- the gesture ---- */

const IGNORED = '.st-rm, [data-act="inner"], input, .st-menu, .st-actions, .st-pick';
/** The description shown under the name while dragging: how-to, hint or time, the first filled. */
const DESCRIPTION = ['.how', '.hint', '.duration'].map((end) => `.st-text[data-path$="${end}"]:not(.st-text--empty)`).join(', ');

function clearMarks(root: ParentNode): void {
  root.querySelectorAll('.st-line').forEach((line) => line.remove());
  root.querySelectorAll('.st-target, .st-full').forEach((mark) => mark.classList.remove('st-target', 'st-full'));
}

function showFound(found: Found): void {
  if (found.target.kind === 'full') return found.mark.classList.add('st-full');
  if (!found.line) return found.mark.classList.add('st-target');
  const line = document.createElement('div');
  line.className = 'st-line';
  if (found.line === 'end') found.mark.append(line);
  else found.mark.parentNode!.insertBefore(line, found.line === 'after' ? found.mark.nextSibling : found.mark);
}

/** Under the finger: only the name and the description (MICROINTERACTIONS.md). */
function proxyFor(el: HTMLElement): HTMLElement {
  const proxy = document.createElement('div');
  proxy.className = 'st-proxy';
  proxy.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'st-proxy__name t-1st-semibold';
  // every entry has its «дії» button (screens/settings-sections.ts entry)
  name.textContent = el.querySelector('.st-actions')!.textContent!.replace(/^дії: /, '');
  proxy.append(name);
  const how = el.querySelector(DESCRIPTION)?.textContent?.split('\n')[0];
  if (how) {
    const line = document.createElement('span');
    line.className = 'st-proxy__how t-3rd-regular';
    line.textContent = how;
    proxy.append(line);
  }
  proxy.style.width = `${Math.min(el.offsetWidth || 340, 340)}px`;
  document.body.append(proxy);
  return proxy;
}

/** After the drop the page is new: the entry is found by its key where it landed, and settles or joins. */
function landed(key: string, target: DropTarget, from: DOMRect): void {
  if (target.kind === 'group') joined(entryNow(key), from);
  else if (target.kind === 'move') settled(entryNow(key, target.list));
}

/** One press on an entry: held, maybe lifted, maybe dragged; then dropped, a menu, or nothing. */
class Press {
  readonly timer: ReturnType<typeof setTimeout>;
  lifted = false;
  proxy: HTMLElement | null = null;
  found: Found | null = null;

  constructor(private readonly gesture: Gesture, readonly el: HTMLElement, readonly x: number, readonly y: number) {
    this.timer = setTimeout(() => this.lift(), LIFT_MS);
  }

  private lift(): void {
    if (this.gesture.press !== this) return;
    this.lifted = true;
    this.el.classList.add('st-lift');
    liftUp(this.el);
    shakeWhile(this.gesture.root, this.el);
    this.gesture.hooks.lifted();
  }

  /** The finger moved: before the lift that is a scroll; after it, a drag. */
  moved(x: number, y: number): void {
    const far = Math.abs(x - this.x) + Math.abs(y - this.y) > SLOP;
    if (!this.lifted) {
      if (far) this.gesture.end(null);
      return;
    }
    if (!this.proxy && !far) return;
    this.proxy ??= this.startDrag();
    this.proxy.style.left = `${x - 20}px`;
    this.proxy.style.top = `${y - 20}px`;
    clearMarks(this.gesture.root);
    this.found = dropAt(this.el, document.elementFromPoint(x, y), y);
    if (this.found) showFound(this.found);
    if (y < 70) scrollBy(0, -12);
    else if (y > innerHeight - 110) scrollBy(0, 12);
  }

  private startDrag(): HTMLElement {
    this.el.classList.add('st-ghost');
    return proxyFor(this.el);
  }

  /** Whatever happened, the marks go; `true` when it was a real lift let go (not cancelled). */
  clear(released: boolean): boolean {
    clearTimeout(this.timer);
    this.proxy?.remove();
    this.el.classList.remove('st-lift', 'st-ghost');
    putDown(this.el);
    stopShaking(this.gesture.root);
    clearMarks(this.gesture.root);
    return this.lifted && released;
  }

  /** Let go without moving: the menu; moved over a target: the drop, then the entry settles there. */
  release(): void {
    const { hooks } = this.gesture;
    if (!this.proxy) return hooks.menu(slotOf(this.el), this.el.dataset.family!);
    if (!this.found) return;
    const key = this.el.dataset.key ?? '';
    const from = this.el.getBoundingClientRect();
    hooks.drop(slotOf(this.el), this.found.target);
    landed(key, this.found.target, from);
  }
}

class Gesture {
  press: Press | null = null;
  private swallowClick = false;
  private readonly move = (event: PointerEvent) => this.press?.moved(event.clientX, event.clientY);
  private readonly up = (event: Event) => this.end(event);
  private readonly cancel = () => this.end(null);

  constructor(readonly root: HTMLElement, readonly hooks: DragHooks) {}

  down(event: PointerEvent): void {
    const target = event.target as Element;
    const el = target.closest<HTMLElement>('.st-item[data-family]');
    if (this.press || event.button > 0 || !el || target.closest(IGNORED)) return;
    this.press = new Press(this, el, event.clientX, event.clientY);
    document.addEventListener('pointermove', this.move);
    document.addEventListener('pointerup', this.up);
    document.addEventListener('pointercancel', this.cancel);
  }

  end(event: Event | null): void {
    const done = this.press;
    this.press = null;
    document.removeEventListener('pointermove', this.move);
    document.removeEventListener('pointerup', this.up);
    document.removeEventListener('pointercancel', this.cancel);
    if (!done?.clear(event !== null)) return;
    this.swallowClick = true;
    setTimeout(() => (this.swallowClick = false), 400);
    done.release();
  }

  /** The tap that ends a drag is not a tap on the text under it. */
  swallow(event: Event): void {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  }
}

/** Listens on the settings screen; a redraw drops the listeners with the old markup. */
export function wireDrag(root: HTMLElement, hooks: DragHooks): void {
  const gesture = new Gesture(root, hooks);
  root.addEventListener('pointerdown', (event) => gesture.down(event));
  // a lifted entry keeps the page still under the finger
  root.addEventListener('touchmove', (event) => {
    if (gesture.press?.lifted) event.preventDefault();
  }, { passive: false });
  root.addEventListener('click', (event) => gesture.swallow(event), true);
  // a long press doesn't open the phone's own menu on the text
  root.addEventListener('contextmenu', (event) => {
    if ((event.target as Element).closest('.st-item[data-family]')) event.preventDefault();
  });
}
