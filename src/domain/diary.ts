import { VERSION_LABEL } from '../version';
import { parseAccent, type Accent } from './accents';

/**
 * Glossary
 * - diary: everything the person keeps in the app: their settings and the days they logged.
 * - settings (profile): what the person set up; format in PROFILE-FORMAT.md.
 * - day: what was logged on one calendar day, keyed by its date.
 * - copy (backup): the diary as a file, `phys-activity-backup` version 1,
 *   the same format «бета 0.81» saves («зберегти копію»).
 *
 * Settings and days are kept as checked JSON objects for now: their inner
 * shape gets typed together with the screens that read it (stage 5) and
 * PROFILE-FORMAT v0.2.
 */

export type JsonObject = { readonly [key: string]: unknown };

/** A calendar date as `YYYY-MM-DD`. */
export type DayKey = string & { readonly brand: 'DayKey' };

export interface Diary {
  readonly profile: JsonObject;
  readonly days: Readonly<Record<DayKey, JsonObject>>;
}

const BACKUP_FORMAT = 'phys-activity-backup';
const BACKUP_VERSION = 1;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

function parseDays(days: JsonObject): Record<DayKey, JsonObject> {
  const result: Record<DayKey, JsonObject> = {};
  for (const [key, day] of Object.entries(days)) {
    if (isDayKey(key) && isObject(day)) result[key] = day;
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
    days: diary.days,
  });
}

export function diaryAccent(diary: Diary): Accent {
  const theme = diary.profile.theme;
  return parseAccent(isObject(theme) ? theme.accent : undefined);
}
