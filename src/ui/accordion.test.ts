import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireAccordions } from './accordion';
import { fakeAnimate } from './test-animate';

describe('accordion', () => {
  let root: HTMLElement;
  const trigger = () => root.querySelector<HTMLButtonElement>('#t')!;
  const panel = () => root.querySelector<HTMLElement>('#p')!;

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = `
      <button id="t" type="button" class="accordion" aria-expanded="false" aria-controls="p">
        <span class="accordion__title">вправи</span>
      </button>
      <div id="p" hidden>зміст</div>`;
    wireAccordions(root);
  });

  it('shows + while closed', () => {
    expect(trigger().querySelector('.accordion__icon')!.innerHTML).toContain('M14.1191');
  });

  it('opens the panel on tap and shows −', () => {
    trigger().click();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hidden).toBe(false);
    expect(trigger().querySelector('.accordion__icon')!.innerHTML).not.toContain('M14.1191');
  });

  it('closes it again on the second tap', () => {
    trigger().click();
    trigger().click();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);
  });

  it('tells who listens about every change', () => {
    const heard: [string, boolean][] = [];
    const other = document.createElement('div');
    other.innerHTML = root.innerHTML;
    wireAccordions(other, (button, expanded) => heard.push([button.id, expanded]));
    other.querySelector<HTMLButtonElement>('#t')!.click();
    other.querySelector<HTMLButtonElement>('#t')!.click();
    expect(heard).toEqual([['t', true], ['t', false]]);
  });

  it('ignores taps outside the triggers', () => {
    panel().click();
    expect(panel().hidden).toBe(true);
  });

  it('does nothing for a disabled trigger', () => {
    trigger().disabled = true;
    trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel().hidden).toBe(true);
  });

  it('says which panel is missing instead of failing silently', () => {
    const errors: string[] = [];
    const listen = (event: ErrorEvent) => {
      errors.push(event.message);
      event.preventDefault();
    };
    window.addEventListener('error', listen);
    panel().remove();
    trigger().click();
    window.removeEventListener('error', listen);
    expect(errors).toEqual(['accordion: panel #p is missing']);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('accordion in motion (MICROINTERACTIONS.md)', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  let root: HTMLElement;
  const trigger = () => root.querySelector<HTMLButtonElement>('.accordion')!;
  const panel = () => root.querySelector<HTMLElement>('#p')!;
  const icon = () => trigger().querySelector<HTMLElement>('.accordion__icon')!;
  const rows = () => [...panel().children];

  function mount(kind: string): void {
    root.innerHTML = `
      <section><button type="button" class="ctl accordion ${kind}" aria-expanded="false" aria-controls="p">вправи</button>
      <div id="p" hidden><p>1</p><p>2</p><p>3</p></div></section>`;
    wireAccordions(root);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fake = fakeAnimate();
    root = document.createElement('div');
    document.body.append(root);
    mount('accordion--section');
  });
  afterEach(() => {
    fake.restore();
    root.remove();
    vi.useRealTimers();
  });

  it('opens: the body grows in 360 ms and the rows come one by one, 40 ms apart', () => {
    trigger().click();
    expect(panel().hidden).toBe(false);
    const grow = fake.on(panel())[0]!;
    expect(grow.options.duration).toBe(360);
    expect(grow.keyframes[0]).toEqual({ height: '0px' });
    expect(rows().map((row) => fake.on(row)[0]!.options.delay)).toEqual([0, 40, 80]);
  });

  it('runs the glint from the title down the body while it opens', () => {
    trigger().click();
    const glint = root.querySelector('.fx-glint')!;
    expect(fake.on(glint)[0]!.options.duration).toBe(360);
    fake.finishAll();
    expect(root.querySelector('.fx-glint')).toBeNull();
  });

  it('turns + into − through ASCII frames, not by rotating', () => {
    trigger().click();
    const frames = [icon().dataset.g];
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(80);
      frames.push(icon().dataset.g);
    }
    expect(frames).toEqual(['*', '=', '-', undefined]);
  });

  it('closes: rows leave from the bottom up, the body folds, and only then it hides', () => {
    trigger().click();
    fake.finishAll();
    fake.played.length = 0;
    trigger().click();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(false);
    expect(rows().map((row) => fake.on(row)[0]!.options.delay)).toEqual([80, 40, 0]);
    const fold = fake.on(panel())[0]!;
    expect(fold.keyframes.at(-1)).toEqual({ height: '0px' });
    fold.finish();
    expect(panel().hidden).toBe(true);
  });

  it('stays open when tapped again while it folds', () => {
    trigger().click();
    trigger().click();
    trigger().click();
    fake.finishAll();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hidden).toBe(false);
  });

  it('drops «як робити» in from 6 px above with a fade instead of growing', () => {
    mount('accordion--mini');
    trigger().click();
    const [drop] = fake.on(panel());
    expect(drop!.keyframes[0]).toEqual({ opacity: 0, transform: 'translateY(-6px)' });
    expect(drop!.options.duration).toBe(240);
  });
});
