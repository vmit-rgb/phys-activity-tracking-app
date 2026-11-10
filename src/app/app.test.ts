import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDevice } from './test-env';
import type { DayKey } from '../domain/dates';
import { readDay } from '../domain/day';
import { serializeDiary, type Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { browserChoice, diaryStore, sectionMemory, type KeyValue } from '../storage/store';
import { mountToast } from '../ui/toast';
import { startApp, type AppEnv } from './app';

// Invented data only.
const COPY_081 = serializeDiary({
  profile: { format: 'phys-activity-profile', version: 1, theme: { accent: 'green' } },
  days: { ['2026-11-07' as DayKey]: readDay({ note: 'вправа 1' }, '2026-11-07' as DayKey) },
}, new Date('2026-11-08T10:00:00Z'));

let host: HTMLElement;
let onDiary: ReturnType<typeof vi.fn<(diary: Diary) => void>>;

function start(over: Partial<AppEnv> = {}, storage: KeyValue = localStorage): void {
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  onDiary = vi.fn<(diary: Diary) => void>();
  startApp({
    host,
    store: diaryStore(storage, () => new Date('2026-11-09T08:00:00Z')),
    browser: browserChoice(localStorage),
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    onDiary,
    today: () => '2026-11-09' as DayKey,
    sections: sectionMemory(localStorage),
    ...fakeDevice().env,
    whenHidden: () => {},
    ...over,
  });
}

const heading = () => host.querySelector('h1')!.textContent;
const toastText = () => document.querySelector<HTMLElement>('.toast:not([hidden]) .toast__message')?.textContent;
const click = (selector: string) => host.querySelector<HTMLElement>(selector)!.click();
const stored = () => diaryStore(localStorage, () => new Date()).load();

async function restoreFile(text: string, file: File = new File([text], 'trekr-kopiya.json')): Promise<void> {
  const input = host.querySelector<HTMLInputElement>('[data-restore-file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(toastText()).toBeTruthy());
}

beforeEach(() => localStorage.clear());

describe('first launch in the installed app', () => {
  beforeEach(() => start());

  it('greets and offers the three ways to start', () => {
    expect(heading()).toBe('привіт! почнімо з налаштувань :)');
    expect(host.querySelector('[data-restore]')!.textContent).toBe('відновити з копії');
    expect(host.querySelector('[data-start-without-ai]')!.textContent).toBe('почати без ШІ');
    expect(host.querySelector('footer')!.textContent).toContain('бета 0.9');
  });

  it('shows the paste field for the detected phone', () => {
    expect(host.querySelector('[data-platform-hint]')!.textContent).toBe('схоже, у тебе андроїд.');
    expect(host.querySelector<HTMLElement>('[data-paste]')!.hidden).toBe(false);
    expect(host.querySelector('[data-platform="android"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[data-paste-how]')!.textContent).toContain('натисни в полі');
  });

  it('switches the instructions to the other phone', () => {
    click('[data-platform="iphone"]');
    expect(host.querySelector('[data-platform="android"]')!.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[data-paste-how]')!.textContent).toContain('тапни в полі');
  });

  it('enables «застосувати» only once something is pasted', () => {
    const field = host.querySelector<HTMLTextAreaElement>('[data-paste-field]')!;
    const apply = host.querySelector<HTMLButtonElement>('[data-apply]')!;
    expect(apply.disabled).toBe(true);
    field.value = '   ';
    field.dispatchEvent(new Event('input'));
    expect(apply.disabled).toBe(true);
    field.value = '{ "format": "phys-activity-profile" }';
    field.dispatchEvent(new Event('input'));
    expect(apply.disabled).toBe(false);
  });

  it('says the prompt and the paste are coming soon, and keeps nothing', () => {
    click('[data-copy-prompt]');
    expect(toastText()).toBe('промпт ще пишемо, скоро буде :)');
    const field = host.querySelector<HTMLTextAreaElement>('[data-paste-field]')!;
    field.value = '{}';
    field.dispatchEvent(new Event('input'));
    click('[data-apply]');
    expect(toastText()).toBe('вставку налаштувань від ШІ ще робимо, скоро буде :)');
    expect(stored()).toBeNull();
  });

  it('starts without AI: stores the examples and leaves the first screen', () => {
    click('[data-start-without-ai]');
    expect(stored()).toEqual(EXAMPLE_DIARY);
    expect(onDiary).toHaveBeenCalledWith(EXAMPLE_DIARY);
    expect(heading()).toBe('головна');
    expect(host.querySelector('.hero__text')!.textContent).toBe('ти можеш налаштувати все в налаштуваннях :)');
  });

  it('restores a copy from «бета 0.81» with its days', async () => {
    await restoreFile(COPY_081);
    expect(toastText()).toBe('відновлено з файлу :)');
    expect(Object.keys(stored()!.days)).toEqual(['2026-11-07']);
    expect(heading()).toBe('головна');
    expect(onDiary).toHaveBeenCalledTimes(1);
  });

  it('refuses a file that is not a copy and stays on the first screen', async () => {
    await restoreFile('{"format":"something-else"}');
    expect(toastText()).toBe('цей файл не схожий на копію з трекера >_<');
    expect(stored()).toBeNull();
    expect(heading()).toBe('привіт! почнімо з налаштувань :)');
  });

  it('says the file is not a copy when the phone cannot read it', async () => {
    const unreadable = new File([''], 'trekr-kopiya.json');
    unreadable.text = () => Promise.reject(new Error('NotReadableError'));
    await restoreFile('', unreadable);
    expect(toastText()).toBe('цей файл не схожий на копію з трекера >_<');
    expect(stored()).toBeNull();
  });

  it('does nothing when no file was picked', () => {
    const input = host.querySelector<HTMLInputElement>('[data-restore-file]')!;
    const picker = vi.spyOn(input, 'click').mockImplementation(() => {});
    click('[data-restore]');
    expect(picker).toHaveBeenCalled();
    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    input.dispatchEvent(new Event('change'));
    expect(toastText()).toBeUndefined();
  });
});

describe('the paste field on a computer', () => {
  it('waits for the person to pick a phone', () => {
    start({ platform: 'unknown', installed: false });
    expect(host.querySelector('[data-platform-hint]')!.textContent).toContain('не вдалося визначити телефон');
    expect(host.querySelector<HTMLElement>('[data-paste]')!.hidden).toBe(true);
    click('[data-platform="iphone"]');
    expect(host.querySelector<HTMLElement>('[data-paste]')!.hidden).toBe(false);
  });
});

describe('a phone in the browser', () => {
  it('asks to install first, with the steps for the detected phone', () => {
    start({ platform: 'iphone', installed: false });
    expect(heading()).toBe('спершу встанови застосунок');
    expect(host.querySelector('[data-steps]')!.textContent).toContain('safari');
    click('[data-platform="android"]');
    expect(host.querySelector('[data-steps]')!.textContent).toContain('chrome');
  });

  it('lets the person go on in the browser and remembers it', () => {
    start({ platform: 'android', installed: false });
    click('[data-use-browser]');
    expect(heading()).toBe('привіт! почнімо з налаштувань :)');
    start({ platform: 'android', installed: false });
    expect(heading()).toBe('привіт! почнімо з налаштувань :)');
  });
});

describe('coming back', () => {
  it('opens straight on the saved diary and applies it', () => {
    diaryStore(localStorage, () => new Date()).save(EXAMPLE_DIARY);
    start({ installed: false });
    expect(heading()).toBe('головна');
    expect(onDiary).toHaveBeenCalledWith(EXAMPLE_DIARY);
  });
});

describe('home', () => {
  beforeEach(() => {
    diaryStore(localStorage, () => new Date()).save(EXAMPLE_DIARY);
    start();
  });

  it('opens on today and goes to the previous day', () => {
    expect(host.querySelector('.date-nav__date [aria-hidden]')!.textContent).toBe('пн, 09.11.2026');
    click('[aria-label="попередній день"]');
    expect(host.querySelector('.date-nav__date [aria-hidden]')!.textContent).toBe('нд, 08.11.2026');
    expect(host.querySelector('.hero__text')!.textContent).toContain('це запис за нд, 08.11.2026.');
  });

  it('opens the menu from ≡', () => {
    click('.bar__menu');
    expect(heading()).toBe('меню');
  });
});

describe('when the phone refuses to store', () => {
  it('says so and stays on the first screen', () => {
    start({}, { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} });
    click('[data-start-without-ai]');
    expect(toastText()).toBe('не вдалося зберегти: схоже, на телефоні забракло місця >_<');
    expect(heading()).toBe('привіт! почнімо з налаштувань :)');
    expect(onDiary).not.toHaveBeenCalled();
  });
});
