import { decode, EASE, moving, MS, play } from './motion';

/*
 * The note and the other text fields with the corner grip (MICROINTERACTIONS.md,
 * «нотатка й поля в діалогах»; ported from 0.81, 2026-11-03).
 * - «зберігається, поки пишеш» (a line with `data-saving` right after the
 *   field) runs through glyphs while typing, at most every 4 s.
 * - The grip stretches the field up to 2/3 of the screen. Past the limits it
 *   gives only a little, with resistance, like dough; let go, it springs back
 *   inside them. The height stays while the same day is drawn anew (the
 *   field's `data-key` holds the day) and is never stored: another day starts
 *   at the usual size.
 */

/** Three lines, the usual size of a note (0.81). */
export const MIN_HEIGHT = 88;
/** At most once every 4 s: an interval, not a duration (MICROINTERACTIONS.md). */
const SAVING_EVERY_MS = 4000;
/** How much of the pull past a limit shows. */
const DOUGH = 0.18;

const maxHeight = () => Math.round((innerHeight * 2) / 3);

/** The height for a pull to `want`: itself inside the limits, a little past them. */
function dough(want: number): number {
  const max = maxHeight();
  if (want > max) return max + (want - max) * DOUGH;
  if (want < MIN_HEIGHT) return MIN_HEIGHT - (MIN_HEIGHT - want) * DOUGH;
  return want;
}

const clamp = (height: number) => Math.max(MIN_HEIGHT, Math.min(maxHeight(), height));

let savingShown = -Infinity;

function onTyping(event: Event): void {
  const hint = (event.target as Element).closest('.field-wrap')?.nextElementSibling;
  if (!(hint instanceof HTMLElement) || !hint.hasAttribute('data-saving') || !moving()) return;
  if (Date.now() - savingShown < SAVING_EVERY_MS) return;
  savingShown = Date.now();
  decode(hint, MS.s);
}

interface Pull {
  readonly field: HTMLTextAreaElement;
  readonly grip: Element;
  readonly y: number;
  readonly from: number;
}

/** Heights by the field's `data-key` (day and field), only while the app is open. */
const heights = new Map<string, number>();

function startPull(event: PointerEvent): Pull | null {
  const grip = (event.target as Element).closest('.field-grip');
  const field = grip?.parentElement?.querySelector('textarea');
  if (!grip || !field) return null;
  event.preventDefault();
  grip.classList.add('field-grip--on');
  return { field, grip, y: event.clientY, from: field.offsetHeight };
}

function endPull(pull: Pull): void {
  pull.grip.classList.remove('field-grip--on');
  const now = parseFloat(pull.field.style.height) || pull.from;
  const final = Math.round(clamp(now));
  pull.field.style.height = `${final}px`;
  if (pull.field.dataset.key) heights.set(pull.field.dataset.key, final);
  play(pull.field, [{ height: `${Math.round(now)}px` }, { height: `${final}px` }], { duration: MS.m, easing: EASE.spring });
}

/** A field drawn anew gets back the height it had on the same day. */
function restore(doc: Document): void {
  doc.querySelectorAll<HTMLTextAreaElement>('.field-wrap > textarea[data-key]').forEach((field) => {
    const height = heights.get(field.dataset.key!);
    if (height !== undefined && !field.style.height) field.style.height = `${height}px`;
  });
}

export function wireNotes(doc: Document): void {
  let pull: Pull | null = null;
  const end = () => {
    if (pull) endPull(pull);
    pull = null;
  };
  doc.addEventListener('input', onTyping, true);
  doc.addEventListener('pointerdown', (event) => {
    pull = startPull(event) ?? pull;
  });
  doc.addEventListener('pointermove', (event) => {
    if (pull) pull.field.style.height = `${Math.round(dough(pull.from + event.clientY - pull.y))}px`;
  });
  doc.addEventListener('pointerup', end);
  doc.addEventListener('pointercancel', end);
  new MutationObserver(() => restore(doc)).observe(doc, { childList: true, subtree: true });
}
