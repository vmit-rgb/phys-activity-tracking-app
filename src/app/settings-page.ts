import type { DayKey } from '../domain/dates';
import { readCopy, type Diary, type JsonObject } from '../domain/diary';
import { exercisesText, exportFile, recordsText, type ExportTab } from '../domain/export';
import { plural } from '../domain/numbers';
import {
  cleanForSave, withAccent, withAccessibility, withEncouragement, withGoal, withPulseTimer, type ProfileEdit,
} from '../domain/profile-edit';
import { readSettings, type ActivityKind, type Settings } from '../domain/settings';
import { showSettings, type PartId, type SettingsAct } from '../screens/settings';
import { confirmDialog, editText } from '../ui/dialog';
import type { Toast, ToastMessage } from '../ui/toast';

/*
 * The settings page's working copy (Figma screen/edit-profile; «бета 0.81»
 * `openSettings`, `stSave`, `stClose`): every change goes into a draft that
 * is shown at once (also the look: accent, text size…), 💾 keeps it with
 * «скасувати» in the toast, leaving with changes asks first. Copy, export,
 * restore and deleting act on the saved diary right away.
 */

export interface SettingsEnv {
  /** Puts a profile's look (accent, «доступність») on screen. */
  look(profile: JsonObject): void;
  /** The phone's «reduce motion». */
  motionReduced(): boolean;
  /** Puts text on the clipboard; false when the phone refuses. */
  copyText(text: string): Promise<boolean>;
  /** Hands a file to the phone; throws when it refuses. */
  saveFile(name: string, text: string): void;
  now(): Date;
}

export interface SettingsHome {
  host: HTMLElement;
  toast: Toast;
  today(): DayKey;
  diary(): Diary;
  /** «остання копія — …» */
  backupLine(): string;
  /** «зберегти копію»; false when the phone refused the file. */
  saveCopy(): boolean;
  /** Stores the diary and stays here; false (and a toast) when the phone refuses. */
  keep(next: Diary): boolean;
  /** Starts over with this diary, on home. */
  restart(next: Diary, message?: ToastMessage): void;
  /** «стерти все»: the first screen, nothing kept. */
  erase(message: ToastMessage): void;
  /** ✕: home, every screen closed. */
  close(): void;
}

export interface SettingsPage {
  draw(): () => void;
  /** Whether leaving now loses something; asks first, and puts the saved look back when it may go. */
  mayLeave(): Promise<boolean>;
}

/* COPY.md, Toasts and Settings; Нитка's drafts marked. */
const SAVED: ToastMessage = { message: 'збережено', emoticon: ':)' };
const COPIED: ToastMessage = { message: 'скопійовано — встав у чат зі своїм ШІ' };
const NOT_COPIED: ToastMessage = { message: 'не вдалося скопіювати', emoticon: '>_<' }; // draft
const FILE_SAVED: ToastMessage = { message: 'збережено', showIcon: true };
const FILE_NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти файл', emoticon: '>_<' };
const NOT_A_COPY: ToastMessage = { message: 'цей файл не схожий на копію з трекера', emoticon: '>_<' };
const RESTORED: ToastMessage = { message: 'відновлено з файлу', emoticon: ':)', showIcon: true };
const soon = (message: string): ToastMessage => ({ message, emoticon: ':)' });
const PROMPT_SOON = soon('промпт ще пишемо, скоро буде');
const PASTE_SOON = soon('вставку налаштувань від ШІ ще робимо, скоро буде');
const PDF_SOON = soon('PDF ще робимо, скоро буде'); // draft
const PHRASE_MAX = 80;
const DAYS = ['день', 'дні', 'днів'] as const;

const same = (a: JsonObject, b: JsonObject) => JSON.stringify(a) === JSON.stringify(b);

/** The page's working copy and what it does; one instance per visit to the settings. */
class Draft implements SettingsPage {
  private saved: JsonObject;
  private draft: JsonObject;
  private open = new Set<PartId>();
  private exportTab: ExportTab = 'records';
  private pasted = '';
  private shown = false;

  constructor(private readonly env: SettingsEnv, private readonly home: SettingsHome) {
    this.saved = home.diary().profile;
    this.draft = this.saved;
  }

  settings(): Settings {
    return readSettings(this.draft);
  }

  say(message: ToastMessage): void {
    this.home.toast.show(message);
  }

  draw = (): (() => void) => {
    this.shown = true;
    showSettings(this.home.host, {
      settings: this.settings(),
      open: this.open,
      motionReduced: this.env.motionReduced(),
      backupLine: this.home.backupLine(),
      exportTab: this.exportTab,
      pasted: this.pasted,
    }, { act: (action) => ACTS[action.act](this, action as never), paste: (text) => (this.pasted = text), restore: (file) => void this.restore(file) });
    return () => {
      this.shown = false;
    };
  };

  redraw(): void {
    if (this.shown) this.draw();
  }

  change(edit: ProfileEdit): void {
    this.draft = edit(this.draft);
    this.env.look(this.draft);
    this.redraw();
  }

  toggle(part: PartId): void {
    this.open = new Set(this.open);
    if (!this.open.delete(part)) this.open.add(part);
    this.redraw();
  }

  showTab(tab: ExportTab): void {
    this.exportTab = tab;
    this.redraw();
  }

  /* ---- 💾 and leaving ---- */

  /** Makes `profile` the saved one (and the draft); false when the phone refused. */
  private keepProfile(profile: JsonObject): boolean {
    if (!this.home.keep({ ...this.home.diary(), profile })) return false;
    this.saved = profile;
    this.draft = profile;
    this.redraw();
    return true;
  }

  save(): void {
    const before = this.saved;
    if (!this.keepProfile(cleanForSave(this.draft))) return;
    this.say({ ...SAVED, action: { label: 'скасувати', run: () => void this.keepProfile(before) } });
  }

  mayLeave = async (): Promise<boolean> => {
    if (!same(this.draft, this.saved)) {
      const answer = await confirmDialog({
        title: 'вийти без збереження?', body: 'зміни на цій сторінці пропадуть.', confirm: 'вийти', cancel: 'залишитися',
      });
      if (answer !== 'confirm') return false;
    }
    this.forget();
    return true;
  };

  /** Drops the draft and puts the saved look back. */
  private forget(): void {
    this.draft = this.saved;
    this.env.look(this.saved);
  }

  async close(): Promise<void> {
    if (await this.mayLeave()) this.home.close();
  }

  /* ---- the phrase ---- */

  async editPhrase(index: number, adding: boolean): Promise<void> {
    const phrases = this.settings().encouragement;
    const typed = await editText({ label: 'підбадьорлива фраза', value: phrases[index] ?? '', maxLength: PHRASE_MAX });
    if (typed) this.change(withEncouragement(phrases.map((p, i) => (i === index ? typed : p)).concat(adding ? [typed] : [])));
  }

  async removePhrase(index: number): Promise<void> {
    const phrases = this.settings().encouragement;
    const answer = await confirmDialog({
      title: `видалити «${phrases[index]}»?`, body: 'її більше не буде в налаштуваннях.', confirm: 'видалити', cancel: 'скасувати',
    });
    if (answer === 'confirm') this.change(withEncouragement(phrases.filter((_, i) => i !== index)));
  }

  /* ---- copy, export, restore ---- */

  async copy(text: string): Promise<void> {
    this.say((await this.env.copyText(text)) ? COPIED : NOT_COPIED);
  }

  copySettings(): Promise<void> {
    return this.copy(JSON.stringify(this.draft, null, 1));
  }

  exportText(): Promise<void> {
    const diary = this.home.diary();
    const settings = readSettings(diary.profile);
    const today = this.home.today();
    return this.copy(this.exportTab === 'records' ? recordsText(diary.days, settings, today) : exercisesText(settings, today));
  }

  exportJson(): void {
    const file = exportFile(this.exportTab, this.home.diary(), this.home.today(), this.env.now());
    try {
      this.env.saveFile(file.name, file.text);
    } catch {
      return this.say(FILE_NOT_SAVED);
    }
    this.say(FILE_SAVED);
  }

  async restore(file: File): Promise<void> {
    const copied = await readCopy(file);
    if (!copied) return this.say(NOT_A_COPY);
    const n = Object.keys(copied.days).length;
    const answer = await confirmDialog({
      title: 'відновити з файлу?',
      body: `записи й налаштування з файлу (${n} ${plural(n, DAYS)}) замінять ті, що є зараз.`,
      confirm: 'відновити',
      cancel: 'скасувати',
    });
    if (answer !== 'confirm') return;
    this.forget();
    this.home.restart(copied, RESTORED);
  }

  backup(): void {
    if (this.home.saveCopy()) this.redraw();
  }

  /* ---- deleting (ACCESSIBILITY.md: a tap and a confirmation, no hold) ---- */

  async deleteRecords(): Promise<void> {
    const answer = await confirmDialog({ title: 'видалити тільки записи?', body: 'видалене не повернути.', confirm: 'видалити', cancel: 'скасувати' });
    if (answer !== 'confirm') return;
    const before = this.home.diary();
    if (!this.home.keep({ ...before, days: {} })) return;
    this.say({ message: 'записи видалено', action: { label: 'скасувати', run: () => void this.home.keep({ ...this.home.diary(), days: before.days }) } });
  }

  async deleteAll(): Promise<void> {
    const answer = await confirmDialog({
      title: 'стерти все разом з налаштуваннями?',
      body: 'спершу збережи копію: видалене не повернути.',
      extra: 'зберегти копію',
      confirm: 'стерти все',
      cancel: 'скасувати',
    });
    if (answer === 'extra') return this.backup();
    if (answer !== 'confirm') return;
    const before = this.home.diary();
    this.forget();
    this.home.erase({ message: 'усе видалено', action: { label: 'скасувати', run: () => this.home.restart(before) } });
  }

  /* ---- the goal and the pulse timer ---- */

  goalKind(kind: ActivityKind, on: boolean): void {
    const done = this.settings().goal.done.filter((k) => k !== kind);
    this.change(withGoal({ done: on ? [...done, kind] : done }));
  }

  goalDays(delta: number): void {
    this.change(withGoal({ days: this.settings().goal.days + delta }));
  }

  /** Switching a timer on starts at 30 s (Figma); switching off keeps its length. */
  timer(trackerId: string, on: boolean): void {
    const tracker = this.settings().trackers.find((t) => t.id === trackerId);
    const seconds = tracker?.kind === 'number' && tracker.timer !== null ? tracker.timer : 30;
    this.change(withPulseTimer(trackerId, on, seconds));
  }
}

type Acts = { readonly [K in SettingsAct['act']]: (page: Draft, action: Extract<SettingsAct, { act: K }>) => void };

/** What each tap does. */
const ACTS: Acts = {
  part: (p, a) => p.toggle(a.part),
  'goal-on': (p, a) => p.change(withGoal({ enabled: a.on })),
  'goal-kind': (p, a) => p.goalKind(a.kind, a.on),
  'goal-days': (p, a) => p.goalDays(a.delta),
  phrase: (p, a) => void p.editPhrase(a.index, false),
  'phrase-add': (p) => void p.editPhrase(p.settings().encouragement.length, true),
  'phrase-rm': (p, a) => void p.removePhrase(a.index),
  accent: (p, a) => p.change(withAccent(a.accent)),
  access: (p, a) => p.change(withAccessibility(a.key, a.on)),
  timer: (p, a) => p.timer(a.tracker, a.on),
  'timer-length': (p, a) => p.change(withPulseTimer(a.tracker, true, a.seconds)),
  'export-tab': (p, a) => p.showTab(a.tab),
  save: (p) => p.save(),
  close: (p) => void p.close(),
  'copy-prompt': (p) => p.say(PROMPT_SOON),
  'copy-settings': (p) => void p.copySettings(),
  apply: (p) => p.say(PASTE_SOON),
  backup: (p) => p.backup(),
  'export-ai': (p) => void p.exportText(),
  'export-json': (p) => p.exportJson(),
  'export-pdf': (p) => p.say(PDF_SOON),
  'delete-records': (p) => void p.deleteRecords(),
  'delete-all': (p) => void p.deleteAll(),
};

export function settingsPage(env: SettingsEnv, home: SettingsHome): SettingsPage {
  return new Draft(env, home);
}
