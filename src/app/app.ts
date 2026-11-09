import type { DayKey } from '../domain/dates';
import { parseDiary, type Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { readSettings } from '../domain/settings';
import { showFirstLaunch } from '../screens/first-launch';
import { showHome } from '../screens/home';
import { showInstallFirst } from '../screens/install-first';
import type { DiaryStore, sectionMemory } from '../storage/store';
import type { Toast, ToastMessage } from '../ui/toast';
import { startScreen, type Platform, type StartScreen } from './start';

export interface AppEnv {
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
}

/* Texts: COPY.md; «скоро» toasts as on the landing page (Olesia, 2026-11-09). */
const PROMPT_SOON: ToastMessage = { message: 'промпт ще пишемо, скоро буде', emoticon: ':)' };
const PASTE_SOON: ToastMessage = { message: 'вставку налаштувань від ШІ ще робимо, скоро буде', emoticon: ':)' };
const NOT_A_COPY: ToastMessage = { message: 'цей файл не схожий на копію з трекера', emoticon: '>_<' };
const RESTORED: ToastMessage = { message: 'відновлено з файлу', emoticon: ':)', showIcon: true };
const NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти: схоже, на телефоні забракло місця', emoticon: '>_<' };
/* Нитка's draft: the menu comes in stage 6. */
const MENU_SOON: ToastMessage = { message: 'меню ще робимо, скоро буде', emoticon: ':)' };

export function startApp(env: AppEnv): void {
  const { host, store, browser, toast } = env;
  let diary = store.load();
  let date = env.today();
  let leave = () => {};

  function showDay(current: Diary, next: DayKey): void {
    date = next;
    leave();
    leave = showHome(host, { settings: readSettings(current.profile), days: current.days, date, today: env.today() }, {
      goTo: (day) => showDay(current, day),
      openMenu: () => toast.show(MENU_SOON),
      sectionOpen: env.sections.open,
      rememberSection: env.sections.remember,
    });
  }

  function show(screen: StartScreen): void {
    leave();
    leave = () => {};
    // home is only chosen when there is a diary (startScreen)
    if (screen === 'home' && diary) showDay(diary, date);
    else if (screen === 'install-first') showInstallFirst(host, env.platform === 'iphone' ? 'iphone' : 'android', useBrowser);
    else showFirstLaunch(host, env.platform, { copyPrompt, applySettings, restore, startWithoutAi });
    document.documentElement.scrollTop = 0;
  }

  function keep(next: Diary, done?: ToastMessage): void {
    try {
      store.save(next);
    } catch {
      toast.show(NOT_SAVED);
      return;
    }
    diary = next;
    env.onDiary(next);
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
    void file.text().then((text) => {
      const restored = parseDiary(text);
      if (restored) keep(restored, RESTORED);
      else toast.show(NOT_A_COPY);
    }, () => toast.show(NOT_A_COPY));
  }

  if (diary) env.onDiary(diary);
  show(startScreen({ hasDiary: diary !== null, installed: env.installed, platform: env.platform, browserChosen: browser.chosen() }));
}
