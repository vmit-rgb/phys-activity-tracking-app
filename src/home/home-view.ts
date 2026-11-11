import { formatShort, type DayKey } from '../domain/dates';
import type { WeekGoal } from '../domain/progress';
import type { Moment, Settings } from '../domain/settings';

/*
 * What the home screen shows, decided without the DOM. Texts: COPY.md
 * («Home», «Bottom bar»), Olesia's decisions of 2026-10-29 and 2026-11-08.
 */

export type SectionId = 'ck-morning' | 'mw' | 'dw' | 'wo' | 'mv' | 'ck-evening' | 'note';

export interface SectionSpec {
  readonly id: SectionId;
  readonly title: string;
  readonly description: string;
}

const CHECK_IN = 'відміть, як ти зараз. правильних відповідей тут немає.';
const LISTEN_TO_BODY = 'слухай тіло. якщо щось не так — зупинись <3';

const asked = (settings: Settings, moment: Moment) => settings.trackers.some((tracker) => tracker.ask.includes(moment));

/** Sections in their fixed order; a section shows when it is switched on or has questions. */
export function homeSections(settings: Settings): SectionSpec[] {
  const all: [boolean, SectionSpec][] = [
    [asked(settings, 'morning'), { id: 'ck-morning', title: 'самопочуття зранку', description: CHECK_IN }],
    [settings.morningWarmup.enabled, { id: 'mw', title: 'ранкова розминка', description: LISTEN_TO_BODY }],
    [settings.daytimeWarmup.enabled, { id: 'dw', title: 'денна розминка', description: LISTEN_TO_BODY }],
    [settings.workout.enabled, { id: 'wo', title: 'тренування', description: LISTEN_TO_BODY }],
    [settings.movement.enabled, { id: 'mv', title: 'рух', description: 'запиши, скільки вийшло.' }],
    [asked(settings, 'evening'), { id: 'ck-evening', title: 'самопочуття ввечері', description: CHECK_IN }],
    [true, { id: 'note', title: 'нотатка', description: 'усе, що хочеш запамʼятати про цей день.' }],
  ];
  return all.filter(([shown]) => shown).map(([, section]) => section);
}

export type Hero =
  | { readonly kind: 'phrase'; readonly text: string }
  | { readonly kind: 'past'; readonly text: string; readonly bold: string };

const DAY_MS = 86_400_000;

/** The phrases take turns, one per day (as in «бета 0.81»). */
export function phraseFor(date: DayKey, phrases: readonly string[]): string {
  if (phrases.length === 0) return '';
  const days = Math.round(Math.abs(Date.parse(date) - Date.parse('2026-01-01')) / DAY_MS);
  return phrases[days % phrases.length]!;
}

/** A past day says whose record it is instead of the phrase (Figma `example/home-past-day`). */
export function heroFor(date: DayKey, today: DayKey, settings: Settings): Hero {
  if (date < today) {
    const shown = formatShort(date);
    return { kind: 'past', text: `це запис за ${shown}.\nзміни збережуться в цей день.`, bold: shown };
  }
  return { kind: 'phrase', text: phraseFor(date, settings.encouragement) };
}

/** «з 1 дня», «з 5 днів»: the genitive after «з». */
function days(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? 'дня' : 'днів';
}

export function goalLine(goal: WeekGoal | null): string | null {
  return goal && `цей тиждень: ${goal.done} з ${goal.target} ${days(goal.target)}`;
}
