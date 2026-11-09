import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_DELAY_MS, startApp } from '../app/app';
import type { DayKey } from '../domain/dates';
import { emptyDay, readDay } from '../domain/day';
import type { Diary } from '../domain/diary';
import { diaryStore, sectionMemory, type DiaryStore } from '../storage/store';
import { mountToast } from '../ui/toast';
import { AUTOSAVE_MS } from './controls';

/*
 * Logging on home, the way the person does it: tap, type, then check what
 * the phone keeps. Invented data only: nothing from a real log.
 */

const TODAY = '2026-11-11' as DayKey;
const EARLIER = '2026-11-09' as DayKey;

const profile = {
  goal: { enabled: true, days: 3, done: ['workout'] },
  morningWarmup: { enabled: true, levels: [
    { id: 'l1', name: 'рівень 1', duration: '5 хв', items: [{ exercise: 'a', reps: '10' }, { exercise: 't', seconds: 30 }] },
  ] },
  daytimeWarmup: { enabled: true, groups: [{ id: 'back', name: 'для спини', items: [{ exercise: 'a', reps: '5' }] }] },
  workout: { enabled: true, sessions: [
    { id: 's', name: 'а', how: 'спершу розімнися', items: [
      { exercise: 'w', reps: '10', sets: 2, fields: ['weight', 'reps'] },
      { set: [{ exercise: 'p', fields: ['seconds'] }] },
    ] },
  ] },
  movement: { enabled: true, kinds: [{ id: 'walk', name: 'ходьба', fields: ['km', 'minutes'], source: { type: 'link', url: 'https://example.com/walk', by: 'ai' } }] },
  exercises: [
    { id: 'a', name: '<b>нахили</b>', how: 'повільно' },
    { id: 't', name: 'планка' },
    { id: 'w', name: 'присідання', how: 'спина рівна\nдруге речення' },
    { id: 'p', name: 'стійка' },
  ],
  trackers: [
    { id: 'energy', name: 'енергія', kind: 'scale', min: 0, max: 10, ask: ['morning'] },
    { id: 'pressure', name: 'тиск', kind: 'numbers', units: ['мм', 'мм'], ask: ['morning'] },
    { id: 'pulse', name: 'пульс', kind: 'number', units: ['уд/хв'], ask: ['morning'] },
    { id: 'dizzy', name: 'запаморочення?', kind: 'yesno', ask: ['afterWorkout'] },
    { id: 'how', name: 'як пройшло', kind: 'note', ask: ['evening'] },
  ],
};

let host: HTMLElement;
let store: DiaryStore;
let hide: () => void;

function start(days: Diary['days'] = {}, settings: Diary['profile'] = profile): void {
  document.body.innerHTML = '<main id="app"></main>';
  host = document.querySelector<HTMLElement>('#app')!;
  localStorage.clear();
  store = diaryStore(localStorage, () => new Date('2026-11-11T08:00:00Z'));
  store.save({ profile: settings, days });
  startApp({
    host,
    store,
    browser: { chosen: () => true, choose: () => {} },
    platform: 'android',
    installed: true,
    toast: mountToast(document.body),
    today: () => TODAY,
    sections: sectionMemory(localStorage),
    onDiary: () => {},
    whenHidden: (save) => {
      hide = save;
    },
  });
}

const saved = () => {
  vi.advanceTimersByTime(SAVE_DELAY_MS);
  // an empty day isn't stored (as in 0.81)
  return store.load()!.days[TODAY] ?? emptyDay(TODAY);
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`not on screen: ${selector}`);
  return element;
};
const byText = (text: string) => [...host.querySelectorAll<HTMLElement>('button, a')].find((b) => b.textContent!.trim() === text)!;
const byLabel = <T extends HTMLElement = HTMLButtonElement>(label: string) => $<T>(`[aria-label="${label}"]`);
const type = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};
const check = (box: HTMLInputElement) => {
  box.click();
};
const toastText = () => document.querySelector<HTMLElement>('.toast:not([hidden]) .toast__message')?.textContent;
const toastAction = () => document.querySelector<HTMLButtonElement>('.toast:not([hidden]) .toast__action')!;

beforeEach(() => {
  vi.useFakeTimers();
  start();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('morning warm-up', () => {
  it('ticks an exercise, counts it in the level and keeps it', () => {
    check($<HTMLInputElement>('[data-input="tick"][data-ex="a"]'));
    expect(saved().mw.ticks).toEqual(['a']);
    expect($('.sub .accordion__meta').textContent).toBe('5 хв · 1 з 2');
  });

  it('marks the whole level: done, crossed out, closed, with a way back', () => {
    byText('позначити весь рівень').click();
    expect(saved().mw.ticks).toEqual(['a', 't']);
    expect($('.sub').classList.contains('sub--done')).toBe(true);
    expect($('.sub .accordion__meta').textContent).toBe('5 хв · готово');
    expect($('.sub .accordion').getAttribute('aria-expanded')).toBe('false');
    byText('зняти позначки з рівня').click();
    expect(saved().mw.ticks).toEqual([]);
  });

  it('shows names from the settings as text', () => {
    expect($('.ex-check .checkbox__label').textContent).toBe('<b>нахили</b>');
    expect(host.querySelector('.ex-check b')).toBeNull();
  });

  it('times a round of a timed exercise and adds another with «ще раз»', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    byLabel('запустити секундомір, 1').click();
    now.mockReturnValue(32_400);
    byLabel('зупинити й зберегти, 1').click();
    expect(saved().mw.times.t).toEqual([31]);
    expect($('[data-sw-time]').textContent).toBe('00.31.00');
    byText('ще раз').click();
    expect(host.querySelectorAll('.ex-check .sw')).toHaveLength(2);
    now.mockRestore();
  });

  it('names an exercise deleted from the settings by the name kept with the day', () => {
    const levels = [{ id: 'l1', items: [{ exercise: 'old' }, { exercise: 'lost' }] }];
    start({ [EARLIER]: readDay({ note: '.', names: { old: 'стара вправа' } }, EARLIER) }, { ...profile, morningWarmup: { enabled: true, levels } });
    const names = [...host.querySelectorAll('.ex-check .checkbox__label')].map((name) => name.textContent);
    expect(names).toEqual(['стара вправа', 'вправа, якої вже немає']);
  });

  it('× on one of several timers removes that round', () => {
    start({ [TODAY]: readDay({ mw: { times: { t: [20, 25] } } }, TODAY) });
    byLabel('видалити таймер 1').click();
    byLabel('точно видалити таймер 1').click();
    expect(saved().mw.times.t).toEqual([25]);
    expect(toastText()).toBe('таймер видалено');
  });

  it('× on the only timer has nothing to reset before it runs', () => {
    expect(byLabel('скинути таймер до нуля').disabled).toBe(true);
    byLabel('запустити секундомір, 1').click();
    expect(byLabel('скинути таймер до нуля').disabled).toBe(false);
  });

  it('× on the only timer resets it after a second tap, with «скасувати»', () => {
    start({ [TODAY]: readDay({ mw: { times: { t: [20] } } }, TODAY) });
    byLabel('скинути таймер до нуля').click();
    expect(saved().mw.times.t).toEqual([20]);
    byLabel('точно скинути таймер до нуля').click();
    // nothing left in the day, so nothing is stored for it
    expect(saved().mw.times.t).toBeUndefined();
    expect($('[data-sw-time]').textContent).toBe('00.00.00');
    expect(toastText()).toBe('таймер скинуто');
    toastAction().click();
    expect(saved().mw.times.t).toEqual([20]);
  });
});

describe('daytime warm-up', () => {
  it('marks a chip as done and unmarks it', () => {
    const chip = () => $('[data-act="chip"]');
    chip().click();
    expect(saved().dw).toEqual(['back']);
    expect(chip().getAttribute('aria-pressed')).toBe('true');
    chip().click();
    expect(saved().dw).toEqual([]);
  });
});

describe('workout', () => {
  beforeEach(() => {
    start({ [EARLIER]: readDay({ wo: { session: 's', ex: { w: [{ w: 20, r: 10 }, { w: 20, r: 8 }] } } }, EARLIER) });
    byText('тренування А').click();
  });

  it('picks a session and shows its exercises with the last time', () => {
    expect(saved().wo).toEqual({ session: 's', ex: {}, rows: {} });
    expect($('.wo-title').textContent).toBe('тренування А');
    expect($('.wo-ex').textContent).toContain('минулого разу: 20 кг × 10, 20 кг × 8');
    expect($('.wo-ex').textContent).toContain('спина рівна');
    expect(host.querySelectorAll('.wo-ex')[0]!.querySelectorAll('.set-row')).toHaveLength(2);
  });

  it('keeps what is typed in a set and counts the day in the weekly goal', () => {
    type(byLabel<HTMLInputElement>('присідання, підхід 1, вага, кг'), '22,5');
    type(byLabel<HTMLInputElement>('присідання, підхід 1, повторення'), '9');
    expect(saved().wo!.ex.w).toEqual([{ w: 22.5, r: 9, s: null }]);
    expect($('.bar__goal').textContent).toBe('цей тиждень: 2 з 3 днів');
  });

  it('«додати підхід» adds a row; × removes it after a second tap, with «скасувати»', () => {
    byText('додати підхід').click();
    expect(host.querySelectorAll('.wo-ex')[0]!.querySelectorAll('.set-row')).toHaveLength(3);
    type(byLabel<HTMLInputElement>('присідання, підхід 3, повторення'), '7');
    byLabel('видалити підхід 3').click();
    expect(byLabel('точно видалити підхід 3').querySelector('svg')).not.toBeNull();
    byLabel('точно видалити підхід 3').click();
    expect(saved().wo!.ex.w).toBeUndefined();
    expect(host.querySelectorAll('.wo-ex')[0]!.querySelectorAll('.set-row')).toHaveLength(2);
    expect(toastText()).toBe('підхід видалено');
    toastAction().click();
    expect(saved().wo!.ex.w).toEqual([{ w: null, r: null, s: null }, { w: null, r: null, s: null }, { w: null, r: 7, s: null }]);
  });

  it('a stopwatch set: ▶ starts, ■ saves, ✓ asks, ↻ starts again', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    $('.wo-group [aria-label="запустити секундомір, 1"]').click();
    vi.advanceTimersByTime(100);
    now.mockReturnValue(45_000);
    vi.advanceTimersByTime(100);
    expect($('.wo-group [data-sw-time]').textContent).toBe('00.45.00');
    $('.wo-group [aria-label="зупинити й зберегти, 1"]').click();
    expect(saved().wo!.ex.p).toEqual([{ w: null, r: null, s: 45 }]);
    $('.wo-group [aria-label="збережено. натисни, щоб перезаписати, 1"]').click();
    expect($('.wo-group .sw__again').textContent).toBe('знову');
    $('.wo-group [aria-label="натисни ще раз — і час запишеться заново, 1"]').click();
    expect($('.wo-group .sw').dataset.state).toBe('running');
    now.mockRestore();
  });

  it('a timed set: × on the only timer resets it, on one of two removes it', () => {
    start({ [TODAY]: readDay({ wo: { session: 's', ex: { p: [{ s: 40 }] } } }, TODAY) });
    $('.wo-group [aria-label="скинути таймер до нуля"]').click();
    $('.wo-group [aria-label="точно скинути таймер до нуля"]').click();
    expect(toastText()).toBe('таймер скинуто');
    expect(saved().wo!.ex.p).toBeUndefined();
    $('.wo-group [data-act="more-sets"]').click();
    $('.wo-group [aria-label="видалити підхід 2"]').click();
    $('.wo-group [aria-label="точно видалити підхід 2"]').click();
    expect(toastText()).toBe('таймер видалено');
    expect($('.wo-group').querySelectorAll('.set-row')).toHaveLength(1);
  });

  it('«прибрати з цього дня» needs one tap when nothing is logged', () => {
    byText('прибрати з цього дня').click();
    expect(saved().wo).toBeNull();
  });

  it('«прибрати з цього дня» asks first when sets are logged', () => {
    type(byLabel<HTMLInputElement>('присідання, підхід 1, повторення'), '9');
    byText('прибрати з цього дня').click();
    expect(saved().wo).not.toBeNull();
    expect(host.textContent).toContain('записи цього тренування видаляться.');
    byText('так, прибрати з цього дня').click();
    expect(saved().wo).toBeNull();
    expect(toastText()).toBe('тренування прибрано');
    toastAction().click();
    expect(saved().wo!.session).toBe('s');
  });

  it('asks a question after the workout', () => {
    check($<HTMLInputElement>('[data-input="yesno"]'));
    expect(saved().t.afterWorkout).toEqual({ dizzy: 'yes' });
    check($<HTMLInputElement>('[data-input="yesno"]'));
    expect(saved().t.afterWorkout).toBeUndefined();
  });
});

describe('wellbeing questions', () => {
  it('a slider value is a draft until «зберегти», then locked until «скинути»', () => {
    byLabel('більше: енергія').click();
    expect($('.tracker__value').textContent).toBe('1/10');
    expect(saved().t).toEqual({});
    byText('зберегти').click();
    expect(saved().t.morning).toEqual({ energy: 1 });
    expect(byLabel<HTMLInputElement>('енергія').disabled).toBe(true);
    byText('скинути').click();
    expect(saved().t.morning).toBeUndefined();
    expect(byLabel<HTMLInputElement>('енергія').disabled).toBe(false);
  });

  it('−/+ stop at the ends of the scale', () => {
    byLabel('менше: енергія').click();
    byLabel('менше: енергія').click();
    expect($('.tracker__value').textContent).toBe('0/10');
    for (let i = 0; i < 12; i++) byLabel('більше: енергія').click();
    expect($('.tracker__value').textContent).toBe('10/10');
  });

  it('a dragged slider saves itself 20 s after the last move', () => {
    type(byLabel<HTMLInputElement>('енергія'), '6');
    type(byLabel<HTMLInputElement>('енергія'), '7');
    expect(host.querySelectorAll('[data-act="slide-save"]')).toHaveLength(1);
    vi.advanceTimersByTime(AUTOSAVE_MS - 1);
    expect(saved().t).toEqual({});
    vi.advanceTimersByTime(1);
    expect(saved().t.morning).toEqual({ energy: 7 });
  });

  it('a slider draft is saved when the day changes or the app is hidden', () => {
    byLabel('менше: енергія').click();
    byLabel('попередній день').click();
    expect(saved().t.morning).toEqual({ energy: 0 });
    byLabel('наступний день').click();
    byText('скинути').click();
    byLabel('більше: енергія').click();
    byLabel('більше: енергія').click();
    hide();
    expect(store.load()!.days[TODAY]!.t.morning).toEqual({ energy: 2 });
  });

  it('keeps two numbers together and one number alone', () => {
    type(byLabel<HTMLInputElement>('тиск, перше число, мм'), '120');
    expect(saved().t.morning).toEqual({ pressure: [120, null] });
    type(byLabel<HTMLInputElement>('тиск, друге число, мм'), '80');
    type(byLabel<HTMLInputElement>('пульс, уд/хв'), '64');
    expect(saved().t.morning).toEqual({ pressure: [120, 80], pulse: 64 });
    type(byLabel<HTMLInputElement>('пульс, уд/хв'), '');
    expect(saved().t.morning).toEqual({ pressure: [120, 80] });
    type(byLabel<HTMLInputElement>('тиск, перше число, мм'), '');
    type(byLabel<HTMLInputElement>('тиск, друге число, мм'), '');
    expect(saved().t.morning).toBeUndefined();
  });

  it('keeps a text answer and the note of the day', () => {
    type($<HTMLTextAreaElement>('[data-input="tracker-note"]'), 'добре');
    type($<HTMLTextAreaElement>('[data-input="note"]'), 'день як день');
    expect(saved().t.evening).toEqual({ how: 'добре' });
    expect(saved().note).toBe('день як день');
    type($<HTMLTextAreaElement>('[data-input="tracker-note"]'), '');
    expect(saved().t.evening).toBeUndefined();
  });
});

describe('movement', () => {
  it('keeps laps and shows the last time', () => {
    start({ [EARLIER]: readDay({ mv: { walk: { km: 2, min: 30 } } }, EARLIER) });
    expect($('.mv-kind').textContent).toContain('минулого разу: 2 км · 30 хв');
    type(byLabel<HTMLInputElement>('ходьба, км'), '1,5');
    byText('додати коло').click();
    type(byLabel<HTMLInputElement>('ходьба, коло 2, хв'), '10');
    expect(saved().mv.walk).toEqual([{ km: 1.5, min: null, steps: null }, { km: null, min: 10, steps: null }]);
  });

  it('removes a lap after a second tap', () => {
    start({ [TODAY]: readDay({ mv: { walk: { km: 1, more: [{ km: 2 }] } } }, TODAY) });
    byLabel('видалити коло 2').click();
    byLabel('точно видалити коло 2').click();
    expect(saved().mv.walk).toEqual([{ km: 1, min: null, steps: null }]);
    expect(toastText()).toBe('коло видалено');
  });

  it('marks a link from the AI and explains it', () => {
    $('.mv-kind button.accordion').click();
    expect($<HTMLAnchorElement>('.mv-kind a').href).toBe('https://example.com/walk');
    byLabel('про посилання від ШІ').click();
    expect(toastText()).toBe('це посилання дав ШІ. перевір його, перш ніж повторювати.');
  });
});

describe('saving', () => {
  it('writes once typing pauses, not on every key', () => {
    const save = vi.spyOn(store, 'save');
    type($<HTMLTextAreaElement>('[data-input="note"]'), 'д');
    type($<HTMLTextAreaElement>('[data-input="note"]'), 'де');
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('says so when the phone refuses to save', () => {
    vi.spyOn(store, 'save').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    $('[data-act="chip"]').click();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(toastText()).toBe('не вдалося зберегти :( спробуй ще раз. якщо повторюється — збережи копію в меню.');
  });

  it('keeps the caret in the field being typed in when the screen is drawn again', () => {
    const note = $<HTMLTextAreaElement>('[data-input="note"]');
    note.focus();
    byLabel('більше: енергія').click();
    expect(document.activeElement).toBe($('[data-input="note"]'));
    expect(document.activeElement).not.toBe(note);
  });

  it('hiding the app before any diary exists stores nothing', () => {
    localStorage.clear();
    document.body.innerHTML = '<main id="app"></main>';
    startApp({
      host: document.querySelector<HTMLElement>('#app')!,
      store,
      browser: { chosen: () => true, choose: () => {} },
      platform: 'android',
      installed: true,
      toast: mountToast(document.body),
      today: () => TODAY,
      sections: sectionMemory(localStorage),
      onDiary: () => {},
      whenHidden: (save) => {
        hide = save;
      },
    });
    hide();
    expect(store.load()).toBeNull();
  });

  it('keeps the focus on the control that was tapped', () => {
    $('[data-act="chip"]').focus();
    $('[data-act="chip"]').click();
    expect(document.activeElement).toBe($('[data-act="chip"]'));
  });
});
