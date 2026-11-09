import type { Answer, Day, SetLog } from '../domain/day';
import {
  addLap, answer, dropSession, markLevel, pickSession, removeLap, removeRound, removeSet, roundRows, setLap, setNote, setRound, setRows,
  setSet, showMoreRounds, showMoreSets, toggleChip, toggleTick, type Edit,
} from '../domain/log';
import { parseNumber } from '../domain/numbers';
import { MOMENTS, type Moment, type Settings, type WorkoutItem } from '../domain/settings';
import { undo, type ToastMessage } from '../ui/toast';
import { bpm } from '../domain/stats';
import type { HomeSession } from './session';
import { prepareSound } from './signal';

/*
 * What a tap or a keystroke inside the sections does. The markup
 * (sections.ts) names the action in data-act / data-input; this turns it
 * into an edit of the day or a change of the session. One listener per
 * render, on the element the render makes.
 */

export interface SectionControls {
  readonly settings: Settings;
  readonly session: HomeSession;
  /** The day shown, as it is now. */
  day(): Day;
  /** Applies an edit to the day shown; `render` draws the screen again. */
  edit(edit: Edit, render: boolean): void;
  /** Draws the screen again without changing the day. */
  render(): void;
  toast(message: ToastMessage): void;
}

export const AUTOSAVE_MS = 20_000;
const AI_LINK: ToastMessage = { message: 'це посилання дав ШІ. перевір його, перш ніж повторювати.' };

const data = (element: HTMLElement, name: string) => String(element.dataset[name]);
const moment = (element: HTMLElement): Moment => {
  const value = data(element, 'moment');
  return MOMENTS.find((m) => m === value) ?? 'morning';
};
const index = (element: HTMLElement) => Number(data(element, 'i'));
const dayKey = (c: SectionControls, key: string) => `${c.day().date}|${key}`;

function workoutItem(c: SectionControls, exercise: string): WorkoutItem | undefined {
  const session = c.settings.workout.sessions.find((s) => s.id === c.day().wo?.session);
  return session?.items.flatMap((entry) => ('set' in entry ? entry.set : [entry])).find((item) => item.exercise === exercise);
}

const planned = (c: SectionControls, exercise: string) => workoutItem(c, exercise)?.sets ?? null;

/** Applies an edit that removes something and offers «скасувати». */
function removeWithUndo(c: SectionControls, edit: Edit, message: string): void {
  const before = c.day();
  c.edit(edit, true);
  c.toast({ message, showIcon: true, action: undo(() => c.edit(() => before, true)) });
}

/** × → ✓: the first tap arms, the second removes (ACCESSIBILITY.md, deleting). */
function remove(c: SectionControls, target: string): void {
  const key = dayKey(c, target);
  if (c.session.armed !== key) {
    c.session.armed = key;
    c.render();
    return;
  }
  c.session.armed = null;
  c.session.running.delete(key);
  c.session.retry.delete(key);
  const [kind = '', id = '', at = '0'] = target.split('|');
  const [edit, message] = REMOVALS[kind === 'lap' || kind === 'round' ? kind : 'set'](c, id, Number(at));
  removeWithUndo(c, edit, message);
}

type Removal = (c: SectionControls, id: string, i: number) => [Edit, string];

/** What × removes: a lap; a round, or the only round's time; a set, or the only timed set's time. */
const REMOVALS: Record<'lap' | 'round' | 'set', Removal> = {
  lap: (_c, id, i) => [removeLap(id, i), 'коло видалено'],
  round: (c, id, i) => (roundRows(c.day(), id) > 1 ? [removeRound(id, i), 'таймер видалено'] : [setRound(id, i, null), 'таймер скинуто']),
  set: (c, id, i) => {
    const timed = workoutItem(c, id)?.fields.includes('seconds') ?? false;
    if (!timed) return [removeSet(id, i, planned(c, id)), 'підхід видалено'];
    return setRows(c.day(), id, planned(c, id)) === 1 ? [setSet(id, i, 's', null), 'таймер скинуто'] : [removeSet(id, i, planned(c, id)), 'таймер видалено'];
  },
};

/** ▶ starts, ■ stops and saves whole seconds, ✓ asks to overwrite, ↻ starts again from zero. */
function stopwatch(c: SectionControls, target: string): void {
  const key = dayKey(c, target);
  const started = c.session.running.get(key);
  const [kind = '', id = '', at = '0'] = target.split('|');
  const round = kind === 'round';
  if (started === undefined) return startStopwatch(c, key, round ? c.day().mw.times[id]?.[Number(at)] : c.day().wo?.ex[id]?.[Number(at)]?.s);
  c.session.running.delete(key);
  const seconds = Math.round((performance.now() - started) / 1000);
  c.edit(round ? setRound(id, Number(at), seconds) : setSet(id, Number(at), 's', seconds), true);
}

/** A saved time asks first (↻ «знову»); then, or without a time, it counts from zero. */
function startStopwatch(c: SectionControls, key: string, saved: number | null | undefined): void {
  if (saved != null && !c.session.retry.has(key)) c.session.retry.add(key);
  else {
    c.session.retry.delete(key);
    c.session.running.set(key, performance.now());
  }
  c.render();
}

function dropWorkout(c: SectionControls): void {
  const day = c.day();
  const logged = Object.values(day.wo?.ex ?? {}).some((sets) => sets.some((set) => set.w !== null || set.r !== null || set.s !== null));
  const key = dayKey(c, 'drop');
  if (logged && c.session.armed !== key) {
    c.session.armed = key;
    c.render();
    return;
  }
  c.session.armed = null;
  removeWithUndo(c, dropSession, 'тренування прибрано');
}

/* ---- the slider: a draft until «зберегти», 20 s or leaving (ACCESSIBILITY.md) ---- */

function sliderKey(c: SectionControls, element: HTMLElement): string {
  return dayKey(c, `slide|${moment(element)}|${data(element, 'tracker')}`);
}

function setDraft(c: SectionControls, element: HTMLElement, value: number): void {
  const id = data(element, 'tracker');
  c.session.drafts.set(sliderKey(c, element), { moment: moment(element), tracker: id, value });
  clearTimeout(c.session.timer);
  c.session.timer = setTimeout(() => c.session.flush(), AUTOSAVE_MS);
}

function step(c: SectionControls, element: HTMLElement): void {
  const [min, max] = [Number(data(element, 'min')), Number(data(element, 'max'))];
  const current = c.session.drafts.get(sliderKey(c, element))?.value;
  const next = current === undefined ? min + Math.max(0, Number(data(element, 'delta'))) : current + Number(data(element, 'delta'));
  setDraft(c, element, Math.min(max, Math.max(min, next)));
  c.render();
}

/** Saves every slider draft of the day shown. */
export function flushDrafts(c: SectionControls): void {
  clearTimeout(c.session.timer);
  const prefix = `${c.day().date}|`;
  const drafts = [...c.session.drafts].filter(([key]) => key.startsWith(prefix));
  if (drafts.length === 0) return;
  for (const [key] of drafts) c.session.drafts.delete(key);
  c.edit((day) => drafts.reduce((next, [, d]) => answer(d.moment, d.tracker, d.value)(next), day), true);
}

function saveDraft(c: SectionControls, element: HTMLElement): void {
  const draft = c.session.drafts.get(sliderKey(c, element));
  c.session.drafts.delete(sliderKey(c, element));
  if (draft) c.edit(answer(draft.moment, draft.tracker, draft.value), true);
}

/* ---- pulse timer: count down, ask for the beats, save beats per minute ---- */

function startPulse(c: SectionControls, element: HTMLElement): void {
  const tracker = c.settings.trackers.find((t) => t.id === data(element, 'tracker'));
  if (tracker?.kind !== 'number' || tracker.timer === null) return;
  const seconds = tracker.timer;
  prepareSound();
  c.session.pulse = { key: dayKey(c, `pulse|${moment(element)}|${tracker.id}`), seconds, phase: 'counting', ends: Date.now() + seconds * 1000, beats: null };
  setTimeout(() => c.session.pulseEnd(), seconds * 1000);
  c.render();
}

function finishPulse(c: SectionControls, element: HTMLElement): void {
  const run = c.session.pulse;
  const field = element.closest('[data-pulse]')?.querySelector<HTMLInputElement>('[data-input="beats"]');
  const beats = parseNumber(field?.value ?? '');
  if (!run || beats === null || beats <= 0) {
    field?.focus();
    return;
  }
  const counted = Math.round(beats);
  c.session.pulse = { ...run, phase: 'done', beats: counted };
  c.edit(answer(moment(element), data(element, 'tracker'), bpm(counted, run.seconds)), true);
}

/* ---- taps ---- */

type Tap = (c: SectionControls, element: HTMLElement) => void;

const TAPS: Record<string, Tap> = {
  level: (c, el) => {
    const level = c.settings.morningWarmup.levels.find((l) => l.id === data(el, 'level'));
    if (level) c.edit(markLevel(level, data(el, 'done') === 'true'), true);
  },
  chip: (c, el) => c.edit(toggleChip(data(el, 'group')), true),
  pick: (c, el) => c.edit(pickSession(data(el, 'session')), true),
  drop: (c) => dropWorkout(c),
  'more-sets': (c, el) => c.edit(showMoreSets(data(el, 'ex'), planned(c, data(el, 'ex'))), true),
  'more-rounds': (c, el) => c.edit(showMoreRounds(data(el, 'ex')), true),
  'add-lap': (c, el) => c.edit(addLap(data(el, 'kind')), true),
  rm: (c, el) => remove(c, data(el, 'rm')),
  sw: (c, el) => stopwatch(c, data(el, 'sw')),
  'slide-step': step,
  'slide-save': saveDraft,
  'slide-reset': (c, el) => c.edit(answer(moment(el), data(el, 'tracker'), null), true),
  'ai-tip': (c) => c.toast(AI_LINK),
  'pulse-start': startPulse,
  'pulse-done': finishPulse,
};

/* ---- typing ---- */

const textOrNull = (text: string) => (text === '' ? null : text);

function numbersAnswer(element: HTMLElement): Answer | null {
  const n = Number(data(element, 'n'));
  const fields = [...(element.closest('.labeled__fields')?.querySelectorAll<HTMLInputElement>('input') ?? [])];
  const values = fields.map((field) => parseNumber(field.value));
  if (n === 1) return values[0] ?? null;
  return values.every((v) => v === null) ? null : values;
}

type Typing = (c: SectionControls, element: HTMLInputElement) => void;

const TYPING: Record<string, Typing> = {
  note: (c, el) => c.edit(setNote(el.value), false),
  'tracker-note': (c, el) => c.edit(answer(moment(el), data(el, 'tracker'), textOrNull(el.value)), false),
  number: (c, el) => c.edit(answer(moment(el), data(el, 'tracker'), numbersAnswer(el)), false),
  set: (c, el) => {
    const value = parseNumber(el.value);
    const field = data(el, 'f') as keyof SetLog;
    c.edit(setSet(data(el, 'ex'), index(el), field, field === 'r' && value !== null ? Math.round(value) : value), false);
  },
  lap: (c, el) => c.edit(setLap(data(el, 'kind'), index(el), data(el, 'f') as 'km', parseNumber(el.value)), false),
  slide: (c, el) => {
    setDraft(c, el, Number(el.value));
    const tracker = el.closest<HTMLElement>('.tracker')!;
    tracker.classList.remove('tracker--unset');
    tracker.querySelector('.tracker__value')!.textContent = `${el.value}/${el.max}`;
    el.setAttribute('aria-valuetext', `${el.value} з ${el.max}`);
    if (!tracker.querySelector('[data-act="slide-save"]')) {
      tracker.querySelector('.tracker__value')!.insertAdjacentHTML('afterend',
        `<button type="button" class="ctl btn btn--tertiary" data-act="slide-save" data-moment="${moment(el)}">зберегти</button>`);
      tracker.querySelector<HTMLElement>('[data-act="slide-save"]')!.dataset.tracker = data(el, 'tracker');
    }
  },
};

const CHANGES: Record<string, Typing> = {
  tick: (c, el) => c.edit(toggleTick(data(el, 'ex')), true),
  yesno: (c, el) => c.edit(answer(moment(el), data(el, 'tracker'), el.checked ? 'yes' : null), false),
};

export function wireSections(root: HTMLElement, c: SectionControls): void {
  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-act]');
    const tap = button && TAPS[data(button, 'act')];
    if (!tap || !button) return;
    if (data(button, 'act') !== 'rm' && data(button, 'act') !== 'drop') c.session.armed = null;
    tap(c, button);
  });
  root.addEventListener('input', (event) => {
    const field = event.target as HTMLInputElement;
    TYPING[data(field, 'input')]?.(c, field);
  });
  root.addEventListener('change', (event) => {
    const field = event.target as HTMLInputElement;
    CHANGES[data(field, 'input')]?.(c, field);
  });
}
