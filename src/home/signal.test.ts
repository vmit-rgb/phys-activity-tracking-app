import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The end of the pulse timer on phones that can and can't make each signal. */

const started: number[] = [];

class FakeAudio {
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  createOscillator() {
    return { frequency: { value: 0 }, connect: (next: unknown) => next, start: () => started.push(this.currentTime), stop: () => {} };
  }
  createGain() {
    return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (next: unknown) => next };
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  started.length = 0;
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('endSignal', () => {
  it('beeps once the sound was prepared on a tap', async () => {
    vi.stubGlobal('AudioContext', FakeAudio);
    const { endSignal, prepareSound } = await import('./signal');
    prepareSound();
    endSignal();
    expect(started).toEqual([0]);
  });

  it('still vibrates and flashes where there is no sound', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { endSignal, FLASH_MS, prepareSound } = await import('./signal');
    prepareSound();
    endSignal();
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
    expect(document.querySelector('.flash')).not.toBeNull();
    vi.advanceTimersByTime(FLASH_MS);
    expect(document.querySelector('.flash')).toBeNull();
  });

  it('flashes on a phone without vibration', async () => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
    const { endSignal } = await import('./signal');
    endSignal();
    expect(document.querySelector('.flash')).not.toBeNull();
  });
});
