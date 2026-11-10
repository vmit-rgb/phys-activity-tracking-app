import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/typography.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/home.css';
import './styles/sections.css';
import './styles/calendar.css';
import './styles/menu.css';
import { startApp } from './app/app';
import { detectPlatform, isInstalled } from './app/start';
import { diaryAccent } from './domain/diary';
import { dayKeyOf } from './domain/dates';
import { backupMemory, browserChoice, diaryStore, sectionMemory, storageFor, themeMemory } from './storage/store';
import { DEFAULT_APPEARANCE, startAppearance, type Appearance } from './ui/appearance';
import { trackInputModality } from './ui/modality';
import { watchForUpdates } from './pwa/updates';
import { mountToast } from './ui/toast';
import { copyWith, saveFile, screenHistory, shareWith } from './ui/device';

// Wiring only: everything with a decision in it lives in the modules above.
const root = document.documentElement;
const installed = isInstalled((query) => matchMedia(query), navigator as { standalone?: boolean });
const storage = storageFor(installed, { local: localStorage, session: sessionStorage });
const themes = themeMemory(storage);
let accent = DEFAULT_APPEARANCE.accent;
const appearance = (): Appearance => ({ ...DEFAULT_APPEARANCE, accent, theme: themes.chosen() ?? 'system' });
const applyAppearance = startAppearance(root, matchMedia('(prefers-color-scheme: light)'), appearance());
trackInputModality(root);

const toast = mountToast(document.body);
startApp({
  host: document.querySelector<HTMLElement>('#app')!,
  store: diaryStore(storage, () => new Date()),
  browser: browserChoice(storage),
  platform: detectPlatform(navigator),
  installed,
  toast,
  today: () => dayKeyOf(new Date()),
  sections: sectionMemory(storage),
  onDiary: (diary) => {
    accent = diaryAccent(diary);
    applyAppearance(appearance());
    // ask the browser not to clear the diary when space runs low (a tab keeps nothing anyway)
    if (installed) void navigator.storage?.persist?.();
  },
  whenHidden: (save) => {
    addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });
  },
  theme: {
    shown: () => (root.dataset.theme === 'light' ? 'light' : 'dark'),
    choose(theme) {
      themes.choose(theme);
      applyAppearance(appearance());
    },
  },
  backups: backupMemory(storage),
  saveFile: (name, text) => saveFile(document, name, text),
  share: (data) => shareWith(navigator, data),
  copyText: (text) => copyWith(navigator.clipboard, text),
  now: () => new Date(),
  history: screenHistory(history, window),
});

// offline copy and «є нова версія :)»; only in the built app, never in development
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void watchForUpdates(navigator.serviceWorker, import.meta.env.BASE_URL, {
    offer: (apply) => toast.show({ message: 'є нова версія', emoticon: ':)', action: { label: 'оновити', run: apply } }),
    reload: () => location.reload(),
    onReturn: (check) => document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    }),
  }).catch(() => {
    // no offline copy (e.g. a private window): the app still works online
  });
}
