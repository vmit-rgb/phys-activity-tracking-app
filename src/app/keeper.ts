import type { DayKey } from '../domain/dates';
import { emptyDay } from '../domain/day';
import type { Diary } from '../domain/diary';
import { rememberNames, type Edit } from '../domain/log';
import { readSettings } from '../domain/settings';
import type { DiaryStore } from '../storage/store';
import type { Toast, ToastMessage } from '../ui/toast';

/** Logging saves this long after the last change, so typing doesn't write on every key. */
export const SAVE_DELAY_MS = 400;

/* COPY.md, Home: «save error» */
const LOG_NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти :( спробуй ще раз. якщо повторюється — збережи копію в меню.' };

export interface LogKeeper {
  /** The diary with the edit applied to one day; saved a moment later. */
  edit(current: Diary, date: DayKey, change: Edit): Diary;
  /** Writes what is not saved yet, now (e.g. when the app is hidden). */
  saveNow(): void;
}

/**
 * Keeps what is logged on home. A refusal to save shows the save-error toast;
 * the diary stays in memory, so the next change tries again.
 */
export function logKeeper(store: DiaryStore, toast: Toast): LogKeeper {
  let unsaved: Diary | null = null;
  let pending: ReturnType<typeof setTimeout> | undefined;

  function saveNow(): void {
    clearTimeout(pending);
    if (!unsaved) return;
    try {
      store.save(unsaved);
      unsaved = null;
    } catch {
      toast.show(LOG_NOT_SAVED);
    }
  }

  return {
    edit(current, date, change) {
      const day = change(current.days[date] ?? emptyDay(date));
      unsaved = { ...current, days: { ...current.days, [date]: rememberNames(readSettings(current.profile))(day) } };
      clearTimeout(pending);
      pending = setTimeout(saveNow, SAVE_DELAY_MS);
      return unsaved;
    },
    saveNow,
  };
}
