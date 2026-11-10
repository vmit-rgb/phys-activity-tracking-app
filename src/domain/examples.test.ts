import { describe, expect, it } from 'vitest';
import { parseDiary, serializeDiary, type Diary } from './diary';
import { EXAMPLE_DIARY } from './examples';
import { readSettings } from './settings';

const diaryAccent = (diary: Diary) => readSettings(diary.profile).accent;

describe('EXAMPLE_DIARY («почати без ШІ»)', () => {
  const saved = parseDiary(serializeDiary(EXAMPLE_DIARY, new Date()))!;

  it('is a valid copy, so it is stored and restored like any other', () => {
    expect(saved).toEqual(EXAMPLE_DIARY);
  });

  it('has no invented log', () => {
    expect(saved.days).toEqual({});
  });

  it('turns on every section', () => {
    for (const section of ['morningWarmup', 'daytimeWarmup', 'workout', 'movement']) {
      expect(saved.profile[section]).toMatchObject({ enabled: true });
    }
  });

  it('is a light example (Olesia, 2026-11-09): two levels, one of the rest, 2–3 exercises everywhere', () => {
    const settings = readSettings(saved.profile);
    expect(settings.morningWarmup.levels).toHaveLength(2);
    expect(settings.daytimeWarmup.groups).toHaveLength(1);
    expect(settings.workout.sessions).toHaveLength(1);
    expect(settings.movement.kinds).toHaveLength(1);
    const counts = [
      ...settings.morningWarmup.levels.map((level) => level.items.length),
      ...settings.daytimeWarmup.groups.map((group) => group.items.length),
      ...settings.workout.sessions.map((session) => session.items.length),
    ];
    expect(counts.every((n) => n >= 2 && n <= 3)).toBe(true);
  });

  it('asks in the morning, after the workout and one question in the evening', () => {
    const asked = (moment: string) => readSettings(saved.profile).trackers.filter((t) => t.ask.includes(moment as never)).length;
    expect(asked('morning')).toBeGreaterThan(0);
    expect(asked('afterWorkout')).toBeGreaterThan(0);
    expect(asked('evening')).toBe(1);
  });

  it('uses the default accent', () => {
    expect(diaryAccent(saved)).toBe('pink');
  });

  it('refers only to exercises it defines', () => {
    const ids = new Set((saved.profile.exercises as { id: string }[]).map((e) => e.id));
    const used = JSON.stringify(saved.profile).match(/"exercise":"[^"]+"/g)!.map((m) => m.slice(12, -1));
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((id) => !ids.has(id))).toEqual([]);
  });
});
