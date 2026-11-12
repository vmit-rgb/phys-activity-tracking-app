import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { circleOver, fillThrough, middleOf, SPIN, spinWhile } from './motion';
import { fakeAnimate } from './test-animate';

const root = document.documentElement;
let fake: ReturnType<typeof fakeAnimate>;
let button: HTMLButtonElement;

beforeEach(() => {
  fake = fakeAnimate();
  vi.useFakeTimers();
  document.body.innerHTML = '<button type="button">зберегти PDF</button>';
  button = document.querySelector('button')!;
});
afterEach(() => {
  vi.runAllTimers();
  fake.restore();
  vi.useRealTimers();
  root.removeAttribute('data-no-motion');
});

describe('the ASCII spinner where something waits', () => {
  it('has Olesia’s frames', () => {
    expect(SPIN).toEqual(['|', '/', '-', '\\']);
  });

  it('turns on the button every 120 ms while the work runs, then gives the label back', async () => {
    let finish!: (value: string) => void;
    const done = spinWhile(button, new Promise<string>((resolve) => (finish = resolve)));
    const frame = () => button.querySelector('.spin')?.textContent;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(frame()).toBe('|');
    vi.advanceTimersByTime(120);
    expect(frame()).toBe('/');
    vi.advanceTimersByTime(240);
    expect(frame()).toBe('\\');
    finish('pdf');
    await vi.runAllTimersAsync();
    await expect(done).resolves.toBe('pdf');
    expect(button.textContent).toBe('зберегти PDF');
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('stays at least 240 ms, so it doesn’t just blink', async () => {
    let settled = false;
    void spinWhile(button, Promise.resolve(1)).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(239);
    expect(settled).toBe(false);
    expect(button.querySelector('.spin')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it('ends with the work when it took longer than 240 ms', async () => {
    let settled = false;
    void spinWhile(button, new Promise((resolve) => setTimeout(resolve, 300))).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(301);
    expect(settled).toBe(true);
  });

  it('leaves a button that already waits as it is', async () => {
    let finish!: () => void;
    const first = spinWhile(button, new Promise<void>((resolve) => (finish = resolve)));
    vi.advanceTimersByTime(120);
    await expect(spinWhile(button, Promise.resolve('again'))).resolves.toBe('again');
    expect(button.querySelector('.spin')!.textContent).toBe('/');
    finish();
    await vi.runAllTimersAsync();
    await first;
    expect(button.textContent).toBe('зберегти PDF');
  });

  it('gives the label back when the work fails too', async () => {
    const done = spinWhile(button, Promise.reject(new Error('offline')));
    const caught = expect(done).rejects.toThrow('offline');
    await vi.runAllTimersAsync();
    await caught;
    expect(button.textContent).toBe('зберегти PDF');
  });

  it('shows a still «…» without motion', async () => {
    root.setAttribute('data-no-motion', '');
    void spinWhile(button, new Promise(() => {}));
    expect(button.querySelector('.spin')!.textContent).toBe('…');
    vi.advanceTimersByTime(360);
    expect(button.querySelector('.spin')!.textContent).toBe('…');
  });
});

describe('the fill through a button whose work is done', () => {
  it('runs the accent through it and away in 1200 ms', () => {
    fillThrough(button);
    const run = fake.on(button).find((r) => r.options.duration === 1200)!;
    expect(run.keyframes.map((k) => k.backgroundSize)).toEqual(['0% 100%', '100% 100%', '100% 100%', '0% 100%']);
    expect(run.keyframes.map((k) => k.backgroundPosition)).toEqual(['0% 0', '0% 0', '100% 0', '100% 0']);
    expect(button.classList.contains('fx-fill')).toBe(true);
    run.finish();
    expect(button.classList.contains('fx-fill')).toBe(false);
  });

  it('re-forms the label out of glyphs and ends with it whole', () => {
    fillThrough(button);
    expect(button.dataset.busy).toBe('');
    vi.advanceTimersByTime(1200);
    expect(button.textContent).toBe('зберегти PDF');
  });

  it('stays still on a phone that can’t animate', () => {
    fake.restore();
    fillThrough(button);
    expect(button.classList.contains('fx-fill')).toBe(false);
    expect(button.dataset.busy).toBeUndefined();
    fake = fakeAnimate();
  });

  it('stays still without motion', () => {
    root.setAttribute('data-no-motion', '');
    fillThrough(button);
    expect(fake.played).toEqual([]);
    expect(button.textContent).toBe('зберегти PDF');
  });
});

describe('a circle growing from a button (menu, search)', () => {
  const at = (left: number, top: number, width: number, height: number) => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
    return el;
  };

  it('starts at the button’s middle, in the covered element’s own coordinates', () => {
    const button = at(10, 590, 40, 40);
    expect(middleOf(button)).toEqual({ x: 30, y: 610 });
    const { from } = circleOver(at(0, 100, 400, 600), middleOf(button), 0);
    expect(from).toBe('circle(0px at 30px 510px)');
  });

  it('ends wide enough to cover the farthest corner, with the margin', () => {
    const { to } = circleOver(at(0, 0, 300, 400), { x: 0, y: 400 }, 40);
    expect(to).toBe('circle(540px at 0px 400px)');
    expect(circleOver(at(100, 50, 300, 400), { x: 400, y: 50 }, 0).to).toBe('circle(500px at 300px 0px)');
  });
});
