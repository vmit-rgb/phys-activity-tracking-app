/* Numbers as people type and read them in Ukrainian: «2,5», not «2.5». */

/** What the person typed, or null when it isn't a number (an empty field too). */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** «2,5», at most two decimals; an empty string for no number. */
export function formatNumber(value: number | null): string {
  return value === null ? '' : String(Math.round(value * 100) / 100).replace('.', ',');
}

/** The word for a count: [1, 2–4, 5+] («коло, кола, кіл»); 11–14 take the third. */
export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const lastTwo = Math.abs(n) % 100;
  const last = lastTwo % 10;
  if (lastTwo > 10 && lastTwo < 15) return many;
  if (last === 1) return one;
  return last >= 2 && last <= 4 ? few : many;
}

const TIMES = ['раз', 'рази', 'разів'] as const;

/** A warm-up count as Figma's «n разів»: «10 разів», «8–12 разів»; other text as it was written. */
export function countLabel(reps: string): string {
  const range = /^\d+(?:\s*[–-]\s*(\d+))?$/.exec(reps.trim());
  if (!range) return reps;
  const last = Number(range[1] ?? reps.trim());
  return `${reps.trim()} ${plural(last, TIMES)}`;
}
