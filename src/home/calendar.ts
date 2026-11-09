import { formatLong, type DayKey } from '../domain/dates';
import type { Day } from '../domain/day';
import { formatNumber } from '../domain/numbers';
import {
  averages, dayMarks, lastSevenDays, monthCells, monthName, monthOf, weekStats, type DayMarks, type MonthKey, type WeekStat,
} from '../domain/stats';
import type { Settings } from '../domain/settings';
import { esc } from '../ui/html';
import { iconSvg } from '../ui/icons';

/*
 * The calendar block (Figma `calendar/month` 131:2314, `calendar/stat-card`,
 * `calendar/legend`, `calendar/day` 131:1588), as HTML: on home under the
 * sections and in the sheet from the date (`example/home-calendar-sheet`).
 * No scene next to the month (removed in Figma, Olesia 2026-11-08).
 * Days and arrows say what they do in data-cal; screens/home.ts listens.
 */

export interface CalendarView {
  readonly settings: Settings;
  readonly date: DayKey;
  readonly today: DayKey;
  readonly month: MonthKey;
  readonly dayAt: (key: DayKey) => Day;
  /** Tells the two copies apart (home, sheet) for their heading ids. */
  readonly place: string;
}

/** «з 1 дня», «з 5 днів»: the genitive after «з». */
const days = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'дня' : 'днів');

function statCard({ label, done, target }: WeekStat): string {
  const goal = target > 0 ? ` <span class="stat__goal t-3rd-regular">з ${target} ${days(target)}</span>` : '';
  return `
    <li class="stat">
      <span class="stat__label t-3rd-semibold">${label}</span>
      <span class="stat__value"><b class="t-1st-bold">${done}</b>${goal}</span>
    </li>`;
}

function summary(view: CalendarView): string {
  const stats = weekStats(view.date, view.today, view.dayAt, view.settings);
  const rows = averages(lastSevenDays(view.date, view.today), view.dayAt, view.settings);
  const week = stats.length ? `<h3 class="t-h5">цей тиждень</h3><ul class="stats" role="list">${stats.map(statCard).join('')}</ul>` : '';
  const average = rows.length ? `<h3 class="t-h5">середнє за 7 днів</h3><ul class="avgs" role="list">${rows.map((row) => `
      <li class="avg"><span class="avg__label t-3rd-semibold">${esc(row.label)}</span> <b class="t-1st-bold">${formatNumber(row.value)}</b></li>`).join('')}</ul>` : '';
  return week + average;
}

function legend(settings: Settings): string {
  const levels = settings.morningWarmup.enabled ? Math.min(3, settings.morningWarmup.levels.length) : 0;
  const items = [
    ...Array.from({ length: levels }, (_, i) => `<li><span class="swatch swatch--lv${i + 1}" aria-hidden="true"></span>рівень ${i + 1}</li>`),
    ...(settings.workout.enabled ? ['<li><span class="marker marker--workout" aria-hidden="true"></span>тренування</li>'] : []),
    ...(settings.movement.enabled ? ['<li><span class="marker marker--movement" aria-hidden="true"></span>рух</li>'] : []),
  ];
  return `<ul class="legend t-3rd-regular" role="list" aria-label="позначки">${items.join('')}</ul>`;
}

function dayLabel(key: DayKey, marks: DayMarks): string {
  return [formatLong(key), ...(marks.level ? [`розминка рівень ${marks.level}`] : []), ...(marks.workout ? ['тренування'] : []), ...(marks.movement ? ['рух'] : [])].join(', ');
}

function dayCell(view: CalendarView, key: DayKey, inMonth: boolean): string {
  const number = String(Number(key.slice(8)));
  if (!inMonth) return `<span class="cal-day cal-day--out" aria-hidden="true">${number}</span>`;
  if (key > view.today) return `<span class="cal-day cal-day--future" aria-hidden="true">${number}</span>`;
  const marks = dayMarks(view.dayAt(key), view.settings);
  const classes = [
    'cal-day',
    ...(marks.level ? [`cal-day--lv${marks.level}`] : []),
    ...(marks.workout ? ['cal-day--workout'] : []),
    ...(marks.movement ? ['cal-day--movement'] : []),
    ...(key === view.today ? ['cal-day--today'] : []),
    ...(key === view.date ? ['cal-day--shown'] : []),
  ];
  return `<button type="button" class="ctl ${classes.join(' ')}" data-cal="day" data-day="${key}" aria-label="${dayLabel(key, marks)}"${
    key === view.date ? ' aria-current="date"' : ''}>${number}</button>`;
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

function month(view: CalendarView): string {
  const heading = `cal-${view.place}-month`;
  const cells = monthCells(view.month).map(({ key, inMonth }) => dayCell(view, key, inMonth)).join('');
  const last = view.month >= monthOf(view.today);
  return `
    <h3 class="t-h5 cal__month" id="${heading}">${monthName(view.month, view.today)}</h3>
    <div class="cal">
      <div class="cal__info">${legend(view.settings)}</div>
      <div class="cal__body">
        <div class="cal__weekdays t-3rd-semibold" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
        <div class="cal__grid" role="group" aria-labelledby="${heading}">${cells}</div>
        <div class="cal__nav">
          <button type="button" class="ctl icon-btn icon-btn--secondary" data-cal="month" data-by="-1" aria-label="попередній місяць">${iconSvg('chevron-left')}</button>
          <button type="button" class="ctl icon-btn icon-btn--secondary" data-cal="month" data-by="1" aria-label="наступний місяць"${last ? ' disabled' : ''}>${iconSvg('chevron-right')}</button>
        </div>
      </div>
    </div>`;
}

/** The whole block: this week, the averages, the month. */
export function calendarMarkup(view: CalendarView): string {
  return summary(view) + month(view);
}
