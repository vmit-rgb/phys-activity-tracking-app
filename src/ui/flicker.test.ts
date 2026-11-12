import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accentFlicker, dimmed, rgbOf, TV_KEYFRAMES, tvFlicker } from './flicker';
import { fakeAnimate } from './test-animate';

const root = document.documentElement;
let fake: ReturnType<typeof fakeAnimate>;

beforeEach(() => {
  fake = fakeAnimate();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runAllTimers();
  fake.restore();
  vi.useRealTimers();
  root.removeAttribute('data-no-motion');
  root.removeAttribute('style');
});

const tv = () => document.querySelector('.fx-tv');

describe('theme change: two flickers of TV noise, 720 ms (MICROINTERACTIONS.md)', () => {
  it('puts the new theme on in the middle, under the noise', () => {
    const apply = vi.fn();
    tvFlicker(apply);
    expect(tv()).not.toBeNull();
    expect(tv()!.getAttribute('aria-hidden')).toBe('true');
    expect(fake.on(tv())[0]!.options.duration).toBe(720);
    vi.advanceTimersByTime(395);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(324);
    expect(tv()).toBeNull();
  });

  it('flickers twice: two peaks of the noise', () => {
    const opacities = TV_KEYFRAMES.map((frame) => Number(frame.opacity));
    const peaks = opacities.filter((o, i) => i > 0 && i < opacities.length - 1 && o > opacities[i - 1]! && o > opacities[i + 1]!);
    expect(peaks).toHaveLength(2);
    expect(opacities.at(0)).toBe(0);
    expect(opacities.at(-1)).toBe(0);
  });

  it('lets the next change come once the first is already on, without running it twice', () => {
    const first = vi.fn();
    tvFlicker(first);
    vi.advanceTimersByTime(500);
    tvFlicker(() => {});
    expect(first).toHaveBeenCalledOnce();
  });

  it('still changes on a phone that can’t animate', () => {
    fake.restore();
    const apply = vi.fn();
    tvFlicker(apply);
    vi.advanceTimersByTime(720);
    expect(apply).toHaveBeenCalledOnce();
    expect(tv()).toBeNull();
    fake = fakeAnimate();
  });

  it('changes at once, with no noise, under «вимкнути всі анімації»', () => {
    root.setAttribute('data-no-motion', '');
    const apply = vi.fn();
    tvFlicker(apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(tv()).toBeNull();
  });

  it('puts a change still waiting on at once when the next one comes, so none is lost', () => {
    const first = vi.fn();
    const second = vi.fn();
    tvFlicker(first);
    vi.advanceTimersByTime(100);
    tvFlicker(second);
    expect(first).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('.fx-tv')).toHaveLength(1);
    vi.advanceTimersByTime(720);
    expect(second).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
  });
});

describe('accent change: only the accent flickers', () => {
  it('reads the colours the browser computed', () => {
    expect(rgbOf('#161616')).toEqual([22, 22, 22]);
    expect(rgbOf(' 255 113 157')).toEqual([255, 113, 157]);
    expect(rgbOf('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(rgbOf('')).toBeNull();
    expect(rgbOf('red')).toBeNull();
  });

  it('dims the accent into the page, 45 % accent', () => {
    expect(dimmed('255 113 157', '#161616')).toBe('127 63 83');
    expect(dimmed('nonsense', '#161616')).toBeNull();
  });

  it('dims, comes back, dims and puts the new accent on at 400 ms, then leaves nothing behind', () => {
    root.style.setProperty('--bg', '#000000');
    const accent = () => root.style.getPropertyValue('--accent-rgb');
    const apply = vi.fn();
    accentFlicker(root, apply);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(399);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(240);
    expect(accent()).toBe('');
  });

  it('dims the colour it can read', () => {
    root.style.setProperty('--bg', '#000000');
    const seen: string[] = [];
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (name: string) => (name === '--accent-rgb' ? '200 100 0' : '#000000'),
    }) as CSSStyleDeclaration);
    accentFlicker(root, () => {});
    vi.advanceTimersByTime(0);
    seen.push(root.style.getPropertyValue('--accent-rgb'));
    vi.advanceTimersByTime(140);
    seen.push(root.style.getPropertyValue('--accent-rgb'));
    spy.mockRestore();
    expect(seen).toEqual(['90 45 0', '']);
  });

  it('changes at once under «вимкнути всі анімації»', () => {
    root.setAttribute('data-no-motion', '');
    const apply = vi.fn();
    accentFlicker(root, apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(root.style.getPropertyValue('--accent-rgb')).toBe('');
  });
});
