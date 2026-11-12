import type { Answer, Day, SetLog } from '../domain/day';
import {
  addLap, answer, dropSession, markLevel, pickSession, removeLap, removeRound, removeSet, roundRows, setLap, setNote, setRound, setRows,
  setSet, showMoreRounds, showMoreSets, toggleChip, toggleTick, type Edit,
} from '../domain/log';
import { parseNumber } from '../domain/numbers';
import { MOMENTS, type Moment, type Settings, type WorkoutItem } from '../domain/settings';
import { undo, type ToastMessage } from '../ui/toast';
import { bpm } from '../domain/stats';
import {
  control, rowAdded, rowLeaving, rowsBack, rowsNow, sliderReset, sliderSaved, stopwatchMoved, stopwatchSeen, timeDissolves, workoutAssembles,
} from './control-motion';
import { dropPulse, pulseRunning, PULSE_READY_MS, schedulePulse, type HomeSession } from './session';
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
  /** The screen as drawn now: a change draws it anew, and the motion plays on the new one. */
  screen(): HTMLElement;
  toast(message: ToastMessage): void;
}

export const AUTOSAVE_MS = 20_000;
const AI_LINK: ToastMessage = { message: 'це посилання дав ШІ. перевір його, перш ніж повторювати.' };

const data = (element: HTMLElement, name: string) => String(element.dataset[name]);
const asMoment = (value: string): Moment => MOMENTS.find((m) => m === value) ?? 'morning';
const moment = (element: HTMLElement): Moment => asMoment(data(element, 'moment'));
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
  c.toast({
    message,
    showIcon: true,
    action: undo(() => {
      const rows = rowsNow(c.screen());
      c.edit(() => before, true);
      rowsBack(c.screen(), rows);
    }),
  });
}

/** × → ✓: the first tap arms, the second removes (ACCESSIBILITY.md, deleting). */
function remove(c: SectionControls, target: string, button: HTMLElement): void {
  const key = dayKey(c, target);
  if (c.session.armed !== key) {
    c.session.armed = key;
    c.render();
    return;
  }
  forget(c.session, key);
  const [kind = '', id = '', at = '0'] = target.split('|');
  const { edit, message, rowStays } = REMOVALS[removalKind(kind)](c, id, at);
  const row = button.closest('.set-row, .pulse__row');
  const was = row?.querySelector('[data-sw-time]')?.textContent ?? '';
  const leave = rowStays ? () => {} : rowLeaving(row);
  removeWithUndo(c, edit, message);
  leave();
  if (rowStays) timeDissolves([...c.screen().querySelectorAll<HTMLElement>('[data-sw-time]')].find((time) => time.dataset.swTime === key), was);
}

/** What the session held for a removed target: its ✓, its stopwatch or pulse run, its «знову». */
function forget(session: HomeSession, key: string): void {
  session.armed = null;
  session.running.delete(key);
  session.retry.delete(key);
  if (session.pulse?.key === key) dropPulse(session);
}

/** What × does: the edit, its toast, and whether the row stays (the only timer is reset to zero, not removed). */
interface Removal { readonly edit: Edit; readonly message: string; readonly rowStays: boolean }

const removed = (edit: Edit, message: string): Removal => ({ edit, message, rowStays: false });
const reset = (edit: Edit): Removal => ({ edit, message: 'таймер скинуто', rowStays: true });

/**
 * What × removes: a lap; a round, or the only round's time; a set, or the
 * only timed set's time; the pulse's number (`pulse|moment|tracker`), so the
 * field is empty and the timer waits for ▶ (Olesia, 2026-11-12).
 */
type RemovalKind = 'lap' | 'round' | 'set' | 'pulse';
const removalKind = (kind: string): RemovalKind => (kind === 'lap' || kind === 'round' || kind === 'pulse' ? kind : 'set');

const REMOVALS: Record<RemovalKind, (c: SectionControls, id: string, at: string) => Removal> = {
  lap: (_c, id, at) => removed(removeLap(id, Number(at)), 'коло видалено'),
  round: (c, id, at) => {
    const i = Number(at);
    return roundRows(c.day(), id) > 1 ? removed(removeRound(id, i), 'таймер видалено') : reset(setRound(id, i, null));
  },
  pulse: (c, id, at) => {
    const name = c.settings.trackers.find((tracker) => tracker.id === at)?.name || 'без назви';
    return { edit: answer(asMoment(id), at, null), message: `${name} скинуто`, rowStays: true };
  },
  set: (c, id, at) => {
    const i = Number(at);
    const timed = workoutItem(c, id)?.fields.includes('seconds') ?? false;
    if (!timed) return removed(removeSet(id, i, planned(c, id)), 'підхід видалено');
    return setRows(c.day(), id, planned(c, id)) === 1 ? reset(setSet(id, i, 's', null)) : removed(removeSet(id, i, planned(c, id)), 'таймер видалено');
  },
};

/** A tap on the stopwatch, and its motion on the stopwatch drawn after it. */
function stopwatch(c: SectionControls, target: string, button: HTMLElement): void {
  const seen = stopwatchSeen(button);
  tapStopwatch(c, target);
  stopwatchMoved(control(c.screen(), 'sw', 'sw', target), seen);
}

/** ▶ starts, ■ stops and saves whole seconds, ✓ asks to overwrite, ↻ starts again from zero. */
function tapStopwatch(c: SectionControls, target: string): void {
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
  workoutAssembles(c.screen());
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

/** The slider of `key` on the screen drawn now. */
const sliderAt = (c: SectionControls, key: string) =>
  [...c.screen().querySelectorAll<HTMLInputElement>('input.slider')].find((slider) => slider.dataset.key === key);

function saveDraft(c: SectionControls, element: HTMLElement): void {
  const key = sliderKey(c, element);
  const draft = c.session.drafts.get(key);
  c.session.drafts.delete(key);
  if (!draft) return;
  c.edit(answer(draft.moment, draft.tracker, draft.value), true);
  sliderSaved(sliderAt(c, key));
}

function resetSlider(c: SectionControls, element: HTMLElement): void {
  c.edit(answer(moment(element), data(element, 'tracker'), null), true);
  sliderReset(sliderAt(c, sliderKey(c, element)));
}

/* ---- pulse timer: 3 s to get ready, count down, ask for the beats, save beats per minute ---- */

/** A tap on the pulse timer's button, and its motion on the button drawn after it (as the stopwatch). */
function pulseButton(c: SectionControls, button: HTMLElement): void {
  const target = data(button, 'pulseSw');
  const seen = stopwatchSeen(button);
  tapPulse(c, button, dayKey(c, target));
  stopwatchMoved(control(c.screen(), 'pulse', 'pulseSw', target), seen);
}

/** ■ cancels the run; a saved number asks first (↻ «знову»); then, or without a number, ▶ starts. */
function tapPulse(c: SectionControls, button: HTMLElement, key: string): void {
  const run = c.session.pulse;
  if (run?.key === key && pulseRunning(run)) {
    dropPulse(c.session);
    return c.render();
  }
  const saved = c.day().t[moment(button)]?.[data(button, 'tracker')];
  if (saved != null && !c.session.retry.has(key)) {
    c.session.retry.add(key);
    return c.render();
  }
  c.session.retry.delete(key);
  startPulse(c, button, key);
}

function startPulse(c: SectionControls, element: HTMLElement, key: string): void {
  const tracker = c.settings.trackers.find((t) => t.id === data(element, 'tracker'));
  if (tracker?.kind !== 'number' || tracker.timer === null) return;
  prepareSound();
  c.session.pulse = { key, seconds: tracker.timer, phase: 'ready', ends: Date.now() + PULSE_READY_MS, beats: null };
  schedulePulse(c.session, PULSE_READY_MS);
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

/** A row added by `button`: the edit, then the new row floats in next to the same button drawn anew. */
function adding(c: SectionControls, button: HTMLElement, name: string, edit: Edit): void {
  c.edit(edit, true);
  rowAdded(control(c.screen(), data(button, 'act'), name, data(button, name)));
}

type Tap = (c: SectionControls, element: HTMLElement) => void;

const TAPS: Record<string, Tap> = {
  level: (c, el) => {
    const level = c.settings.morningWarmup.levels.find((l) => l.id === data(el, 'level'));
    if (level) c.edit(markLevel(level, data(el, 'done') === 'true'), true);
  },
  chip: (c, el) => c.edit(toggleChip(data(el, 'group')), true),
  pick: (c, el) => {
    c.edit(pickSession(data(el, 'session')), true);
    workoutAssembles(c.screen());
  },
  drop: (c) => dropWorkout(c),
  'more-sets': (c, el) => adding(c, el, 'ex', showMoreSets(data(el, 'ex'), planned(c, data(el, 'ex')))),
  'more-rounds': (c, el) => adding(c, el, 'ex', showMoreRounds(data(el, 'ex'))),
  'add-lap': (c, el) => adding(c, el, 'kind', addLap(data(el, 'kind'))),
  rm: (c, el) => remove(c, data(el, 'rm'), el),
  sw: (c, el) => stopwatch(c, data(el, 'sw'), el),
  'slide-step': step,
  'slide-save': saveDraft,
  'slide-reset': resetSlider,
  'ai-tip': (c) => c.toast(AI_LINK),
  pulse: pulseButton,
  'pulse-done': finishPulse,
  'pulse-cancel': (c) => {
    dropPulse(c.session);
    c.render();
  },
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
