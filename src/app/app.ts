import type { DayKey } from '../domain/dates';
import { readCopy, type Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { readSettings } from '../domain/settings';
import { homeSession } from '../home/session';
import { showFirstLaunch } from '../screens/first-launch';
import { showHome } from '../screens/home';
import { showInstallFirst } from '../screens/install-first';
import type { DiaryStore, sectionMemory } from '../storage/store';
import type { Toast, ToastMessage } from '../ui/toast';
import { logKeeper } from './keeper';
import { pagesOverHome, type DeviceEnv } from './pages';
import { startScreen, type Phone, type Platform, type StartScreen } from './start';

export { SAVE_DELAY_MS } from './keeper';

export interface AppEnv extends DeviceEnv {
  host: HTMLElement;
  store: DiaryStore;
  browser: { chosen(): boolean; choose(): void };
  platform: Platform;
  installed: boolean;
  toast: Toast;
  /** Today on the phone. */
  today(): DayKey;
  sections: ReturnType<typeof sectionMemory>;
  /** Called with every diary the app starts showing, e.g. to apply its accent. */
  onDiary(diary: Diary): void;
  /** Runs `save` when the app is hidden or closed, so nothing typed is lost. */
  whenHidden(save: () => void): void;
}

/* Texts: COPY.md; «скоро» toasts as on the landing page (Olesia, 2026-11-09). */
const PROMPT_SOON: ToastMessage = { message: 'промпт ще пишемо, скоро буде', emoticon: ':)' };
const PASTE_SOON: ToastMessage = { message: 'вставку налаштувань від ШІ ще робимо, скоро буде', emoticon: ':)' };
const NOT_A_COPY: ToastMessage = { message: 'цей файл не схожий на копію з трекера', emoticon: '>_<' };
const RESTORED: ToastMessage = { message: 'відновлено з файлу', emoticon: ':)', showIcon: true };
const NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти: схоже, на телефоні забракло місця', emoticon: '>_<' };

/** Stores the diary; false and the «no space» toast when the phone refuses. */
function saved(store: DiaryStore, next: Diary, toast: Toast): boolean {
  try {
    store.save(next);
    return true;
  } catch {
    toast.show(NOT_SAVED);
    return false;
  }
}

/** «відновити з копії»: a copy goes to `keep`, anything else gets the «not a copy» toast. */
async function restoreFrom(file: File, keep: (diary: Diary, done: ToastMessage) => void, toast: Toast): Promise<void> {
  const restored = await readCopy(file);
  if (restored) keep(restored, RESTORED);
  else toast.show(NOT_A_COPY);
}

/** install-first shows Android's steps unless the phone is an iPhone. */
const phoneOf = (platform: Platform): Phone => (platform === 'iphone' ? 'iphone' : 'android');

export function startApp(env: AppEnv): void {
  const { host, store, browser, toast } = env;
  let diary = store.load();
  let date = env.today();
  let leave = () => {};
  const session = homeSession();
  const log = logKeeper(store, toast);
  // the menu opens only from home, so there is a diary whenever it asks
  const pages = pagesOverHome(env, {
    host,
    toast,
    today: env.today,
    diary: () => diary!,
    date: () => date,
    // after «стерти все» there is no diary, and `show` gives the first screen instead
    showHome(day) {
      date = day;
      show('home');
    },
    replace(draw) {
      leave();
      leave = draw();
      document.documentElement.scrollTop = 0;
    },
    keep: (next) => persist(next),
    restart: (next, message) => keep(next, message),
    erase(message) {
      store.clear();
      diary = null;
      show('first-launch');
      toast.show(message);
    },
  });

  function showDay(current: Diary, next: DayKey): void {
    date = next;
    leave();
    let shown = current;
    leave = showHome(host, { settings: readSettings(current.profile), days: current.days, date, today: env.today(), session }, {
      goTo: (day) => {
        session.flush();
        showDay(shown, day);
      },
      openMenu: () => {
        session.flush();
        log.saveNow();
        pages.open('menu');
      },
      sectionOpen: env.sections.open,
      rememberSection: env.sections.remember,
      edit(change, render) {
        shown = log.edit(shown, date, change);
        diary = shown;
        if (render) showDay(shown, date);
        return shown.days;
      },
      refresh: () => showDay(shown, date),
      toast: (message) => toast.show(message),
    });
  }

  function show(screen: StartScreen): void {
    leave();
    leave = () => {};
    // home is only chosen when there is a diary (startScreen)
    if (screen === 'home' && diary) showDay(diary, date);
    else if (screen === 'install-first') showInstallFirst(host, phoneOf(env.platform), useBrowser);
    else showFirstLaunch(host, env.platform, { copyPrompt, applySettings, restore, startWithoutAi });
    document.documentElement.scrollTop = 0;
  }

  /** Stores the diary and makes it the one shown; false (and a toast) when the phone refuses. */
  function persist(next: Diary): boolean {
    if (!saved(store, next, toast)) return false;
    diary = next;
    env.onDiary(next);
    return true;
  }

  function keep(next: Diary, done?: ToastMessage): void {
    if (!persist(next)) return;
    show('home');
    if (done) toast.show(done);
  }

  function useBrowser(): void {
    browser.choose();
    show('first-launch');
  }
  const copyPrompt = () => toast.show(PROMPT_SOON);
  const applySettings = () => toast.show(PASTE_SOON);
  const startWithoutAi = () => keep(EXAMPLE_DIARY);
  function restore(file: File): void {
    void restoreFrom(file, keep, toast);
  }

  env.whenHidden(() => {
    session.flush();
    log.saveNow();
  });
  if (diary) env.onDiary(diary);
  show(startScreen({ hasDiary: diary !== null, installed: env.installed, platform: env.platform, browserChosen: browser.chosen() }));
}
