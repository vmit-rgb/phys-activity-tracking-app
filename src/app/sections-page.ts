import type { JsonObject } from '../domain/diary';
import { sessionName } from '../domain/journal';
import { formatNumber, parseNumber } from '../domain/numbers';
import type { ProfileEdit } from '../domain/profile-edit';
import {
  freeId, joinGroup, linkSource, LIST_OF, newTracker, TRACKERS, valueAt, withActivity, withAdded, withChoice, withExercise, withGroup, withLeft,
  withMoved, withNewExercise, withPrescription, withRemoved, withTimed, withValue, type Place, type Slot,
} from '../domain/sections-edit';
import { MOMENTS, type ActivityKind, type Moment, type Settings, type Tracker } from '../domain/settings';
import type { DropTarget } from '../screens/drag';
import type { AddWhat } from '../screens/settings';
import { THINGS, type ActionMenu, type EditKind, type Picking, type SectionsView, type Thing } from '../screens/settings-sections';
import { confirmDialog, editText } from '../ui/dialog';
import { undo, type ToastMessage } from '../ui/toast';

/*
 * Stage 6d: what the settings do inside the sections, on the page's draft
 * (saved with 💾 like the rest). Every drag or menu action says what
 * happened with «скасувати» (brief, Decisions 2026-10-30; COPY.md
 * «Settings»), except a full group, where nothing changed.
 */

/** The page's draft, as the sections see it. */
export interface DraftHost {
  settings(): Settings;
  profile(): JsonObject;
  change(edit: ProfileEdit): void;
  /** Puts a whole profile in the draft (undo). */
  replace(profile: JsonObject): void;
  redraw(): void;
  say(message: ToastMessage): void;
}

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Obj : {});

/* COPY.md «Settings», accepted 2026-10-30; the rest Нитка's drafts. */
const GROUPED: ToastMessage = { message: 'групу зібрано', emoticon: ':)', showIcon: true };
const LEFT: ToastMessage = { message: 'вправу винесено з групи', showIcon: true };
const MOVED: ToastMessage = { message: 'переміщено', showIcon: true };
const REMOVED: ToastMessage = { message: 'видалено', showIcon: true }; // «бета 0.81»
const FULL: ToastMessage = { message: 'у групі вже 3 вправи — більше не влізе', emoticon: '>_<' };
const NOT_A_NUMBER: ToastMessage = { message: 'тут потрібне число', emoticon: '>_<' }; // draft
const ONE_FIELD: ToastMessage = { message: 'хоч одне поле має лишитися', emoticon: '>_<' }; // draft

const MAX: Record<EditKind, number> = { text: 120, long: 500, url: 500, number: 12, rx: 60 };
const FIELD_ORDER = { wfield: ['weight', 'reps', 'seconds'], mfield: ['km', 'minutes', 'steps'] } as const;
const FIELD_DEFAULT = { wfield: 'reps', mfield: 'minutes' } as const;

const ADD_LABELS: Record<AddWhat, string> = {
  tracker: 'назва', level: 'назва рівня', zone: 'для чого', session: 'назва тренування', movement: 'що саме', exercise: 'назва вправи',
};

const LIST_THING: Readonly<Record<string, Thing>> = {
  [LIST_OF.morningWarmup]: 'level', [LIST_OF.daytimeWarmup]: 'zone', [LIST_OF.workout]: 'session', [LIST_OF.movement]: 'movement',
};

/** The list a group sits in, for an entry inside the group. */
const outside = (list: string) => list.replace(/\.\d+\.set$/, '');
const inGroup = (list: string) => list.endsWith('.set');

export class SectionsEditor {
  private inner = new Set<string>();
  private menu: ActionMenu | null = null;
  private picking: Picking | null = null;
  /** The open menu's family (trackers step only among their kind). */
  private family = '';

  constructor(private readonly draft: DraftHost) {}

  view(): SectionsView {
    return { inner: this.inner, menu: this.menu, picking: this.picking };
  }

  toggle(id: string): void {
    if (!this.inner.delete(id)) this.inner.add(id);
    this.draft.redraw();
  }

  /** A short vibration when an entry is lifted, unless «вимкнути вібровідгук». */
  lifted(): void {
    if (!this.draft.settings().accessibility.noVibration) navigator.vibrate?.(18);
  }

  /** Runs a change and says so with «скасувати». */
  private undoable(edit: ProfileEdit, message: ToastMessage): void {
    const before = this.draft.profile();
    this.draft.change(edit);
    this.draft.say({ ...message, action: undo(() => this.draft.replace(before)) });
  }

  private entry(slot: Slot): Obj {
    return obj(valueAt(this.draft.profile(), `${slot.list}.${slot.index}`));
  }

  /** What an entry is called, for dialogs and menus. */
  private nameOf(slot: Slot): string {
    const found = this.entry(slot);
    if (Array.isArray(found.set)) return `група: ${found.set.map((item) => this.exerciseName(obj(item).exercise)).join(' + ')}`;
    if (typeof found.exercise === 'string') return this.exerciseName(found.exercise);
    const name = typeof found.name === 'string' ? found.name.trim() : '';
    return name && slot.list === LIST_OF.workout ? sessionName(name) : name || 'без назви';
  }

  private exerciseName(id: unknown): string {
    return this.draft.settings().exercises.find((exercise) => exercise.id === id)?.name.trim() || 'вправа';
  }

  /* ---- values ---- */

  private current(path: string, kind: EditKind): string {
    const exercise = /^ex:(.+)\.(name|how|source)$/.exec(path);
    if (exercise) {
      const found = this.draft.settings().exercises.find((x) => x.id === exercise[1]);
      if (!found) return '';
      return exercise[2] === 'source' ? (found.source.type === 'link' ? found.source.url : '') : found[exercise[2] as 'name' | 'how'];
    }
    if (kind === 'rx') {
      const item = obj(valueAt(this.draft.profile(), path.slice(0, -'.@rx'.length)));
      return `${typeof item.sets === 'number' ? `${item.sets} × ` : ''}${String(item.reps ?? '')}`;
    }
    const value = valueAt(this.draft.profile(), path);
    if (kind === 'url') return String(obj(value).url ?? '');
    if (typeof value === 'number') return formatNumber(value);
    return typeof value === 'string' ? value : '';
  }

  async edit(path: string, kind: EditKind, label: string): Promise<void> {
    const typed = await editText({ label, value: this.current(path, kind), maxLength: MAX[kind] });
    if (typed === null) return;
    const edit = this.editFor(path, kind, typed);
    if (edit) this.draft.change(edit);
  }

  private editFor(path: string, kind: EditKind, typed: string): ProfileEdit | null {
    const exercise = /^ex:(.+)\.(name|how|source)$/.exec(path);
    if (exercise) return withExercise(exercise[1]!, exercise[2] as 'name' | 'how' | 'source', kind === 'url' ? linkSource(typed) : typed);
    if (kind === 'url') return withValue(path, linkSource(typed));
    if (kind === 'rx') return withPrescription(path.slice(0, -'.@rx'.length), typed);
    if (kind !== 'number') return withValue(path, typed);
    const value = parseNumber(typed.replace(/[^\d,.-]/g, ''));
    if (value !== null) return withValue(path, value);
    if (typed.trim() !== '') this.draft.say(NOT_A_NUMBER);
    // an empty weight or workout time means «none»; a warm-up time or a scale end stays
    else if (/^workout\..*\.(weight|seconds)$/.test(path)) return withValue(path, undefined);
    return null;
  }

  ask(path: string, moment: Moment, on: boolean): void {
    this.draft.change(withChoice(path, moment, on, MOMENTS));
  }

  timed(path: string, on: boolean): void {
    const item = obj(valueAt(this.draft.profile(), path));
    const old = item.timed === true;
    const seconds = typeof item.seconds === 'number' ? item.seconds : old ? Number(item.reps) || null : null;
    this.draft.change(withTimed(path, on, seconds, old ? '' : String(item.reps ?? '')));
  }

  /** A field on or off; the last one stays (an empty list would read as the default anyway). */
  field(which: 'wfield' | 'mfield', path: string, field: string, on: boolean): void {
    const stored = valueAt(this.draft.profile(), path);
    const now = Array.isArray(stored) && stored.length ? stored : [FIELD_DEFAULT[which]];
    const next = FIELD_ORDER[which].filter((f) => (f === field ? on : now.includes(f)));
    if (!next.length) {
      this.draft.say(ONE_FIELD);
      return this.draft.redraw();
    }
    this.draft.change(withValue(path, next));
  }

  activity(kind: ActivityKind, on: boolean): void {
    this.draft.change(withActivity(kind, { enabled: on }));
  }

  target(kind: ActivityKind, delta: number): void {
    this.draft.change(withActivity(kind, { weeklyTarget: this.draft.settings()[kind].weeklyTarget + delta }));
  }

  /* ---- adding and removing ---- */

  /** «додати …»: the name first (full-screen field); nothing typed adds nothing. New boxes open. */
  async add(what: AddWhat, kind: Tracker['kind'], list: string): Promise<void> {
    const name = await editText({ label: ADD_LABELS[what], value: '', maxLength: MAX.text });
    if (!name) return;
    const profile = this.draft.profile();
    if (what === 'exercise') return this.draft.change(withNewExercise(list, freeId(profile, 'exercise'), name));
    if (what === 'tracker') {
      this.inner.add(`k:${kind}`);
      return this.draft.change(withAdded(TRACKERS, newTracker(kind, freeId(profile, 'tracker'), name)));
    }
    const made = this.made(what, freeId(profile, what), name);
    this.inner.add(String(made.entry.id));
    this.draft.change(withAdded(made.list, made.entry));
  }

  private made(what: Exclude<AddWhat, 'exercise' | 'tracker'>, id: string, name: string): { list: string; entry: Obj } {
    switch (what) {
      case 'level':
        return { list: LIST_OF.morningWarmup, entry: { id, name, duration: '', items: [] } };
      case 'zone':
        return { list: LIST_OF.daytimeWarmup, entry: { id, name, items: [] } };
      case 'session':
        return { list: LIST_OF.workout, entry: { id, name, how: '', items: [] } };
      default:
        return { list: LIST_OF.movement, entry: { id, name, fields: ['minutes'], source: { type: 'user' } } };
    }
  }

  async remove(slot: Slot): Promise<void> {
    const it = THINGS[this.thingOf(slot)][1];
    const answer = await confirmDialog({
      title: `видалити «${this.nameOf(slot)}»?`, body: `${it} більше не буде в налаштуваннях.`, confirm: 'видалити', cancel: 'скасувати',
    });
    if (answer === 'confirm') this.undoable(withRemoved(slot), REMOVED);
  }

  /** A level, a «для чого», a workout, a kind of movement by its list; a tracker by its kind; the rest are exercises. */
  private thingOf(slot: Slot): Thing {
    if (slot.list === TRACKERS) return this.entry(slot).kind as Tracker['kind'];
    return LIST_THING[slot.list] ?? 'exercise';
  }

  /* ---- moving: dragging, the menu ---- */

  drop(from: Slot, target: DropTarget): void {
    if (target.kind === 'full') return this.draft.say(FULL);
    if (target.kind === 'group') return this.join(from, target.onto);
    const left = inGroup(from.list) && target.list !== from.list;
    this.undoable(withMoved(from, target), left ? LEFT : MOVED);
  }

  private join(from: Slot, onto: Slot): void {
    const before = this.draft.profile();
    const joined = joinGroup(before, from, onto);
    if (joined.result === 'full') return this.draft.say(FULL);
    this.draft.replace(joined.profile);
    this.draft.say({ ...GROUPED, action: undo(() => this.draft.replace(before)) });
  }

  /** The neighbour up or down; trackers count only those of their own kind. */
  private step(slot: Slot, family: string, delta: -1 | 1): Place | null {
    const list = valueAt(this.draft.profile(), slot.list) as unknown[];
    const kind = family.startsWith('tk-') ? family.slice(3) : null;
    for (let i = slot.index + delta; i >= 0 && i < list.length; i += delta) {
      if (kind === null || obj(list[i]).kind === kind) return { list: slot.list, before: delta < 0 ? i : i + 1 };
    }
    return null;
  }

  /** The lists an exercise can move to: the other levels, «для чого» or workouts. */
  private containers(slot: Slot): { key: string; label: string }[] {
    const home = outside(slot.list);
    const settings = this.draft.settings();
    const kind = (['morningWarmup', 'daytimeWarmup', 'workout'] as const).find((k) => home.startsWith(`${LIST_OF[k]}.`));
    if (!kind) return [];
    const boxes = kind === 'morningWarmup' ? settings.morningWarmup.levels : kind === 'daytimeWarmup' ? settings.daytimeWarmup.groups : settings.workout.sessions;
    return boxes.flatMap((box, i) => {
      const list = `${LIST_OF[kind]}.${i}.items`;
      const label = kind === 'workout' ? sessionName(box.name || String(i + 1)) : box.name.trim() || (kind === 'morningWarmup' ? `рівень ${i + 1}` : 'без назви');
      return list === home ? [] : [{ key: `m:${list}`, label }];
    });
  }

  /** Other entries of the same workout to make a group with. */
  private partners(slot: Slot): { key: string; label: string }[] {
    if (!slot.list.startsWith(`${LIST_OF.workout}.`) || Array.isArray(this.entry(slot).set)) return [];
    const top = outside(slot.list);
    const own = inGroup(slot.list) ? Number(/\.(\d+)\.set$/.exec(slot.list)![1]) : slot.index;
    const items = valueAt(this.draft.profile(), top) as unknown[];
    return items.flatMap((_, i) => (i === own ? [] : [{ key: `g:${i}`, label: this.nameOf({ list: top, index: i }) }]));
  }

  openMenu(slot: Slot, family: string): void {
    const items: { key: string; label: string }[] = [];
    if (this.partners(slot).length) items.push({ key: 'group', label: 'об’єднати в групу з…' });
    if (inGroup(slot.list)) items.push({ key: 'leave', label: 'вийти з групи' });
    if (this.containers(slot).length) items.push({ key: 'move', label: 'перемістити в…' });
    if (this.step(slot, family, -1)) items.push({ key: 'up', label: 'вище' });
    if (this.step(slot, family, 1)) items.push({ key: 'down', label: 'нижче' });
    if (!items.length) return;
    items.push({ key: 'cancel', label: 'скасувати' });
    this.menu = { slot, items };
    this.family = family;
    this.draft.redraw();
  }

  menuItem(key: string): void {
    // its buttons and Escape exist only while the menu is open
    const { slot } = this.menu!;
    if (key === 'group' || key === 'move') {
      const options = key === 'group' ? this.partners(slot) : this.containers(slot);
      this.menu = { slot, items: [...options, { key: 'cancel', label: 'скасувати' }] };
      return this.draft.redraw();
    }
    this.menu = null;
    this.menuAction(slot, key);
  }

  private menuAction(slot: Slot, key: string): void {
    if (key === 'leave') return this.undoable(withLeft(slot), LEFT);
    if (key === 'up' || key === 'down') return this.undoable(withMoved(slot, this.step(slot, this.family, key === 'up' ? -1 : 1)!), MOVED);
    if (key.startsWith('m:')) return this.undoable(withMoved(slot, { list: key.slice(2), before: null }), MOVED);
    if (key.startsWith('g:')) return this.join(slot, { list: outside(slot.list), index: Number(key.slice(2)) });
    this.draft.redraw();
  }

  /* ---- «створити групу» ---- */

  startPicking(): void {
    this.picking = { list: null, chosen: [] };
    this.draft.redraw();
  }

  pick(slot: Slot): void {
    const picking = this.picking!;
    const chosen = picking.list === slot.list ? picking.chosen : [];
    const next = chosen.includes(slot.index) ? chosen.filter((i) => i !== slot.index) : [...chosen, slot.index];
    this.picking = { list: next.length ? slot.list : null, chosen: next };
    this.draft.redraw();
  }

  finishPicking(done: boolean): void {
    const picking = this.picking;
    this.picking = null;
    if (done && picking?.list) return this.undoable(withGroup(picking.list, picking.chosen), GROUPED);
    this.draft.redraw();
  }
}
