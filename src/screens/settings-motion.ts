import { entryNow, joined, menuChoices, menuOpened, settled } from './drag-motion';
import type { SettingsAct } from './settings';

/*
 * What moves once a tap's change is on the page (stage 7c2). Read before the
 * tap is handled, while the old page is still there; played after it, on the
 * page drawn anew.
 */

type After = () => void;
const nothing: After = () => {};
const menuNow = () => document.querySelector<HTMLElement>('.st-menu');

/** The list a group sits in, for an entry inside the group. */
const outside = (list: string) => list.replace(/\.\d+\.set$/, '');

/** The list the entry lands in: another one («перемістити в…»), the one around its group, or its own. */
function landing(key: string, list: string): string {
  if (key.startsWith('m:')) return key.slice(2);
  return key === 'leave' ? outside(list) : list;
}

/** A choice in the action menu: another list of choices, or the entry moved or grouped. */
function afterMenuItem(key: string, root: HTMLElement): After {
  // the second list is always there: «об’єднати…» and «перемістити…» show only when they have choices
  if (key === 'group' || key === 'move') return () => menuChoices(menuNow()!);
  const item = root.querySelector('.st-menu')!.closest<HTMLElement>('.st-item')!;
  if (key === 'cancel') return nothing;
  const entry = item.dataset.key!;
  if (key.startsWith('g:')) return () => joined(entryNow(entry));
  const list = landing(key, item.dataset.list!);
  return () => settled(entryNow(entry, list));
}

export function motionFor(action: SettingsAct, root: HTMLElement): After {
  if (action.act === 'menu') return () => menuOpened(menuNow());
  if (action.act === 'menu-item') return afterMenuItem(action.key, root);
  if (action.act !== 'pick-done') return nothing;
  const first = root.querySelector<HTMLElement>('.st-pick[aria-pressed="true"]')?.dataset.key;
  return first ? () => joined(entryNow(first)) : nothing;
}
