import { addDays, formatLong, formatShort, type DayKey } from '../domain/dates';
import { emptyDay, type Day } from '../domain/day';
import type { Diary } from '../domain/diary';
import { weekGoal } from '../domain/progress';
import type { Settings } from '../domain/settings';
import { swipeDays, type Point } from '../home/gestures';
import { goalLine } from '../home/home-view';
import { iconSvg } from '../ui/icons';
import { part } from './parts';

/*
 * The bottom bar (Figma `navigation` 189:6748): ≡ on home, ✕ in the menu
 * (variants `home` and `menu`); the week line and the date with its arrows
 * on the right in both.
 */

export interface BarState {
  readonly settings: Settings;
  readonly days: Diary['days'];
  readonly date: DayKey;
  readonly today: DayKey;
}

const LEFT = {
  menu: `<button type="button" class="ctl icon-btn icon-btn--secondary bar__menu" aria-label="меню">${iconSvg('menu')}</button>`,
  close: `<button type="button" class="ctl icon-btn icon-btn--secondary bar__menu" aria-label="закрити меню">${iconSvg('close')}</button>`,
};

export function barMarkup(left: keyof typeof LEFT): string {
  return `
  <nav class="bar" aria-label="навігація">
    ${LEFT[left]}
    <div class="bar__right">
      <p class="bar__goal t-3rd-semibold" aria-live="polite"></p>
      <div class="date-nav">
        <button type="button" class="ctl icon-btn icon-btn--secondary date-nav__step" data-step="-1" aria-label="попередній день">${iconSvg('chevron-left')}</button>
        <button type="button" class="ctl date-nav__date" aria-live="polite" aria-haspopup="dialog" aria-expanded="false"><span aria-hidden="true"></span><span class="visually-hidden"></span></button>
        <button type="button" class="ctl icon-btn icon-btn--secondary date-nav__step" data-step="1" aria-label="наступний день">${iconSvg('chevron-right')}</button>
      </div>
    </div>
  </nav>`;
}

export function fillBar(host: HTMLElement, state: BarState): void {
  const dayAt = (key: DayKey): Day => state.days[key] ?? emptyDay(key);
  const goal = goalLine(weekGoal(state.date, state.today, dayAt, state.settings));
  const goalText = part<HTMLElement>(host, '.bar__goal');
  goalText.textContent = goal ?? '';
  goalText.hidden = goal === null;
  const date = part<HTMLElement>(host, '.date-nav__date');
  // without the goal line the date takes header 4 (Olesia, 2026-10-29)
  date.className = `ctl date-nav__date ${goal === null ? 't-h4' : 't-h5'}`;
  date.firstElementChild!.textContent = formatShort(state.date);
  date.lastElementChild!.textContent = formatLong(state.date);
  part<HTMLButtonElement>(host, '.date-nav [data-step="1"]').disabled = state.date >= state.today;
}

/** Arrows and a swipe on the date go to the day before or after, never past today. */
export function wireDateNav(host: HTMLElement, state: BarState, go: (date: DayKey) => void, signal: AbortSignal): void {
  const step = (days: number) => {
    const next = addDays(state.date, days);
    if (days !== 0 && next <= state.today) go(next);
  };
  for (const button of host.querySelectorAll<HTMLButtonElement>('.date-nav__step')) {
    button.addEventListener('click', () => step(Number(button.dataset.step)));
  }
  const dateNav = part<HTMLElement>(host, '.date-nav');
  let start: Point | null = null;
  dateNav.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    start = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true, signal });
  dateNav.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    if (start && touch) step(swipeDays(start, { x: touch.clientX, y: touch.clientY }));
    start = null;
  }, { passive: true, signal });
}
