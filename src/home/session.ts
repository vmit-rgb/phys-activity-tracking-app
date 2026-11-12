import type { Moment } from '../domain/settings';
import type { MonthKey } from '../domain/stats';

/**
 * What the home screen keeps while the app is open but never stores:
 * which levels and «як робити» are open, the × armed for removal, running
 * stopwatches and slider values not saved yet. It outlives a render, so a
 * tap that re-draws the screen loses nothing.
 *
 * Glossary
 * - armed: a × tapped once; it turns into ✓, and the second tap removes (ACCESSIBILITY.md, deleting).
 * - draft: a slider value moved but not saved; «зберегти», 20 s or leaving saves it.
 * - retry: a saved stopwatch or pulse tapped once; the next tap starts it again from zero.
 */
export interface HomeSession {
  readonly open: Map<string, boolean>;
  armed: string | null;
  readonly running: Map<string, number>;
  readonly retry: Set<string>;
  readonly drafts: Map<string, Draft>;
  /** Saves every draft; set by the screen shown. */
  flush: () => void;
  /** The 20 s autosave of the drafts (ACCESSIBILITY.md, slider). */
  timer: ReturnType<typeof setTimeout> | undefined;
  /** The month the calendar shows; null follows the day shown. */
  month: MonthKey | null;
  /** The pulse timer in use, if any (one at a time: both hands are busy). */
  pulse: PulseRun | null;
  /** The next step of the pulse timer (ready → counting → beats); set by the screen shown. */
  pulseStep: () => void;
  /** The pending step, so ■ and «скасувати» can call it off. */
  pulseTimer: ReturnType<typeof setTimeout> | undefined;
}

export interface Draft { readonly moment: Moment; readonly tracker: string; readonly value: number }

/**
 * The pulse timer (ACCESSIBILITY.md, Figma `tracker/pulse-timer`):
 * ready (3 s to find the pulse) → counting → beats (how many?) → done (the
 * line «42 удари за 30 с × 2», until the day changes). ■ in ready or counting
 * and «скасувати» at beats drop the run (Olesia, 2026-11-12).
 */
export interface PulseRun {
  readonly key: string;
  readonly seconds: number;
  readonly phase: 'ready' | 'counting' | 'beats' | 'done';
  /** When the phase shown ends (ready, counting), as Date.now(). */
  readonly ends: number;
  readonly beats: number | null;
}

/** Time to find the pulse before the count starts (Olesia, 2026-11-12). */
export const PULSE_READY_MS = 3000;

/** Ready or counting: ■ is on screen and a step is pending. */
export const pulseRunning = (run: PulseRun | null | undefined): boolean => run?.phase === 'ready' || run?.phase === 'counting';

/** The next pulse step comes after `ms`; one at a time. */
export function schedulePulse(session: HomeSession, ms: number): void {
  clearTimeout(session.pulseTimer);
  session.pulseTimer = setTimeout(() => session.pulseStep(), ms);
}

/** ■ or «скасувати»: the run and its pending step are gone, nothing is saved. */
export function dropPulse(session: HomeSession): void {
  clearTimeout(session.pulseTimer);
  session.pulseTimer = undefined;
  session.pulse = null;
}

export function homeSession(): HomeSession {
  return {
    open: new Map(), armed: null, running: new Map(), retry: new Set(), drafts: new Map(), flush: () => {}, timer: undefined,
    month: null, pulse: null, pulseStep: () => {}, pulseTimer: undefined,
  };
}

/** «0:18» */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What the pulse timer shows now: «3», «2», «1» while getting ready, then «0:30» … «0:00». */
export function pulseTime(run: PulseRun, now: number): string {
  return run.phase === 'ready' ? String(Math.max(1, Math.ceil((run.ends - now) / 1000))) : formatCountdown(run.ends - now);
}

/** «01.24.37»: minutes, seconds, hundredths (Figma `stopwatch`). */
export function formatStopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 10));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 6000))}.${pad(Math.floor(total / 100) % 60)}.${pad(total % 100)}`;
}

export type StopwatchState = 'default' | 'running' | 'saved' | 'retry';

export function stopwatchState(session: HomeSession, key: string, saved: number | null): StopwatchState {
  if (session.running.has(key)) return 'running';
  if (saved === null) return 'default';
  return session.retry.has(key) ? 'retry' : 'saved';
}
