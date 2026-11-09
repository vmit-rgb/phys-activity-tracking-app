import type { Moment } from '../domain/settings';

/**
 * What the home screen keeps while the app is open but never stores:
 * which levels and «як робити» are open, the × armed for removal, running
 * stopwatches and slider values not saved yet. It outlives a render, so a
 * tap that re-draws the screen loses nothing.
 *
 * Glossary
 * - armed: a × tapped once; it turns into ✓, and the second tap removes (ACCESSIBILITY.md, deleting).
 * - draft: a slider value moved but not saved; «зберегти», 20 s or leaving saves it.
 * - retry: a saved stopwatch tapped once; the next tap starts it again from zero.
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
}

export interface Draft { readonly moment: Moment; readonly tracker: string; readonly value: number }

export function homeSession(): HomeSession {
  return { open: new Map(), armed: null, running: new Map(), retry: new Set(), drafts: new Map(), flush: () => {}, timer: undefined };
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
