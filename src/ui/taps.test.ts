import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireTapMotion } from './taps';
import { fakeAnimate } from './test-animate';

/** A screen that draws itself anew on every change, as home does. */
function screen(host: HTMLElement) {
  let ticked = false;
  const draw = () => {
    host.innerHTML = `
      <label class="ctl checkbox"><input class="checkbox__input" type="checkbox" data-input="tick" data-ex="squat"${ticked ? ' checked' : ''} /><span class="checkbox__box"></span>присідання</label>
      <button type="button" class="ctl btn btn--secondary" data-act="add-set" data-ex="squat">додати підхід</button>
      <button type="button" class="ctl btn btn--secondary" data-act="add-set" data-ex="lunge">додати підхід</button>
      <button type="button" class="ctl accordion" aria-expanded="false" aria-controls="x">розминка</button>
      <button type="button" class="ctl chip" aria-pressed="false">біль</button>
      <button type="button" class="ctl cal-day" data-cal="day" data-day="2026-11-12">12</button>
      <button type="button" class="ctl btn btn--primary" disabled>зберегти</button>`;
  };
  host.addEventListener('change', (event) => {
    ticked = (event.target as HTMLInputElement).checked;
    draw();
  });
  host.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-act]')) draw();
  });
  draw();
}

describe('tap motion', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  let host: HTMLElement;
  const box = () => host.querySelector<HTMLElement>('.checkbox__box')!;
  const tick = () => host.querySelector<HTMLInputElement>('.checkbox__input')!.click();

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
    document.documentElement.removeAttribute('data-no-motion');
    vi.useRealTimers();
  });
  wireTapMotion(document);

  it('ticks the checkbox drawn after the change through [.] [+] [x] with a pop of 1.15', () => {
    tick();
    vi.advanceTimersByTime(0);
    expect(box().dataset.g).toBe('[.]');
    vi.advanceTimersByTime(80);
    expect(box().dataset.g).toBe('[+]');
    vi.advanceTimersByTime(80);
    expect(box().dataset.g).toBe('[x]');
    vi.advanceTimersByTime(80);
    expect(box().dataset.g).toBeUndefined();
    expect(fake.on(box()).some((run) => run.keyframes[1]?.transform === 'scale(1.15)')).toBe(true);
  });

  it('unticks it the other way: [+] [.] [ ]', () => {
    tick();
    vi.advanceTimersByTime(300);
    tick();
    vi.advanceTimersByTime(0);
    expect(box().dataset.g).toBe('[+]');
    vi.advanceTimersByTime(160);
    expect(box().dataset.g).toBe('[ ]');
  });

  it('pops the very button that was tapped, even after the screen is drawn anew', () => {
    host.querySelectorAll<HTMLButtonElement>('[data-act]')[1]!.click();
    vi.advanceTimersByTime(0);
    const [squat, lunge] = host.querySelectorAll('[data-act]');
    expect(fake.on(squat!)).toEqual([]);
    expect(fake.on(lunge!).map((run) => run.options.easing)).toEqual(['cubic-bezier(.34,1.56,.64,1)']);
  });

  it('leaves the controls with motion of their own to it: accordion, chip, calendar day', () => {
    for (const selector of ['.accordion', '.chip', '.cal-day']) host.querySelector<HTMLElement>(selector)!.click();
    vi.advanceTimersByTime(0);
    expect(fake.played).toEqual([]);
  });

  it('pops nothing that is disabled', () => {
    host.querySelector<HTMLButtonElement>('.btn--primary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(fake.played).toEqual([]);
  });

  it('pops a button wider than 220 px more softly', () => {
    const scaleAt = (width: number) => {
      fake.played.length = 0;
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
      host.querySelector<HTMLButtonElement>('[data-act]')!.click();
      vi.advanceTimersByTime(0);
      vi.restoreAllMocks();
      return fake.on(host.querySelector('[data-act]'))[0]!.keyframes[1]?.transform;
    };
    expect(scaleAt(220)).toBe('scale(1.06)');
    expect(scaleAt(221)).toBe('scale(1.012)');
  });

  it('finds the tapped one by its id when a new row comes in before it', () => {
    const list = document.createElement('div');
    document.body.append(list);
    let rows = ['b'];
    const draw = () => {
      list.innerHTML = rows.map((id) => `<button type="button" class="ctl btn btn--secondary" id="${id}">${id}</button>`).join('');
    };
    list.addEventListener('click', () => {
      rows = ['a', ...rows];
      draw();
    });
    draw();
    list.querySelector<HTMLButtonElement>('#b')!.click();
    vi.advanceTimersByTime(0);
    expect(fake.played.map((run) => run.el.id)).toEqual(['b']);
    list.remove();
  });

  it('lets other fields, checkboxes without a box and buttons that are gone pass quietly', () => {
    const other = document.createElement('div');
    document.body.append(other);
    other.innerHTML = '<input type="text" id="name" /><span><input type="checkbox" id="last" /></span><input type="checkbox" id="bare" /><button type="button" id="gone">×</button>';
    other.querySelector('#name')!.dispatchEvent(new Event('change', { bubbles: true }));
    other.querySelector<HTMLInputElement>('#last')!.click();
    other.querySelector<HTMLInputElement>('#bare')!.click();
    const gone = other.querySelector<HTMLButtonElement>('#gone')!;
    gone.addEventListener('click', () => gone.remove());
    gone.click();
    vi.advanceTimersByTime(0);
    other.remove();
    expect(fake.played).toEqual([]);
  });

  it('springs the chosen day mark of a days slider bigger after − / + or the slider (drawn anew)', () => {
    const days = document.createElement('div');
    document.body.append(days);
    let value = 3;
    const draw = () => {
      days.innerHTML = `<div class="st-days"><button type="button" class="ctl icon-btn" data-act="goal-days" data-delta="1">+</button>
        <input type="range" min="0" max="7" value="${value}" data-input="goal-days" />
        <div class="st-days__ticks">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<span${n === value ? ' class="on"' : ''}>${n}</span>`).join('')}</div></div>`;
    };
    days.addEventListener('click', () => {
      value += 1;
      draw();
    });
    days.addEventListener('input', (event) => {
      value = Number((event.target as HTMLInputElement).value);
      draw();
    });
    draw();
    const grown = () => fake.on(days.querySelector('.st-days__ticks .on')).find((run) => run.keyframes.at(-1)?.transform === 'scale(1.35)');
    days.querySelector<HTMLButtonElement>('[data-act]')!.click();
    vi.advanceTimersByTime(0);
    expect(days.querySelector('.on')!.textContent).toBe('4');
    expect(grown()?.options).toMatchObject({ duration: 240, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    const slider = days.querySelector<HTMLInputElement>('input')!;
    slider.value = '6';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(days.querySelector('.on')!.textContent).toBe('6');
    expect(grown()).toBeDefined();
    days.remove();
  });

  it('keeps still with «вимкнути всі анімації»', () => {
    document.documentElement.setAttribute('data-no-motion', '');
    tick();
    host.querySelector<HTMLButtonElement>('[data-act]')!.click();
    vi.advanceTimersByTime(300);
    expect(box().dataset.g).toBeUndefined();
    expect(fake.played).toEqual([]);
  });
});
