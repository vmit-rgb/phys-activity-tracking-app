import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayKey } from '../domain/dates';
import { readDay } from '../domain/day';
import { parseDiary, serializeDiary, type Diary, type JsonObject } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, DIARY_KEY, diaryStore, sectionMemory } from '../storage/store';
import { mountToast } from '../ui/toast';
import { startApp } from './app';
import { fakeDevice } from './test-env';

// Invented data only.
const TODAY = '2026-11-09' as DayKey;
const WITH_A_DAY: Diary = {
  ...EXAMPLE_DIARY,
  days: { ['2026-11-08' as DayKey]: readDay({ note: 'вправа 1 легко', t: { morning: { energy: 6 } } }, '2026-11-08' as DayKey) },
};

let host: HTMLElement;
let device: ReturnType<typeof fakeDevice>['device'];

function start(diary: Diary = WITH_A_DAY, reduced = false): void {
  diaryStore(localStorage, () => new Date()).save(diary);
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  const fake = fakeDevice();
  device = fake.device;
  device.motionReduced = reduced;
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

const stored = (): Diary => parseDiary(localStorage.getItem(DIARY_KEY) ?? '')!;
const storedProfile = (): JsonObject => stored().profile;
const heading = () => host.querySelector('h1')?.textContent;
const toastText = () => document.querySelector<HTMLElement>('.toast:not([hidden]) .toast__message')?.textContent;
const named = (b: HTMLElement) => (b.getAttribute('aria-label') ?? (b.querySelector('.accordion__title') ?? b).textContent!.trim());
const button = (name: string, root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => named(b) === name)!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tap = async (name: string) => {
  button(name).click();
  await settle();
};
const checkbox = (label: string) => [...host.querySelectorAll<HTMLLabelElement>('label.checkbox')]
  .find((l) => l.textContent!.trim() === label)!.querySelector<HTMLInputElement>('input')!;
const tick = async (label: string) => {
  checkbox(label).click();
  await settle();
};
const dialog = () => document.querySelector<HTMLElement>('.dialog');
const editor = () => document.querySelector<HTMLElement>('.text-edit');
const partTitles = () => [...host.querySelectorAll('.st-part .accordion__title')].map((t) => t.textContent);
const meta = (title: string) => button(title).querySelector('.accordion__meta')?.textContent;
const openPart = (title: string) => tap(title);

async function openSettings(diary?: Diary, reduced?: boolean): Promise<void> {
  start(diary, reduced);
  await tap('меню');
  await tap('налаштування');
}

beforeEach(async () => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('settings: the page (Figma screen/edit-profile 186:3278)', () => {
  beforeEach(() => openSettings());

  it('opens from the menu, with its parts closed and 💾 ✕ in the bar', async () => {
    expect(heading()).toBe('налаштування');
    expect(partTitles()).toEqual([
      'тижнева ціль', 'підбадьорлива фраза', 'акцентний колір', 'доступність', 'самопочуття',
      'налаштування через ШІ', 'копія й експорт', 'видалення',
    ]);
    expect(button('тижнева ціль').getAttribute('aria-expanded')).toBe('false');
    expect(button('зберегти налаштування')).toBeTruthy();
    expect(button('закрити налаштування')).toBeTruthy();
    expect(host.textContent).toContain('тапни на будь-який текст, щоб змінити його. коли закінчиш — збережи внизу.');
  });

  it('says what a closed part holds', async () => {
    expect(meta('тижнева ціль')).toBe('5 днів на тиждень');
    expect(meta('підбадьорлива фраза')).toBe('1 фраза');
    expect(meta('акцентний колір')).toBe('рожевий');
    expect(meta('доступність')).toBe('стандартно');
  });

  it('opens a part with a tap and hides its line', async () => {
    await openPart('тижнева ціль');
    expect(button('тижнева ціль').getAttribute('aria-expanded')).toBe('true');
    expect(meta('тижнева ціль')).toBeUndefined();
    expect(checkbox('рахувати тижневу ціль').checked).toBe(true);
  });

  it('closes with ✕ straight home when nothing changed', async () => {
    await tap('закрити налаштування');
    expect(heading()).toBe('головна');
    expect(dialog()).toBeNull();
    expect(device.depth()).toBe(0);
  });
});

describe('settings: saving and leaving', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('тижнева ціль');
  });

  it('keeps a change only on 💾, with «скасувати» in the toast', async () => {
    await tick('рахувати тижневу ціль');
    expect((storedProfile().goal as JsonObject).enabled).toBe(true);
    await tap('зберегти налаштування');
    expect((storedProfile().goal as JsonObject).enabled).toBe(false);
    expect(toastText()).toBe('збережено :)');
    await tap('скасувати');
    expect((storedProfile().goal as JsonObject).enabled).toBe(true);
    expect(checkbox('рахувати тижневу ціль').checked).toBe(true);
  });

  it('keeps fields of the profile the screen doesn’t know', async () => {
    await tick('рахувати тижневу ціль');
    await tap('зберегти налаштування');
    expect(storedProfile().format).toBe('phys-activity-profile');
    expect(storedProfile().workout).toEqual(EXAMPLE_DIARY.profile.workout);
  });

  it('asks before ✕ throws changes away; «залишитися» stays', async () => {
    await tick('рахувати тижневу ціль');
    await tap('закрити налаштування');
    expect(dialog()!.textContent).toContain('вийти без збереження?');
    expect(dialog()!.textContent).toContain('зміни на цій сторінці пропадуть.');
    expect(document.activeElement!.textContent).toBe('залишитися');
    await tap('залишитися');
    expect(dialog()).toBeNull();
    expect(heading()).toBe('налаштування');
    expect(checkbox('рахувати тижневу ціль').checked).toBe(false);
  });

  it('leaves without saving on «вийти»', async () => {
    await tick('рахувати тижневу ціль');
    await tap('закрити налаштування');
    await tap('вийти');
    expect(heading()).toBe('головна');
    expect((storedProfile().goal as JsonObject).enabled).toBe(true);
  });

  it('asks on the phone’s back button too, and stays on «залишитися»', async () => {
    await tick('рахувати тижневу ціль');
    device.pressBack();
    await settle();
    expect(dialog()!.textContent).toContain('вийти без збереження?');
    await tap('залишитися');
    expect(heading()).toBe('налаштування');
    device.pressBack();
    await settle();
    await tap('вийти');
    expect(heading()).toBe('меню');
  });

  it('closes with Escape the same as «залишитися»', async () => {
    await tick('рахувати тижневу ціль');
    await tap('закрити налаштування');
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialog()).toBeNull();
    expect(heading()).toBe('налаштування');
  });
});

describe('settings: the weekly goal', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('тижнева ціль');
  });

  it('lists the kinds that are on and changes what makes a day «зроблено»', async () => {
    expect(host.textContent).toContain('що треба виконати, щоб день був «зроблено»');
    expect(checkbox('ранкова розминка').checked).toBe(true);
    await tick('денна розминка');
    await tap('зберегти налаштування');
    expect((storedProfile().goal as JsonObject).done).toEqual(['morningWarmup', 'daytimeWarmup']);
  });

  it('changes the days with − and + within 0–7', async () => {
    await tap('більше: днів на тиждень');
    await tap('більше: днів на тиждень');
    await tap('більше: днів на тиждень');
    expect(host.querySelector('.st-days__value')!.textContent).toBe('7/7');
    await tap('зберегти налаштування');
    expect((storedProfile().goal as JsonObject).days).toBe(7);
  });

  it('hides what to count when the goal is off', async () => {
    await tick('рахувати тижневу ціль');
    expect(host.textContent).not.toContain('що треба виконати');
  });
});

describe('settings: the phrase', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('підбадьорлива фраза');
  });

  const typeIn = (text: string) => {
    editor()!.querySelector<HTMLTextAreaElement>('textarea')!.value = text;
  };

  it('changes a phrase in the full-screen field', async () => {
    await tap('ти можеш налаштувати все в налаштуваннях :)');
    expect(editor()!.textContent).toContain('підбадьорлива фраза');
    expect(editor()!.querySelector('textarea')!.value).toBe('ти можеш налаштувати все в налаштуваннях :)');
    typeIn('маленький крок теж рахується');
    await tap('готово');
    expect(editor()).toBeNull();
    expect(button('маленький крок теж рахується')).toBeTruthy();
  });

  it('gives the old phrase back on «скасувати»', async () => {
    await tap('ти можеш налаштувати все в налаштуваннях :)');
    typeIn('інше');
    await tap('скасувати');
    expect(button('ти можеш налаштувати все в налаштуваннях :)')).toBeTruthy();
  });

  it('adds a phrase at the end and drops it when nothing was typed', async () => {
    await tap('додати фразу');
    expect(editor()!.querySelector('textarea')!.value).toBe('');
    await tap('скасувати');
    expect(host.querySelectorAll('[data-act="phrase"]')).toHaveLength(1);
    await tap('додати фразу');
    typeIn('ти тут — це вже половина справи');
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    await tap('зберегти налаштування');
    expect(storedProfile().encouragement).toEqual(['ти можеш налаштувати все в налаштуваннях :)', 'ти тут — це вже половина справи']);
  });

  it('removes a phrase after asking', async () => {
    await tap('видалити: ти можеш налаштувати все в налаштуваннях :)');
    expect(dialog()!.textContent).toContain('видалити «ти можеш налаштувати все в налаштуваннях :)»?');
    await tap('видалити');
    expect(host.querySelectorAll('[data-act="phrase"]')).toHaveLength(0);
    await tap('зберегти налаштування');
    expect(storedProfile().encouragement).toEqual([]);
  });
});

describe('settings: accent and «доступність»', () => {
  it('shows a new accent at once and keeps it on 💾', async () => {
    await openSettings();
    await openPart('акцентний колір');
    expect(host.textContent).toContain('гортай, щоб побачити всі');
    expect(button('рожевий').getAttribute('aria-pressed')).toBe('true');
    await tap('блакитний');
    expect(button('блакитний').getAttribute('aria-pressed')).toBe('true');
    expect((device.looks.at(-1)!.theme as JsonObject).accent).toBe('blue');
    await tap('зберегти налаштування');
    expect((storedProfile().theme as JsonObject).accent).toBe('blue');
  });

  it('puts the saved look back when leaving without saving', async () => {
    await openSettings();
    await openPart('акцентний колір');
    await tap('блакитний');
    await tap('закрити налаштування');
    await tap('вийти');
    expect((device.looks.at(-1)!.theme as JsonObject).accent).toBe('pink');
  });

  it('has seven checkboxes, applied at once and kept on 💾', async () => {
    await openSettings();
    await openPart('доступність');
    const labels = [...host.querySelectorAll('#st-access label.checkbox')].map((l) => l.textContent!.trim());
    expect(labels).toEqual([
      'вимкнути всі анімації', 'вимкнути фонові анімації (ASCII)', 'вимкнути вібровідгук', 'вимкнути звук',
      'збільшені зони тапу', 'збільшити розмір тексту', 'віддзеркалити нижню панель',
    ]);
    await tick('збільшити розмір тексту');
    expect((device.looks.at(-1)!.accessibility as JsonObject).largerText).toBe(true);
    await tick('вимкнути звук');
    await tap('зберегти налаштування');
    expect(storedProfile().accessibility).toMatchObject({ largerText: true, noSound: true, noMotion: false });
    await tap('доступність');
    expect(meta('доступність')).toBe('без звуку, більший текст');
  });

  it('locks the two animation checkboxes when the phone reduces motion', async () => {
    await openSettings(WITH_A_DAY, true);
    await openPart('доступність');
    expect(checkbox('вимкнути всі анімації').checked).toBe(true);
    expect(checkbox('вимкнути всі анімації').disabled).toBe(true);
    expect(checkbox('вимкнути фонові анімації (ASCII)').disabled).toBe(true);
    expect(checkbox('вимкнути вібровідгук').disabled).toBe(false);
    expect(host.textContent).toContain('на телефоні ввімкнено «зменшити рух», тож анімації вимкнені.');
  });
});

describe('settings: the pulse timer', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('самопочуття');
  });

  it('shows the timer of each one-number question, with its length', async () => {
    expect(host.querySelector('#st-wellbeing')!.textContent).toContain('пульс');
    expect(checkbox('таймер для пульсу').checked).toBe(true);
    expect(host.textContent).toContain('на головній зʼявиться таймер');
    expect(button('30 с').getAttribute('aria-pressed')).toBe('true');
  });

  it('changes the length and switches the timer off', async () => {
    await tap('60 с');
    await tap('зберегти налаштування');
    const pulse = () => (storedProfile().trackers as JsonObject[]).find((t) => t.id === 'pulse')!;
    expect(pulse().timer).toEqual({ enabled: true, seconds: 60 });
    await tick('таймер для пульсу');
    expect(button('60 с')).toBeUndefined();
    await tap('зберегти налаштування');
    expect(pulse().timer).toEqual({ enabled: false, seconds: 60 });
  });
});

describe('settings: «налаштування через ШІ»', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('налаштування через ШІ');
  });

  it('copies the settings for the AI', async () => {
    await tap('скопіювати мої налаштування для ШІ');
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(device.copied[0]!)).toEqual(EXAMPLE_DIARY.profile);
    expect(device.copied[0]!.startsWith('{\n "format": "phys-activity-profile",')).toBe(true);
    expect(toastText()).toBe('скопійовано — встав у чат зі своїм ШІ');
  });

  it('says the prompt and the paste come soon; «застосувати» waits for text', async () => {
    await tap('скопіювати промпт');
    expect(toastText()).toBe('промпт ще пишемо, скоро буде :)');
    expect(button('застосувати').disabled).toBe(true);
    const field = host.querySelector<HTMLTextAreaElement>('textarea')!;
    field.value = '{ }';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(button('застосувати').disabled).toBe(false);
    await tap('застосувати');
    expect(toastText()).toBe('вставку налаштувань від ШІ ще робимо, скоро буде :)');
  });

  it('restores from a copy after asking, and goes home', async () => {
    const copy = { ...EXAMPLE_DIARY, days: { ['2026-11-01' as DayKey]: readDay({ note: 'з файлу' }, '2026-11-01' as DayKey) } };
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File([serializeDiary(copy, new Date())], 'trekr-kopiya.json')] });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dialog()!.textContent).toContain('відновити з файлу?');
    expect(dialog()!.textContent).toContain('записи й налаштування з файлу (1 день) замінять ті, що є зараз.');
    await tap('відновити');
    expect(heading()).toBe('головна');
    expect(Object.keys(stored().days)).toEqual(['2026-11-01']);
    expect(toastText()).toBe('відновлено з файлу :)');
  });

  it('says so when the file is not a copy', async () => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['не копія'], 'x.json')] });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dialog()).toBeNull();
    expect(toastText()).toBe('цей файл не схожий на копію з трекера >_<');
  });
});

describe('settings: copy and export', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('копія й експорт');
  });

  it('saves a copy and says how old it is', async () => {
    expect(host.querySelector('#st-backup')!.textContent).toContain('копії ще немає');
    await tap('зберегти копію');
    expect(device.saved[0]!.name).toBe('trekr-kopiya-2026-11-09.json');
    expect(host.querySelector('#st-backup')!.textContent).toContain('остання копія — сьогодні');
  });

  it('exports the records with the health-data warning', async () => {
    expect(button('записи').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('записи — це дані про твоє здоров’я. копіюючи їх для ШІ, ти передаєш їх у чат стороннього сервісу.');
    await tap('скопіювати для ШІ');
    await Promise.resolve();
    await Promise.resolve();
    expect(device.copied[0]).toContain('Мій щоденник руху й самопочуття (експорт з трекера, 09.11.2026)');
    expect(device.copied[0]).toContain('нотатка: вправа 1 легко');
    await tap('зберегти JSON');
    expect(device.saved[0]!.name).toBe('trekr-zapysy-2026-11-09.json');
    expect(JSON.parse(device.saved[0]!.text).format).toBe('phys-activity-log');
  });

  it('exports the exercises without the warning', async () => {
    await tap('вправи');
    expect(button('вправи').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).not.toContain('записи — це дані про твоє здоров’я');
    await tap('скопіювати для ШІ');
    await Promise.resolve();
    await Promise.resolve();
    expect(device.copied[0]).toContain('Мої вправи (з трекера, 09.11.2026):');
    await tap('зберегти JSON');
    expect(device.saved[0]!.name).toBe('trekr-vpravy-2026-11-09.json');
  });

  it('saves the records and the exercises as PDF', async () => {
    await tap('зберегти PDF');
    await vi.waitFor(() => expect(device.saved).toHaveLength(1));
    expect(device.saved[0]!.name).toBe('trekr-zapysy-2026-11-09.pdf');
    expect(device.saved[0]!.text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(device.saved[0]!.text).toContain('/Count 1');
    expect(toastText()).toBe('збережено');
    await tap('вправи');
    await tap('зберегти PDF');
    await vi.waitFor(() => expect(device.saved).toHaveLength(2));
    expect(device.saved[1]!.name).toBe('trekr-vpravy-2026-11-09.pdf');
  });

  it('says so when the PDF cannot be made', async () => {
    device.fontsWork = false;
    await tap('зберегти PDF');
    await vi.waitFor(() => expect(toastText()).toBe('не вдалося зібрати PDF >_<'));
    expect(device.saved).toEqual([]);
  });

  it('says so when the phone refuses the PDF', async () => {
    device.saveWorks = false;
    await tap('зберегти PDF');
    await vi.waitFor(() => expect(toastText()).toBe('не вдалося зберегти файл >_<'));
  });

  it('says so when the phone refuses the file', async () => {
    device.saveWorks = false;
    await tap('зберегти JSON');
    expect(toastText()).toBe('не вдалося зберегти файл >_<');
  });
});

describe('settings: deleting', () => {
  beforeEach(async () => {
    await openSettings();
    await openPart('видалення');
  });

  it('deletes the records only after asking, with «скасувати» after', async () => {
    expect(host.textContent).toContain('після натискання зʼявиться вікно з підтвердженням. утримувати нічого не треба.');
    await tap('видалити тільки записи');
    expect(dialog()!.textContent).toContain('видалити тільки записи?');
    await tap('скасувати');
    expect(Object.keys(stored().days)).toHaveLength(1);
    await tap('видалити тільки записи');
    await tap('видалити');
    expect(stored().days).toEqual({});
    expect(storedProfile()).toEqual(EXAMPLE_DIARY.profile);
    expect(toastText()).toBe('записи видалено');
    await tap('скасувати');
    expect(Object.keys(stored().days)).toEqual(['2026-11-08']);
  });

  it('erases everything after asking, offering a copy first', async () => {
    await tap('стерти все разом з налаштуваннями');
    expect(dialog()!.textContent).toContain('стерти все разом з налаштуваннями?');
    expect(dialog()!.textContent).toContain('спершу збережи копію: видалене не повернути.');
    button('зберегти копію', dialog()!).click();
    await settle();
    expect(device.saved[0]!.name).toBe('trekr-kopiya-2026-11-09.json');
    expect(dialog()).toBeNull();
    await tap('стерти все разом з налаштуваннями');
    await tap('стерти все');
    expect(localStorage.getItem(DIARY_KEY)).toBeNull();
    expect(host.textContent).toContain('почати без ШІ');
    expect(toastText()).toBe('усе видалено');
    await tap('скасувати');
    expect(heading()).toBe('головна');
    expect(Object.keys(stored().days)).toEqual(['2026-11-08']);
  });
});

describe('settings: less common paths', () => {
  afterEach(() => vi.restoreAllMocks());

  const failWrites = () => vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });
  const NOT_SAVED = 'не вдалося зберегти: схоже, на телефоні забракло місця >_<';
  const pick = async (file: unknown) => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await settle();
  };

  it('takes a kind out of the goal and moves the days with the slider itself', async () => {
    await openSettings();
    await openPart('тижнева ціль');
    await tick('ранкова розминка');
    const range = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    range.value = '3';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.querySelector('.st-days__value')!.textContent).toBe('3/7');
    await tap('зберегти налаштування');
    expect(storedProfile().goal).toMatchObject({ done: [], days: 3 });
  });

  it('keeps the focus on the same control after a redraw', async () => {
    await openSettings();
    await openPart('тижнева ціль');
    checkbox('рахувати тижневу ціль').focus();
    await tick('рахувати тижневу ціль');
    expect((document.activeElement as HTMLElement).dataset.act).toBe('goal-on');
    await openPart('налаштування через ШІ');
    host.querySelector<HTMLElement>('[data-restore]')!.focus();
    await tick('рахувати тижневу ціль');
    expect(document.activeElement).toBe(document.body);
    expect(host.querySelector('textarea')!.value).toBe('');
  });

  it('opens the file picker and keeps pasted text over a redraw', async () => {
    await openSettings();
    await openPart('налаштування через ШІ');
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await tap('відновити з копії');
    expect(picker).toHaveBeenCalled();
    const field = host.querySelector<HTMLTextAreaElement>('textarea')!;
    field.value = 'від ШІ';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await openPart('тижнева ціль');
    expect(host.querySelector('textarea')!.value).toBe('від ШІ');
    expect(button('застосувати').disabled).toBe(false);
  });

  it('says so when the phone refuses to store, and keeps the draft', async () => {
    await openSettings();
    await openPart('тижнева ціль');
    await tick('рахувати тижневу ціль');
    failWrites();
    await tap('зберегти налаштування');
    expect(toastText()).toBe(NOT_SAVED);
    expect(checkbox('рахувати тижневу ціль').checked).toBe(false);
  });

  it('keeps the saved settings when undoing fails', async () => {
    await openSettings();
    await openPart('тижнева ціль');
    await tick('рахувати тижневу ціль');
    await tap('зберегти налаштування');
    failWrites();
    await tap('скасувати');
    vi.restoreAllMocks();
    expect((storedProfile().goal as JsonObject).enabled).toBe(false);
  });

  it('keeps the records when deleting them can’t be stored', async () => {
    await openSettings();
    await openPart('видалення');
    await tap('видалити тільки записи');
    failWrites();
    await tap('видалити');
    vi.restoreAllMocks();
    expect(Object.keys(stored().days)).toHaveLength(1);
    expect(toastText()).toBe(NOT_SAVED);
  });

  it('says so when copying fails', async () => {
    await openSettings();
    await openPart('налаштування через ШІ');
    device.copyWorks = false;
    await tap('скопіювати мої налаштування для ШІ');
    expect(toastText()).toBe('не вдалося скопіювати >_<');
  });

  it('changes nothing when restoring or erasing is cancelled', async () => {
    await openSettings();
    await openPart('налаштування через ШІ');
    await pick(new File([serializeDiary(EXAMPLE_DIARY, new Date())], 'trekr-kopiya.json'));
    await tap('скасувати');
    await openPart('видалення');
    await tap('стерти все разом з налаштуваннями');
    await tap('скасувати');
    expect(heading()).toBe('налаштування');
    expect(Object.keys(stored().days)).toHaveLength(1);
  });

  it('says a file that can’t be read is not a copy', async () => {
    await openSettings();
    await openPart('налаштування через ШІ');
    await pick({ text: () => Promise.reject(new Error('unreadable')) });
    expect(toastText()).toBe('цей файл не схожий на копію з трекера >_<');
  });

  it('explains the timer when no question takes a number', async () => {
    await openSettings({ profile: { ...EXAMPLE_DIARY.profile, trackers: [] }, days: {} });
    await openPart('самопочуття');
    expect(host.textContent).toContain('таймер для пульсу ставиться на питання з одним числом. їх поки немає.');
    expect(meta('доступність')).toBe('стандартно');
  });

  it('turns a timer on at 30 s on an unnamed question', async () => {
    await openSettings({ profile: { ...EXAMPLE_DIARY.profile, trackers: [{ id: 'n', name: '', kind: 'number', ask: ['morning'] }] }, days: {} });
    await openPart('самопочуття');
    expect(host.querySelector('.st-timer h3')!.textContent).toBe('без назви');
    await tick('таймер для пульсу');
    expect(button('30 с').getAttribute('aria-pressed')).toBe('true');
    await tap('зберегти налаштування');
    expect((storedProfile().trackers as JsonObject[])[0]!.timer).toEqual({ enabled: true, seconds: 30 });
  });
});

describe('settings: the days at their ends', () => {
  it('goes down with − and stops at 0 and at 7', async () => {
    await openSettings();
    await openPart('тижнева ціль');
    for (let i = 0; i < 5; i += 1) await tap('менше: днів на тиждень');
    expect(host.querySelector('.st-days__value')!.textContent).toBe('0/7');
    expect(button('менше: днів на тиждень').disabled).toBe(true);
    expect(button('більше: днів на тиждень').disabled).toBe(false);
    for (let i = 0; i < 7; i += 1) await tap('більше: днів на тиждень');
    expect(button('більше: днів на тиждень').disabled).toBe(true);
    expect(button('менше: днів на тиждень').disabled).toBe(false);
    const range = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(range.getAttribute('aria-valuetext')).toBe('7 з 7');
  });
});
