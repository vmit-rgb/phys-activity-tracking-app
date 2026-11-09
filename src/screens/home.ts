import { addDays, formatLong, formatShort, type DayKey } from '../domain/dates';
import { emptyDay, type Day } from '../domain/day';
import type { Diary } from '../domain/diary';
import { weekGoal } from '../domain/progress';
import type { Settings } from '../domain/settings';
import { barShown, swipeDays, toTopShown, type Point } from '../home/gestures';
import { HERO_STYLES, heroStyle, type HeroStyle } from '../home/hero-fit';
import { goalLine, heroFor, homeSections, type SectionSpec } from '../home/home-view';
import { wireAccordions } from '../ui/accordion';
import { iconSvg } from '../ui/icons';
import { FOOTER, part } from './parts';

/*
 * Home (Figma `screen/home-default` 73:2601 open, 338:16522 closed;
 * `navigation` 189:6897; `button/to-top` 288:10620). Stage 5a: the frame of
 * the screen; the inside of the sections comes in 5b, the calendar in 5c.
 * The ASCII scene behind the phrase comes in stage 7 (Olesia, 2026-11-09).
 * Texts from the settings are set as text, never as HTML.
 */

export interface HomeState {
  readonly settings: Settings;
  readonly days: Diary['days'];
  readonly date: DayKey;
  readonly today: DayKey;
}

export interface HomeActions {
  goTo(date: DayKey): void;
  openMenu(): void;
  /** Whether a section is open; open unless the person closed it. */
  sectionOpen(id: string): boolean;
  rememberSection(id: string, open: boolean): void;
}

function sectionMarkup({ id, title, description }: SectionSpec, open: boolean): string {
  return `
    <section class="home-section" aria-labelledby="sec-${id}-title">
      <h2 class="home-section__heading">
        <button type="button" class="ctl accordion accordion--section" id="sec-${id}-title" data-section="${id}"
          aria-expanded="${open}" aria-controls="sec-${id}"><span class="accordion__title">${title}</span></button>
      </h2>
      <div class="home-section__body" id="sec-${id}"${open ? '' : ' hidden'}>
        <p class="t-1st-regular">${description}</p>
      </div>
    </section>`;
}

const BAR = `
  <nav class="bar" aria-label="навігація">
    <button type="button" class="ctl icon-btn icon-btn--secondary bar__menu" aria-label="меню">${iconSvg('menu')}</button>
    <div class="bar__right">
      <p class="bar__goal t-3rd-semibold" aria-live="polite"></p>
      <div class="date-nav">
        <button type="button" class="ctl icon-btn icon-btn--secondary date-nav__step" data-step="-1" aria-label="попередній день">${iconSvg('chevron-left')}</button>
        <p class="date-nav__date" aria-live="polite"><span aria-hidden="true"></span><span class="visually-hidden"></span></p>
        <button type="button" class="ctl icon-btn icon-btn--secondary date-nav__step" data-step="1" aria-label="наступний день">${iconSvg('chevron-right')}</button>
      </div>
    </div>
  </nav>
  <button type="button" class="ctl icon-btn icon-btn--primary to-top" aria-label="вгору" hidden>${iconSvg('arrow-up')}</button>`;

function markup(state: HomeState, actions: HomeActions): string {
  const sections = homeSections(state.settings).map((section) => sectionMarkup(section, actions.sectionOpen(section.id)));
  return `
    <div class="home">
      <h1 class="visually-hidden">головна</h1>
      <header class="hero"><p class="hero__text"></p></header>
      <div class="home__sections">${sections.join('')}</div>
      ${FOOTER}
    </div>
    ${BAR}`;
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
    text.className = 'hero__text hero__text--past t-h6';
    return () => {};
  }
  return () => {
    text.classList.remove(...HERO_STYLES);
    text.classList.add(heroStyle(measure(text)));
  };
}

function fillBar(host: HTMLElement, state: HomeState): void {
  const dayAt = (key: DayKey): Day => state.days[key] ?? emptyDay(key);
  const goal = goalLine(weekGoal(state.date, state.today, dayAt, state.settings));
  const goalText = part<HTMLElement>(host, '.bar__goal');
  goalText.textContent = goal ?? '';
  goalText.hidden = goal === null;
  const date = part<HTMLElement>(host, '.date-nav__date');
  // without the goal line the date takes header 4 (Olesia, 2026-10-29)
  date.className = `date-nav__date ${goal === null ? 't-h4' : 't-h5'}`;
  date.firstElementChild!.textContent = formatShort(state.date);
  date.lastElementChild!.textContent = formatLong(state.date);
  part<HTMLButtonElement>(host, '[data-step="1"]').disabled = state.date >= state.today;
}

/** The bar hides on scroll down; «вгору» shows once scrolled. */
function wireScroll(host: HTMLElement, signal: AbortSignal): void {
  const bar = part<HTMLElement>(host, '.bar');
  const toTop = part<HTMLButtonElement>(host, '.to-top');
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    const shown = barShown({
      y, lastY, maxY: document.documentElement.scrollHeight - innerHeight,
      barFocused: bar.contains(document.activeElement), barShown: !bar.classList.contains('bar--hidden'),
    });
    bar.classList.toggle('bar--hidden', !shown);
    toTop.hidden = !toTopShown(y, shown);
    if (Math.abs(y - lastY) > 6) lastY = y;
  }, { passive: true, signal });
  bar.addEventListener('focusin', () => bar.classList.remove('bar--hidden'), { signal });
}

/** Arrows and a swipe on the date move by a day. */
function wireDateNav(host: HTMLElement, step: (days: number) => void, signal: AbortSignal): void {
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

/** Shows home; returns what to undo when another screen takes its place. */
export function showHome(host: HTMLElement, state: HomeState, actions: HomeActions): () => void {
  host.innerHTML = markup(state, actions);
  const fit = fillHero(host, state);
  fillBar(host, state);
  // on .home, which every render makes anew: on host the listeners would pile up
  wireAccordions(part(host, '.home'), (trigger, open) => actions.rememberSection(String(trigger.dataset.section), open));
  part(host, '.bar__menu').addEventListener('click', () => actions.openMenu());

  const listeners = new AbortController();
  wireDateNav(host, (days) => {
    const next = addDays(state.date, days);
    if (days !== 0 && next <= state.today) actions.goTo(next);
  }, listeners.signal);
  wireScroll(host, listeners.signal);

  fit();
  void document.fonts?.ready.then(fit);
  addEventListener('resize', fit, { signal: listeners.signal });
  return () => listeners.abort();
}
