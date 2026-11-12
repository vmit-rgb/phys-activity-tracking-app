import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireTapMotion } from './taps';
import { fakeAnimate } from './test-animate';

/*
 * Chips and tabs switch in stripes (MICROINTERACTIONS.md: «чип / таб
 * увімкнено», «таби експорту»; Figma tabs/segmented 179:3188): the fill
 * breaks into vertical stripes, thins out and gathers into the new state,
 * 360 ms; the text colour changes halfway.
 */

/** A chip and two tabs that draw themselves anew on every tap, as the app does. */
function screen(host: HTMLElement) {
  let on = false;
  let tab = 'records';
  const draw = () => {
    host.innerHTML = `
      <button type="button" class="ctl chip" data-act="chip" data-group="neck" aria-pressed="${on}">шия</button>
      <div class="segmented" role="group">
        <button type="button" class="ctl tab" data-act="export-tab" data-tab="records" aria-pressed="${tab === 'records'}">записи</button>
        <button type="button" class="ctl tab" data-act="export-tab" data-tab="exercises" aria-pressed="${tab === 'exercises'}">вправи</button>
      </div>`;
  };
  host.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-act]');
    if (button?.dataset.act === 'chip') on = !on;
    if (button?.dataset.act === 'export-tab') tab = button.dataset.tab!;
    draw();
  });
  draw();
}

describe('chips and tabs switch in stripes', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  let host: HTMLElement;
  const chip = () => host.querySelector<HTMLElement>('.chip')!;
  const seg = () => host.querySelector<HTMLElement>('.segmented')!;
  const tab = (name: string) => host.querySelector<HTMLElement>(`[data-tab="${name}"]`)!;
  const stripesIn = (el: Element) => [...el.querySelectorAll(':scope > .fx-stripes > i')];
  const widthOf = (width: number) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, width, right: width } as DOMRect);

  beforeEach(() => {
    vi.useFakeTimers();
    fake = fakeAnimate();
    host = document.createElement('div');
    document.body.append(host);
    screen(host);
  });
  afterEach(() => {
    fake.restore();
    host.remove();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-no-motion');
    vi.useRealTimers();
  });
  wireTapMotion(document);

  it('fills a chip that turns on with accent stripes, left to right, within 360 ms', () => {
    widthOf(120);
    chip().click();
    vi.advanceTimersByTime(0);
    const stripes = stripesIn(chip());
    expect(stripes.length).toBeGreaterThanOrEqual(6);
    const runs = stripes.map((stripe) => fake.on(stripe)[0]!);
    // off before, on after: each stripe starts unseen and ends filled
    expect(runs.every((run) => run.keyframes[0]!.opacity === 0 && run.keyframes.at(-1)!.opacity === 1)).toBe(true);
    // left to right: the delays grow with the place, and nothing runs past 360 ms
    const delays = runs.map((run) => Number(run.options.delay));
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(runs.every((run) => Number(run.options.delay) + Number(run.options.duration) <= 360)).toBe(true);
    expect(chip().classList.contains('fx-run')).toBe(true);
  });

  it('empties a chip that turns off the same way, and the text changes colour halfway', () => {
    chip().click();
    vi.advanceTimersByTime(0);
    fake.finishAll();
    fake.played.length = 0;
    chip().click();
    vi.advanceTimersByTime(0);
    const runs = stripesIn(chip()).map((stripe) => fake.on(stripe)[0]!);
    expect(runs.every((run) => run.keyframes[0]!.opacity === 1 && run.keyframes.at(-1)!.opacity === 0)).toBe(true);
    const text = fake.on(chip()).find((run) => run.keyframes.some((frame) => frame.color));
    expect(text?.options.duration).toBe(360);
    expect(text!.keyframes.map((frame) => frame.offset ?? null)).toEqual([null, 0.5, 0.51, null]);
  });

  it('cleans up once the stripes are done: no stripes, the chip’s own fill back', () => {
    chip().click();
    vi.advanceTimersByTime(0);
    fake.finishAll();
    expect(chip().querySelector('.fx-stripes')).toBeNull();
    expect(chip().classList.contains('fx-run')).toBe(false);
  });

  it('lets the fill flow from the old tab into the new one, in the direction of the move', () => {
    widthOf(300);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      const left = this.dataset.tab === 'exercises' ? 150 : 0;
      const width = this.matches('.tab') ? 150 : 300;
      return { left, width, right: left + width } as DOMRect;
    });
    tab('exercises').click();
    vi.advanceTimersByTime(0);
    const stripes = stripesIn(seg());
    const runs = stripes.map((stripe) => fake.on(stripe)[0]!);
    const leftOf = (stripe: Element) => parseFloat((stripe as HTMLElement).style.left);
    // stripes over the old tab start filled and end empty; over the new one the other way
    for (const [i, stripe] of stripes.entries()) {
      const [first, last] = [runs[i]!.keyframes[0]!.opacity, runs[i]!.keyframes.at(-1)!.opacity];
      if (leftOf(stripe) + parseFloat((stripe as HTMLElement).style.width) / 2 < 50) expect([first, last]).toEqual([1, 0]);
      else expect([first, last]).toEqual([0, 1]);
    }
    // the colours of both labels swap halfway
    expect(fake.on(tab('exercises')).some((run) => run.keyframes.some((frame) => frame.color))).toBe(true);
    expect(fake.on(tab('records')).some((run) => run.keyframes.some((frame) => frame.color))).toBe(true);
    expect(seg().classList.contains('fx-run')).toBe(true);
    fake.finishAll();
    expect(seg().querySelector('.fx-stripes')).toBeNull();
    expect(seg().classList.contains('fx-run')).toBe(false);
  });

  it('does nothing when the tab tapped was already the chosen one', () => {
    tab('records').click();
    vi.advanceTimersByTime(0);
    expect(fake.played).toEqual([]);
    expect(seg().querySelector('.fx-stripes')).toBeNull();
  });

  it('keeps still with «вимкнути всі анімації»: the state changes, no stripes', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    chip().click();
    tab('exercises').click();
    vi.advanceTimersByTime(0);
    expect(chip().getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.fx-stripes')).toBeNull();
    expect(fake.played).toEqual([]);
  });
});
