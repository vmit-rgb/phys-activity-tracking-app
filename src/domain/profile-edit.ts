import type { Accent } from './accents';
import type { JsonObject } from './diary';
import { readAccessibility, readSettings, type AccessibilityKey, type ActivityKind, type PulseSeconds } from './settings';

/*
 * Changes the settings screen makes to the stored profile (PROFILE-FORMAT.md).
 * Each one returns a new profile and keeps every field it doesn't touch, also
 * the ones this app doesn't know yet, so a profile from the AI loses nothing.
 */

export type ProfileEdit = (profile: JsonObject) => JsonObject;

const raw = (value: unknown): JsonObject => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : {});

export interface GoalChange {
  readonly enabled?: boolean;
  readonly days?: number;
  readonly done?: readonly ActivityKind[];
}

/** The main goal: counted or not, days per week (0–7), what makes a day «зроблено». */
export const withGoal = (change: GoalChange): ProfileEdit => (profile) => {
  const goal = { ...readSettings(profile).goal, ...change };
  return { ...profile, goal: { ...raw(profile.goal), enabled: goal.enabled, days: Math.min(7, Math.max(0, goal.days)), done: goal.done } };
};

/** The encouraging phrases, in order; empty ones are dropped when saved (see `cleanForSave`). */
export const withEncouragement = (phrases: readonly string[]): ProfileEdit => (profile) => ({ ...profile, encouragement: [...phrases] });

export const withAccent = (accent: Accent): ProfileEdit => (profile) => ({ ...profile, theme: { ...raw(profile.theme), accent } });

/** One «доступність» checkbox. The old `theme.motion` goes: `accessibility` now says it all. */
export const withAccessibility = (key: AccessibilityKey, on: boolean): ProfileEdit => (profile) => {
  const { motion: _old, ...theme } = raw(profile.theme);
  return { ...profile, theme, accessibility: { ...readAccessibility(profile), [key]: on } };
};

/** The pulse timer on a one-number tracker: `timer: { enabled, seconds }`. */
export const withPulseTimer = (trackerId: string, enabled: boolean, seconds: PulseSeconds): ProfileEdit => (profile) => ({
  ...profile,
  trackers: (Array.isArray(profile.trackers) ? profile.trackers : []).map((tracker: unknown) =>
    raw(tracker).id === trackerId ? { ...raw(tracker), timer: { enabled, seconds } } : tracker),
});

/** Before saving: phrases left empty (e.g. «додати фразу» and nothing typed) are not kept. */
export const cleanForSave: ProfileEdit = (profile) => Array.isArray(profile.encouragement)
  ? { ...profile, encouragement: profile.encouragement.filter((phrase) => typeof phrase !== 'string' || phrase.trim() !== '') }
  : profile;
