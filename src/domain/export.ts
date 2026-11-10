import { formatShort, type DayKey } from './dates';
import { hasData, type Day } from './day';
import { writeDays, type Diary, type JsonObject } from './diary';
import { dayBlocks, sessionName, type DayBlock } from './journal';
import { formatNumber } from './numbers';
import type { ActivityKind, Exercise, Settings, WarmupItem, WorkoutEntry, WorkoutItem } from './settings';

/*
 * «копія й експорт» → «експорт» (COPY.md, Menu; «бета 0.81» `exportAI`,
 * `exportJSON`, `logLines`, `exerciseLines`). Two tabs: «записи» (the log)
 * and «вправи» (what the person does), each as text, JSON or PDF (`exportPDF`).
 */

export type ExportTab = 'records' | 'exercises';

/** «09.11.2026» */
const dotted = (key: DayKey) => key.split('-').reverse().join('.');

/* ---- the records, as text for an AI ---- */

function blockLine(block: DayBlock): string {
  if (block.kind === 'text') return `${block.title}: ${block.text.replace(/\s*\n\s*/g, ' / ')}`;
  if (block.kind === 'values') {
    return `${block.title}: ${block.rows.map((row) => [row.label, row.value, row.unit].filter(Boolean).join(' ')).join(', ')}`;
  }
  return `${block.title}: ${block.groups.map((group) =>
    `${group.title} (${group.items.map((item) => (item.times ? `${item.name} ${item.times}` : item.name)).join(', ')})`).join('; ')}`;
}

/** Days with records, newest first: the date, then one line per block. */
function recordDays(days: Diary['days'], settings: Settings): string[][] {
  const shown = Object.values(days).filter(hasData).sort((a, b) => b.date.localeCompare(a.date));
  return shown.map((day: Day) => [formatShort(day.date), ...dayBlocks(day, days, settings).map(blockLine)]);
}

/** Days with records, newest first, each as its date and one line per block. */
export function recordsText(days: Diary['days'], settings: Settings, today: DayKey): string {
  const head = `Мій щоденник руху й самопочуття (експорт з трекера, ${dotted(today)}). Це записи, а не діагнози: не інтерпретуй значення як медичні.`;
  const blocks = recordDays(days, settings).map(([date, ...lines]) => [date, ...lines.map((line) => `  ${line}`)].join('\n'));
  return [head, ...blocks].join('\n\n');
}

/* ---- the exercises, as text ---- */

/** «3 × 10, 5 кг», «30 с»; empty when nothing is set. */
function prescription(item: WarmupItem | WorkoutItem): string {
  const amount = item.seconds !== null ? `${formatNumber(item.seconds)} с` : item.reps;
  if (!amount) return '';
  const workout = 'weight' in item ? item : null;
  const sets = workout?.sets ? `${workout.sets} × ` : '';
  const weight = workout?.weight != null ? `, ${formatNumber(workout.weight)} кг` : '';
  return ` — ${sets}${amount}${weight}`;
}

function exerciseNotes(exercise: Exercise, indent: string): string[] {
  const how = exercise.how ? [`${indent}  ${exercise.how.replace(/\n+/g, ' ')}`] : [];
  const { source } = exercise;
  if (source.type !== 'link') return how;
  return [...how, `${indent}  посилання${source.by === 'ai' ? ' (від ШІ, перевір)' : ''}: ${source.url}`];
}

function exerciseLine(settings: Settings, item: WarmupItem | WorkoutItem, indent: string): string[] {
  const exercise = settings.exercises.find((x) => x.id === item.exercise);
  const first = `${indent}• ${exercise?.name || 'вправа'}${prescription(item)}`;
  return exercise ? [first, ...exerciseNotes(exercise, indent)] : [first];
}

const titled = (title: string, hint: string) => (hint ? `${title} — ${hint}` : title);
const oneLine = (text: string) => text.replace(/\n+/g, ' ');

function morningText(settings: Settings): string[] {
  return ['ранкова розминка', ...settings.morningWarmup.levels.flatMap((level, i) => [
    `  ${level.name || `рівень ${i + 1}`}${level.duration ? ` · ${level.duration}` : ''}`,
    ...level.items.flatMap((item) => exerciseLine(settings, item, '    ')),
  ])];
}

function daytimeText(settings: Settings): string[] {
  const { hint, groups } = settings.daytimeWarmup;
  return [titled('денна розминка', hint), ...groups.flatMap((group) => [
    `  ${group.name || 'без назви'}`, ...group.items.flatMap((item) => exerciseLine(settings, item, '    ')),
  ])];
}

function workoutText(settings: Settings): string[] {
  const entry = (item: WorkoutEntry) => ('set' in item
    ? ['    група вправ:', ...item.set.flatMap((x) => exerciseLine(settings, x, '      '))]
    : exerciseLine(settings, item, '    '));
  return [titled('тренування', settings.workout.hint), ...settings.workout.sessions.flatMap((session) => [
    `  ${sessionName(session.name)}`,
    ...(session.how ? [`    ${oneLine(session.how)}`] : []),
    ...session.items.flatMap(entry),
  ])];
}

function movementText(settings: Settings): string[] {
  return [titled('рух', settings.movement.hint), ...settings.movement.kinds.map((kind) =>
    `  • ${kind.name || 'без назви'}${kind.source.type === 'link' ? ` — ${kind.source.url}` : ''}`)];
}

const SECTION_TEXTS: readonly [ActivityKind, (settings: Settings) => string[]][] = [
  ['morningWarmup', morningText], ['daytimeWarmup', daytimeText], ['workout', workoutText], ['movement', movementText],
];

/** Each section that is on, as indented lines. */
const exerciseSections = (settings: Settings) =>
  SECTION_TEXTS.filter(([kind]) => settings[kind].enabled).map(([, text]) => text(settings));

export function exercisesText(settings: Settings, today: DayKey): string {
  const sections = exerciseSections(settings).map((lines) => lines.join('\n'));
  return [`Мої вправи (з трекера, ${dotted(today)}):`, ...sections].join('\n\n');
}

/* ---- PDF: the same texts, laid out as «бета 0.81» `exportPDF` did ---- */

export interface PdfLine {
  readonly text: string;
  /** Points. */
  readonly size: number;
  readonly bold: boolean;
  /** Points from the left margin. */
  readonly indent: number;
}

export interface PdfDocument {
  readonly name: string;
  readonly lines: readonly PdfLine[];
}

const pdfLine = (text: string, size: number, bold = false, indent = 0): PdfLine => ({ text, size, bold, indent });
const gap = (size: number) => pdfLine('', size);

function recordLines(days: Diary['days'], settings: Settings): PdfLine[] {
  return recordDays(days, settings).flatMap(([date, ...blocks]) =>
    [pdfLine(date!, 12, true), ...blocks.map((block) => pdfLine(block, 9.5, false, 12)), gap(6)]);
}

/** Depth from the leading spaces: sections large, their first level (levels, sessions) bold, items («•») plain. */
function exerciseLines(settings: Settings): PdfLine[] {
  return exerciseSections(settings).flatMap((lines, i) => [...(i ? [gap(6)] : []), ...lines.map((line) => {
    const text = line.trim();
    const depth = line.length - line.trimStart().length;
    return pdfLine(text, depth ? 9.5 : 13, depth <= 2 && !text.startsWith('•'), depth * 3);
  })]);
}

/** The PDF's file name and lines; `footer` names the app at the bottom (Olesia, 2026-11-10). */
export function pdfDocument(tab: ExportTab, days: Diary['days'], settings: Settings, today: DayKey, footer: string): PdfDocument {
  const records = tab === 'records';
  return {
    name: `${records ? 'trekr-zapysy' : 'trekr-vpravy'}-${today}.pdf`,
    lines: [
      pdfLine(records ? 'щоденник руху й самопочуття' : 'мої вправи', 16, true),
      pdfLine(`експорт ${formatShort(today)}${records ? ' · це щоденник, а не медичний документ' : ''}`, 9),
      gap(6),
      ...(records ? recordLines(days, settings) : exerciseLines(settings)),
      gap(8),
      pdfLine(footer, 8),
    ],
  };
}

/* ---- JSON files, as «бета 0.81» saves them ---- */

export interface ExportFile {
  readonly name: string;
  readonly text: string;
}

const pick = (profile: JsonObject, keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, profile[key]]));

export function exportFile(tab: ExportTab, diary: Diary, today: DayKey, now: Date): ExportFile {
  const { profile } = diary;
  if (tab === 'records') {
    const exercises = Array.isArray(profile.exercises) ? profile.exercises as JsonObject[] : [];
    return {
      name: `trekr-zapysy-${today}.json`,
      text: JSON.stringify({
        format: 'phys-activity-log',
        version: 2,
        exported: now.toISOString(),
        trackers: profile.trackers,
        exercises: exercises.map((exercise) => ({ id: exercise.id, name: exercise.name })),
        days: writeDays(diary.days),
      }, null, 1),
    };
  }
  return {
    name: `trekr-vpravy-${today}.json`,
    text: JSON.stringify({
      format: 'phys-activity-exercises',
      version: 1,
      ...pick(profile, ['morningWarmup', 'daytimeWarmup', 'workout', 'movement', 'exercises']),
    }, null, 1),
  };
}
