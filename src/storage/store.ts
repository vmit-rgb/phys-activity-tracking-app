import { isDayKey, type DayKey } from '../domain/dates';
import { parseDiary, serializeDiary, type Diary } from '../domain/diary';

/** The part of `localStorage` the app uses; a test can pass its own. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DIARY_KEY = 'phys-activity-tracking-app/diary';
const UNREADABLE_KEY = `${DIARY_KEY}/unreadable`;
const BROWSER_KEY = 'phys-activity-tracking-app/browser-chosen';
const SECTION_KEY = 'phys-activity-tracking-app/section-closed/';
const THEME_KEY = 'phys-activity-tracking-app/theme';
const BACKUP_KEY = 'phys-activity-tracking-app/last-copy';

export interface DiaryStore {
  load(): Diary | null;
  /** Throws when the phone refuses to store it (e.g. storage full). */
  save(diary: Diary): void;
  /** «стерти все»: no diary on this phone; an entry set aside as unreadable stays. */
  clear(): void;
}

/**
 * The diary on this phone only, kept in the same format as a copy file.
 * An entry the app can't read is never lost: it is set aside before the
 * first write over it.
 */
export function diaryStore(storage: KeyValue, now: () => Date): DiaryStore {
  return {
    load: () => parseDiary(storage.getItem(DIARY_KEY) ?? ''),
    save(diary) {
      const previous = storage.getItem(DIARY_KEY);
      if (previous !== null && parseDiary(previous) === null) storage.setItem(UNREADABLE_KEY, previous);
      storage.setItem(DIARY_KEY, serializeDiary(diary, now()));
    },
    clear: () => storage.removeItem(DIARY_KEY),
  };
}

/** Whether the person chose to use the app in the phone's browser without installing it. */
export function browserChoice(storage: KeyValue): { chosen(): boolean; choose(): void } {
  return {
    chosen: () => storage.getItem(BROWSER_KEY) === 'yes',
    choose: () => storage.setItem(BROWSER_KEY, 'yes'),
  };
}

/** Which home sections the person closed; a section is open until then. Kept on this phone only, not in the copy. */
export function sectionMemory(storage: KeyValue): { open(id: string): boolean; remember(id: string, open: boolean): void } {
  return {
    open: (id) => storage.getItem(SECTION_KEY + id) !== 'yes',
    remember: (id, open) => setQuietly(storage, SECTION_KEY + id, open ? 'no' : 'yes'),
  };
}

/** Writes what only makes the app nicer: a full phone just forgets it. */
function setQuietly(storage: KeyValue, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // nothing is lost but the remembered choice
  }
}

export type ThemeChoice = 'dark' | 'light';

/** The theme chosen with ☼ / ☾ in the menu; light and dark belong to the phone, not the profile (PROFILE-FORMAT.md). */
export function themeMemory(storage: KeyValue): { chosen(): ThemeChoice | null; choose(theme: ThemeChoice): void } {
  return {
    chosen() {
      const theme = storage.getItem(THEME_KEY);
      return theme === 'dark' || theme === 'light' ? theme : null;
    },
    choose: (theme) => setQuietly(storage, THEME_KEY, theme),
  };
}

/** The day of the last «зберегти копію», for «остання копія — …» (on this phone only, as in «бета 0.81»). */
export function backupMemory(storage: KeyValue): { last(): DayKey | null; remember(day: DayKey): void } {
  return {
    last() {
      const day = storage.getItem(BACKUP_KEY);
      return isDayKey(day) ? day : null;
    },
    remember: (day) => setQuietly(storage, BACKUP_KEY, day),
  };
}

/**
 * Where the app keeps everything (Olesia, 2026-11-09): the installed app on
 * the phone; a browser tab only in that tab, so a new tab starts from the
 * first screen. The tab never reads or writes the phone's storage: on Android
 * the installed app shares it with Chrome, and the tab must not touch that diary.
 */
export function storageFor<T extends KeyValue>(installed: boolean, storages: { local: T; session: T }): T {
  return installed ? storages.local : storages.session;
}
