import { VERSION_LABEL } from '../version';
import { parseAccent, type Accent } from './accents';
import { isDayKey, type DayKey } from './dates';
import { readDay, writeDay, type Day } from './day';

/**
 * Glossary
 * - diary: everything the person keeps in the app: their settings and the days they logged.
 * - settings (profile): what the person set up; format in PROFILE-FORMAT.md.
 * - day: what was logged on one calendar day, keyed by its date.
 * - copy (backup): the diary as a file, `phys-activity-backup` version 1,
 *   the same format «бета 0.81» saves («зберегти копію»).
 *
 * Days are read into their typed shape (day.ts) where they come in. The
 * settings stay as stored, so nothing the app doesn't know yet is lost; the
 * screens read them through `readSettings` (settings.ts).
 */

export type JsonObject = { readonly [key: string]: unknown };

export interface Diary {
  readonly profile: JsonObject;
  readonly days: Readonly<Record<DayKey, Day>>;
}

const BACKUP_FORMAT = 'phys-activity-backup';
const BACKUP_VERSION = 1;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDays(days: JsonObject): Record<DayKey, Day> {
  const result: Record<DayKey, Day> = {};
  for (const [key, day] of Object.entries(days)) {
    if (isDayKey(key) && isObject(day)) result[key] = readDay(day, key);
  }
  return result;
}

/** Days with something in them, in the stored shape. */
function writeDays(days: Diary['days']): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const day of Object.values(days)) {
    const stored = writeDay(day);
    if (stored) result[day.date] = stored;
  }
  return result;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Reads a copy (a file or the app's own storage). Returns null for anything
 * that isn't a copy with settings; days with a broken date are left out.
 */
export function parseDiary(text: string): Diary | null {
  const data = parseJson(text);
  if (!isObject(data) || data.format !== BACKUP_FORMAT || data.version !== BACKUP_VERSION) return null;
  if (!isObject(data.profile) || !isObject(data.days)) return null;
  return { profile: data.profile, days: parseDays(data.days) };
}

/** The diary as a copy that «бета 0.81» and this app both read. */
export function serializeDiary(diary: Diary, savedAt: Date): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    savedAt: savedAt.toISOString(),
    app: VERSION_LABEL,
    profile: diary.profile,
    days: writeDays(diary.days),
  });
}

export function diaryAccent(diary: Diary): Accent {
  const theme = diary.profile.theme;
  return parseAccent(isObject(theme) ? theme.accent : undefined);
}
