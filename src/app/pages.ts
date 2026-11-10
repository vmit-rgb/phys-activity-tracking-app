import { backupLine, copyFileName, needsBackup } from '../domain/backup';
import type { DayKey } from '../domain/dates';
import { serializeDiary, type Diary } from '../domain/diary';
import { readSettings } from '../domain/settings';
import { showHowToUse, showWhatsNew, type HelpActions } from '../screens/help';
import { showMenu, type MenuItem } from '../screens/menu';
import type { backupMemory, ThemeChoice } from '../storage/store';
import type { Toast, ToastMessage } from '../ui/toast';

/*
 * The screens that open over home (stage 6a): the menu and its two pages.
 * Each one is a step in the phone's history, so «назад» closes them one by one.
 */

export interface ShareData {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

/** What the screens over home need from the phone. */
export interface DeviceEnv {
  /** The theme shown now and the choice made with ☼ / ☾ in the menu. */
  theme: { shown(): ThemeChoice; choose(theme: ThemeChoice): void };
  /** The day of the last copy, on this phone. */
  backups: ReturnType<typeof backupMemory>;
  /** Hands a file to the phone (its downloads); throws when the phone refuses. */
  saveFile(name: string, text: string): void;
  /** The phone's share sheet; 'unavailable' when it has none. */
  share(data: ShareData): Promise<'shared' | 'cancelled' | 'unavailable'>;
  /** Puts text on the clipboard; false when the phone refuses. */
  copyText(text: string): Promise<boolean>;
  now(): Date;
  /** The phone's back button; `depth` = how many screens are open over home. */
  history: {
    push(depth: number): void;
    back(steps: number): void;
    listen(onBack: (depth: number) => void): void;
  };
}

/** How the app lets these screens take the screen and give it back to home. */
export interface Home {
  host: HTMLElement;
  toast: Toast;
  today(): DayKey;
  diary(): Diary;
  /** The day home shows. */
  date(): DayKey;
  /** Shows home on that day. */
  showHome(date: DayKey): void;
  /** Undoes the screen shown now and draws the next one; `draw` returns what to undo later. */
  replace(draw: () => () => void): void;
}

/* COPY.md, Toasts; «не вдалося зберегти файл» as «бета 0.81» says it. */
const COPY_SAVED: ToastMessage = { message: 'копію збережено', showIcon: true };
const FILE_NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти файл', emoticon: '>_<' };
const LINK_COPIED: ToastMessage = { message: 'посилання скопійовано — надішли, кому хочеш', emoticon: ':)' };
/* Нитка's drafts (stage 6a): what the menu offers before it is built. */
const NOT_SHARED: ToastMessage = { message: 'не вдалося поділитися', emoticon: '>_<' };
const soon = (message: string): ToastMessage => ({ message, emoticon: ':)' });
const HISTORY_SOON = soon('історію ще робимо, скоро буде');
const SETTINGS_SOON = soon('налаштування ще робимо, скоро будуть');
const SEARCH_SOON = soon('пошук ще робимо, скоро буде');
const FEEDBACK_SOON = soon('форму для фідбеку ще робимо, скоро буде');

/** «поділитися застосунком» (Figma caption, Нитка's draft): the landing page, not the app itself. */
export const SHARE: ShareData = {
  title: 'трекер',
  text: 'щоденник руху й самопочуття: розминка, вправи й самопочуття в одному місці, без сповіщень, дані лишаються на телефоні',
  url: 'https://vmit-rgb.github.io/phys-activity-tracking-app-landing-page/',
};

export type Page = 'menu' | 'whats-new' | 'how-to-use';

export function pagesOverHome(env: DeviceEnv, home: Home): { open(page: Page): void } {
  let pages: Page[] = [];
  const say = (message: ToastMessage) => () => home.toast.show(message);

  function open(page: Page): void {
    pages = [...pages, page];
    env.history.push(pages.length);
    draw();
  }

  /**
   * Back to `depth` screens over home (always fewer than are open); the
   * phone's history brings us there (see `listen`).
   */
  function backTo(depth: number): void {
    env.history.back(pages.length - depth);
  }

  const help: HelpActions = { menu: () => backTo(1), search: say(SEARCH_SOON), close: () => backTo(0) };

  function draw(): void {
    const page = pages.at(-1);
    if (!page) home.showHome(home.date());
    else if (page === 'menu') home.replace(menu);
    else {
      home.replace(() => {
        (page === 'whats-new' ? showWhatsNew : showHowToUse)(home.host, help);
        return () => {};
      });
    }
  }

  function saveCopy(): void {
    const today = home.today();
    try {
      env.saveFile(copyFileName(today), serializeDiary(home.diary(), env.now()));
    } catch {
      home.toast.show(FILE_NOT_SAVED);
      return;
    }
    env.backups.remember(today);
    draw();
    home.toast.show(COPY_SAVED);
  }

  async function share(): Promise<void> {
    if ((await env.share(SHARE)) !== 'unavailable') return;
    home.toast.show((await env.copyText(`${SHARE.text} → ${SHARE.url}`)) ? LINK_COPIED : NOT_SHARED);
  }

  const ITEMS: Record<MenuItem, () => void> = {
    history: say(HISTORY_SOON),
    settings: say(SETTINGS_SOON),
    search: say(SEARCH_SOON),
    feedback: say(FEEDBACK_SOON),
    backup: saveCopy,
    'whats-new': () => open('whats-new'),
    'how-to-use': () => open('how-to-use'),
    share: () => void share(),
  };

  function switchTheme(): void {
    env.theme.choose(env.theme.shown() === 'dark' ? 'light' : 'dark');
    draw();
    home.host.querySelector<HTMLElement>('.menu__theme')!.focus();
  }

  function menu(): () => void {
    const diary = home.diary();
    const today = home.today();
    const last = env.backups.last();
    return showMenu(home.host, {
      settings: readSettings(diary.profile),
      days: diary.days,
      date: home.date(),
      today,
      theme: env.theme.shown(),
      backupLine: backupLine(last, today),
      remind: needsBackup(last, today, Object.keys(diary.days).length > 0),
    }, {
      choose: (item) => ITEMS[item](),
      switchTheme,
      close: () => backTo(0),
      goTo(date) {
        home.showHome(date);
        backTo(0);
      },
    });
  }

  env.history.listen((depth) => {
    if (depth >= pages.length) return;
    pages = pages.slice(0, depth);
    draw();
  });

  return { open };
}
