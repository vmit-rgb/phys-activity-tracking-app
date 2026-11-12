import { formatShort, type DayKey } from '../domain/dates';
import type { SearchHit } from '../domain/journal';
import { esc } from '../ui/html';
import { iconSvg } from '../ui/icons';
import { circleOver, EASE, middleOf, MS, STAGGER_MS, play } from '../ui/motion';
import { part } from './parts';

/*
 * search/panel (Figma 210:4110): the field (search/field 206:3754), then the
 * results (search/result 210:4040) over the bar. The matched word is bold on
 * an accent shade-3 fill (Olesia, 2026-11-03). Texts: COPY.md «Search».
 */

export interface SearchActions {
  find(query: string): SearchHit[];
  /** A result: that day. */
  pick(date: DayKey): void;
  /** The panel is gone (🔍 again or Escape). */
  closed(): void;
}

const PANEL = `
  <div class="search" role="search">
    <div class="search__field">
      ${iconSvg('search')}
      <input class="search__input" type="search" autocomplete="off" enterkeyhint="search" placeholder="пошук у нотатках" aria-label="пошук у нотатках" />
      <button type="button" class="ctl icon-btn icon-btn--secondary search__clear" aria-label="очистити" hidden>${iconSvg('close')}</button>
    </div>
    <div class="search__results" aria-live="polite"></div>
  </div>`;

const hit = ({ date, before, match, after }: SearchHit) => `
  <button type="button" class="ctl search__hit" data-day="${date}">
    <span class="search__date t-h6">${formatShort(date)}</span>
    <span class="search__snippet t-2nd-regular">${esc(before)}<mark>${esc(match)}</mark>${esc(after)}</span>
  </button>`;

function results(query: string, hits: readonly SearchHit[]): string {
  if (!query.trim()) return '';
  if (hits.length === 0) return '<p class="search__none t-h6">нічого не знайшлося :( спробуй інше слово</p>';
  return `<p class="search__count t-3rd-regular muted">знайдено: ${hits.length}</p>${hits.map(hit).join('')}`;
}

/** search/panel opens from 🔍 as a circle (360 ms), as in «бета 0.81». */
function openFromButton(host: HTMLElement, panel: HTMLElement): void {
  const button = host.querySelector('.bar__search');
  if (!button) return;
  const { from, to } = circleOver(panel, middleOf(button), 20);
  play(panel, [{ clipPath: from }, { clipPath: to }], { duration: MS.m, easing: EASE.out });
}

/** Results come in from the left while typing, one by one. */
function slideIn(list: HTMLElement): void {
  [...list.querySelectorAll('.search__hit')].slice(0, 12).forEach((found, i) => {
    play(found, [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], {
      duration: MS.s, delay: i * STAGGER_MS, easing: EASE.out, fill: 'backwards',
    });
  });
}

/** Opens the panel at the end of `host` with the focus in the field; returns how to close it. */
export function openSearch(host: HTMLElement, actions: SearchActions): () => void {
  host.insertAdjacentHTML('beforeend', PANEL);
  const panel = part<HTMLElement>(host, '.search');
  const input = part<HTMLInputElement>(panel, '.search__input');
  const clear = part<HTMLButtonElement>(panel, '.search__clear');
  const list = part<HTMLElement>(panel, '.search__results');

  const show = () => {
    clear.hidden = input.value === '';
    list.innerHTML = results(input.value, actions.find(input.value));
    slideIn(list);
  };
  const close = () => {
    panel.remove();
    actions.closed();
  };

  input.addEventListener('input', show);
  clear.addEventListener('click', () => {
    input.value = '';
    show();
    input.focus();
  });
  list.addEventListener('click', (event) => {
    const found = (event.target as Element).closest<HTMLElement>('[data-day]');
    if (found) actions.pick(found.dataset.day as DayKey);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  input.focus();
  openFromButton(host, panel);
  return close;
}
