import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/typography.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/home.css';
import { startApp } from './app/app';
import { detectPlatform, isInstalled } from './app/start';
import { diaryAccent } from './domain/diary';
import { dayKeyOf } from './domain/dates';
import { browserChoice, diaryStore, sectionMemory } from './storage/store';
import { DEFAULT_APPEARANCE, startAppearance } from './ui/appearance';
import { trackInputModality } from './ui/modality';
import { watchForUpdates } from './pwa/updates';
import { mountToast } from './ui/toast';

// Wiring only: everything with a decision in it lives in the modules above.
const root = document.documentElement;
const applyAppearance = startAppearance(root, matchMedia('(prefers-color-scheme: light)'), DEFAULT_APPEARANCE);
trackInputModality(root);

const toast = mountToast(document.body);
startApp({
  host: document.querySelector<HTMLElement>('#app')!,
  store: diaryStore(localStorage, () => new Date()),
  browser: browserChoice(localStorage),
  platform: detectPlatform(navigator),
  installed: isInstalled((query) => matchMedia(query), navigator as { standalone?: boolean }),
  toast,
  today: () => dayKeyOf(new Date()),
  sections: sectionMemory(localStorage),
  onDiary: (diary) => {
    applyAppearance({ ...DEFAULT_APPEARANCE, accent: diaryAccent(diary) });
    // ask the browser not to clear the diary when space runs low
    void navigator.storage?.persist?.();
  },
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
