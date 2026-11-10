import { describe, expect, it } from 'vitest';
import type { JsonObject } from './diary';
import { EXAMPLE_DIARY } from './examples';
import { cleanForSave, withAccent, withAccessibility, withEncouragement, withGoal, withPulseTimer } from './profile-edit';
import { readAccessibility, readSettings } from './settings';

// Invented data only.
const PROFILE: JsonObject = { ...EXAMPLE_DIARY.profile, unknownField: { kept: true } };

describe('profile edits keep what they don’t touch', () => {
  it('changes the goal and keeps the rest of it', () => {
    const next = withGoal({ days: 6 })({ ...PROFILE, goal: { enabled: true, days: 5, done: ['workout'], note: 'з ШІ' } });
    expect(next.goal).toEqual({ enabled: true, days: 6, done: ['workout'], note: 'з ШІ' });
    expect(next.unknownField).toEqual({ kept: true });
  });

  it('fills a missing goal with the defaults and keeps the days within 0–7', () => {
    const { goal: _goal, ...noGoal } = PROFILE;
    expect(withGoal({ days: 9 })(noGoal).goal).toEqual({ enabled: true, days: 7, done: [] });
    expect(withGoal({ days: -1, enabled: false })(noGoal).goal).toEqual({ enabled: false, days: 0, done: [] });
  });

  it('sets the phrases, the accent and the pulse timer', () => {
    expect(withEncouragement(['а', 'б'])(PROFILE).encouragement).toEqual(['а', 'б']);
    expect(withAccent('mint')({ ...PROFILE, theme: { accent: 'pink', other: 1 } }).theme).toEqual({ accent: 'mint', other: 1 });
    const timed = withPulseTimer('pulse', false, 60)(PROFILE);
    const trackers = timed.trackers as JsonObject[];
    expect(trackers.find((t) => t.id === 'pulse')!.timer).toEqual({ enabled: false, seconds: 60 });
    expect(trackers.find((t) => t.id === 'energy')).toEqual((PROFILE.trackers as JsonObject[]).find((t) => t.id === 'energy'));
    expect(withPulseTimer('pulse', true, 15)({ ...PROFILE, trackers: undefined }).trackers).toEqual([]);
  });

  it('writes «доступність» and drops the old `theme.motion`', () => {
    const old = { ...PROFILE, theme: { accent: 'pink', motion: { ui: false, ascii: true, vibration: false } } };
    const next = withAccessibility('largerText', true)(old);
    expect(next.theme).toEqual({ accent: 'pink' });
    expect(next.accessibility).toEqual({
      noMotion: true, noBackgroundMotion: false, noVibration: true, noSound: false, largerTargets: false, largerText: true, mirrored: false,
    });
  });

  it('drops empty phrases before saving and leaves a profile without phrases alone', () => {
    expect(cleanForSave({ ...PROFILE, encouragement: ['а', ' ', '', 3] }).encouragement).toEqual(['а', 3]);
    const { encouragement: _e, ...none } = PROFILE;
    expect(cleanForSave(none)).toBe(none);
  });
});

describe('readAccessibility', () => {
  it('is all off by default', () => {
    expect(Object.values(readSettings({}).accessibility).every((on) => on === false)).toBe(true);
  });

  it('reads the old boolean `theme.motion: false` as «вимкнути всі анімації»', () => {
    expect(readAccessibility({ theme: { motion: false } }).noMotion).toBe(true);
    expect(readAccessibility({ theme: { motion: true } }).noMotion).toBe(false);
  });

  it('lets the stored checkboxes win over the old switch', () => {
    const a = readAccessibility({ theme: { motion: { ascii: false } }, accessibility: { noBackgroundMotion: false, mirrored: true, noSound: 'так' } });
    expect(a.noBackgroundMotion).toBe(false);
    expect(a.mirrored).toBe(true);
    expect(a.noSound).toBe(false);
  });
});

describe('profile edits on odd stored values', () => {
  it('treats a goal or theme that is a list or null as missing', () => {
    expect(withGoal({ days: 3 })({ goal: ['x'] }).goal).toEqual({ enabled: true, days: 3, done: [] });
    expect(withAccent('gray')({ theme: null }).theme).toEqual({ accent: 'gray' });
    expect(withAccent('gray')({ theme: ['blue'] }).theme).toEqual({ accent: 'gray' });
  });
});
