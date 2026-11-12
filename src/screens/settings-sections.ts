import { sessionName } from '../domain/journal';
import { formatNumber, plural } from '../domain/numbers';
import { LIST_OF, TRACKERS, type Slot } from '../domain/sections-edit';
import {
  MOMENTS, PULSE_SECONDS, type ActivityKind, type Moment, type MovementKind, type PulseSeconds, type Settings, type Source,
  type Tracker, type WarmupItem, type WorkoutEntry, type WorkoutItem,
} from '../domain/settings';
import { esc } from '../ui/html';
import { iconSvg } from '../ui/icons';
import { act, checkbox, daysSlider, iconButton, tertiary } from './settings-bits';

/*
 * Stage 6d: the inside of the sections in «налаштування» (Figma
 * screen/edit-profile: section/wellbeing, /morning-warmup, /daytime-warmup,
 * /workouts, /movement; «бета 0.81» `renderSettings`). Every text is a
 * button that opens the full-screen field; «видалити …» at the end of an
 * entry removes it after asking (a × until 2026-11-12); every
 * entry can be dragged (screens/drag.ts) or moved through its menu
 * («дії: …», also on a long press). Texts: COPY.md «Settings» and
 * «Added 2026-11-08 in Figma».
 */

/** The long-press / «дії» menu of one entry. */
export interface ActionMenu {
  readonly slot: Slot;
  readonly items: readonly { readonly key: string; readonly label: string }[];
}

/** «створити групу»: choosing exercises of one workout. */
export interface Picking {
  /** The workout's list, once the first exercise is chosen. */
  readonly list: string | null;
  readonly chosen: readonly number[];
}

export interface SectionsView {
  /** Open inner parts: tracker kinds (`k:scale`…) and levels, zones, workouts by id. */
  readonly inner: ReadonlySet<string>;
  readonly menu: ActionMenu | null;
  readonly picking: Picking | null;
}

/** How a value is typed in the full-screen field. */
export type EditKind = 'text' | 'long' | 'number' | 'url' | 'rx';

interface Ctx {
  readonly settings: Settings;
  readonly view: SectionsView;
}

export const KIND_NAMES: Record<ActivityKind, string> = {
  morningWarmup: 'ранкова розминка', daytimeWarmup: 'денна розминка', workout: 'тренування', movement: 'рух',
};

const EXERCISES = ['вправа', 'вправи', 'вправ'] as const;
const FIELDS = ['поле', 'поля', 'полів'] as const;

/* ---- pieces ---- */

/** A text or value: tap to change it. Empty shows its placeholder, faint. */
function ed(path: string, value: string, placeholder: string, label: string, kind: EditKind, cls = 't-1st-regular'): string {
  const empty = value.trim() === '';
  return `<button type="button" class="ctl st-text ${cls}${empty ? ' st-text--empty' : ''}" ${act('edit', `data-path="${esc(path)}" data-edit="${kind}" data-label="${esc(label)}"`)}>${
    esc(empty ? placeholder : value)}</button>`;
}

const slotData = (slot: Slot) => `data-list="${esc(slot.list)}" data-index="${slot.index}"`;
const shown = (name: string) => name.trim() || 'без назви';

/** What can be deleted in the sections: the word in «видалити …» and in the dialog («його / її більше не буде»). */
export type Thing = 'level' | 'zone' | 'session' | 'movement' | 'exercise' | Tracker['kind'];
export const THINGS: Record<Thing, readonly [word: string, it: 'його' | 'її']> = {
  level: ['рівень', 'його'], zone: ['зону', 'її'], session: ['тренування', 'його'], movement: ['рух', 'його'], exercise: ['вправу', 'її'],
  scale: ['повзунок', 'його'], yesno: ['питання', 'його'], numbers: ['поле', 'його'], number: ['поле', 'його'], note: ['нотатку', 'її'],
};

/**
 * «видалити рівень»: red text at the end of what it deletes, so it doesn't
 * compete with the +/− by the name (Olesia, 2026-11-12). The voice name
 * starts with the seen text and adds which one.
 */
function removeButton(slot: Slot, name: string, thing: Thing): string {
  const label = `видалити ${THINGS[thing][0]}`;
  return `<div><button type="button" class="ctl btn btn--destructive st-rm" ${act('rm', slotData(slot))} aria-label="${label}: ${esc(shown(name))}">${label}</button></div>`;
}

function toggle(id: string, name: string, open: boolean): string {
  return `<button type="button" class="ctl icon-btn icon-btn--secondary" ${act('inner', `data-id="${esc(id)}"`)} aria-expanded="${open}" aria-label="${
    open ? 'згорнути' : 'розгорнути'}: ${esc(shown(name))}">${iconSvg(open ? 'remove' : 'add')}</button>`;
}

function menuMarkup(ctx: Ctx, slot: Slot, name: string): string {
  const { menu } = ctx.view;
  if (!menu || menu.slot.list !== slot.list || menu.slot.index !== slot.index) return '';
  const items = menu.items.map((item) => `<button type="button" role="menuitem" class="ctl btn btn--tertiary" ${act('menu-item', `data-key="${esc(item.key)}"`)}>${esc(item.label)}</button>`);
  return `<div class="st-menu" role="menu" aria-label="дії: ${esc(shown(name))}">${items.join('')}</div>`;
}

/** What finds an entry again after a redraw moved it: its family and the id of what it is. */
export const entryKey = (family: string, id: string) => `${family}:${id}`;

/** An entry that can be dragged, with its «дії» button (seen when focused) and its menu. */
function entry(ctx: Ctx, family: string, slot: Slot, id: string, name: string, inner: string, cls = '', attrs = ''): string {
  return `
      <div class="st-item${cls}" data-family="${family}" data-key="${esc(entryKey(family, id))}" ${slotData(slot)}${attrs}>
        <button type="button" class="ctl st-actions t-3rd-regular" ${act('menu', `data-family="${family}" ${slotData(slot)}`)}>дії: ${esc(shown(name))}</button>
        ${inner}${menuMarkup(ctx, slot, name)}
      </div>`;
}

function list(family: string, path: string, items: string[], end = ''): string {
  return `<div class="st-list" data-family="${family}" data-list="${esc(path)}" data-end="${end}">${items.join('')}</div>`;
}

const count = (n: number, words: readonly [string, string, string]) => `${n} ${plural(n, words)}`;
const exerciseCount = (items: readonly (WarmupItem | WorkoutEntry)[]) =>
  count(items.reduce((n, item) => n + ('set' in item ? item.set.length : 1), 0), EXERCISES);

function linkField(path: string, source: Source): string {
  const url = source.type === 'link' ? source.url : '';
  const short = url.replace(/^https?:\/\//i, '');
  const text = short.length > 34 ? `${short.slice(0, 34)}…` : short;
  const ai = source.type === 'link' && source.by === 'ai' ? '<span class="t-3rd-regular muted"> * від ШІ</span>' : '';
  return `<div class="st-link">${ed(path, text, 'посилання', 'посилання (https://…)', 'url', 't-3rd-regular st-text--link')}${ai}</div>`;
}

/* ---- самопочуття ---- */

const TRACKER_KINDS: readonly [Tracker['kind'], string, string, string, string][] = [
  ['scale', 'повзунки', '', 'додати повзунок', 'назва (наприклад, біль у шиї)'],
  ['yesno', 'питання так / ні', '', 'додати питання', 'питання (наприклад, було запаморочення?)'],
  ['numbers', 'два числа', 'наприклад, тиск', 'додати поле', 'назва (наприклад, тиск)'],
  ['number', 'одне число', 'наприклад, пульс', 'додати поле', 'назва (наприклад, пульс)'],
  ['note', 'нотатки', '', 'додати нотатку', 'назва'],
];

/** Moments that belong to a section show only while it is on (0.81). */
const MOMENT_KIND: Partial<Record<Moment, ActivityKind>> = {
  afterMorningWarmup: 'morningWarmup', beforeDaytimeWarmup: 'daytimeWarmup', afterDaytimeWarmup: 'daytimeWarmup',
  beforeWorkout: 'workout', afterWorkout: 'workout', beforeMovement: 'movement', afterMovement: 'movement',
};
const ASK_LABELS: Record<Moment, string> = {
  morning: 'питати зранку',
  afterMorningWarmup: 'питати після ранкової розминки',
  beforeDaytimeWarmup: 'питати до денної розминки',
  afterDaytimeWarmup: 'питати після денної розминки',
  beforeWorkout: 'питати до тренування',
  afterWorkout: 'питати після тренування',
  beforeMovement: 'питати до руху',
  afterMovement: 'питати після руху',
  evening: 'питати ввечері',
};

function timerBlock(tracker: Tracker & { kind: 'number' }): string {
  const id = esc(tracker.id);
  const length = (seconds: PulseSeconds) => `<button type="button" class="ctl tab" ${act('timer-length', `data-tracker="${id}" data-seconds="${seconds}"`)}
        aria-pressed="${tracker.timer === seconds}">${seconds} с</button>`;
  const lengths = tracker.timer === null ? '' : `<div class="segmented st-lengths" role="group" aria-label="скільки триває таймер">${PULSE_SECONDS.map(length).join('')}</div>`;
  return `
        <div class="st-timer">
          ${checkbox('таймер для пульсу', tracker.timer !== null, `${act('timer')} data-tracker="${id}"`)}
          <p class="t-3rd-regular muted">на головній зʼявиться таймер: рахуєш удари, поки він іде, потім вписуєш число — застосунок перерахує в уд/хв.</p>
          ${lengths}
        </div>`;
}

function trackerValues(tracker: Tracker, path: string): string {
  switch (tracker.kind) {
    case 'scale':
      return `<div class="st-pair">${ed(`${path}.min`, `від ${formatNumber(tracker.min)}`, 'від 0', 'найменше значення', 'number', 't-3rd-regular')}${
        ed(`${path}.max`, `до ${formatNumber(tracker.max)}`, 'до 10', 'найбільше значення', 'number', 't-3rd-regular')}</div>`;
    case 'number':
      return ed(`${path}.units.0`, tracker.unit, 'одиниці (наприклад, уд/хв)', 'одиниці', 'text', 't-3rd-regular');
    case 'numbers':
      return `<div class="st-pair">${ed(`${path}.units.0`, tracker.units[0], 'одиниці першого числа', 'одиниці', 'text', 't-3rd-regular')}${
        ed(`${path}.units.1`, tracker.units[1], 'одиниці другого числа', 'одиниці', 'text', 't-3rd-regular')}</div>`;
    default:
      return '';
  }
}

function trackerMarkup(ctx: Ctx, tracker: Tracker, index: number, placeholder: string): string {
  const path = `${TRACKERS}.${index}`;
  const slot = { list: TRACKERS, index };
  const moments = MOMENTS.filter((moment) => {
    const kind = MOMENT_KIND[moment];
    return !kind || ctx.settings[kind].enabled;
  });
  const asks = moments.map((moment) => checkbox(ASK_LABELS[moment], tracker.ask.includes(moment), `${act('ask')} data-path="${path}.ask" data-moment="${moment}"`));
  const inner = `
        <div class="st-row">${ed(`${path}.name`, tracker.name, placeholder, 'назва', 'text', 't-1st-semibold')}</div>
        ${ed(`${path}.hint`, tracker.hint, 'підказка (наприклад, 0 — не болить, 10 — дуже)', 'підказка', 'text', 't-3rd-regular')}
        ${trackerValues(tracker, path)}
        <div class="st-asks">${asks.join('')}</div>
        ${tracker.kind === 'number' ? timerBlock(tracker) : ''}
        ${removeButton(slot, tracker.name, tracker.kind)}`;
  return entry(ctx, `tk-${tracker.kind}`, slot, tracker.id, tracker.name, inner);
}

/** A box with its own +/−: a tracker kind, a level, a «для чого», a workout. */
function box(title: string, open: boolean, toggleButton: string, meta: string, body: () => string): string {
  return `<div class="st-row st-box__head">${title}${toggleButton}</div>${open ? `<div class="st-box__body">${body()}</div>` : `<p class="t-3rd-regular muted">${esc(meta)}</p>`}`;
}

function trackerKind(ctx: Ctx, [kind, title, hint, add, placeholder]: (typeof TRACKER_KINDS)[number]): string {
  const id = `k:${kind}`;
  const open = ctx.view.inner.has(id);
  const mine = ctx.settings.trackers.flatMap((tracker, index) => (tracker.kind === kind ? [index] : []));
  const end = mine.length ? String(mine.at(-1)! + 1) : '';
  const body = () => `${hint ? `<p class="t-3rd-regular muted">${hint}</p>` : ''}
        ${list(`tk-${kind}`, TRACKERS, mine.map((index) => trackerMarkup(ctx, ctx.settings.trackers[index]!, index, placeholder)), end)}
        <div>${tertiary(add, act('add', `data-what="tracker" data-kind="${kind}"`))}</div>`;
  return `<div class="st-box">${box(`<h3 class="t-h6 st-grow">${title}</h3>`, open, toggle(id, title, open), count(mine.length, FIELDS), body)}</div>`;
}

export function wellbeingBody(ctx: Ctx): string {
  return TRACKER_KINDS.map((kind) => trackerKind(ctx, kind)).join('');
}

/* ---- the activity sections ---- */

function activityHead(ctx: Ctx, kind: ActivityKind, hint: boolean): string {
  const activity = ctx.settings[kind];
  const head = checkbox('показувати на головній', activity.enabled, `${act('kind-on')} data-kind="${kind}"`);
  if (!activity.enabled) return head;
  return `${head}${hint ? ed(`${kind}.hint`, activity.hint, 'підказка', 'підказка', 'long', 't-3rd-regular') : ''}`;
}

function target(ctx: Ctx, kind: ActivityKind): string {
  return daysSlider({
    label: 'ціль: днів на тиждень', value: ctx.settings[kind].weeklyTarget, name: 'target', data: `data-kind="${kind}"`,
    spoken: `ціль, ${KIND_NAMES[kind]}: днів на тиждень`,
  });
}

const addButton = (label: string, data: string) => `<div class="st-end">${tertiary(label, act('add', data))}</div>`;

/* exercises */

function exerciseHead(ctx: Ctx, id: string): { name: string; how: string; source: Source } {
  return ctx.settings.exercises.find((exercise) => exercise.id === id) ?? { name: '', how: '', source: { type: 'user' } };
}

function warmupItem(ctx: Ctx, family: string, slot: Slot, item: WarmupItem): string {
  const path = `${slot.list}.${slot.index}`;
  const exercise = exerciseHead(ctx, item.exercise);
  const value = item.seconds === null
    ? ed(`${path}.reps`, item.reps, 'n разів', 'скільки разів', 'text', 't-3rd-regular st-value')
    : ed(`${path}.seconds`, `${formatNumber(item.seconds)} с`, 'n с', 'скільки секунд', 'number', 't-3rd-regular st-value');
  const inner = `
        <div class="st-row">${ed(`ex:${item.exercise}.name`, exercise.name, 'вправа', 'назва вправи', 'text')}${value}</div>
        ${ed(`ex:${item.exercise}.how`, exercise.how, 'як робити: короткий опис вправи', 'як робити', 'long', 't-3rd-regular')}
        ${checkbox('n с', item.seconds !== null, `${act('timed')} data-path="${path}"`)}
        ${linkField(`ex:${item.exercise}.source`, exercise.source)}
        ${removeButton(slot, exercise.name, 'exercise')}`;
  return entry(ctx, family, slot, item.exercise, exercise.name, inner);
}

export function prescription(item: WorkoutItem): string {
  return `${item.sets ? `${item.sets} × ` : ''}${item.reps}${item.side ? ` ${item.side}` : ''}`;
}

function workoutFields(item: WorkoutItem, path: string): string {
  const on = (field: WorkoutItem['fields'][number]) => item.fields.includes(field);
  const box = (field: WorkoutItem['fields'][number], label: string) => checkbox(label, on(field), `${act('wfield')} data-path="${path}.fields" data-field="${field}"`);
  const seconds = on('seconds') ? ed(`${path}.seconds`, item.seconds === null ? '' : `${formatNumber(item.seconds)} с`, 'скільки секунд', 'скільки секунд', 'number', 't-3rd-regular st-value') : '';
  const weight = on('weight') ? ed(`${path}.weight`, item.weight === null ? '' : `${formatNumber(item.weight)} кг`, 'стартова вага', 'вага', 'number', 't-3rd-regular st-value') : '';
  return `<div class="st-fields">
          <div class="st-row">${box('seconds', 'n с')}${seconds}</div>
          <div class="st-row">${box('weight', 'n кг')}${weight}</div>
          ${box('reps', 'n разів')}
        </div>`;
}

function workoutItem(ctx: Ctx, slot: Slot, item: WorkoutItem): string {
  const path = `${slot.list}.${slot.index}`;
  const exercise = exerciseHead(ctx, item.exercise);
  if (ctx.view.picking) return pickRow(ctx, slot, item.exercise, exercise, prescription(item));
  const inner = `
        <div class="st-row">${ed(`ex:${item.exercise}.name`, exercise.name, 'вправа', 'назва вправи', 'text')}${
  ed(`${path}.@rx`, prescription(item), 'n разів', 'підходи × повторення (наприклад, 3 × 10–12)', 'rx', 't-3rd-regular st-value')}</div>
        ${ed(`ex:${item.exercise}.how`, exercise.how, 'як робити: короткий опис вправи', 'як робити', 'long', 't-3rd-regular')}
        ${linkField(`ex:${item.exercise}.source`, exercise.source)}
        ${workoutFields(item, path)}
        ${removeButton(slot, exercise.name, 'exercise')}`;
  return entry(ctx, 'wo-ex', slot, item.exercise, exercise.name, inner);
}

/**
 * In «створити групу»: an exercise is a toggle with its name, «n разів» and how-to
 * (example/settings-create-group); another workout's are off once one is chosen.
 */
function pickRow(ctx: Ctx, slot: Slot, item: string, exercise: { name: string; how: string }, rx: string): string {
  const name = exercise.name;
  const picking = ctx.view.picking!;
  const chosen = picking.list === slot.list && picking.chosen.includes(slot.index);
  const other = picking.list !== null && picking.list !== slot.list;
  const full = !chosen && picking.chosen.length >= 3;
  const how = exercise.how ? `<span class="st-pick__how t-3rd-regular">${esc(exercise.how)}</span>` : '<span class="st-pick__how"></span>';
  return `<button type="button" class="ctl st-pick" ${act('pick', slotData(slot))} data-key="${esc(entryKey('wo-ex', item))}" aria-label="${esc(shown(name))}" aria-pressed="${chosen}"${other || full ? ' disabled' : ''}>
    <span class="st-pick__name t-1st-regular">${esc(shown(name))}</span><span class="st-pick__rx t-3rd-regular">${esc(rx || 'n разів')}</span>${how}</button>`;
}

function groupMarkup(ctx: Ctx, slot: Slot, set: readonly WorkoutItem[]): string {
  const inner = `${slot.list}.${slot.index}.set`;
  const names = set.map((item) => shown(exerciseHead(ctx, item.exercise).name));
  const items = set.map((item, index) => workoutItem(ctx, { list: inner, index }, item));
  if (ctx.view.picking) return `<div class="st-group st-group--off"><p class="t-3rd-regular muted">група вправ: ${esc(names.join(' + '))}</p></div>`;
  return entry(ctx, 'wo-ex', slot, `set:${set[0]?.exercise ?? ''}`, `група вправ: ${names.join(' + ')}`, `<p class="t-3rd-regular muted">група вправ</p>${list('wo-ex', inner, items)}`, ' st-group', ` data-group="${set.length}"`);
}

function workoutEntries(ctx: Ctx, path: string, items: readonly WorkoutEntry[]): string {
  return list('wo-ex', path, items.map((item, index) => ('set' in item
    ? groupMarkup(ctx, { list: path, index }, item.set)
    : workoutItem(ctx, { list: path, index }, item))));
}

/* levels, «для чого», workouts */

interface Container {
  readonly family: string;
  readonly id: string;
  readonly slot: Slot;
  readonly name: string;
  readonly head: string;
  readonly meta: string;
  readonly body: () => string;
  readonly thing: Thing;
  readonly forceOpen?: boolean;
}

/** «видалити …» is the last line of the open box; while picking a group there is nothing to delete. */
function container(ctx: Ctx, c: Container): string {
  const open = c.forceOpen === true || ctx.view.inner.has(c.id);
  const items = `${c.slot.list}.${c.slot.index}.items`;
  const body = () => `${c.body()}${ctx.view.picking ? '' : removeButton(c.slot, c.name, c.thing)}`;
  const inner = box(c.head, open, toggle(c.id, c.name, open), c.meta, body);
  return entry(ctx, c.family, c.slot, c.id, c.name, inner, ' st-box', ` data-items="${esc(items)}"${open ? '' : ' data-closed="1"'}`);
}

const addExercise = (items: string) => `<div>${tertiary('додати вправу', act('add', `data-what="exercise" data-list="${esc(items)}"`))}</div>`;

export function morningBody(ctx: Ctx): string {
  const { morningWarmup } = ctx.settings;
  const head = activityHead(ctx, 'morningWarmup', false);
  if (!morningWarmup.enabled) return head;
  const path = LIST_OF.morningWarmup;
  const levels = morningWarmup.levels.map((level, index) => {
    const items = `${path}.${index}.items`;
    return container(ctx, {
      family: 'lv', thing: 'level', id: level.id, slot: { list: path, index }, name: level.name,
      head: `${ed(`${path}.${index}.name`, level.name, 'назва рівня (наприклад, легкий день)', 'назва рівня', 'text', 't-h6 st-grow')}${
        ed(`${path}.${index}.duration`, level.duration, 'час', 'час (наприклад, 10 хв)', 'text', 't-3rd-regular st-value')}`,
      meta: exerciseCount(level.items),
      body: () => `${list('mw-ex', items, level.items.map((item, i) => warmupItem(ctx, 'mw-ex', { list: items, index: i }, item)))}${addExercise(items)}`,
    });
  });
  return `${head}${target(ctx, 'morningWarmup')}${list('lv', path, levels)}${addButton('додати рівень', 'data-what="level"')}`;
}

export function daytimeBody(ctx: Ctx): string {
  const { daytimeWarmup } = ctx.settings;
  const head = activityHead(ctx, 'daytimeWarmup', true);
  if (!daytimeWarmup.enabled) return head;
  const path = LIST_OF.daytimeWarmup;
  const zones = daytimeWarmup.groups.map((zone, index) => {
    const items = `${path}.${index}.items`;
    return container(ctx, {
      family: 'dg', thing: 'zone', id: zone.id, slot: { list: path, index }, name: zone.name,
      head: ed(`${path}.${index}.name`, zone.name, 'для чого (наприклад, для спини)', 'для чого', 'text', 't-h6 st-grow'),
      meta: exerciseCount(zone.items),
      body: () => `${list('dw-ex', items, zone.items.map((item, i) => warmupItem(ctx, 'dw-ex', { list: items, index: i }, item)))}${addExercise(items)}`,
    });
  });
  return `${head}${target(ctx, 'daytimeWarmup')}${list('dg', path, zones)}${addButton('додати зону', 'data-what="zone"')}`;
}

function groupHint(ctx: Ctx): string {
  const { picking } = ctx.view;
  if (!picking) {
    return `<p class="t-3rd-regular muted">група вправ — 2–3 вправи, які робиш разом. натисни «створити групу» й вибери вправи. або потягни вправу на іншу, як застосунки в папку на телефоні.</p>
        <div>${tertiary('створити групу', act('pick-start'))}</div>`;
  }
  const n = picking.chosen.length;
  return `<div class="st-row st-picking">
          <p class="t-2nd-bold st-grow" aria-live="polite">вибери 2–3 вправи для групи</p>
          ${iconButton('check', 'зібрати групу', act('pick-done'), n < 2 || n > 3)}
          ${iconButton('close', 'скасувати групу', act('pick-cancel'))}
        </div>`;
}

export function workoutBody(ctx: Ctx): string {
  const { workout } = ctx.settings;
  const head = activityHead(ctx, 'workout', true);
  if (!workout.enabled) return head;
  const path = LIST_OF.workout;
  const sessions = workout.sessions.map((session, index) => {
    const items = `${path}.${index}.items`;
    return container(ctx, {
      family: 'ss', thing: 'session', id: session.id, slot: { list: path, index }, name: session.name ? sessionName(session.name) : '',
      head: ed(`${path}.${index}.name`, session.name ? sessionName(session.name) : '', 'тренування (назва)', 'назва тренування', 'text', 't-h6 st-grow'),
      meta: exerciseCount(session.items),
      forceOpen: ctx.view.picking !== null,
      body: () => `${ed(`${path}.${index}.how`, session.how, 'як робити: як проходить тренування', 'як проходить тренування', 'long', 't-3rd-regular')}
          ${workoutEntries(ctx, items, session.items)}${ctx.view.picking ? '' : addExercise(items)}`,
    });
  });
  return `${head}${groupHint(ctx)}${target(ctx, 'workout')}${list('ss', path, sessions)}${addButton('додати тренування', 'data-what="session"')}`;
}

const MOVEMENT_FIELDS: readonly [MovementKind['fields'][number], string][] = [['km', 'n км'], ['minutes', 'n хв'], ['steps', 'n кроків']];

function movementKind(ctx: Ctx, kind: MovementKind, index: number): string {
  const path = `${LIST_OF.movement}.${index}`;
  const slot = { list: LIST_OF.movement, index };
  const fields = MOVEMENT_FIELDS.map(([field, label]) => checkbox(label, kind.fields.includes(field), `${act('mfield')} data-path="${path}.fields" data-field="${field}"`));
  const inner = `
        <div class="st-row">${ed(`${path}.name`, kind.name, 'що саме (наприклад, прогулянка)', 'що саме', 'text', 't-1st-semibold')}</div>
        ${linkField(`${path}.source`, kind.source)}
        <div class="st-fields">${fields.join('')}</div>
        ${removeButton(slot, kind.name, 'movement')}`;
  return entry(ctx, 'mv', slot, kind.id, kind.name, inner);
}

export function movementBody(ctx: Ctx): string {
  const { movement } = ctx.settings;
  const head = activityHead(ctx, 'movement', true);
  if (!movement.enabled) return head;
  const kinds = movement.kinds.map((kind, index) => movementKind(ctx, kind, index));
  return `${head}${list('mv', LIST_OF.movement, kinds)}${target(ctx, 'movement')}${addButton('додати рух', 'data-what="movement"')}`;
}

/* ---- the lines of closed parts ---- */

const LEVELS = ['рівень', 'рівні', 'рівнів'] as const;
const ZONES = ['зона', 'зони', 'зон'] as const;
const SESSIONS = ['тренування', 'тренування', 'тренувань'] as const;
const KINDS = ['вид руху', 'види руху', 'видів руху'] as const;

export function sectionMetas(settings: Settings): Record<ActivityKind, string> {
  const off = (kind: ActivityKind, line: string) => (settings[kind].enabled ? line : 'вимкнено');
  const names = settings.movement.kinds.map((kind) => kind.name.trim()).filter(Boolean);
  return {
    morningWarmup: off('morningWarmup', count(settings.morningWarmup.levels.length, LEVELS)),
    daytimeWarmup: off('daytimeWarmup', count(settings.daytimeWarmup.groups.length, ZONES)),
    workout: off('workout', count(settings.workout.sessions.length, SESSIONS)),
    movement: off('movement', names.length ? names.join(', ') : count(settings.movement.kinds.length, KINDS)),
  };
}
