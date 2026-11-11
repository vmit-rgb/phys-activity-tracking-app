import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/home.css';
import './styles/sections.css';
import './styles/calendar.css';
import './styles/menu.css';
import './styles/history.css';
import './styles/settings.css';
// last: a text style class (t-*) wins over any earlier font rule of the same weight (VISUAL-AUDIT Н2)
import './styles/typography.css';
import { startApp } from './app/app';
import { detectPlatform, isInstalled } from './app/start';
import { dayKeyOf } from './domain/dates';
import { backupMemory, browserChoice, diaryStore, sectionMemory, storageFor, themeMemory } from './storage/store';
import { DEFAULT_APPEARANCE, lookOf, startAppearance, type Appearance } from './ui/appearance';
import { trackNumberFill } from './ui/number-fill';
import { watchForUpdates } from './pwa/updates';
import { mountToast } from './ui/toast';
import { copyWith, saveFile, screenHistory, shareWith } from './ui/device';
import type { PdfFonts } from './pdf/pdf';

// Wiring only: everything with a decision in it lives in the modules above.
const root = document.documentElement;
const installed = isInstalled((query) => matchMedia(query), navigator as { standalone?: boolean });
const storage = storageFor(installed, { local: localStorage, session: sessionStorage });
const themes = themeMemory(storage);
let look: Omit<Appearance, 'theme'> = DEFAULT_APPEARANCE;
const appearance = (): Appearance => ({ ...look, theme: themes.chosen() ?? 'system' });
const applyAppearance = startAppearance(root, matchMedia('(prefers-color-scheme: light)'), appearance());
trackNumberFill(root);

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
    look = lookOf(diary.profile);
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
  look(profile) {
    look = lookOf(profile);
    applyAppearance(appearance());
  },
  motionReduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  backups: backupMemory(storage),
  saveFile: (name, content) => saveFile(document, name, content),
  // a separate file, loaded with the first PDF (and kept offline with the rest)
  pdfFonts: async () => (await import('./pdf/noto-sans-mono-pdf.json')).default as PdfFonts,
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
