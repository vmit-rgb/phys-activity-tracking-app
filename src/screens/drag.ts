import type { Slot } from '../domain/sections-edit';

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

function overItem(dragged: HTMLElement, item: HTMLElement, y: number): Found | null {
  const rect = item.getBoundingClientRect();
  const rel = rect.height ? (y - rect.top) / rect.height : 0;
  const slot = slotOf(item);
  if (dragged.dataset.family === 'wo-ex' && !isGroup(dragged) && rel > 0.25 && rel < 0.75) {
    const group = isGroup(item) ? item : slot.list.endsWith('.set') ? item.parentElement!.closest<HTMLElement>('.st-group') : null;
    const own = group !== null && dragged.dataset.list === `${group.dataset.list}.${group.dataset.index}.set`;
    if (!own) {
      return group && Number(group.dataset.group) >= 3 ? { target: { kind: 'full' }, mark: group } : { target: { kind: 'group', onto: slot }, mark: item };
    }
  }
  const refused = refusedBy(dragged, item.parentElement!);
  if (refused !== undefined) return refused;
  const after = rel >= 0.5;
  return { target: { kind: 'move', list: slot.list, before: after ? slot.index + 1 : slot.index }, mark: item, line: after ? 'after' : 'before' };
}

/** Where the dragged entry would land with the finger over `under`, at height `y`. */
export function dropAt(dragged: HTMLElement, under: Element | null, y: number): Found | null {
  if (!under) return null;
  const family = dragged.dataset.family!;
  const same = `.st-item[data-family="${family}"]`;
  let item = under.closest<HTMLElement>(same);
  while (item && dragged.contains(item)) item = item.parentElement!.closest<HTMLElement>(same);
  if (item) return overItem(dragged, item, y);
  const closed = under.closest<HTMLElement>('.st-item[data-closed]');
  if (closed && HOLDS[closed.dataset.family!] === family) return { target: { kind: 'move', list: closed.dataset.items!, before: null }, mark: closed };
  const list = under.closest<HTMLElement>(`.st-list[data-family="${family}"]`);
  if (!list) return null;
  const refused = refusedBy(dragged, list);
  if (refused !== undefined) return refused;
  return { target: { kind: 'move', list: list.dataset.list!, before: list.dataset.end ? Number(list.dataset.end) : null }, mark: list, line: 'end' };
}

/* ---- the gesture ---- */

interface Press {
  readonly el: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly timer: ReturnType<typeof setTimeout>;
  lifted: boolean;
  proxy: HTMLElement | null;
  found: Found | null;
}

const IGNORED = '.st-rm, [data-act="inner"], input, .st-menu, .st-actions, .st-pick';

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

function proxyFor(el: HTMLElement): HTMLElement {
  const proxy = document.createElement('div');
  proxy.className = 'st-proxy t-1st-semibold';
  proxy.setAttribute('aria-hidden', 'true');
  proxy.textContent = (el.querySelector('.st-actions')?.textContent ?? '').replace(/^дії: /, '');
  proxy.style.width = `${Math.min(el.offsetWidth || 340, 340)}px`;
  document.body.append(proxy);
  return proxy;
}

/** Listens on the settings screen; a redraw drops the listeners with the old markup. */
export function wireDrag(root: HTMLElement, hooks: DragHooks): void {
  let press: Press | null = null;
  let swallowClick = false;

  const move = (event: PointerEvent) => {
    if (!press) return;
    const far = Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y) > SLOP;
    if (!press.lifted) {
      if (far) end(null);
      return;
    }
    if (!press.proxy && !far) return;
    if (!press.proxy) {
      press.proxy = proxyFor(press.el);
      press.el.classList.add('st-ghost');
    }
    press.proxy.style.left = `${event.clientX - 20}px`;
    press.proxy.style.top = `${event.clientY - 20}px`;
    clearMarks(root);
    press.found = dropAt(press.el, document.elementFromPoint(event.clientX, event.clientY), event.clientY);
    if (press.found) showFound(press.found);
    if (event.clientY < 70) scrollBy(0, -12);
    else if (event.clientY > innerHeight - 110) scrollBy(0, 12);
  };

  const end = (event: Event | null) => {
    const done = press;
    press = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', cancel);
    if (!done) return;
    clearTimeout(done.timer);
    done.proxy?.remove();
    done.el.classList.remove('st-lift', 'st-ghost');
    clearMarks(root);
    if (!done.lifted || !event) return;
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 400);
    if (!done.proxy) return hooks.menu(slotOf(done.el), done.el.dataset.family!);
    if (done.found) hooks.drop(slotOf(done.el), done.found.target);
  };
  const cancel = () => end(null);

  root.addEventListener('pointerdown', (event) => {
    const target = event.target as Element;
    const el = target.closest<HTMLElement>('.st-item[data-family]');
    if (press || event.button > 0 || !el || target.closest(IGNORED)) return;
    const timer = setTimeout(() => {
      if (!press) return;
      press.lifted = true;
      el.classList.add('st-lift');
      hooks.lifted();
    }, LIFT_MS);
    press = { el, x: event.clientX, y: event.clientY, timer, lifted: false, proxy: null, found: null };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancel);
  });
  // a lifted entry keeps the page still under the finger
  root.addEventListener('touchmove', (event) => {
    if (press?.lifted) event.preventDefault();
  }, { passive: false });
  // the tap that ends a drag is not a tap on the text under it
  root.addEventListener('click', (event) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);
  // a long press doesn't open the phone's own menu on the text
  root.addEventListener('contextmenu', (event) => {
    if ((event.target as Element).closest('.st-item[data-family]')) event.preventDefault();
  });
}
