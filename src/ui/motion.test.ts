import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode, fadeShown, GLYPHS, glyphs, MS, play, pop, scrambleTo, stagger, typeIn, whenDone } from './motion';
import { fakeAnimate } from './test-animate';

describe('motion', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  let el: HTMLElement;
  const root = document.documentElement;

  beforeEach(() => {
    fake = fakeAnimate();
    el = document.createElement('div');
    document.body.append(el);
    vi.useFakeTimers();
  });
  afterEach(() => {
    fake.restore();
    el.remove();
    root.removeAttribute('data-no-motion');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses only the durations of the scale (MICROINTERACTIONS.md)', () => {
    expect(Object.values(MS)).toEqual([120, 240, 360, 420, 720, 1200]);
  });

  it('plays nothing with «вимкнути всі анімації»', () => {
    root.setAttribute('data-no-motion', '');
    expect(play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: MS.s })).toBeNull();
    pop(el);
    expect(fake.played).toEqual([]);
  });

  it('plays nothing when the phone reduces motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    pop(el);
    expect(fake.played).toEqual([]);
  });

  it('runs the follow-up at once when nothing plays, and only at the end when it does', () => {
    const done = vi.fn();
    whenDone(null, done);
    expect(done).toHaveBeenCalledTimes(1);
    const run = play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: MS.s });
    whenDone(run, done);
    expect(done).toHaveBeenCalledTimes(1);
    fake.finishAll();
    expect(done).toHaveBeenCalledTimes(2);
    (run as unknown as { cancel(): void }).cancel();
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('pops a tapped control with a spring: up and back in 240 ms', () => {
    pop(el, 1.15);
    const [run] = fake.on(el);
    expect(run!.options.duration).toBe(MS.s);
    expect(run!.keyframes.map((k) => k.transform)).toEqual(['scale(1)', 'scale(1.15)', 'scale(1)']);
  });

  it('brings the children in one by one, 40 ms apart, from 8 px below', () => {
    el.innerHTML = '<p>1</p><p>2</p><p>3</p>';
    stagger(el);
    const runs = [...el.children].map((child) => fake.on(child)[0]!);
    expect(runs.map((run) => run.options.delay)).toEqual([0, 40, 80]);
    expect(runs[0]!.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateY(8px)' });
  });

  it('shows glyph frames 80 ms each, then the drawn state again', () => {
    const done = vi.fn();
    glyphs(el, ['[.]', '[+]', '[x]'], done);
    expect(el.dataset.g).toBe('[.]');
    vi.advanceTimersByTime(80);
    expect(el.dataset.g).toBe('[+]');
    vi.advanceTimersByTime(80);
    expect(el.dataset.g).toBe('[x]');
    vi.advanceTimersByTime(80);
    expect(el.dataset.g).toBeUndefined();
    expect(done).toHaveBeenCalled();
  });

  it('lets a new run of glyphs replace one still going', () => {
    glyphs(el, ['[.]', '[+]', '[x]']);
    vi.advanceTimersByTime(80);
    glyphs(el, ['[+]', '[.]', '[ ]']);
    expect(el.dataset.g).toBe('[+]');
    vi.advanceTimersByTime(240);
    expect(el.dataset.g).toBeUndefined();
  });

  it('types a text in letter by letter within 360 ms and keeps it readable whole', () => {
    el.textContent = 'збережено';
    typeIn(el);
    expect(el.textContent).toBe('збережено');
    const delays = fake.played.map((run) => run.options.delay!);
    expect(delays).toHaveLength(9);
    expect(delays[0]).toBe(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(MS.m);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });

  it('leaves the text whole and still with «вимкнути всі анімації», and one letter comes at once', () => {
    root.setAttribute('data-no-motion', '');
    el.textContent = 'ок';
    typeIn(el);
    expect(el.childNodes).toHaveLength(1);
    root.removeAttribute('data-no-motion');
    el.textContent = 'x';
    typeIn(el);
    expect(fake.played.map((run) => run.options.delay)).toEqual([0]);
  });

  it('brings an element inside the text in whole, as one letter', () => {
    el.innerHTML = 'є <span class="emo">:)</span>';
    typeIn(el);
    expect(fake.on(el.querySelector('.emo'))).toHaveLength(1);
    expect(el.querySelector('.emo')!.textContent).toBe(':)');
    expect(fake.played).toHaveLength(3);
  });
});

describe('fading a floating button in and out', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  let el: HTMLElement;
  beforeEach(() => {
    fake = fakeAnimate();
    el = document.createElement('button');
    el.hidden = true;
    document.body.append(el);
  });
  afterEach(() => {
    fake.restore();
    el.remove();
  });

  it('shows it at once and fades it in', () => {
    fadeShown(el, true);
    expect(el.hidden).toBe(false);
    expect(fake.on(el)[0]!.keyframes[0]).toMatchObject({ opacity: 0 });
  });

  it('fades it out and only then hides it', () => {
    fadeShown(el, true);
    fadeShown(el, false);
    expect(el.hidden).toBe(false);
    fake.on(el).at(-1)!.finish();
    expect(el.hidden).toBe(true);
  });

  it('does nothing when nothing changes, so scrolling does not restart it', () => {
    fadeShown(el, false);
    fadeShown(el, true);
    fadeShown(el, true);
    expect(fake.on(el)).toHaveLength(1);
  });

  it('keeps it when shown again while it fades out', () => {
    fadeShown(el, true);
    fadeShown(el, false);
    fadeShown(el, true);
    fake.finishAll();
    expect(el.hidden).toBe(false);
  });
});

describe('a text that changed re-forms out of ASCII glyphs (decode)', () => {
  let el: HTMLElement;
  const root = document.documentElement;
  const shown = () => el.querySelector('[aria-hidden="true"]')!.textContent!;
  const spoken = () => el.querySelector('.visually-hidden')!.textContent;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('p');
    el.textContent = 'пн, 9 лис';
    document.body.append(el);
  });
  afterEach(() => {
    el.remove();
    root.removeAttribute('data-no-motion');
    vi.useRealTimers();
  });

  it('shows glyphs first, spaces stay spaces, and a screen reader hears only the real text', () => {
    decode(el, MS.s);
    expect(spoken()).toBe('пн, 9 лис');
    expect([...shown()]).toHaveLength(9);
    expect(shown()[3]).toBe(' ');
    expect([...shown()].filter((ch) => ch !== ' ').every((ch) => GLYPHS.includes(ch) || 'пн,9лис'.includes(ch))).toBe(true);
  });

  it('ends as the plain text when its time is up, not a step before', () => {
    decode(el, MS.s);
    vi.advanceTimersByTime(MS.s - 40);
    expect(el.dataset.busy).toBeDefined();
    vi.advanceTimersByTime(40);
    expect(el.dataset.busy).toBeUndefined();
    expect(el.childElementCount).toBe(0);
    expect(el.textContent).toBe('пн, 9 лис');
  });

  it('resolves left to right: the first letter is in place before the last', () => {
    el.textContent = 'abcdefghijklmnopqrst';
    decode(el, MS.xxl);
    vi.advanceTimersByTime(MS.xxl * 0.35);
    expect(shown()[0]).toBe('a');
    expect(shown().at(-1)).not.toBe('t');
  });

  it('puts each letter in place at its own moment, the first ones from the start', () => {
    // no randomness: letter i settles at i / (n - 1) × 0.7 of the time, plus 0.3 × 0.5
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    el.textContent = 'abcdefghijk';
    decode(el, 400);
    expect(shown()).toBe(';;;;;;;;;;;');
    vi.advanceTimersByTime(120);
    expect(shown()).toBe('abc;;;;;;;;');
    vi.mocked(Math.random).mockReturnValue(0);
    el.textContent = 'abc';
    decode(el, 400);
    expect(shown()).toBe('a!!');
    vi.advanceTimersByTime(120);
    expect(shown()).toBe('a!!');
    vi.advanceTimersByTime(40);
    expect(shown()).toBe('ab!');
    el.textContent = 'x';
    decode(el, 400);
    expect(shown()).toBe('x');
    vi.restoreAllMocks();
  });

  it('leaves a text with an element inside as it is', () => {
    el.innerHTML = 'пн <b>9</b>';
    decode(el, MS.s);
    expect(el.innerHTML).toBe('пн <b>9</b>');
    expect(el.dataset.busy).toBeUndefined();
  });

  it('lets a new decode replace one still going, keeping the newest text', () => {
    decode(el, MS.s);
    vi.advanceTimersByTime(80);
    el.textContent = 'вт, 10 лис';
    decode(el, MS.s);
    vi.advanceTimersByTime(MS.s);
    expect(el.textContent).toBe('вт, 10 лис');
  });

  it('draws the glyphs in place in a text a screen reader skips anyway', () => {
    el.setAttribute('aria-hidden', 'true');
    decode(el, MS.s);
    expect(el.childElementCount).toBe(0);
    expect([...el.textContent!]).toHaveLength(9);
    vi.advanceTimersByTime(MS.s);
    expect(el.textContent).toBe('пн, 9 лис');
  });

  it('keeps the text still with «вимкнути всі анімації»', () => {
    root.setAttribute('data-no-motion', '');
    decode(el, MS.s);
    expect(el.childElementCount).toBe(0);
    expect(el.textContent).toBe('пн, 9 лис');
  });
});

describe('digits dissolve into glyphs and give way to the new text (scramble)', () => {
  let el: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('span');
    el.textContent = '00.12.40';
    document.body.append(el);
  });
  afterEach(() => {
    el.remove();
    document.documentElement.removeAttribute('data-no-motion');
    vi.useRealTimers();
  });

  it('runs through glyphs for 240 ms, then shows the new text and calls back', () => {
    const done = vi.fn();
    scrambleTo(el, '00.00.00', done);
    vi.advanceTimersByTime(MS.xs);
    expect(el.textContent).not.toBe('00.12.40');
    expect(el.dataset.busy).toBeDefined();
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MS.xs);
    expect(el.textContent).toBe('00.00.00');
    expect(el.dataset.busy).toBeUndefined();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('blanks more of the digits as the time runs', () => {
    // a glyph while the dice (0.3) stay above 0.6 of the time gone, a blank after
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    scrambleTo(el, '00.00.00');
    expect(el.textContent).toBe('********');
    vi.advanceTimersByTime(120);
    expect(el.textContent).toBe('********');
    vi.advanceTimersByTime(40);
    expect(el.textContent).toBe('        ');
    vi.restoreAllMocks();
  });

  it('puts the new text at once with «вимкнути всі анімації»', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    const done = vi.fn();
    scrambleTo(el, '00.00.00', done);
    expect(el.textContent).toBe('00.00.00');
    expect(done).toHaveBeenCalled();
  });
});
