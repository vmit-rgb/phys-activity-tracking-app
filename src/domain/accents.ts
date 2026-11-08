/**
 * Accent colours the person can pick. Order matches the Figma picker
 * (`settings/accent-color`, 9 options since 2026-11-08).
 */
export const ACCENTS = [
  'gray', 'orange', 'pink', 'magenta', 'purple', 'violet', 'blue', 'cyan', 'mint',
] as const;

export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_ACCENT: Accent = 'pink';

/**
 * Accents removed on 2026-11-08 (too close to the warning, error and success
 * colours). Profiles saved before that still carry them, so each one moves
 * to the nearest accent that remains.
 */
const REMOVED_ACCENTS: ReadonlyMap<unknown, Accent> = new Map([
  ['red', 'orange'],
  ['amber', 'orange'],
  ['yellow', 'orange'],
  ['green', 'mint'],
  ['lime', 'mint'],
]);

function isAccent(value: unknown): value is Accent {
  return (ACCENTS as readonly unknown[]).includes(value);
}

/** Reads an accent from outside data (a profile or a backup file). */
export function parseAccent(value: unknown): Accent {
  if (isAccent(value)) return value;
  return REMOVED_ACCENTS.get(value) ?? DEFAULT_ACCENT;
}
