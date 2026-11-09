import { describe, expect, it } from 'vitest';
import { EXAMPLE_DIARY } from './examples';
import { readSettings } from './settings';

// Invented data only: nothing from a real log.

describe('readSettings: the example settings («почати без ШІ»)', () => {
  const settings = readSettings(EXAMPLE_DIARY.profile);

  it('reads the four activity kinds with their parts', () => {
    expect(settings.morningWarmup.levels.map((level) => level.name)).toEqual(['рівень 1', 'рівень 2']);
    expect(settings.morningWarmup.levels[0]!.items).toEqual([
      { exercise: 'exercise-1', reps: '10', seconds: null },
      { exercise: 'exercise-2', reps: '', seconds: 30 },
    ]);
    expect(settings.daytimeWarmup.groups.map((group) => group.name)).toEqual(['для спини']);
    expect(settings.workout.sessions.map((session) => session.id)).toEqual(['a']);
    expect(settings.workout.sessions[0]!.items[0]).toEqual(
      { exercise: 'exercise-6', reps: '10', seconds: null, weight: 5, sets: 3, side: '', fields: ['weight', 'reps'] },
    );
    expect(settings.movement.kinds[0]).toEqual({ id: 'movement-1', name: 'рух 1', fields: ['km', 'minutes'], source: { type: 'user' } });
  });

  it('reads its questions', () => {
    expect(settings.trackers.map((tracker) => `${tracker.id}:${tracker.kind}`)).toEqual(['energy:scale', 'pulse:number', 'hard:yesno', 'tired:scale']);
  });

  it('reads the goal and the phrases', () => {
    expect(settings.goal).toEqual({ enabled: true, days: 5, done: ['morningWarmup'] });
    expect(settings.encouragement).toEqual(['ти можеш налаштувати все в налаштуваннях :)']);
    expect(settings.accent).toBe('pink');
  });
});

describe('readSettings: groups of exercises and every kind of question', () => {
  const settings = readSettings({
    workout: { enabled: true, sessions: [{ id: 's', items: [
      { exercise: 'a', reps: 10 },
      { set: [{ exercise: 'b', reps: '12', fields: ['reps'] }, { exercise: 'c', seconds: 30, fields: ['seconds'] }] },
    ] }] },
    trackers: [
      { id: 'energy', name: 'енергія', hint: '0 — немає сил', kind: 'scale', min: 0, max: 10, ask: ['morning', 'afterWorkout'] },
      { id: 'hard', name: 'було важко?', kind: 'yesno', ask: ['afterWorkout'] },
      { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'] },
      { id: 'pressure', name: 'тиск', kind: 'numbers', units: ['мм рт. ст.', 'мм рт. ст.'], ask: ['morning'] },
      { id: 'note', name: 'нотатка', kind: 'note', ask: ['evening'] },
    ],
  });

  it('reads a group of exercises in a workout', () => {
    expect(settings.workout.sessions[0]!.items[1]).toEqual({
      set: [
        { exercise: 'b', reps: '12', seconds: null, weight: null, sets: null, side: '', fields: ['reps'] },
        { exercise: 'c', reps: '', seconds: 30, weight: null, sets: null, side: '', fields: ['seconds'] },
      ],
    });
  });

  it('reads every kind of tracker', () => {
    expect(settings.trackers).toEqual([
      { id: 'energy', name: 'енергія', hint: '0 — немає сил', ask: ['morning', 'afterWorkout'], kind: 'scale', min: 0, max: 10 },
      { id: 'hard', name: 'було важко?', hint: '', ask: ['afterWorkout'], kind: 'yesno' },
      { id: 'pulse', name: 'пульс', hint: '', ask: ['morning'], kind: 'number', unit: 'уд/хв' },
      { id: 'pressure', name: 'тиск', hint: '', ask: ['morning'], kind: 'numbers', units: ['мм рт. ст.', 'мм рт. ст.'] },
      { id: 'note', name: 'нотатка', hint: '', ask: ['evening'], kind: 'note' },
    ]);
  });
});

describe('readSettings: settings saved by «бета 0.81»', () => {
  it('takes a timed warm-up exercise from `timed` + `reps`', () => {
    const settings = readSettings({
      morningWarmup: { enabled: true, levels: [{ id: 'l1', items: [{ exercise: 'plank', reps: '40', timed: true }, { exercise: 'squat', reps: '8–10' }] }] },
    });
    expect(settings.morningWarmup.levels[0]!.items).toEqual([
      { exercise: 'plank', reps: '', seconds: 40 },
      { exercise: 'squat', reps: '8–10', seconds: null },
    ]);
  });

  it('keeps a link only when it is a web address', () => {
    const settings = readSettings({
      exercises: [
        { id: 'a', name: 'а', source: { type: 'link', url: 'https://example.com/a', by: 'ai' } },
        { id: 'b', name: 'б', source: { type: 'link', url: 'javascript:alert(1)' } },
        { id: 'c', name: 'в', source: { type: 'link', url: 'http://example.com/c' } },
      ],
    });
    expect(settings.exercises.map((exercise) => exercise.source)).toEqual([
      { type: 'link', url: 'https://example.com/a', by: 'ai' },
      { type: 'user' },
      { type: 'link', url: 'http://example.com/c', by: 'user' },
    ]);
  });
});

describe('readSettings: missing or broken parts', () => {
  it('gives an empty, switched-off diary for empty settings', () => {
    const settings = readSettings({});
    expect(settings.goal).toEqual({ enabled: true, days: 5, done: [] });
    expect(settings.morningWarmup).toEqual({ enabled: false, weeklyTarget: 0, hint: '', levels: [] });
    expect(settings.workout.sessions).toEqual([]);
    expect(settings.trackers).toEqual([]);
    expect(settings.encouragement).toEqual([]);
  });

  it('leaves out entries without an id and unknown values', () => {
    const settings = readSettings({
      goal: { enabled: false, days: 'п’ять', done: ['workout', 'yoga'] },
      encouragement: ['  ', 'ок', 7],
      workout: { enabled: true, weeklyTarget: 2, sessions: [
        { name: 'без id', items: [] },
        { id: 's', items: [{ reps: 5 }, { exercise: 'x', fields: ['speed'] }, { set: [{ reps: 1 }] }, { set: [{ exercise: 'y', weight: 7, reps: 5 }] }] },
      ] },
      trackers: [{ id: 't', kind: 'mood', ask: ['night', 'evening'] }, { kind: 'yesno' }, { id: 'u', kind: 'numbers', units: ['кг'] }],
    });
    expect(settings.goal).toEqual({ enabled: false, days: 5, done: ['workout'] });
    expect(settings.encouragement).toEqual(['ок', '7']);
    expect(settings.workout.sessions).toEqual([{ id: 's', name: '', how: '', items: [
      { exercise: 'x', reps: '', seconds: null, weight: null, sets: null, side: '', fields: ['reps'] },
      { set: [{ exercise: 'y', reps: '5', seconds: null, weight: 7, sets: null, side: '', fields: ['reps'] }] },
    ] }]);
    expect(settings.trackers).toEqual([
      { id: 't', name: '', hint: '', ask: ['evening'], kind: 'scale', min: 0, max: 10 },
      { id: 'u', name: '', hint: '', ask: [], kind: 'numbers', units: ['кг', ''] },
    ]);
  });

  it('drops warm-up items without an exercise and reads missing units as empty', () => {
    const settings = readSettings({
      daytimeWarmup: { enabled: true, groups: [{ id: 'g', items: [{ reps: 3 }, { exercise: 'e', reps: 3 }] }] },
      trackers: [{ id: 'p', kind: 'number' }, { id: 'q', kind: 'numbers' }],
    });
    expect(settings.daytimeWarmup.groups[0]!.items).toEqual([{ exercise: 'e', reps: '3', seconds: null }]);
    expect(settings.trackers).toEqual([
      { id: 'p', name: '', hint: '', ask: [], kind: 'number', unit: '' },
      { id: 'q', name: '', hint: '', ask: [], kind: 'numbers', units: ['', ''] },
    ]);
  });

  it('gives a movement kind minutes when it has no fields', () => {
    const settings = readSettings({ movement: { enabled: true, kinds: [{ id: 'swim', name: 'плавання', fields: [] }], hint: 'хоч трохи' } });
    expect(settings.movement).toEqual({ enabled: true, weeklyTarget: 0, hint: 'хоч трохи', kinds: [{ id: 'swim', name: 'плавання', fields: ['minutes'], source: { type: 'user' } }] });
  });
});
