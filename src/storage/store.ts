import { parseDiary, serializeDiary, type Diary } from '../domain/diary';

/** The part of `localStorage` the app uses; a test can pass its own. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DIARY_KEY = 'phys-activity-tracking-app/diary';
const UNREADABLE_KEY = `${DIARY_KEY}/unreadable`;
const BROWSER_KEY = 'phys-activity-tracking-app/browser-chosen';
const SECTION_KEY = 'phys-activity-tracking-app/section-closed/';

export interface DiaryStore {
  load(): Diary | null;
  /** Throws when the phone refuses to store it (e.g. storage full). */
  save(diary: Diary): void;
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
    remember(id, open) {
      try {
        storage.setItem(SECTION_KEY + id, open ? 'no' : 'yes');
      } catch {
        // a full phone only forgets which sections were closed
      }
    },
  };
}
