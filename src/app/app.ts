import { parseDiary, type Diary } from '../domain/diary';
import { EXAMPLE_DIARY } from '../domain/examples';
import { showFirstLaunch } from '../screens/first-launch';
import { showHomePlaceholder } from '../screens/home-placeholder';
import { showInstallFirst } from '../screens/install-first';
import type { DiaryStore } from '../storage/store';
import type { Toast, ToastMessage } from '../ui/toast';
import { startScreen, type Platform, type StartScreen } from './start';

export interface AppEnv {
  host: HTMLElement;
  store: DiaryStore;
  browser: { chosen(): boolean; choose(): void };
  platform: Platform;
  installed: boolean;
  toast: Toast;
  /** Called with every diary the app starts showing, e.g. to apply its accent. */
  onDiary(diary: Diary): void;
}

/* Texts: COPY.md; «скоро» toasts as on the landing page (Olesia, 2026-11-09). */
const PROMPT_SOON: ToastMessage = { message: 'промпт ще пишемо, скоро буде', emoticon: ':)' };
const PASTE_SOON: ToastMessage = { message: 'вставку налаштувань від ШІ ще робимо, скоро буде', emoticon: ':)' };
const NOT_A_COPY: ToastMessage = { message: 'цей файл не схожий на копію з трекера', emoticon: '>_<' };
const RESTORED: ToastMessage = { message: 'відновлено з файлу', emoticon: ':)', showIcon: true };
const NOT_SAVED: ToastMessage = { message: 'не вдалося зберегти: схоже, на телефоні забракло місця', emoticon: '>_<' };

export function startApp(env: AppEnv): void {
  const { host, store, browser, toast } = env;

  function show(screen: StartScreen): void {
    if (screen === 'home') showHomePlaceholder(host);
    else if (screen === 'install-first') showInstallFirst(host, env.platform === 'iphone' ? 'iphone' : 'android', useBrowser);
    else showFirstLaunch(host, env.platform, { copyPrompt, applySettings, restore, startWithoutAi });
    document.documentElement.scrollTop = 0;
  }

  function keep(diary: Diary, done?: ToastMessage): void {
    try {
      store.save(diary);
    } catch {
      toast.show(NOT_SAVED);
      return;
    }
    env.onDiary(diary);
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
      const diary = parseDiary(text);
      if (diary) keep(diary, RESTORED);
      else toast.show(NOT_A_COPY);
    }, () => toast.show(NOT_A_COPY));
  }

  const diary = store.load();
  if (diary) env.onDiary(diary);
  show(startScreen({ hasDiary: diary !== null, installed: env.installed, platform: env.platform, browserChosen: browser.chosen() }));
}
