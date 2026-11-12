import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import index from '../../index.html?raw';
import { leaveLoading } from './boot';
import { fakeAnimate } from './test-animate';

const root = document.documentElement;
let fake: ReturnType<typeof fakeAnimate>;
let host: HTMLElement;

const LOADING = /<div id="loading"[\s\S]*?<\/div><span class="ld-t">завантажую…<\/span><\/div>/;

beforeEach(() => {
  fake = fakeAnimate();
  document.body.innerHTML = `${LOADING.exec(index)![0]}<main id="app"></main>`;
  host = document.querySelector('#app')!;
});
afterEach(() => {
  fake.restore();
  root.removeAttribute('data-no-motion');
});

const layer = () => document.getElementById('loading');
const homeMarkup = '<div class="home"><header class="hero"></header><div class="home__sections"><section></section><section></section></div><section class="cal-block"></section></div>';

describe('the loading screen (Figma screen/loading 347:9064)', () => {
  it('stands in index.html, before any script: nine spinner cells and «завантажую…»', () => {
    const cells = [...layer()!.querySelectorAll('.ld > span')];
    expect(cells).toHaveLength(9);
    cells.forEach((cell) => expect(cell.textContent!.split('\n')).toEqual(['|', '/', '-', '\\']));
    expect(layer()!.getAttribute('role')).toBe('status');
    expect(layer()!.querySelector('.ld')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('turns by CSS alone, each cell a step behind, and stays still when the phone reduces motion', () => {
    expect(index).toMatch(/animation: ld-spin 480ms steps\(4\) infinite/);
    expect(index).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*#loading \.ld b \{ animation: none; \}/);
  });
});

describe('loading → home (MICROINTERACTIONS.md)', () => {
  it('lets the spinner fly apart and melt in 360 ms, then takes the screen away', () => {
    host.innerHTML = homeMarkup;
    leaveLoading(document, host, 1000);
    const spinner = fake.on(layer()!.querySelector('.ld'))[0]!;
    expect(spinner.options.duration).toBe(360);
    expect(spinner.keyframes.at(-1)).toMatchObject({ transform: 'scale(1.7)', gap: '14px', opacity: 0 });
    expect(layer()!.style.pointerEvents).toBe('none');
    fake.on(layer()).forEach((run) => run.finish());
    expect(layer()).toBeNull();
  });

  it('keeps the spinner at least 240 ms from the start of the page', () => {
    host.innerHTML = homeMarkup;
    leaveLoading(document, host, 100);
    expect(fake.on(layer())[0]!.options.delay).toBe(140);
  });

  it('brings hero, sections and calendar in one after another', () => {
    host.innerHTML = homeMarkup;
    leaveLoading(document, host, 1000);
    const delays = ['.hero', '.home__sections', '.cal-block'].map((selector) => fake.on(host.querySelector(selector))[0]!.options.delay);
    expect(delays).toEqual([240, 360, 480]);
    const sections = [...host.querySelectorAll('.home__sections > section')].map((s) => fake.on(s)[0]!.options.delay);
    expect(sections).toEqual([360, 400]);
  });

  it('brings any other first screen in whole', () => {
    host.innerHTML = '<div class="first"></div>';
    leaveLoading(document, host, 1000);
    expect(fake.on(host.firstElementChild)[0]!.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateY(12px)' });
  });

  it('is simply gone without motion', () => {
    root.setAttribute('data-no-motion', '');
    host.innerHTML = homeMarkup;
    leaveLoading(document, host, 0);
    expect(layer()).toBeNull();
    expect(fake.played).toEqual([]);
  });
});
