import { EASE, glyphs, MS, play, pop } from './motion';
import { chipFill, tabFlow } from './stripes';

/*
 * The answer to a tap, in one place for the whole app. A screen may draw
 * itself anew on a tap (home does), so the control is remembered before the
 * screen's own handlers run and found again right after.
 */

/** Controls with motion of their own (accordion, chips and tabs, calendar days), or none. */
const OWN_MOTION = '.accordion, .chip, .tab, .cal-day, .checkbox';

const TICK = ['[.]', '[+]', '[x]'];
const UNTICK = ['[+]', '[.]', '[ ]'];

/** What names a control across renders: its tag and its data-* attributes and id. */
function signature(el: Element): string {
  const own = [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'id').map((a) => `${a.name}=${a.value}`);
  return [el.tagName, ...own.sort()].join('|');
}

/** Finds the control again: the same element, or its twin on the new screen. */
function finder(el: Element, doc: Document): () => Element | undefined {
  const sig = signature(el);
  const alike = () => [...doc.querySelectorAll(el.tagName)].filter((other) => signature(other) === sig);
  const index = alike().indexOf(el);
  return () => (el.isConnected ? el : alike()[index]);
}

function afterHandlers(doc: Document, el: Element, run: (twin: Element) => void): void {
  const find = finder(el, doc);
  setTimeout(() => {
    const twin = find();
    if (twin) run(twin);
  }, 0);
}

/** A checkbox: [ ]→[.]→[+]→[x] (or back) and a pop of 1.15 on the box drawn after the change. */
function onTick(doc: Document, event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.matches('input[type="checkbox"]')) return;
  const frames = input.checked ? TICK : UNTICK;
  afterHandlers(doc, input, (twin) => {
    // the box is drawn right after its input (input:checked + .checkbox__box in the CSS)
    const box = twin.nextElementSibling;
    if (!(box instanceof HTMLElement) || !box.matches('.checkbox__box')) return;
    glyphs(box, frames);
    pop(box, 1.15);
  });
}

/** Any other button: a small spring, smaller on a wide one. */
function onPress(doc: Document, event: Event): void {
  const button = (event.target as Element).closest('button');
  if (!button || button.disabled || button.matches(OWN_MOTION)) return;
  afterHandlers(doc, button, (twin) => pop(twin, twin.getBoundingClientRect().width > 220 ? 1.012 : 1.06));
}

const isOn = (el: Element) => el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true';
const tabsOf = (group: Element) => [...group.querySelectorAll<HTMLElement>(':scope > .tab')];

/** A chip that turned on or off fills or empties in stripes. */
function onChip(doc: Document, chip: HTMLElement): void {
  const was = isOn(chip);
  afterHandlers(doc, chip, (twin) => {
    if (isOn(twin) !== was) chipFill(twin as HTMLElement, !was);
  });
}

/** Another tab chosen: the fill flows from the old one into it. */
function onTab(doc: Document, tab: HTMLElement, group: Element): void {
  const was = tabsOf(group).findIndex(isOn);
  afterHandlers(doc, tab, (twin) => {
    const twinGroup = twin.closest<HTMLElement>('.segmented')!;
    const tabs = tabsOf(twinGroup);
    const now = tabs.findIndex(isOn);
    if (was >= 0 && now >= 0 && now !== was) tabFlow(twinGroup, tabs[was]!, tabs[now]!);
  });
}

/** A chip or a tab that changed its state switches in stripes; one that didn't change, doesn't. */
function onSwitch(doc: Document, event: Event): void {
  const button = (event.target as Element).closest<HTMLElement>('.chip, .segmented > .tab');
  if (!button) return;
  const group = button.closest('.segmented');
  if (group) onTab(doc, button, group);
  else onChip(doc, button);
}

/** A days slider moved (− / + or the slider itself): the chosen day mark grows with a spring. */
function onDays(doc: Document, event: Event): void {
  const control = (event.target as Element).closest('.st-days :is(button, input)');
  if (!control) return;
  afterHandlers(doc, control, (twin) => {
    const mark = twin.closest('.st-days')?.querySelector('.st-days__ticks .on');
    play(mark, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }], { duration: MS.s, easing: EASE.spring });
  });
}

export function wireTapMotion(doc: Document): void {
  doc.addEventListener('change', (event) => onTick(doc, event), true);
  doc.addEventListener('input', (event) => onDays(doc, event), true);
  doc.addEventListener('click', (event) => {
    onPress(doc, event);
    onSwitch(doc, event);
    onDays(doc, event);
  }, true);
}
