import { DEFAULT_ACCENT } from './accents';
import type { Diary } from './diary';

/*
 * «почати без ШІ» (brief, Decisions 2026-11-08): every section filled with
 * examples under neutral names, settings only, no invented log. Texts are
 * Нитка's draft. Format: PROFILE-FORMAT.md, version 1.
 */

const exercise = (n: number) => ({
  id: `exercise-${n}`,
  name: `вправа ${n}`,
  how: 'тут буде коротко, як її робити.',
  source: { type: 'user' },
});

const EXAMPLE_PROFILE = {
  format: 'phys-activity-profile',
  version: 1,
  lang: 'uk',
  ui: null,
  theme: { accent: DEFAULT_ACCENT },
  goal: { enabled: true, days: 5, done: ['morningWarmup'] },
  encouragement: ['ти можеш налаштувати все в налаштуваннях :)'],
  morningWarmup: {
    enabled: true,
    weeklyTarget: 5,
    levels: [
      { id: 'level-1', name: 'рівень 1', duration: '5 хв', items: [{ exercise: 'exercise-1', reps: 10 }, { exercise: 'exercise-2', seconds: 30 }] },
      { id: 'level-2', name: 'рівень 2', duration: '10 хв', items: [{ exercise: 'exercise-3', reps: 12 }] },
    ],
  },
  daytimeWarmup: {
    enabled: true,
    weeklyTarget: 3,
    hint: 'коли довго сидиш',
    groups: [{ id: 'back', name: 'для спини', items: [{ exercise: 'exercise-4', reps: 8 }] }],
  },
  workout: {
    enabled: true,
    weeklyTarget: 2,
    hint: 'через день',
    sessions: [
      { id: 'a', name: 'а', how: 'розімнися перед початком.', items: [
        { exercise: 'exercise-5', reps: 10, weight: 5, fields: ['weight', 'reps'] },
        { set: [
          { exercise: 'exercise-6', reps: 12, fields: ['reps'] },
          { exercise: 'exercise-2', seconds: 30, fields: ['seconds'] },
        ] },
      ] },
      { id: 'b', name: 'б', how: 'розімнися перед початком.', items: [
        { exercise: 'exercise-3', reps: 10, weight: 5, fields: ['weight', 'reps'] },
      ] },
    ],
  },
  movement: {
    enabled: true,
    weeklyTarget: 3,
    hint: '',
    kinds: [{ id: 'walk', name: 'ходьба', fields: ['km', 'minutes', 'steps'], source: { type: 'user' } }],
  },
  exercises: [1, 2, 3, 4, 5, 6].map(exercise),
  trackers: [
    { id: 'energy', name: 'енергія', hint: '0 — немає сил, 10 — повно сил', kind: 'scale', min: 0, max: 10, ask: ['morning', 'afterWorkout'] },
    { id: 'hard', name: 'було важко?', kind: 'yesno', ask: ['afterWorkout'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'] },
    { id: 'pressure', name: 'тиск', kind: 'numbers', units: ['мм рт. ст.', 'мм рт. ст.'], ask: ['morning'] },
    { id: 'note', name: 'нотатка', kind: 'note', ask: ['evening'] },
  ],
};

export const EXAMPLE_DIARY: Diary = { profile: EXAMPLE_PROFILE, days: {} };
