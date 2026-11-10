import { ACCENTS, type Accent } from '../domain/accents';
import type { ExportTab } from '../domain/export';
import { plural } from '../domain/numbers';
import {
  ACCESSIBILITY_KEYS, ACTIVITY_KINDS, PULSE_SECONDS, type AccessibilityKey, type ActivityKind, type PulseSeconds, type Settings, type Tracker,
} from '../domain/settings';
import { esc } from '../ui/html';
import { iconSvg } from '../ui/icons';
import { FOOTER, part, wireRestore } from './parts';

/*
 * «налаштування» (Figma screen/edit-profile 186:3278), stage 6c: the parts
 * goal, phrase, accent, «доступність», the pulse timer, the AI, copy and
 * export, deleting; the sections' contents come in 6d. Each part is
 * `accordion/trigger` (group) + `group/section-body`, closed until opened,
 * with a line of what it holds while closed («бета 0.81»). The bar is
 * navigation `edit-profile`: 💾 ✕. Texts: COPY.md «Settings» and «Added
 * 2026-11-08 in Figma».
 */

export type PartId = 'goal' | 'phrase' | 'accent' | 'access' | 'wellbeing' | 'ai' | 'backup' | 'delete';

export interface SettingsState {
  /** The settings as edited, not saved yet. */
  readonly settings: Settings;
  readonly open: ReadonlySet<PartId>;
  /** The phone's «reduce motion»: animations are off whatever the checkboxes say. */
  readonly motionReduced: boolean;
  readonly backupLine: string;
  readonly exportTab: ExportTab;
  /** What is in the paste field, kept over a redraw. */
  readonly pasted: string;
}

/** What a tap asks for; the page decides. Values come from the markup's data attributes. */
export type SettingsAct =
  | { readonly act: 'part'; readonly part: PartId }
  | { readonly act: 'goal-on'; readonly on: boolean }
  | { readonly act: 'goal-kind'; readonly on: boolean; readonly kind: ActivityKind }
  | { readonly act: 'goal-days'; readonly delta: number }
  | { readonly act: 'phrase'; readonly index: number }
  | { readonly act: 'phrase-rm'; readonly index: number }
  | { readonly act: 'phrase-add' | 'save' | 'close' | 'copy-prompt' | 'copy-settings' | 'apply' | 'backup' | 'export-ai' | 'export-json' | 'export-pdf' | 'delete-records' | 'delete-all' }
  | { readonly act: 'accent'; readonly accent: Accent }
  | { readonly act: 'access'; readonly key: AccessibilityKey; readonly on: boolean }
  | { readonly act: 'timer'; readonly tracker: string; readonly on: boolean }
  | { readonly act: 'timer-length'; readonly tracker: string; readonly seconds: PulseSeconds }
  | { readonly act: 'export-tab'; readonly tab: ExportTab };

export interface SettingsActions {
  act(action: SettingsAct): void;
  paste(text: string): void;
  restore(file: File): void;
}

/* COPY.md: accent names from Figma. */
export const ACCENT_NAMES: Record<Accent, string> = {
  gray: 'сірий', orange: 'помаранчевий', pink: 'рожевий', magenta: 'пурпуровий', purple: 'фіолетовий',
  violet: 'лавандовий', blue: 'блакитний', cyan: 'бірюзовий', mint: 'м’ятний',
};

const KIND_NAMES: Record<ActivityKind, string> = {
  morningWarmup: 'ранкова розминка', daytimeWarmup: 'денна розминка', workout: 'тренування', movement: 'рух',
};

/* ACCESSIBILITY.md and Figma section/accessibility; «вимкнути звук» added by Olesia 2026-11-10. */
const ACCESS_LABELS: Record<AccessibilityKey, string> = {
  noMotion: 'вимкнути всі анімації',
  noBackgroundMotion: 'вимкнути фонові анімації (ASCII)',
  noVibration: 'вимкнути вібровідгук',
  noSound: 'вимкнути звук',
  largerTargets: 'збільшені зони тапу',
  largerText: 'збільшити розмір тексту',
  mirrored: 'віддзеркалити нижню панель',
};
/* The closed part's line (Figma layer 347:9003: «без анімацій, більші зони тапу»); Нитка's words for the rest. */
const ACCESS_SHORT: Record<AccessibilityKey, string> = {
  noMotion: 'без анімацій',
  noBackgroundMotion: 'без фонових анімацій',
  noVibration: 'без вібрації',
  noSound: 'без звуку',
  largerTargets: 'більші зони тапу',
  largerText: 'більший текст',
  mirrored: 'дзеркальна панель',
};
const MOTION_KEYS: readonly AccessibilityKey[] = ['noMotion', 'noBackgroundMotion'];

const DAYS = ['день', 'дні', 'днів'] as const;
const PHRASES = ['фраза', 'фрази', 'фраз'] as const;
const FIELDS = ['поле', 'поля', 'полів'] as const;

/* ---- pieces ---- */

function checkbox(label: string, checked: boolean, data: string, disabled = false): string {
  return `
    <label class="ctl checkbox"><input class="checkbox__input" type="checkbox" ${data}${checked ? ' checked' : ''}${disabled ? ' disabled' : ''} /><span class="checkbox__box" aria-hidden="true"></span>
      <span class="checkbox__label t-1st-semibold">${label}</span></label>`;
}

const act = (name: string, extra = '') => `data-act="${name}"${extra ? ` ${extra}` : ''}`;
const tertiary = (label: string, data: string) => `<button type="button" class="ctl btn btn--tertiary" ${data}>${label}</button>`;
const secondary = (label: string, data: string) => `<button type="button" class="ctl btn btn--secondary st-wide" ${data}>${label}</button>`;
const destructive = (label: string, data: string) => `<button type="button" class="ctl btn btn--destructive" ${data}>${label}</button>`;

/** One part: accordion/trigger (group) and its body; the line under the title only while closed. */
function partMarkup(id: PartId, title: string, meta: string, open: boolean, body: () => string): string {
  return `
    <section class="st-part" aria-labelledby="st-${id}-title">
      <h2 class="st-part__heading">
        <button type="button" class="ctl accordion accordion--group" id="st-${id}-title" data-part="${id}" aria-expanded="${open}" aria-controls="st-${id}">
          <span class="accordion__title">${title}</span><span class="accordion__icon">${iconSvg(open ? 'remove' : 'add')}</span>${
  !open && meta ? `<span class="accordion__meta">${esc(meta)}</span>` : ''}
        </button>
      </h2>
      <div class="st-part__body" id="st-${id}"${open ? '' : ' hidden'}>${open ? body() : ''}</div>
    </section>`;
}

/* ---- the parts ---- */

function goalBody({ goal, ...settings }: Settings): string {
  const on = ACTIVITY_KINDS.filter((kind) => settings[kind].enabled);
  const label = 'днів на тиждень';
  const step = (delta: number, name: string, icon: 'add' | 'remove', off: boolean) =>
    `<button type="button" class="ctl icon-btn icon-btn--secondary" ${act('goal-days', `data-delta="${delta}"`)} aria-label="${name}: ${label}"${off ? ' disabled' : ''}>${iconSvg(icon)}</button>`;
  const details = `
      <div class="st-indent">
        <p class="t-2nd-bold">що треба виконати, щоб день був «зроблено»</p>
        ${on.map((kind) => checkbox(KIND_NAMES[kind], goal.done.includes(kind), `${act('goal-kind')} data-kind="${kind}"`)).join('')}
        <div class="st-days">
          <div class="st-days__head"><span class="t-1st-semibold">${label}</span><span class="st-days__value t-3rd-semibold" aria-live="polite">${goal.days}/7</span></div>
          <div class="slider-row">${step(-1, 'менше', 'remove', goal.days <= 0)}
            <input type="range" class="slider" min="0" max="7" step="1" value="${goal.days}" aria-label="${label}" aria-valuetext="${goal.days} з 7" data-input="goal-days" />${
  step(1, 'більше', 'add', goal.days >= 7)}
          </div>
        </div>
      </div>`;
  return `${checkbox('рахувати тижневу ціль', goal.enabled, act('goal-on'))}${goal.enabled ? details : ''}`;
}

function phraseBody(settings: Settings): string {
  const rows = settings.encouragement.map((phrase, i) => `
      <div class="st-row">
        <button type="button" class="ctl st-text t-1st-regular" ${act('phrase', `data-index="${i}"`)}>${esc(phrase)}</button>
        <button type="button" class="ctl icon-btn icon-btn--secondary icon-btn--small" ${act('phrase-rm', `data-index="${i}"`)} aria-label="видалити: ${esc(phrase)}">${iconSvg('close')}</button>
      </div>`);
  return `${rows.join('')}<div class="st-end">${tertiary('додати фразу', act('phrase-add'))}</div>`;
}

function accentBody(settings: Settings): string {
  const swatch = (accent: Accent) => `<button type="button" class="ctl swatch" data-swatch="${accent}" ${act('accent', `data-accent="${accent}"`)}
      aria-pressed="${settings.accent === accent}" aria-label="${ACCENT_NAMES[accent]}"><span class="swatch__dot"></span></button>`;
  return `<p class="t-3rd-regular muted">гортай, щоб побачити всі</p>
      <div class="swatches" role="group" aria-label="акцентний колір">${ACCENTS.map(swatch).join('')}</div>`;
}

function accessBody(settings: Settings, reduced: boolean): string {
  const row = (key: AccessibilityKey) => {
    const locked = reduced && MOTION_KEYS.includes(key);
    return checkbox(ACCESS_LABELS[key], locked || settings.accessibility[key], `${act('access')} data-key="${key}"`, locked);
  };
  const note = reduced ? '<p class="t-3rd-regular muted">на телефоні ввімкнено «зменшити рух», тож анімації вимкнені.</p>' : '';
  return `${ACCESSIBILITY_KEYS.map(row).join('')}${note}`;
}

function timerBody(tracker: Tracker & { kind: 'number' }): string {
  const id = esc(tracker.id);
  const length = (seconds: PulseSeconds) => `<button type="button" class="ctl tab" ${act('timer-length', `data-tracker="${id}" data-seconds="${seconds}"`)}
        aria-pressed="${tracker.timer === seconds}">${seconds} с</button>`;
  const lengths = tracker.timer === null ? '' : `<div class="segmented st-lengths" role="group" aria-label="скільки триває таймер">${PULSE_SECONDS.map(length).join('')}</div>`;
  return `
      <div class="st-timer">
        <h3 class="t-h6">${esc(tracker.name || 'без назви')}</h3>
        ${checkbox('таймер для пульсу', tracker.timer !== null, `${act('timer')} data-tracker="${id}"`)}
        <p class="t-3rd-regular muted">на головній зʼявиться таймер: рахуєш удари, поки він іде, потім вписуєш число — застосунок перерахує в уд/хв.</p>
        ${lengths}
      </div>`;
}

const oneNumber = (settings: Settings) => settings.trackers.filter((t): t is Tracker & { kind: 'number' } => t.kind === 'number');

function wellbeingBody(settings: Settings): string {
  const timers = oneNumber(settings);
  return timers.length ? timers.map(timerBody).join('')
    : '<p class="t-3rd-regular muted">таймер для пульсу ставиться на питання з одним числом. їх поки немає.</p>';
}

function aiBody(state: SettingsState): string {
  return `
      <p class="t-2nd-regular muted">попроси свій ШІ змінити налаштування: скопіюй поточні, встав йому разом з промптом, а його відповідь — сюди. записи лишаться як були.</p>
      ${secondary('скопіювати промпт', act('copy-prompt'))}
      ${secondary('скопіювати мої налаштування для ШІ', act('copy-settings'))}
      <div class="paste">
        <textarea class="field paste__field" rows="3" aria-label="відповідь ШІ" placeholder="встав сюди відповідь ШІ" data-input="paste">${esc(state.pasted)}</textarea>
        <button type="button" class="ctl btn btn--primary btn--wide" ${act('apply')}${state.pasted.trim() ? '' : ' disabled'}>застосувати</button>
      </div>
      <div>${tertiary('відновити з копії', 'data-restore')}</div>
      <input type="file" accept=".json,application/json,text/plain" hidden data-restore-file />`;
}

function backupBody(state: SettingsState): string {
  const tab = (name: ExportTab, label: string) =>
    `<button type="button" class="ctl tab" ${act('export-tab', `data-tab="${name}"`)} aria-pressed="${state.exportTab === name}">${label}</button>`;
  const warning = state.exportTab === 'records'
    ? '<p class="t-3rd-bold st-warning">записи — це дані про твоє здоров’я. копіюючи їх для ШІ, ти передаєш їх у чат стороннього сервісу.</p>' : '';
  return `
      <div class="st-backup">
        <p class="t-3rd-regular muted" data-backup-line>${esc(state.backupLine)}</p>
        <div>${tertiary('зберегти копію', act('backup'))}</div>
      </div>
      <p class="t-3rd-regular muted">копія — один файл з усіма записами й налаштуваннями. з нього все відновиться на новому телефоні.</p>
      <h3 class="t-2nd-bold">експорт</h3>
      <div class="segmented" role="group" aria-label="що експортувати">${tab('records', 'записи')}${tab('exercises', 'вправи')}</div>
      ${warning}
      ${secondary('скопіювати для ШІ', act('export-ai'))}
      ${secondary('зберегти JSON', act('export-json'))}
      ${secondary('зберегти PDF', act('export-pdf'))}`;
}

function deleteBody(): string {
  return `
      <div class="st-backup">
        <p class="t-2nd-bold">спершу збережи копію: видалене не повернути.</p>
        <div>${tertiary('зберегти копію', act('backup'))}</div>
      </div>
      <div>${destructive('видалити тільки записи', act('delete-records'))}</div>
      <div>${destructive('стерти все разом з налаштуваннями', act('delete-all'))}</div>
      <p class="t-3rd-regular muted">після натискання зʼявиться вікно з підтвердженням. утримувати нічого не треба.</p>`;
}

/* ---- the lines of closed parts ---- */

function accessMeta(settings: Settings, reduced: boolean): string {
  const on = ACCESSIBILITY_KEYS.filter((key) => settings.accessibility[key] || (reduced && MOTION_KEYS.includes(key)));
  return on.length ? on.map((key) => ACCESS_SHORT[key]).join(', ') : 'стандартно';
}

function metas(state: SettingsState): Record<PartId, string> {
  const { settings } = state;
  const { goal, encouragement } = settings;
  const fields = settings.trackers.length;
  return {
    goal: goal.enabled ? `${goal.days} ${plural(goal.days, DAYS)} на тиждень` : 'вимкнено',
    phrase: `${encouragement.length} ${plural(encouragement.length, PHRASES)}`,
    accent: ACCENT_NAMES[settings.accent],
    access: accessMeta(settings, state.motionReduced),
    wellbeing: `${fields} ${plural(fields, FIELDS)}`,
    ai: '',
    backup: state.backupLine,
    delete: '',
  };
}

function markup(state: SettingsState): string {
  const { settings } = state;
  const meta = metas(state);
  const parts: [PartId, string, () => string][] = [
    ['goal', 'тижнева ціль', () => goalBody(settings)],
    ['phrase', 'підбадьорлива фраза', () => phraseBody(settings)],
    ['accent', 'акцентний колір', () => accentBody(settings)],
    ['access', 'доступність', () => accessBody(settings, state.motionReduced)],
    ['wellbeing', 'самопочуття', () => wellbeingBody(settings)],
    ['ai', 'налаштування через ШІ', () => aiBody(state)],
    ['backup', 'копія й експорт', () => backupBody(state)],
    ['delete', 'видалення', deleteBody],
  ];
  return `
    <div class="settings">
      <h1 class="visually-hidden">налаштування</h1>
      <p class="settings__intro t-2nd-regular">тапни на будь-який текст, щоб змінити його. коли закінчиш — збережи внизу.</p>
      <div class="settings__parts">${parts.map(([id, title, body]) => partMarkup(id, title, meta[id], state.open.has(id), body)).join('')}</div>
      ${FOOTER}
    </div>
    <nav class="bar bar--edit" aria-label="навігація">
      <button type="button" class="ctl icon-btn icon-btn--secondary bar__menu" ${act('save')} aria-label="зберегти налаштування">${iconSvg('save')}</button>
      <button type="button" class="ctl icon-btn icon-btn--secondary bar__menu" ${act('close')} aria-label="закрити налаштування">${iconSvg('close')}</button>
    </nav>`;
}

/* ---- taps ---- */

type Read = (element: HTMLElement, checked: boolean) => SettingsAct;

const d = (element: HTMLElement, name: string) => String(element.dataset[name]);

/** Turns a tapped element into what it asks for. */
const READ: Record<string, Read> = {
  'goal-on': (_, on) => ({ act: 'goal-on', on }),
  'goal-kind': (el, on) => ({ act: 'goal-kind', on, kind: d(el, 'kind') as ActivityKind }),
  'goal-days': (el) => ({ act: 'goal-days', delta: Number(d(el, 'delta')) }),
  phrase: (el) => ({ act: 'phrase', index: Number(d(el, 'index')) }),
  'phrase-rm': (el) => ({ act: 'phrase-rm', index: Number(d(el, 'index')) }),
  accent: (el) => ({ act: 'accent', accent: d(el, 'accent') as Accent }),
  access: (el, on) => ({ act: 'access', key: d(el, 'key') as AccessibilityKey, on }),
  timer: (el, on) => ({ act: 'timer', tracker: d(el, 'tracker'), on }),
  'timer-length': (el) => ({ act: 'timer-length', tracker: d(el, 'tracker'), seconds: Number(d(el, 'seconds')) as PulseSeconds }),
  'export-tab': (el) => ({ act: 'export-tab', tab: d(el, 'tab') as ExportTab }),
};

/** A tap on a part's title or on a button with `data-act`. */
function tapped(target: Element): SettingsAct | null {
  const trigger = target.closest<HTMLElement>('[data-part]');
  if (trigger) return { act: 'part', part: trigger.dataset.part as PartId };
  const button = target.closest<HTMLElement>('button[data-act]');
  if (!button) return null;
  const name = d(button, 'act');
  return READ[name]?.(button, false) ?? { act: name } as SettingsAct;
}

/** Typing: the days slider moved by itself, or text in the paste field. */
function typed(host: HTMLElement, input: HTMLInputElement, actions: SettingsActions): void {
  if (input.dataset.input === 'goal-days') return actions.act({ act: 'goal-days', delta: Number(input.value) - Number(input.defaultValue) });
  // checkboxes say «input» too: only the paste field is text
  if (input.dataset.input !== 'paste') return;
  actions.paste(input.value);
  part<HTMLButtonElement>(host, '[data-act="apply"]').disabled = input.value.trim() === '';
}

function wire(host: HTMLElement, actions: SettingsActions, state: SettingsState): void {
  host.addEventListener('click', (event) => {
    const action = tapped(event.target as Element);
    if (action) actions.act(action);
  });
  // only checkboxes say «change» here: the paste field and the slider are heard on «input»
  host.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.type === 'checkbox') actions.act(READ[d(input, 'act')]!(input, input.checked));
  });
  host.addEventListener('input', (event) => typed(host, event.target as HTMLInputElement, actions));
  // «відновити з копії» is there while its part is open
  if (state.open.has('ai')) wireRestore(host, actions.restore);
}

/**
 * Draws the page (again, after every change: the scroll and the focused
 * control stay).
 */
export function showSettings(host: HTMLElement, state: SettingsState, actions: SettingsActions): void {
  const focused = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? focusKey(document.activeElement) : null;
  const y = scrollY;
  host.innerHTML = `<div class="settings-screen">${markup(state)}</div>`;
  // listeners live on the new root, so a redraw drops the old ones with the old markup
  wire(part(host, '.settings-screen'), actions, state);
  if (focused) host.querySelector<HTMLElement>(focused)?.focus({ preventScroll: true });
  scrollTo(0, y);
}

const FOCUS_KEYS = ['part', 'act', 'index', 'kind', 'key', 'accent', 'tracker', 'seconds', 'tab', 'input'];

/** A selector that finds the same control after a redraw. */
function focusKey(element: HTMLElement): string | null {
  const attrs = FOCUS_KEYS.filter((key) => element.dataset[key] !== undefined)
    .map((key) => `[data-${key}="${element.dataset[key]!.replace(/["\\]/g, '\\$&')}"]`);
  return attrs.length ? attrs.join('') : null;
}
