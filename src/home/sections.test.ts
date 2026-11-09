import { describe, expect, it } from 'vitest';
import type { DayKey } from '../domain/dates';
import { emptyDay, readDay, type Day } from '../domain/day';
import { readSettings } from '../domain/settings';
import { checkInBody, daytimeBody, morningBody, movementBody, sessionName, workoutBody, type SectionContext } from './sections';
import { homeSession } from './session';

/* What a section shows for unusual settings. Invented data only. */

const DATE = '2026-11-11' as DayKey;

function render(markup: string): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = markup;
  return box;
}

const ctx = (profile: Record<string, unknown>, day: Day = emptyDay(DATE)): SectionContext => ({
  settings: readSettings(profile), day, days: {}, session: homeSession(),
});
const texts = (box: HTMLElement, selector: string) => [...box.querySelectorAll(selector)].map((element) => element.textContent!.trim());

describe('names and hints that are missing', () => {
  it('a question without a name says «без назви», every kind', () => {
    const trackers = ['scale', 'yesno', 'number', 'note'].map((kind) => ({ id: kind, kind, ask: ['morning'] }));
    const box = render(checkInBody(ctx({ trackers }), 'morning'));
    expect(texts(box, '.tracker__name, .checkbox__label, .labeled__name, .tracker__note > span')).toEqual(['без назви', 'без назви', 'без назви', 'без назви']);
    expect(box.querySelectorAll('.muted')).toHaveLength(0);
  });

  it('an exercise without a name and a movement kind without a name', () => {
    const box = render(morningBody(ctx({ morningWarmup: { enabled: true, levels: [{ id: 'l', items: [{ exercise: 'x' }] }] }, exercises: [{ id: 'x' }] })));
    expect(texts(box, '.checkbox__label')).toEqual(['вправа без назви']);
    expect(texts(box, '.accordion__title')).toEqual(['рівень 1']);
    expect(texts(render(movementBody(ctx({ movement: { enabled: true, kinds: [{ id: 'k' }] } }))), '.mv-kind > p')).toEqual(['без назви']);
  });

  it('a chip without a name, an exercise gone from the settings in a workout', () => {
    expect(texts(render(daytimeBody(ctx({ daytimeWarmup: { enabled: true, groups: [{ id: 'g' }] } }))), '.chip')).toEqual(['без назви']);
    const day = readDay({ wo: { session: 's' } }, DATE);
    const box = render(workoutBody(ctx({ workout: { enabled: true, sessions: [{ id: 's', name: 'а', items: [{ exercise: 'gone' }] }] } }, day)));
    expect(texts(box, '.wo-ex__head .t-1st-semibold')).toEqual(['вправа, якої вже немає']);
  });

  it('says where to add levels and workouts when there are none', () => {
    expect(render(morningBody(ctx({}))).textContent).toContain('рівнів ще немає. додай їх у налаштуваннях.');
    expect(render(workoutBody(ctx({}))).textContent).toContain('тренувань ще немає. додай їх у налаштуваннях.');
    expect(render(daytimeBody(ctx({}))).querySelector('.how-acc')).toBeNull();
  });
});

describe('answers already given', () => {
  const trackers = [
    { id: 'ok', name: 'добре?', kind: 'yesno', ask: ['morning'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: [''], ask: ['morning'] },
    { id: 'p', name: 'тиск', kind: 'numbers', units: ['мм', 'мм'], ask: ['morning'] },
    { id: 'n', name: 'нотатка', kind: 'note', hint: 'коротко', ask: ['morning'] },
  ];
  const day = readDay({ t: { morning: { ok: 'yes', pulse: 61, p: [120, null], n: 'спокійно' } } }, DATE);
  const box = render(checkInBody(ctx({ trackers }, day), 'morning'));

  it('shows them in place', () => {
    expect(box.querySelector<HTMLInputElement>('[data-input="yesno"]')!.checked).toBe(true);
    expect([...box.querySelectorAll<HTMLInputElement>('.number__input')].map((input) => input.value)).toEqual(['61', '120', '']);
    expect(box.querySelector('textarea')!.textContent).toBe('спокійно');
    expect(texts(box, '.muted')).toEqual(['коротко']);
  });

  it('names a field without a unit by the question alone', () => {
    expect(box.querySelector('.number__input')!.getAttribute('aria-label')).toBe('пульс');
  });
});

describe('exercises, links and how-to', () => {
  const exercises = [
    { id: 'a', name: 'а', source: { type: 'link', url: 'https://example.com/a', by: 'user' } },
    { id: 'b', name: 'б' },
  ];

  it('a link given by the person has no *, and a how-to may be just the link', () => {
    const box = render(daytimeBody(ctx({ daytimeWarmup: { enabled: true, groups: [{ id: 'g', name: 'для спини', items: [{ exercise: 'a' }, { exercise: 'b' }] }] }, exercises })));
    expect(box.querySelector('a')!.getAttribute('href')).toBe('https://example.com/a');
    expect(box.querySelector('.ai-mark')).toBeNull();
    expect(box.querySelector('.how')).toBeNull();
    expect(texts(box, '.zone__item p')).toEqual(['а', 'б']);
  });

  it('a workout: the plan reads «3 × 10 на кожну ногу», «30 с», or nothing', () => {
    const items = [
      { exercise: 'a', sets: 3, reps: '10', side: 'на кожну ногу' },
      { exercise: 'b', seconds: 30, fields: ['seconds'] },
      { exercise: 'b', fields: ['reps', 'seconds'], seconds: 20 },
    ];
    const day = readDay({ wo: { session: 's' } }, DATE);
    const box = render(workoutBody(ctx({ workout: { enabled: true, sessions: [{ id: 's', name: 'тренування на спину', items }] }, exercises }, day)));
    expect(texts(box, '.wo-ex__head .muted')).toEqual(['3 × 10 на кожну ногу', '30 с', '20']);
    expect(texts(box, '.wo-title')).toEqual(['тренування на спину']);
    expect(box.querySelector('.how-acc .accordion--paragraph')).toBeNull();
    expect(box.querySelectorAll('.wo-ex__sub p')).toHaveLength(0);
  });

  it('a workout removed from the settings keeps its records', () => {
    const box = render(workoutBody(ctx({}, readDay({ wo: { session: 'gone' } }, DATE))));
    expect(box.textContent).toContain('цього тренування вже немає в налаштуваннях. записи збережено.');
  });
});

describe('sessionName', () => {
  it('«а» becomes «тренування А»; a full name stays', () => {
    expect(sessionName('а')).toBe('тренування А');
    expect(sessionName('Тренування для ніг')).toBe('Тренування для ніг');
  });
});
