import { describe, expect, it } from 'vitest';
import type { DayKey } from '../domain/dates';
import { emptyDay, readDay, type Day } from '../domain/day';
import { readSettings } from '../domain/settings';
import { checkInBody, daytimeBody, morningBody, movementBody, noteBody, workoutBody, type SectionContext } from './sections';
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
    expect(texts(box, '.tracker__name, .checkbox__label, .labeled__name, .tracker__note > .t-1st-semibold')).toEqual(['без назви', 'без назви', 'без назви', 'без назви']);
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

  it('draws two numbers as one field [ ] / [ ] with one unit (input/base number-pair, VISUAL-AUDIT п. 17)', () => {
    const pairs = box.querySelectorAll<HTMLElement>('.number--pair');
    expect(pairs).toHaveLength(1);
    const pair = pairs[0]!;
    expect(pair.querySelectorAll('.number__input')).toHaveLength(2);
    expect(texts(pair, '.number__slash')).toEqual(['/']);
    expect(texts(pair, '.number__unit')).toEqual(['мм']);
    expect([...pair.querySelectorAll('.number__input')].map((input) => input.getAttribute('aria-label'))).toEqual(['тиск, перше число, мм', 'тиск, друге число, мм']);
  });

  it('names both units when the two numbers differ', () => {
    const mixed = [{ id: 'q', name: 'вага', kind: 'numbers', units: ['кг', 'г'], ask: ['morning'] }];
    expect(texts(render(checkInBody(ctx({ trackers: mixed }, day), 'morning')), '.number__unit')).toEqual(['кг / г']);
  });

  it('tells the line how many letters are typed, so it starts after them (input/base filled)', () => {
    const lengths = [...box.querySelectorAll<HTMLInputElement>('.number__input')].map((input) => input.style.getPropertyValue('--len'));
    expect(lengths).toEqual(['2', '3', '0']);
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

describe('a warm-up exercise as checklist/exercise (VISUAL-AUDIT п. 12, 14, 15)', () => {
  const exercises = [
    { id: 'a', name: 'присідання', how: 'повільно' },
    { id: 't', name: 'планка', how: 'рівно' },
    { id: 'p', name: 'без опису' },
  ];
  const level = { id: 'l', duration: '5 хв', items: [{ exercise: 'a', reps: 10 }, { exercise: 't', seconds: 30 }, { exercise: 'p', reps: 5 }] };
  const box = render(morningBody(ctx({ morningWarmup: { enabled: true, levels: [level] }, exercises })));
  const item = (n: number) => box.querySelectorAll<HTMLElement>('.ex-check')[n]!;

  it('puts the count right after the name, small', () => {
    expect(texts(item(0), '.ex-check__name')).toEqual(['присідання 10 разів']);
    expect(item(0).querySelector('.ex-check__name .ex-check__reps')!.className).toBe('ex-check__reps t-3rd-semibold');
  });

  it('opens «як робити» with + at the right of the row, not with a row of its own', () => {
    const more = item(0).querySelector<HTMLButtonElement>('.ex-check__head > .ex-check__more')!;
    expect(more.getAttribute('aria-label')).toBe('як робити: присідання');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(box.querySelector(`#${more.getAttribute('aria-controls')}`)!.textContent).toContain('повільно');
    expect(box.querySelector('.ex-check .how-acc')).toBeNull();
  });

  it('has no + when there is nothing to open', () => {
    expect(item(2).querySelector('.ex-check__more')).toBeNull();
  });

  it('keeps a timed exercise open with its stopwatch, «ще раз» under it and no number for one round', () => {
    const more = item(1).querySelector<HTMLButtonElement>('.ex-check__more')!;
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const details = box.querySelector<HTMLElement>(`#${more.getAttribute('aria-controls')}`)!;
    expect(details.querySelector('.sw')).not.toBeNull();
    expect(texts(details, '.set-row__n')).toEqual(['']);
    expect(details.querySelector('.sw-block > .btn--tertiary')!.textContent).toBe('ще раз');
  });

  it('puts «позначити весь рівень» first in the open level, under its time line', () => {
    const body = box.querySelector('.acc-body--group')!;
    expect(body.firstElementChild!.textContent).toBe('позначити весь рівень');
  });
});

describe('the pulse timer as tracker/pulse-timer (VISUAL-AUDIT п. 16, Н7)', () => {
  const trackers = [{ id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'], timer: { enabled: true, seconds: 30 } }];
  const box = render(checkInBody(ctx({ trackers }), 'morning'));

  it('names the question in bold with its unit on the right, and puts the field and «таймер» side by side', () => {
    const head = box.querySelector('.pulse__head')!;
    expect([...head.children].map((child) => `${child.className}:${child.textContent}`)).toEqual(['t-1st-bold:пульс', 't-3rd-regular muted:уд/хв']);
    const row = box.querySelector('.pulse__row')!;
    expect(row.querySelector('.number__input')!.getAttribute('aria-label')).toBe('пульс, уд/хв');
    expect(row.querySelector('.btn--tertiary')!.textContent).toBe('таймер · 30 с');
    expect(row.querySelector('.number__unit')).toBeNull();
  });
});

describe('a picked workout as activity/section workout-active (VISUAL-AUDIT п. 19)', () => {
  const exercises = [{ id: 'a', name: 'тяга' }];
  const workout = { enabled: true, hint: 'відпочинок 60 с між підходами', sessions: [{ id: 's', name: 'тренування А', items: [{ exercise: 'a', sets: 2, reps: '10', fields: ['weight', 'reps'] }] }] };
  const earlier = '2026-11-09' as DayKey;
  const days = { [earlier]: readDay({ wo: { session: 's', ex: { a: [{ w: 5, r: 10, s: null }] } } }, earlier) };
  const box = render(workoutBody({ ...ctx({ workout, exercises }, readDay({ wo: { session: 's' } }, DATE)), days }));

  it('names the workout in header 5 and the rules in 1st text regular', () => {
    expect(box.querySelector('.wo-title')!.className).toBe('t-h5 wo-title');
    expect(box.querySelector('.wo-rules')!.className).toBe('wo-rules t-1st-regular');
    expect(box.querySelector('.wo-rules')!.textContent).toBe('відпочинок 60 с між підходами');
  });

  it('draws units in «минулого разу» small and muted', () => {
    expect(box.querySelector('.wo-ex__sub p')!.innerHTML).toBe('<b>минулого разу:</b> 5 <span class="unit">кг</span> × 10');
  });
});

describe('numbers and × on rows (killing mutants)', () => {
  it('numbers several rounds of a timed exercise', () => {
    const level = { id: 'l', items: [{ exercise: 't', seconds: 30 }] };
    const day = readDay({ mw: { times: { t: [20, 0] } } }, DATE);
    const box = render(morningBody(ctx({ morningWarmup: { enabled: true, levels: [level] }, exercises: [{ id: 't', name: 'планка' }] }, day)));
    expect(texts(box, '.set-row__n')).toEqual(['1', '2']);
    expect(texts(box, '[data-sw-time]')).toEqual(['00.20.00', '00.00.00']);
    // a stored 0 is a time too, not an empty round
    expect([...box.querySelectorAll<HTMLElement>('.sw')].map((sw) => sw.dataset.state)).toEqual(['saved', 'saved']);
  });

  it('gives × from the second set and the second lap, never to the first', () => {
    const workout = { enabled: true, sessions: [{ id: 's', items: [{ exercise: 'a', sets: 2, fields: ['reps'] }] }] };
    const wo = render(workoutBody(ctx({ workout, exercises: [{ id: 'a', name: 'тяга' }] }, readDay({ wo: { session: 's' } }, DATE))));
    expect([...wo.querySelectorAll('.set-row')].map((row) => row.querySelector('.rm') ? '×' : '-')).toEqual(['-', '×']);
    const movement = { enabled: true, kinds: [{ id: 'k', name: 'ходьба', fields: ['km'] }] };
    const mv = render(movementBody(ctx({ movement }, readDay({ mv: { k: { km: 1, min: null, steps: null, more: [{ km: 2, min: null, steps: null }] } } }, DATE))));
    expect([...mv.querySelectorAll('.set-row')].map((row) => row.querySelector('.rm') ? '×' : '-')).toEqual(['-', '×']);
  });

  it('names a pulse question without a name', () => {
    const trackers = [{ id: 'p', kind: 'number', units: ['уд/хв'], ask: ['morning'], timer: { enabled: true, seconds: 30 } }];
    expect(texts(render(checkInBody(ctx({ trackers }), 'morning')), '.pulse__head .t-1st-bold')).toEqual(['без назви']);
  });
});

describe('text fields with the resize grip (п. 18)', () => {
  it('gives the note and a note question the grip', () => {
    const trackers = [{ id: 'n', name: 'нотатка', kind: 'note', ask: ['morning'] }];
    expect(render(checkInBody(ctx({ trackers }), 'morning')).querySelector('.field-wrap > textarea.field + .field-grip')).not.toBeNull();
    expect(render(noteBody(ctx({}))).querySelector('.field-wrap > textarea.note-field + .field-grip')).not.toBeNull();
  });
});
