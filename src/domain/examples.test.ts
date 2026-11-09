import { describe, expect, it } from 'vitest';
import { diaryAccent, parseDiary, serializeDiary } from './diary';
import { EXAMPLE_DIARY } from './examples';

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
