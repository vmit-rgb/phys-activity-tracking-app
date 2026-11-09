import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/typography.css';
import './styles/components.css';
import './styles/screens.css';
import { startApp } from './app/app';
import { detectPlatform, isInstalled } from './app/start';
import { diaryAccent } from './domain/diary';
import { browserChoice, diaryStore } from './storage/store';
import { DEFAULT_APPEARANCE, startAppearance } from './ui/appearance';
import { trackInputModality } from './ui/modality';
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
  onDiary: (diary) => {
    applyAppearance({ ...DEFAULT_APPEARANCE, accent: diaryAccent(diary) });
    // ask the browser not to clear the diary when space runs low
    void navigator.storage?.persist?.();
  },
});
