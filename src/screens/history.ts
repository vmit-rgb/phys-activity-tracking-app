import { formatLong, type DayKey } from '../domain/dates';
import { emptyDay, hasData, type Day } from '../domain/day';
import type { Diary } from '../domain/diary';
import { dayBlocks, dayMeta, monthDays, monthSummary, searchNotes, type DayBlock, type ValueRow } from '../domain/journal';
import { weekGoal } from '../domain/progress';
import type { Settings } from '../domain/settings';
import { averages, monthCells, monthOf, shiftMonth, type MonthKey } from '../domain/stats';
import { averagesList, calendarMarkup } from '../home/calendar';
import { goalLine } from '../home/home-view';
import { wireAccordions } from '../ui/accordion';
import { esc } from '../ui/html';
import { iconSvg } from '../ui/icons';
import type { ToastMessage } from '../ui/toast';
import { pagesBarMarkup, TO_TOP, wirePagesBar, wireScroll } from './bar';
import { FOOTER, part } from './parts';
import { openSearch } from './search';

/*
 * «історія» (Figma screen/log-history 165:2758): the week line and the month
 * line (history/period-summary 233:4769), the calendar block as on home, the
 * month's averages (history/period-averages 234:4881), the day cards
 * (history/day-card 234:4872), the footer and the bar ≡ 🔍 ✕. 🔍 opens the
 * search panel over the bar. Behaviour as in «бета 0.81»; texts: COPY.md «History».
 */

export interface HistoryState {
  readonly settings: Settings;
  readonly days: Diary['days'];
  readonly today: DayKey;
  /** The day home shows: its week and month open first. */
  readonly date: DayKey;
  /** Open with the search panel (menu → «пошук у нотатках», 🔍 on other pages). */
  readonly search: boolean;
}

export interface HistoryActions {
  menu(): void;
  close(): void;
  /** Home on that day. */
  goTo(date: DayKey): void;
  toast(message: ToastMessage): void;
}

/* «бета 0.81»'s words for a calendar day with nothing in it. */
const NO_RECORDS: ToastMessage = { message: 'за цей день записів немає' };

/* ---- one day card ---- */

function valueRow({ label, value, unit, text }: ValueRow): string {
  return `
      <li class="value-row${text ? ' value-row--text' : ''}"><span class="value-row__label t-2nd-regular">${esc(label)}</span><span class="muted" aria-hidden="true">·</span>${
  text ? `<span class="value-row__text t-2nd-regular">${esc(value)}</span>` : `<b class="value-row__value t-1st-bold">${esc(value)}</b>`
}${unit ? `<span class="value-row__unit t-3rd-regular muted">${esc(unit)}</span>` : ''}</li>`;
}

function blockBody(block: DayBlock): string {
  if (block.kind === 'text') return `<p class="day-block__text t-2nd-regular">${esc(block.text)}</p>`;
  if (block.kind === 'values') return `<ul class="day-block__rows" role="list">${block.rows.map(valueRow).join('')}</ul>`;
  return block.groups.map((group) => `
      <p class="day-block__group t-2nd-bold">${esc(group.title)}</p>
      <ul class="day-block__checks" role="list">${group.items.map(({ name, times }) => `
        <li class="day-check t-1st-semibold"><span class="checkbox__box day-check__box" aria-hidden="true"></span><span>${esc(name)}${
  times ? ` <span class="t-3rd-regular muted">· ${esc(times)}</span>` : ''}</span></li>`).join('')}</ul>`).join('');
}

const block = (item: DayBlock) => `
    <section class="day-block">
      <h3 class="day-block__title t-h6">${esc(item.title)}</h3>
      ${blockBody(item)}
    </section>`;

function card(day: Day, open: boolean, state: HistoryState): string {
  const id = `card-${day.date}`;
  return `
  <article class="day-card" id="${id}">
    <h2 class="day-card__heading">
      <button type="button" class="ctl accordion accordion--group day-card__trigger" data-card="${day.date}" aria-expanded="${open}" aria-controls="${id}-body">
        <span class="accordion__title">${formatLong(day.date)}</span><span class="accordion__icon">${iconSvg(open ? 'remove' : 'add')}</span>
        <span class="accordion__meta">${esc(dayMeta(day, state.settings))}</span>
      </button>
    </h2>
    <div class="day-card__body" id="${id}-body"${open ? '' : ' hidden'}>
      ${dayBlocks(day, state.days, state.settings).map(block).join('')}
      <button type="button" class="ctl btn btn--tertiary day-card__edit" data-edit="${day.date}">редагувати цей день</button>
    </div>
  </article>`;
}

/* ---- the screen ---- */

interface View {
  date: DayKey;
  month: MonthKey;
  open: Set<DayKey>;
}

/** The first card of a month is open (0.81). */
const firstOpen = (state: HistoryState, month: MonthKey) => new Set(monthDays(state.days, month, state.today).slice(0, 1));

function content(state: HistoryState, view: View): string {
  const dayAt = (key: DayKey): Day => state.days[key] ?? emptyDay(key);
  const goal = goalLine(weekGoal(view.date, state.today, dayAt, state.settings));
  const summary = monthSummary(view.month, state.today, Object.values(state.days), state.settings);
  const monthKeys = monthCells(view.month).filter((cell) => cell.inMonth && cell.key <= state.today).map((cell) => cell.key);
  const rows = averages(monthKeys, dayAt, state.settings);
  const keys = monthDays(state.days, view.month, state.today);
  const calendar = calendarMarkup({ settings: state.settings, date: view.date, today: state.today, month: view.month, dayAt, place: 'history' });
  return `
    <section class="screen__section history__period" aria-label="період">
      <div class="history__lines">
        ${goal === null ? '' : `<p class="history__goal t-3rd-bold">${goal}</p>`}
        ${summary === null ? '' : `<p class="history__summary t-3rd-regular">${summary}</p>`}
      </div>
    </section>
    <section class="cal-block" data-place="history" aria-label="календар">${calendar}</section>
    <section class="screen__section history__averages" aria-labelledby="history-averages">
      <h2 class="t-h4" id="history-averages">середнє за період</h2>
      <p class="t-3rd-regular muted">за місяць, який відкрито в календарі</p>
      ${rows.length ? averagesList(rows) : '<p class="t-2nd-regular muted">ще немає значень за цей місяць</p>'}
    </section>
    <section class="history__days" aria-label="дні">
      ${keys.length
    ? keys.map((key) => card(dayAt(key), view.open.has(key), state)).join('')
    : '<p class="history__empty t-2nd-regular muted">цього місяця записів немає. зате попереду ще купа днів :3</p>'}
    </section>`;
}

/** Shows the history; returns what to undo when another screen takes its place. */
export function showHistory(host: HTMLElement, state: HistoryState, actions: HistoryActions): () => void {
  const view: View = { date: state.date, month: monthOf(state.date), open: firstOpen(state, monthOf(state.date)) };
  host.innerHTML = `
    <div class="screen page history">
      <section class="screen__section" aria-labelledby="page-title">
        <h1 id="page-title" class="t-h3">історія</h1>
      </section>
      <div class="history__content"></div>
      ${FOOTER}
    </div>
    ${pagesBarMarkup(false)}${TO_TOP}`;
  const root = part<HTMLElement>(host, '.history__content');
  const render = () => {
    root.innerHTML = content(state, view);
  };
  const focus = (selector: string) => root.querySelector<HTMLElement>(selector)!.focus({ preventScroll: true });

  function showDay(date: DayKey): void {
    view.date = date;
    if (!hasData(state.days[date] ?? emptyDay(date))) {
      render();
      focus(`[data-cal="day"][data-day="${date}"]`);
      actions.toast(NO_RECORDS);
      return;
    }
    view.open.add(date);
    render();
    focus(`[data-card="${date}"]`);
    root.querySelector(`#card-${date}`)!.scrollIntoView?.({ block: 'start' });
  }

  function showMonth(by: string): void {
    view.month = shiftMonth(view.month, Number(by));
    view.open = firstOpen(state, view.month);
    render();
    focus(`[data-cal="month"][data-by="${by}"]`);
  }

  root.addEventListener('click', onTap(actions.goTo, showDay, showMonth));
  wireAccordions(root, (trigger, open) => {
    const date = trigger.dataset.card as DayKey;
    if (open) view.open.add(date);
    else view.open.delete(date);
  });

  const search = searchSwitch(host, state, actions.goTo);
  wirePagesBar(host, { menu: actions.menu, close: actions.close, search: search.toggle });

  const listeners = new AbortController();
  wireScroll(host, listeners.signal, search.isOpen);
  render();
  if (state.search) search.toggle();
  return () => listeners.abort();
}

/** Days and arrows of the calendar, «редагувати цей день». */
function onTap(edit: (date: DayKey) => void, day: (date: DayKey) => void, month: (by: string) => void) {
  return (event: Event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-cal], [data-edit]');
    if (!target) return;
    if (target.dataset.edit) edit(target.dataset.edit as DayKey);
    else if (target.dataset.cal === 'day') day(target.dataset.day as DayKey);
    else month(String(target.dataset.by));
  };
}

/** search/panel over the bar: 🔍 opens and closes it and shows which it is. */
function searchSwitch(host: HTMLElement, state: HistoryState, pick: (date: DayKey) => void) {
  const button = part<HTMLButtonElement>(host, '.bar__search');
  let close: (() => void) | null = null;
  const closed = () => {
    close = null;
    button.setAttribute('aria-pressed', 'false');
    button.focus();
  };
  return {
    isOpen: () => close !== null,
    toggle(): void {
      if (close) {
        close();
        return;
      }
      button.setAttribute('aria-pressed', 'true');
      close = openSearch(host, { find: (query) => searchNotes(state.days, state.settings, query), pick, closed });
    },
  };
}
