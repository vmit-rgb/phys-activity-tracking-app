import { backupLine, copyFileName, needsBackup } from '../domain/backup';
import type { DayKey } from '../domain/dates';
import { serializeDiary, type Diary } from '../domain/diary';
import { readSettings } from '../domain/settings';
import { showHowToUse, showWhatsNew, type HelpActions } from '../screens/help';
import { showHistory } from '../screens/history';
import { showMenu, type MenuItem } from '../screens/menu';
import type { PdfFonts } from '../pdf/pdf';
import type { backupMemory, ThemeChoice } from '../storage/store';
import type { Toast, ToastMessage } from '../ui/toast';
import { settingsPage, type SettingsEnv, type SettingsPage } from './settings-page';

/*
 * The screens that open over home: the menu and its two pages (stage 6a),
 * the history with search in notes (stage 6b).
 * Each one is a step in the phone's history, so «назад» closes them one by one.
 */

export interface ShareData {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

/** What the screens over home need from the phone. */
export interface DeviceEnv extends Pick<SettingsEnv, 'look' | 'motionReduced'> {
  /** The theme shown now and the choice made with ☼ / ☾ in the menu. */
  theme: { shown(): ThemeChoice; choose(theme: ThemeChoice): void };
  /** The day of the last copy, on this phone. */
  backups: ReturnType<typeof backupMemory>;
  /** Hands a file to the phone (its downloads); throws when the phone refuses. */
  saveFile(name: string, content: string | Uint8Array<ArrayBuffer>): void;
  /** The font embedded in a PDF, loaded when the first PDF is made; rejects when it can't load. */
  pdfFonts(): Promise<PdfFonts>;
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
  /** Stores the diary; false (and a toast) when the phone refuses. */
  keep(next: Diary): boolean;
  /** Starts over with this diary on home (a restored copy, an undone «стерти все»). */
  restart(next: Diary, message?: ToastMessage): void;
  /** «стерти все»: no diary on this phone, the first screen. */
  erase(message: ToastMessage): void;
}

/* COPY.md, Toasts; «не вдалося зберегти файл» as «бета 0.81» says it. */
const COPY_SAVED: ToastMessage = { message: 'копію збережено', showIcon: true };
const FILE_NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти файл', emoticon: '>_<' };
const LINK_COPIED: ToastMessage = { message: 'посилання скопійовано — надішли, кому хочеш', emoticon: ':)' };
/* Нитка's drafts (stage 6a): what the menu offers before it is built. */
const NOT_SHARED: ToastMessage = { message: 'не вдалося поділитися', emoticon: '>_<' };
const soon = (message: string): ToastMessage => ({ message, emoticon: ':)' });
const FEEDBACK_SOON = soon('форму для фідбеку ще робимо, скоро буде');

/** «поділитися застосунком» (Figma caption, Нитка's draft): the landing page, not the app itself. */
export const SHARE: ShareData = {
  title: 'трекер',
  text: 'щоденник руху й самопочуття: розминка, вправи й самопочуття в одному місці, без сповіщень, дані лишаються на телефоні',
  url: 'https://vmit-rgb.github.io/phys-activity-tracking-app-landing-page/',
};

/** «зберегти копію»; false when the phone refused the file. */
function saveCopyFile(env: DeviceEnv, home: Home): boolean {
  const today = home.today();
  try {
    env.saveFile(copyFileName(today), serializeDiary(home.diary(), env.now()));
  } catch {
    home.toast.show(FILE_NOT_SAVED);
    return false;
  }
  env.backups.remember(today);
  home.toast.show(COPY_SAVED);
  return true;
}

/** The share sheet; without one, the text and link on the clipboard. */
async function share(env: DeviceEnv, toast: Toast): Promise<void> {
  if ((await env.share(SHARE)) !== 'unavailable') return;
  toast.show((await env.copyText(`${SHARE.text} → ${SHARE.url}`)) ? LINK_COPIED : NOT_SHARED);
}

/** 'search' is the history with the search panel open. */
export type Page = 'menu' | 'whats-new' | 'how-to-use' | 'history' | 'search' | 'settings';

export function pagesOverHome(env: DeviceEnv, home: Home): { open(page: Page): void } {
  let pages: Page[] = [];
  let settings: SettingsPage | null = null;
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

  /** Home on that day, every screen over it closed. */
  function goTo(date: DayKey): void {
    home.showHome(date);
    backTo(0);
  }

  const help: HelpActions = { menu: () => backTo(1), search: () => open('search'), close: () => backTo(0) };

  function history(search: boolean): () => void {
    const diary = home.diary();
    return showHistory(home.host, {
      settings: readSettings(diary.profile),
      days: diary.days,
      today: home.today(),
      date: home.date(),
      search,
    }, {
      menu: () => backTo(1),
      close: () => backTo(0),
      goTo,
      toast: (message) => home.toast.show(message),
    });
  }

  const helpPage = (show: typeof showWhatsNew) => () => {
    show(home.host, help);
    return () => {};
  };

  /** Each page draws itself and returns what to undo. */
  const SCREENS: Record<Page, () => () => void> = {
    menu: () => menu(),
    'whats-new': helpPage(showWhatsNew),
    'how-to-use': helpPage(showHowToUse),
    history: () => history(false),
    search: () => history(true),
    // the menu creates the page before opening it
    settings: () => settings!.draw(),
  };

  function openSettings(): void {
    settings = settingsPage(env, {
      ...home,
      backupLine: () => backupLine(env.backups.last(), home.today()),
      saveCopy,
      close: () => leaveAll(() => {}),
      restart: (next, message) => leaveAll(() => home.restart(next, message)),
      erase: (message) => leaveAll(() => home.erase(message)),
    });
    open('settings');
  }

  /** Settings let go of the screen: `then`, and every screen over home closes. */
  function leaveAll(then: () => void): void {
    settings = null;
    then();
    backTo(0);
  }

  function draw(): void {
    const page = pages.at(-1);
    if (page) home.replace(SCREENS[page]);
    else home.showHome(home.date());
  }

  const saveCopy = () => saveCopyFile(env, home);

  const ITEMS: Record<MenuItem, () => void> = {
    history: () => open('history'),
    settings: openSettings,
    search: () => open('search'),
    feedback: say(FEEDBACK_SOON),
    backup: () => {
      if (saveCopy()) draw();
    },
    'whats-new': () => open('whats-new'),
    'how-to-use': () => open('how-to-use'),
    share: () => void share(env, home.toast),
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
      goTo,
    });
  }

  /** The phone's «назад» over settings with changes: back on the page until the person decides. */
  async function leaveSettings(depth: number): Promise<void> {
    env.history.push(pages.length);
    const page = settings!;
    if (!(await page.mayLeave())) return;
    settings = null;
    backTo(depth);
  }

  env.history.listen((depth) => {
    if (depth >= pages.length) return;
    if (settings && pages.indexOf('settings') >= depth) return void leaveSettings(depth);
    pages = pages.slice(0, depth);
    draw();
  });

  return { open };
}
