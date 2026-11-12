import type { DayKey } from '../domain/dates';
import { emptyDay, type Day } from '../domain/day';
import type { Diary } from '../domain/diary';
import type { Edit } from '../domain/log';
import type { Settings } from '../domain/settings';
import { flushDrafts, wireSections, type SectionControls } from '../home/controls';
import { HERO_STYLES, heroStyle, type HeroStyle } from '../home/hero-fit';
import { dayArrives } from '../home/home-motion';
import { heroFor, homeSections, type SectionId, type SectionSpec } from '../home/home-view';
import {
  checkInBody, daytimeBody, morningBody, movementBody, noteBody, workoutBody, type SectionContext,
} from '../home/sections';
import { formatCountdown, formatStopwatch, type HomeSession } from '../home/session';
import { calendarMarkup, type CalendarView } from '../home/calendar';
import { endSignal } from '../home/signal';
import { monthOf, shiftMonth } from '../domain/stats';
import { wireAccordions } from '../ui/accordion';
import type { ToastMessage } from '../ui/toast';
import { barMarkup, fillBar, TO_TOP, wireDateNav, wireScroll } from './bar';
import { FOOTER, part } from './parts';

/*
 * Home (Figma `screen/home-default` 73:2601 open, 338:16522 closed;
 * `navigation` 189:6897; `button/to-top` 288:10620). Stage 5a: the frame of
 * the screen; 5b: the inside of the sections (home/sections.ts, home/controls.ts);
 * the calendar comes in 5c.
 * The ASCII scene behind the phrase comes in stage 7 (Olesia, 2026-11-09).
 * Texts from the settings are set as text, never as HTML.
 */

export interface HomeState {
  readonly settings: Settings;
  readonly days: Diary['days'];
  readonly date: DayKey;
  readonly today: DayKey;
  readonly session: HomeSession;
  /** The day shown before, when home is drawn for another day: the motion comes from its side. */
  readonly cameFrom?: DayKey;
}

export interface HomeActions {
  goTo(date: DayKey): void;
  openMenu(): void;
  /** Whether a section is open; open unless the person closed it. */
  sectionOpen(id: string): boolean;
  rememberSection(id: string, open: boolean): void;
  /** Applies an edit to the day shown and keeps it; `render` shows home again. Returns the days after it. */
  edit(edit: Edit, render: boolean): Diary['days'];
  /** Shows home again without changing anything. */
  refresh(): void;
  toast(message: ToastMessage): void;
}

const BODIES: Record<SectionId, (ctx: SectionContext) => string> = {
  'ck-morning': (ctx) => checkInBody(ctx, 'morning'),
  mw: morningBody,
  dw: daytimeBody,
  wo: workoutBody,
  mv: movementBody,
  'ck-evening': (ctx) => checkInBody(ctx, 'evening'),
  note: noteBody,
};

function sectionMarkup({ id, title, description }: SectionSpec, open: boolean, ctx: SectionContext): string {
  return `
    <section class="home-section" aria-labelledby="sec-${id}-title">
      <h2 class="home-section__heading">
        <button type="button" class="ctl accordion accordion--section" id="sec-${id}-title" data-section="${id}"
          aria-expanded="${open}" aria-controls="sec-${id}"><span class="accordion__title">${title}</span></button>
      </h2>
      <p class="home-section__hint t-3rd-regular" aria-hidden="true">${description}</p>
      <div class="home-section__body" id="sec-${id}"${open ? '' : ' hidden'}>
        <p class="t-1st-regular">${description}</p>
        ${BODIES[id](ctx)}
      </div>
    </section>`;
}

function markup(state: HomeState, actions: HomeActions): string {
  const ctx: SectionContext = { settings: state.settings, day: dayOf(state), days: state.days, session: state.session };
  const sections = homeSections(state.settings).map((section) => sectionMarkup(section, actions.sectionOpen(section.id), ctx));
  return `
    <div class="home">
      <h1 class="visually-hidden">головна</h1>
      <header class="hero"><p class="hero__text"></p></header>
      <div class="home__sections">${sections.join('')}</div>
      <section class="cal-block" aria-label="календар">${calendarMarkup(calendarView(state, 'home'))}</section>
      ${FOOTER}
    </div>
    ${barMarkup('menu')}${TO_TOP}`;
}

/** Lines a phrase takes in a style, measured on a hidden copy of the same width. */
function measure(text: HTMLElement): (style: HeroStyle) => number {
  return (style) => {
    const probe = text.cloneNode(true) as HTMLElement;
    probe.className = `hero__text ${style}`;
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;right:0';
    text.parentElement!.append(probe);
    const lines = probe.getBoundingClientRect().height / parseFloat(getComputedStyle(probe).lineHeight);
    probe.remove();
    // no layout (e.g. a hidden tab) measures nothing: keep header 1
    return Number.isFinite(lines) ? Math.round(lines) : 0;
  };
}

function fillHero(host: HTMLElement, state: HomeState): () => void {
  const text = part<HTMLElement>(host, '.hero__text');
  const hero = heroFor(state.date, state.today, state.settings);
  text.textContent = hero.text;
  if (hero.kind === 'past') {
    // the date in bold, as example/home-past-day; built from text nodes, never HTML
    const [before, after] = hero.text.split(hero.bold) as [string, string];
    const date = document.createElement('b');
    date.textContent = hero.bold;
    text.replaceChildren(before, date, after);
    text.className = 'hero__text hero__text--past t-h6';
    return () => {};
  }
  return () => {
    text.classList.remove(...HERO_STYLES);
    text.classList.add(heroStyle(measure(text)));
  };
}

const dayOf = (state: HomeState): Day => state.days[state.date] ?? emptyDay(state.date);

function calendarView(state: HomeState, place: string): CalendarView {
  return {
    settings: state.settings,
    date: state.date,
    today: state.today,
    month: state.session.month ?? monthOf(state.date),
    dayAt: (key) => state.days[key] ?? emptyDay(key),
    place,
  };
}

/* ---- the calendar: on home and in the sheet from the date (Figma example/home-calendar-sheet) ---- */

interface Calendar {
  /** Draws the block on home again, e.g. after typing changed the week. */
  refresh(state: HomeState): void;
  closeSheet(): void;
}

function wireCalendar(host: HTMLElement, state: HomeState, go: (date: DayKey) => void, signal: AbortSignal): Calendar {
  let current = state;
  const dateButton = part<HTMLButtonElement>(host, '.date-nav__date');
  const sheet = () => host.querySelector<HTMLElement>('.cal-sheet');

  function closeSheet(): void {
    if (!sheet()) return;
    sheet()!.remove();
    dateButton.setAttribute('aria-expanded', 'false');
    dateButton.focus({ preventScroll: true });
  }

  /** Days open that day; arrows change the month in place and keep the focus. */
  function onTap(event: Event): void {
    const button = (event.target as Element).closest<HTMLElement>('[data-cal]');
    if (!button) return;
    if (button.dataset.cal === 'day') {
      closeSheet();
      go(String(button.dataset.day) as DayKey);
      return;
    }
    const container = button.closest<HTMLElement>('.cal-block')!;
    const by = String(button.dataset.by);
    state.session.month = shiftMonth(calendarView(current, '').month, Number(by));
    container.innerHTML = calendarMarkup(calendarView(current, container.dataset.place ?? 'home'));
    container.querySelector<HTMLElement>(`[data-cal="month"][data-by="${by}"]`)!.focus();
  }

  function openSheet(): void {
    host.insertAdjacentHTML('beforeend', `
      <div class="cal-sheet" role="dialog" aria-modal="true" aria-label="календар">
        <div class="cal-sheet__scrim"></div>
        <div class="cal-sheet__panel"><div class="cal-block" data-place="sheet">${calendarMarkup(calendarView(current, 'sheet'))}</div></div>
      </div>`);
    const opened = sheet()!;
    dateButton.setAttribute('aria-expanded', 'true');
    part(host, '.bar').classList.remove('bar--hidden');
    opened.addEventListener('click', onTap);
    part(opened, '.cal-sheet__scrim').addEventListener('click', closeSheet);
    opened.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSheet();
    });
    (opened.querySelector<HTMLElement>('[aria-current="date"]') ?? opened.querySelector<HTMLElement>('button'))!.focus({ preventScroll: true });
  }

  part(host, '.home .cal-block').addEventListener('click', onTap);
  dateButton.addEventListener('click', () => (sheet() ? closeSheet() : openSheet()), { signal });
  return {
    refresh(next) {
      current = next;
      part(host, '.home .cal-block').innerHTML = calendarMarkup(calendarView(next, 'home'));
    },
    closeSheet,
  };
}

const FOCUSABLE = '[data-act], input, textarea, button.accordion';

interface FocusMark { readonly key: string | undefined; readonly index: number }

/** Where the focus was, so a new render can put it back: the field's key or the control's place. */
function focusMark(host: HTMLElement): FocusMark {
  const all = [...host.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const index = all.findIndex((element) => element === document.activeElement);
  return { key: all[index]?.dataset.key, index };
}

function restoreFocus(host: HTMLElement, mark: FocusMark): void {
  const all = [...host.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const target = all.find((element) => mark.key !== undefined && element.dataset.key === mark.key) ?? all[mark.index];
  target?.focus({ preventScroll: true });
}

/** The day's sections: taps and typing become edits; a render keeps the focus where it was. */
function sectionControls(host: HTMLElement, state: HomeState, actions: HomeActions, calendar: Calendar): SectionControls {
  let current = state;
  const keepingFocus = (draw: () => void) => {
    const mark = focusMark(host);
    draw();
    restoreFocus(host, mark);
  };
  return {
    settings: state.settings,
    session: state.session,
    day: () => dayOf(current),
    edit(edit, render) {
      if (render) {
        keepingFocus(() => actions.edit(edit, true));
        return;
      }
      current = { ...current, days: actions.edit(edit, false) };
      fillBar(host, current);
      calendar.refresh(current);
    },
    render: () => keepingFocus(() => actions.refresh()),
    toast: (message) => actions.toast(message),
  };
}

/** Running stopwatches of the day shown count on screen. */
function tickStopwatches(host: HTMLElement, state: HomeState, signal: AbortSignal): void {
  const prefix = `${state.date}|`;
  if (![...state.session.running.keys()].some((key) => key.startsWith(prefix))) return;
  const timer = setInterval(() => {
    for (const time of host.querySelectorAll<HTMLElement>('[data-sw-time]')) {
      const started = state.session.running.get(String(time.dataset.swTime));
      if (started !== undefined) time.textContent = formatStopwatch(performance.now() - started);
    }
  }, 50);
  signal.addEventListener('abort', () => clearInterval(timer));
}

/** The pulse countdown counts on screen. */
function tickPulse(host: HTMLElement, state: HomeState, signal: AbortSignal): void {
  const run = state.session.pulse;
  if (run?.phase !== 'counting') return;
  const timer = setInterval(() => {
    const left = host.querySelector<HTMLElement>('[data-pulse-left]');
    if (left) left.textContent = formatCountdown(run.ends - Date.now());
  }, 200);
  signal.addEventListener('abort', () => clearInterval(timer));
}

/** The end of the countdown: the signal, then the question about the beats, with the focus in its field. */
function pulseEnd(host: HTMLElement, state: HomeState, controls: SectionControls): () => void {
  return () => {
    const run = state.session.pulse;
    if (run?.phase !== 'counting') return;
    state.session.pulse = { ...run, phase: 'beats' };
    endSignal(state.settings.accessibility);
    controls.render();
    host.querySelector<HTMLElement>('[data-input="beats"]')?.focus({ preventScroll: true });
  };
}

/** Shows home; returns what to undo when another screen takes its place. */
export function showHome(host: HTMLElement, state: HomeState, actions: HomeActions): () => void {
  host.innerHTML = markup(state, actions);
  const fit = fillHero(host, state);
  fillBar(host, state);
  // on .home, which every render makes anew: on host the listeners would pile up
  const home = part<HTMLElement>(host, '.home');
  wireAccordions(home, (trigger, open) => {
    if (trigger.dataset.section) actions.rememberSection(trigger.dataset.section, open);
    else state.session.open.set(String(trigger.dataset.memo), open);
  });
  const listeners = new AbortController();
  // another day: the calendar follows it, a pulse result is put away
  const go = (date: DayKey) => {
    state.session.month = null;
    if (state.session.pulse?.phase === 'done') state.session.pulse = null;
    actions.goTo(date);
  };
  const calendar = wireCalendar(host, state, go, listeners.signal);
  const controls = sectionControls(host, state, actions, calendar);
  wireSections(home, controls);
  state.session.flush = () => flushDrafts(controls);
  state.session.pulseEnd = pulseEnd(host, state, controls);
  part(host, '.bar__menu').addEventListener('click', () => actions.openMenu());

  tickStopwatches(host, state, listeners.signal);
  tickPulse(host, state, listeners.signal);
  wireDateNav(host, state, go, listeners.signal);
  wireScroll(host, listeners.signal);

  fit();
  if (state.cameFrom) dayArrives(host, state.cameFrom, state.date);
  void document.fonts?.ready.then(fit);
  addEventListener('resize', fit, { signal: listeners.signal });
  return () => listeners.abort();
}
