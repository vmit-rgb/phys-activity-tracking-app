import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fadeShown, glyphs, MS, play, pop, stagger, typeIn, whenDone } from './motion';
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
