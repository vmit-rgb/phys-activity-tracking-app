import { iconSvg } from './icons';

const TRIGGER = 'button.accordion[aria-controls]';

function setIcon(trigger: HTMLButtonElement, expanded: boolean): void {
  let icon = trigger.querySelector<HTMLElement>('.accordion__icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'accordion__icon';
    trigger.append(icon);
  }
  icon.innerHTML = iconSvg(expanded ? 'remove' : 'add');
}

function toggle(root: HTMLElement, trigger: HTMLButtonElement): boolean {
  const id = trigger.getAttribute('aria-controls');
  const panel = root.querySelector<HTMLElement>(`#${id}`);
  if (!panel) throw new Error(`accordion: panel #${id} is missing`);
  const expanded = trigger.getAttribute('aria-expanded') !== 'true';
  trigger.setAttribute('aria-expanded', String(expanded));
  panel.hidden = !expanded;
  setIcon(trigger, expanded);
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
