import type { DayKey } from '../domain/dates';
import type { ThemeChoice } from '../storage/store';
import { iconSvg } from '../ui/icons';
import { barMarkup, fillBar, wireDateNav, type BarState } from './bar';
import { FOOTER, part } from './parts';

/*
 * screen/menu (Figma 183:3210): `menu/top-bar` with the theme switch,
 * `menu/links`, `menu/backup` (type status), `menu/help-links` (390:9410),
 * the footer and the bar (navigation `menu`: ✕ instead of ≡).
 * Texts: COPY.md «Menu» and «Added 2026-11-08 in Figma».
 */

export interface MenuState extends BarState {
  /** The theme shown now; the switch offers the other one. */
  readonly theme: ThemeChoice;
  readonly backupLine: string;
  /** «давненько не було копії…» */
  readonly remind: boolean;
}

/** What a button in the menu asks for; the app decides what happens. */
export type MenuItem = 'history' | 'settings' | 'search' | 'backup' | 'whats-new' | 'how-to-use' | 'share' | 'feedback';

export interface MenuActions {
  choose(item: MenuItem): void;
  switchTheme(): void;
  close(): void;
  /** Home on that day. */
  goTo(date: DayKey): void;
}

const THEME_SWITCH: Record<ThemeChoice, string> = {
  dark: `<button type="button" class="ctl icon-btn icon-btn--secondary menu__theme" aria-label="світла тема">${iconSvg('sun')}</button>`,
  light: `<button type="button" class="ctl icon-btn icon-btn--secondary menu__theme" aria-label="темна тема">${iconSvg('moon')}</button>`,
};

/** `look`: «btn--primary menu__link» for menu/links, «btn--secondary menu__help» for menu/help-links. */
const item = (look: string, name: MenuItem, label: string) =>
  `<button type="button" class="ctl btn ${look}" data-menu="${name}">${label}</button>`;
const LINK = 'btn--primary menu__link';
const HELP = 'btn--secondary menu__help';

// menu/backup warning: one bold line in place of the status (Olesia, 2026-11-11)
const REMINDER = '<p class="t-2nd-bold" data-backup-reminder>давненько не було копії. збережи, поки все на місці :)</p>';

function markup(state: MenuState): string {
  return `
    <div class="menu">
      <div class="menu__top">${THEME_SWITCH[state.theme]}</div>
      <h1 class="visually-hidden">меню</h1>
      <div class="menu__content">
        <nav class="menu__group menu__group--links" aria-label="розділи">
          ${item(LINK, 'history', 'історія')}
          ${item(LINK, 'settings', 'налаштування')}
          ${item(LINK, 'search', 'пошук у нотатках')}
        </nav>
        <section class="menu__backup" aria-label="копія">
          ${state.remind ? REMINDER : `<p class="t-3rd-regular muted" data-backup-line>${state.backupLine}</p>`}
          <button type="button" class="ctl btn btn--tertiary" data-menu="backup">зберегти копію</button>
        </section>
        <nav class="menu__group menu__group--help" aria-label="допомога">
          ${item(HELP, 'whats-new', 'що нового в застосунку')}
          ${item(HELP, 'how-to-use', 'як користуватись')}
          ${item(HELP, 'share', 'поділитися застосунком')}
          ${item(HELP, 'feedback', 'додати фідбек')}
        </nav>
        ${FOOTER}
      </div>
    </div>
    ${barMarkup('close')}`;
}

/** Shows the menu; returns what to undo when another screen takes its place. */
export function showMenu(host: HTMLElement, state: MenuState, actions: MenuActions): () => void {
  host.innerHTML = markup(state);
  fillBar(host, state);
  // in the menu the date only leads back home on that day: no calendar sheet here
  const date = part<HTMLButtonElement>(host, '.date-nav__date');
  date.removeAttribute('aria-haspopup');
  date.removeAttribute('aria-expanded');
  date.addEventListener('click', () => actions.goTo(state.date));

  part(host, '.menu').addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-menu]');
    if (button) actions.choose(button.dataset.menu as MenuItem);
  });
  part(host, '.menu__theme').addEventListener('click', () => actions.switchTheme());
  part(host, '.bar__menu').addEventListener('click', () => actions.close());

  const listeners = new AbortController();
  wireDateNav(host, state, actions.goTo, listeners.signal);
  return () => listeners.abort();
}
