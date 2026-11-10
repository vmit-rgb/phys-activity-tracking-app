import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayKey } from '../domain/dates';
import { parseDiary, type Diary, type JsonObject } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, DIARY_KEY, diaryStore, sectionMemory } from '../storage/store';
import { mountToast } from '../ui/toast';
import { startApp } from './app';
import { fakeDevice } from './test-env';

// Invented data only: the «почати без ШІ» example.
const TODAY = '2026-11-09' as DayKey;

let host: HTMLElement;

function start(diary: Diary): void {
  diaryStore(localStorage, () => new Date()).save(diary);
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  const fake = fakeDevice();
  startApp({
    host,
    store: diaryStore(localStorage, () => new Date('2026-11-09T08:00:00Z')),
    browser: browserChoice(localStorage),
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    onDiary: () => {},
    today: () => TODAY,
    sections: sectionMemory(localStorage),
    whenHidden: () => {},
    ...fake.env,
  });
}

const storedProfile = (): JsonObject => parseDiary(localStorage.getItem(DIARY_KEY) ?? '')!.profile;
const at = (path: string, profile = storedProfile()): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value as JsonObject | undefined)?.[key], profile);
const toastText = () => document.querySelector<HTMLElement>('.toast:not([hidden]) .toast__message')?.textContent;
const named = (b: HTMLElement) => (b.getAttribute('aria-label') ?? (b.querySelector('.accordion__title') ?? b).textContent!.trim());
const buttons = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].filter((b) => named(b) === name);
const button = (name: string) => buttons(name)[0]!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tap = async (name: string, nth = 0) => {
  const found = buttons(name)[nth];
  if (!found) throw new Error(`no button «${name}»`);
  found.click();
  await settle();
};
const labels = (label: string) => [...host.querySelectorAll<HTMLLabelElement>('label.checkbox')].filter((l) => l.textContent!.trim() === label);
const tick = async (label: string, nth = 0) => {
  labels(label)[nth]!.querySelector('input')!.click();
  await settle();
};
const checked = (label: string, nth = 0) => labels(label)[nth]!.querySelector('input')!.checked;
/** Types into the full-screen field and taps «готово» (or «скасувати»). */
const type = async (text: string, done = true) => {
  const field = document.querySelector<HTMLTextAreaElement>('.text-edit__input')!;
  field.value = text;
  await tap(done ? 'готово' : 'скасувати');
};
/** A choice in the open menu (names repeat elsewhere on the page). */
const choose = async (label: string) => {
  [...host.querySelectorAll<HTMLButtonElement>('.st-menu button')].find((b) => b.textContent === label)!.click();
  await settle();
};
const save = () => tap('зберегти налаштування');
const meta = (title: string) => button(title).querySelector('.accordion__meta')?.textContent;

async function openSettings(diary: Diary = EXAMPLE_DIARY): Promise<void> {
  start(diary);
  await tap('меню');
  await tap('налаштування');
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('sections in the settings: closed', () => {
  it('say what they hold', async () => {
    await openSettings();
    expect(meta('ранкова розминка')).toBe('2 рівні');
    expect(meta('денна розминка')).toBe('1 зона');
    expect(meta('тренування')).toBe('1 тренування');
    expect(meta('рух')).toBe('рух 1');
    expect(meta('самопочуття')).toBe('4 поля');
  });

  it('say «вимкнено» when off, and name unnamed movement by count', async () => {
    const profile = { ...EXAMPLE_DIARY.profile, workout: { enabled: false }, movement: { enabled: true, kinds: [{ id: 'm', name: '' }] } };
    await openSettings({ profile, days: {} });
    expect(meta('тренування')).toBe('вимкнено');
    expect(meta('рух')).toBe('1 вид руху');
  });
});

describe('ранкова розминка', () => {
  beforeEach(async () => {
    await openSettings();
    await tap('ранкова розминка');
  });

  it('shows the levels closed with their count, a level opens', async () => {
    expect(host.textContent).toContain('2 вправи');
    expect(host.textContent).toContain('3 вправи');
    await tap('розгорнути: рівень 1');
    expect(button('згорнути: рівень 1')).toBeTruthy();
    expect(host.textContent).toContain('тут буде коротко, як її робити.');
    expect(checked('n с', 0)).toBe(false);
    expect(checked('n с', 1)).toBe(true);
    expect(host.textContent).toContain('30 с');
    await tap('згорнути: рівень 1');
    expect(button('розгорнути: рівень 1')).toBeTruthy();
  });

  it('renames a level and its exercise, kept on 💾', async () => {
    await tap('рівень 1');
    await type('легкий день');
    await tap('розгорнути: легкий день');
    await tap('вправа 1');
    await type('присідання');
    await save();
    expect(at('morningWarmup.levels.0.name')).toBe('легкий день');
    expect((storedProfile().exercises as JsonObject[])[0]!.name).toBe('присідання');
    expect(host.textContent).toContain('присідання');
  });

  it('changes the count, the time and «як робити»', async () => {
    await tap('розгорнути: рівень 1');
    await tap('10');
    await type('8–10');
    await tap('30 с');
    await type('45 с');
    await tap('тут буде коротко, як її робити.', 1);
    await type('спина рівна');
    await save();
    expect(at('morningWarmup.levels.0.items.0.reps')).toBe('8–10');
    expect(at('morningWarmup.levels.0.items.1.seconds')).toBe(45);
    expect((storedProfile().exercises as JsonObject[])[1]!.how).toBe('спина рівна');
  });

  it('says so when a time is not a number, and keeps an emptied time', async () => {
    await tap('розгорнути: рівень 1');
    await tap('30 с');
    await type('довго');
    expect(toastText()).toBe('тут потрібне число >_<');
    await tap('30 с');
    await type('');
    expect(host.textContent).toContain('30 с');
  });

  it('makes an exercise timed and back', async () => {
    await tap('розгорнути: рівень 1');
    await tick('n с', 0);
    expect(host.textContent).toContain('10 с');
    await tick('n с', 1);
    await save();
    expect(at('morningWarmup.levels.0.items.0')).toEqual({ exercise: 'exercise-1', reps: '', seconds: 10 });
    expect(at('morningWarmup.levels.0.items.1')).toEqual({ exercise: 'exercise-2', reps: '30' });
  });

  it('adds a link to an exercise', async () => {
    await tap('розгорнути: рівень 1');
    await tap('посилання');
    await type('example.com/vprava');
    expect(host.textContent).toContain('example.com/vprava');
    await save();
    expect((storedProfile().exercises as JsonObject[])[0]!.source).toEqual({ type: 'link', url: 'https://example.com/vprava', by: 'user' });
  });

  it('adds an exercise and a level after their names; nothing typed adds nothing', async () => {
    await tap('розгорнути: рівень 1');
    await tap('додати вправу');
    await type('нова вправа');
    await tap('додати рівень');
    await type('', true);
    await tap('додати рівень');
    await type('рівень 3');
    expect(button('згорнути: рівень 3')).toBeTruthy();
    await save();
    expect(at('morningWarmup.levels.0.items.2')).toEqual({ exercise: 'exercise-9', reps: '' });
    expect((storedProfile().exercises as JsonObject[]).at(-1)).toMatchObject({ id: 'exercise-9', name: 'нова вправа' });
    expect((at('morningWarmup.levels') as JsonObject[]).map((l) => l.name)).toEqual(['рівень 1', 'рівень 2', 'рівень 3']);
    expect((at('morningWarmup.levels') as JsonObject[])[2]).toEqual({ id: 'level-3', name: 'рівень 3', duration: '', items: [] });
  });

  it('removes a level after asking, with «скасувати» after', async () => {
    await tap('видалити: рівень 2');
    expect(document.querySelector('.dialog')!.textContent).toContain('видалити «рівень 2»?');
    await tap('скасувати');
    expect(host.textContent).toContain('3 вправи');
    await tap('видалити: рівень 2');
    await tap('видалити');
    expect(toastText()).toBe('видалено');
    expect(host.textContent).not.toContain('3 вправи');
    await tap('скасувати');
    expect(host.textContent).toContain('3 вправи');
  });

  it('turns the section off and on, and changes its days', async () => {
    await tap('більше: ціль, ранкова розминка: днів на тиждень');
    expect(host.querySelector('.st-days__value')!.textContent).toBe('6/7');
    const range = host.querySelector<HTMLInputElement>('input[data-input="target"]')!;
    range.value = '2';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await tick('показувати на головній');
    expect(host.textContent).not.toContain('рівень 1');
    await save();
    expect(storedProfile().morningWarmup).toMatchObject({ enabled: false, weeklyTarget: 2 });
    expect(meta('ранкова розминка')).toBeUndefined();
    await tap('ранкова розминка');
    expect(meta('ранкова розминка')).toBe('вимкнено');
  });
});

describe('денна розминка and рух', () => {
  beforeEach(() => openSettings());

  it('edits the hint, a zone and adds one', async () => {
    await tap('денна розминка');
    await tap('коли довго сидиш');
    await type('');
    expect(button('підказка')).toBeTruthy();
    await tap('розгорнути: для спини');
    expect(checked('n с', 1)).toBe(true);
    await tap('додати зону');
    await type('для шиї');
    await save();
    expect(at('daytimeWarmup.hint')).toBe('');
    expect((at('daytimeWarmup.groups') as JsonObject[])[1]).toEqual({ id: 'zone-1', name: 'для шиї', items: [] });
  });

  it('changes movement fields, keeping at least one, and its link', async () => {
    await tap('рух');
    expect(checked('n км')).toBe(true);
    expect(checked('n кроків')).toBe(false);
    await tick('n км');
    await tick('n хв');
    expect(toastText()).toBe('хоч одне поле має лишитися >_<');
    expect(checked('n хв')).toBe(true);
    await tick('n кроків');
    await tap('посилання');
    await type('https://example.com/walk');
    await tap('додати рух');
    await type('плавання');
    await save();
    expect(at('movement.kinds.0.fields')).toEqual(['minutes', 'steps']);
    expect(at('movement.kinds.0.source')).toEqual({ type: 'link', url: 'https://example.com/walk', by: 'user' });
    expect((at('movement.kinds') as JsonObject[])[1]).toEqual({ id: 'movement-2', name: 'плавання', fields: ['minutes'], source: { type: 'user' } });
    await tap('рух');
    expect(meta('рух')).toBe('рух 1, плавання');
  });

  it('marks links from the AI', async () => {
    const profile = { ...EXAMPLE_DIARY.profile, movement: { enabled: true, kinds: [{ id: 'm', name: 'біг', source: { type: 'link', url: 'https://example.com/a-very-long-address-for-running-shoes', by: 'ai' } }] } };
    await openSettings({ profile, days: {} });
    await tap('рух');
    expect(host.textContent).toContain('example.com/a-very-long-address-fo…');
    expect(host.textContent).toContain('* від ШІ');
  });
});

describe('самопочуття', () => {
  beforeEach(async () => {
    await openSettings();
    await tap('самопочуття');
  });

  it('groups questions by kind, each kind opens', async () => {
    const kinds = [...host.querySelectorAll('.st-box h3')].map((h) => h.textContent);
    expect(kinds).toEqual(['повзунки', 'питання так / ні', 'два числа', 'одне число', 'нотатки']);
    expect(host.textContent).toContain('2 поля');
    await tap('розгорнути: повзунки');
    expect(host.textContent).toContain('0 — немає сил, 10 — повно сил');
    expect(host.textContent).toContain('від 0');
    expect(checked('питати зранку')).toBe(true);
    expect(checked('питати після тренування')).toBe(true);
    expect(labels('питати ввечері')).toHaveLength(2);
  });

  it('changes a name, a hint, the scale ends and when to ask', async () => {
    await tap('розгорнути: повзунки');
    await tap('енергія');
    await type('сили');
    await tap('до 10', 0);
    await type('5');
    await tick('питати ввечері', 0);
    await tick('питати зранку', 0);
    await save();
    expect((storedProfile().trackers as JsonObject[])[0]).toMatchObject({ name: 'сили', max: 5, ask: ['afterWorkout', 'evening'] });
  });

  it('hides moments of a section that is off', async () => {
    await tap('тренування');
    await tick('показувати на головній');
    await tap('розгорнути: повзунки');
    expect(labels('питати після тренування')).toHaveLength(0);
    expect(labels('питати до руху')).toHaveLength(2);
  });

  it('adds a question of a kind, with its units', async () => {
    await tap('розгорнути: два числа');
    expect(host.textContent).toContain('наприклад, тиск');
    await tap('додати поле');
    await type('тиск');
    await tap('одиниці першого числа');
    await type('мм рт. ст.');
    await save();
    expect((storedProfile().trackers as JsonObject[]).at(-1)).toEqual({
      id: 'tracker-1', name: 'тиск', hint: '', kind: 'numbers', ask: ['morning'], units: ['мм рт. ст.', ''],
    });
  });

  it('adds notes and yes/no questions; one number keeps its unit and timer', async () => {
    await tap('розгорнути: нотатки');
    await tap('додати нотатку');
    await type('що їла');
    await tap('розгорнути: одне число');
    await tap('уд/хв');
    await type('уд/хв ');
    expect(host.textContent).toContain('таймер для пульсу');
    await tap('розгорнути: питання так / ні');
    await tap('додати питання');
    await type('було запаморочення?');
    const kinds = (storedProfile().trackers as JsonObject[]).map((t) => t.kind);
    expect(kinds).toEqual(['scale', 'number', 'yesno', 'scale']);
    await save();
    expect((storedProfile().trackers as JsonObject[]).slice(-2).map((t) => t.kind)).toEqual(['note', 'yesno']);
  });

  it('moves a question up among its own kind through its menu', async () => {
    await tap('розгорнути: повзунки');
    await tap('дії: втома');
    expect([...host.querySelectorAll('.st-menu button')].map((b) => b.textContent)).toEqual(['вище', 'скасувати']);
    await tap('вище');
    expect(toastText()).toBe('переміщено');
    await save();
    expect((storedProfile().trackers as JsonObject[]).map((t) => t.id)).toEqual(['tired', 'energy', 'pulse', 'hard']);
  });
});

describe('тренування', () => {
  const S = 'workout.sessions.0.items';
  beforeEach(async () => {
    await openSettings();
    await tap('тренування');
    await tap('розгорнути: тренування А');
  });

  it('shows sets × reps and the fields', async () => {
    expect(host.textContent).toContain('3 × 10');
    expect(host.textContent).toContain('5 кг');
    expect(checked('n кг', 0)).toBe(true);
    expect(checked('n с', 2)).toBe(true);
    expect(host.textContent).toContain('30 с');
  });

  it('changes sets × reps, the weight and the fields', async () => {
    await tap('3 × 10');
    await type('4 × 8–10');
    await tap('5 кг');
    await type('7,5');
    await tick('n кг', 1);
    await tap('стартова вага');
    await type('');
    await tap('30 с');
    await type('');
    await save();
    expect(at(`${S}.0`)).toMatchObject({ sets: 4, reps: '8–10', weight: 7.5 });
    expect(at(`${S}.1`)).toEqual({ exercise: 'exercise-7', reps: '12', sets: 2, fields: ['weight', 'reps'] });
    expect(at(`${S}.2`)).toEqual({ exercise: 'exercise-8', fields: ['seconds'] });
  });

  it('adds a workout and an exercise', async () => {
    await tap('додати тренування');
    await type('б');
    expect(button('згорнути: тренування Б')).toBeTruthy();
    await tap('додати вправу', 1);
    await type('тяга');
    await save();
    expect((at('workout.sessions') as JsonObject[])[1]).toMatchObject({ id: 'session-1', name: 'б', how: '' });
    expect(at('workout.sessions.1.items.0')).toEqual({ exercise: 'exercise-9', reps: '', sets: 3, fields: ['weight', 'reps'] });
  });

  it('makes a group through «створити групу»', async () => {
    await tap('створити групу');
    expect(host.textContent).toContain('вибери 2–3 вправи для групи');
    expect(button('зібрати групу').disabled).toBe(true);
    await tap('вправа 6');
    await tap('вправа 8');
    expect(button('вправа 8').getAttribute('aria-pressed')).toBe('true');
    await tap('вправа 6');
    await tap('вправа 7');
    expect(button('зібрати групу').disabled).toBe(false);
    await tap('зібрати групу');
    expect(toastText()).toBe('групу зібрано :)');
    expect(host.textContent).toContain('група вправ');
    await save();
    expect((at(S) as JsonObject[]).map((x) => (x.set ? (x.set as JsonObject[]).map((y) => y.exercise) : x.exercise)))
      .toEqual(['exercise-6', ['exercise-7', 'exercise-8']]);
  });

  it('leaves «створити групу» without changes', async () => {
    await tap('створити групу');
    await tap('вправа 6');
    await tap('скасувати групу');
    expect(host.textContent).not.toContain('вибери 2–3 вправи');
    expect(button('створити групу')).toBeTruthy();
  });

  it('groups, takes out and moves through the menu', async () => {
    await tap('дії: вправа 8');
    expect([...host.querySelectorAll('.st-menu button')].map((b) => b.textContent))
      .toEqual(['об’єднати в групу з…', 'вище', 'скасувати']);
    await tap('об’єднати в групу з…');
    await choose('вправа 6');
    expect(toastText()).toBe('групу зібрано :)');
    await tap('дії: вправа 8');
    await tap('вийти з групи');
    expect(toastText()).toBe('вправу винесено з групи');
    await tap('дії: вправа 6');
    await tap('нижче');
    await save();
    expect((at(S) as JsonObject[]).map((x) => x.exercise)).toEqual(['exercise-8', 'exercise-6', 'exercise-7']);
  });

  it('moves an exercise to another workout; Escape closes the menu', async () => {
    await tap('додати тренування');
    await type('б');
    await tap('дії: вправа 7');
    host.querySelector('.st-menu')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(host.querySelector('.st-menu')).toBeNull();
    await tap('дії: вправа 7');
    await tap('перемістити в…');
    await choose('тренування Б');
    expect(toastText()).toBe('переміщено');
    await save();
    expect(at('workout.sessions.1.items.0.exercise')).toBe('exercise-7');
  });

  it('refuses a fourth exercise in a group', async () => {
    await tap('створити групу');
    for (const name of ['вправа 6', 'вправа 7', 'вправа 8']) await tap(name);
    await tap('зібрати групу');
    await tap('додати вправу');
    await type('четверта');
    await tap('дії: четверта');
    await tap('об’єднати в групу з…');
    await choose('група: вправа 6 + вправа 7 + вправа 8');
    expect(toastText()).toBe('у групі вже 3 вправи — більше не влізе >_<');
    expect(buttons('скасувати').filter((b) => b.closest('.toast'))).toHaveLength(0);
  });

  it('removes an exercise from a group, which then dissolves', async () => {
    await tap('дії: вправа 8');
    await tap('об’єднати в групу з…');
    await choose('вправа 7');
    await tap('видалити: вправа 8');
    expect(document.querySelector('.dialog')!.textContent).toContain('видалити «вправа 8»?');
    await tap('видалити');
    expect(host.querySelector('.st-group')).toBeNull();
  });
});

describe('dragging on the page', () => {
  const at0 = (el: Element, top: number, height = 100) =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, height, bottom: top + height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) });
  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));

  it('drags an exercise onto another to make a group, and lets go without moving to open the menu', async () => {
    await openSettings();
    await tap('тренування');
    await tap('розгорнути: тренування А');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const items = () => [...host.querySelectorAll<HTMLElement>('.st-item[data-family="wo-ex"]')];
    const [first, , third] = items();
    at0(first!, 0);
    document.elementFromPoint = () => first!;
    pointer('pointerdown', third!.querySelector('.st-text')!, 10, 300);
    vi.advanceTimersByTime(500);
    expect(third!.classList.contains('st-lift')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(18);
    pointer('pointermove', document, 10, 50);
    expect(first!.classList.contains('st-target')).toBe(true);
    expect(document.querySelector('.st-proxy')!.textContent).toBe('вправа 8');
    pointer('pointerup', document, 10, 50);
    vi.useRealTimers();
    expect(toastText()).toBe('групу зібрано :)');
    expect(document.querySelector('.st-proxy')).toBeNull();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const group = host.querySelector<HTMLElement>('.st-group')!;
    pointer('pointerdown', group.querySelector('p')!, 10, 10);
    vi.advanceTimersByTime(500);
    pointer('pointerup', document, 10, 10);
    vi.useRealTimers();
    await settle();
    expect([...host.querySelectorAll('.st-menu button')].map((b) => b.textContent)).toEqual(['нижче', 'скасувати']);
  });
});

describe('less common paths', () => {
  const S = 'workout.sessions.0.items';
  const withWorkout = (items: unknown[]): Diary =>
    ({ profile: { ...EXAMPLE_DIARY.profile, workout: { enabled: true, sessions: [{ id: 's', name: '', items }] } }, days: {} });

  it('changes nothing when the field is cancelled', async () => {
    await openSettings();
    await tap('рух');
    await tap('рух 1');
    await type('біг', false);
    await tap('закрити налаштування');
    expect(document.querySelector('.dialog')).toBeNull();
  });

  it('names a workout without a name, and an exercise missing from the catalogue', async () => {
    await openSettings(withWorkout([{ exercise: 'ghost', reps: '5', fields: [] }]));
    await tap('тренування');
    expect(button('розгорнути: без назви')).toBeTruthy();
    await tap('розгорнути: без назви');
    expect(checked('n разів')).toBe(true);
    await tick('n кг');
    await tap('вправа');
    await type('примара');
    await save();
    expect(at(`${S}.0.fields`)).toEqual(['weight', 'reps']);
    expect((storedProfile().exercises as JsonObject[]).at(-1)).toEqual({ id: 'ghost', name: 'примара', how: '', source: { type: 'user' } });
  });

  it('reads the timed exercise of «бета 0.81»', async () => {
    const profile = { ...EXAMPLE_DIARY.profile, morningWarmup: { enabled: true, levels: [{ id: 'l', name: '', items: [{ exercise: 'exercise-1', reps: '40', timed: true }] }] } };
    await openSettings({ profile, days: {} });
    await tap('ранкова розминка');
    await tap('розгорнути: без назви');
    expect(host.textContent).toContain('40 с');
    await tick('n с');
    await save();
    expect(at('morningWarmup.levels.0.items.0')).toEqual({ exercise: 'exercise-1', reps: '40' });
  });

  it('turns on a 0.81 timed exercise that was unticked', async () => {
    const profile = { ...EXAMPLE_DIARY.profile, morningWarmup: { enabled: true, levels: [{ id: 'l', name: '', items: [{ exercise: 'exercise-1', reps: 'x', timed: true }] }] } };
    await openSettings({ profile, days: {} });
    await tap('ранкова розминка');
    await tap('розгорнути: без назви');
    await tick('n с');
    await save();
    expect(at('morningWarmup.levels.0.items.0')).toEqual({ exercise: 'exercise-1', reps: '', seconds: 30 });
  });

  it('edits «n разів» without sets', async () => {
    await openSettings(withWorkout([{ exercise: 'exercise-6', reps: '12' }]));
    await tap('тренування');
    await tap('розгорнути: без назви');
    await tap('12');
    expect((document.querySelector('.text-edit__input') as HTMLTextAreaElement).value).toBe('12');
    await type('2 × 12');
    expect(host.textContent).toContain('2 × 12');
  });

  it('has no menu for an entry with nowhere to go', async () => {
    await openSettings();
    await tap('рух');
    await tap('дії: рух 1');
    expect(host.querySelector('.st-menu')).toBeNull();
  });

  it('moves a warm-up exercise to another zone through the menu', async () => {
    const daytime = EXAMPLE_DIARY.profile.daytimeWarmup as JsonObject;
    const profile = { ...EXAMPLE_DIARY.profile, daytimeWarmup: { ...daytime, groups: [
      { id: 'a', name: 'для спини', items: [{ exercise: 'exercise-4' }] }, { id: 'b', name: '', items: [] },
    ] } };
    await openSettings({ profile, days: {} });
    await tap('денна розминка');
    await tap('розгорнути: для спини');
    await tap('дії: вправа 4');
    await tap('перемістити в…');
    await choose('без назви');
    await save();
    expect(at('daytimeWarmup.groups.1.items')).toEqual([{ exercise: 'exercise-4' }]);
  });

  it('names unnamed levels by number when moving', async () => {
    const profile = { ...EXAMPLE_DIARY.profile, morningWarmup: { enabled: true, levels: [
      { id: 'x', name: 'перший', items: [{ exercise: 'exercise-1', reps: '1' }] }, { id: 'y', name: '', items: [] },
    ] } };
    await openSettings({ profile, days: {} });
    await tap('ранкова розминка');
    await tap('розгорнути: перший');
    await tap('дії: вправа 1');
    await tap('перемістити в…');
    expect([...host.querySelectorAll('.st-menu button')].map((b) => b.textContent)).toEqual(['рівень 2', 'скасувати']);
  });

  it('chooses and unchooses in «створити групу», with a group already there', async () => {
    await openSettings(withWorkout([{ set: [{ exercise: 'exercise-6' }, { exercise: 'exercise-7' }] }, { exercise: 'exercise-8' }]));
    await tap('тренування');
    await tap('створити групу');
    expect(host.textContent).toContain('група вправ: вправа 6 + вправа 7');
    await tap('вправа 8');
    await tap('вправа 8');
    expect(button('вправа 8').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the inside of the daytime warm-up and movement only while on', async () => {
    await openSettings();
    await tap('денна розминка');
    await tick('показувати на головній');
    expect(host.textContent).not.toContain('для спини');
    await tap('рух');
    await tick('показувати на головній', 1);
    expect(host.textContent).not.toContain('додати рух');
  });

  it('says «переміщено» or «винесено з групи» after a drag, and refuses a full group', async () => {
    await openSettings(withWorkout([
      { set: [{ exercise: 'exercise-6' }, { exercise: 'exercise-7' }] }, { exercise: 'exercise-8' },
      { set: [{ exercise: 'exercise-1' }, { exercise: 'exercise-2' }, { exercise: 'exercise-3' }] },
    ]));
    await tap('тренування');
    await tap('розгорнути: без назви');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const drag = (from: HTMLElement, under: Element, y: number) => {
      document.elementFromPoint = () => under;
      from.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0, button: 0 }));
      vi.advanceTimersByTime(500);
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: y }));
      document.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: y }));
    };
    const item = (list: string, index: number) => host.querySelector<HTMLElement>(`.st-item[data-list="${list}"][data-index="${index}"]`)!;
    const outer = () => host.querySelector(`.st-list[data-list="${S}"]`)!;
    drag(item(S, 1), outer(), 400);
    expect(toastText()).toBe('переміщено');
    drag(item(`${S}.0.set`, 0), outer(), 400);
    expect(toastText()).toBe('вправу винесено з групи');
    const full = [...host.querySelectorAll<HTMLElement>('.st-group')].find((g) => g.dataset.group === '3')!;
    vi.spyOn(full, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 100, bottom: 100, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) });
    drag(item(S, 0), full, 50);
    expect(toastText()).toBe('у групі вже 3 вправи — більше не влізе >_<');
  });
});
