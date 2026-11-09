import { DEFAULT_ACCENT } from './accents';
import type { Diary } from './diary';

/*
 * «почати без ШІ» (brief, Decisions 2026-11-08): every section filled with
 * examples under neutral names, settings only, no invented log. A light
 * example (Olesia, 2026-11-09): two morning levels, one daytime zone, one
 * workout, one kind of movement, one evening question, 2–3 exercises in
 * each. Texts are Нитка's draft. Format: PROFILE-FORMAT.md, version 1.
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
      { id: 'level-2', name: 'рівень 2', duration: '10 хв', items: [
        { exercise: 'exercise-1', reps: 15 }, { exercise: 'exercise-2', seconds: 45 }, { exercise: 'exercise-3', reps: 10 },
      ] },
    ],
  },
  daytimeWarmup: {
    enabled: true,
    weeklyTarget: 3,
    hint: 'коли довго сидиш',
    groups: [{ id: 'back', name: 'для спини', items: [{ exercise: 'exercise-4', reps: 8 }, { exercise: 'exercise-5', seconds: 20 }] }],
  },
  workout: {
    enabled: true,
    weeklyTarget: 2,
    hint: 'через день',
    sessions: [
      { id: 'a', name: 'а', how: 'розімнися перед початком.', items: [
        { exercise: 'exercise-6', reps: '10', weight: 5, sets: 3, fields: ['weight', 'reps'] },
        { exercise: 'exercise-7', reps: '12', sets: 2, fields: ['reps'] },
        { exercise: 'exercise-8', seconds: 30, fields: ['seconds'] },
      ] },
    ],
  },
  movement: {
    enabled: true,
    weeklyTarget: 3,
    hint: '',
    kinds: [{ id: 'movement-1', name: 'рух 1', fields: ['km', 'minutes'], source: { type: 'user' } }],
  },
  exercises: [1, 2, 3, 4, 5, 6, 7, 8].map(exercise),
  trackers: [
    { id: 'energy', name: 'енергія', hint: '0 — немає сил, 10 — повно сил', kind: 'scale', min: 0, max: 10, ask: ['morning', 'afterWorkout'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'] },
    { id: 'hard', name: 'було важко?', kind: 'yesno', ask: ['afterWorkout'] },
    { id: 'tired', name: 'втома', hint: '0 — бадьоро, 10 — дуже втомлено', kind: 'scale', min: 0, max: 10, ask: ['evening'] },
  ],
};

export const EXAMPLE_DIARY: Diary = { profile: EXAMPLE_PROFILE, days: {} };
