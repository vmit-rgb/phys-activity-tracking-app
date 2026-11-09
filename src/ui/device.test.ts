import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyWith, saveFile, screenHistory, shareWith } from './device';

const DATA = { title: 'трекер', text: 'текст', url: 'https://example.com/' };

afterEach(() => vi.useRealTimers());

describe('saveFile', () => {
  it('downloads the text under its name and cleans up after itself', () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:copy');
    URL.revokeObjectURL = vi.fn();
    const clicked: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    saveFile(document, 'trekr-kopiya-2026-11-20.json', '{}');
    expect(clicked[0]!.download).toBe('trekr-kopiya-2026-11-20.json');
    expect(clicked[0]!.href).toBe('blob:copy');
    expect(document.querySelector('a')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:copy');
    click.mockRestore();
  });
});

describe('shareWith', () => {
  it('opens the share sheet', async () => {
    const share = vi.fn(async () => {});
    expect(await shareWith({ share }, DATA)).toBe('shared');
    expect(share).toHaveBeenCalledWith(DATA);
  });

  it('takes a closed sheet as cancelled', async () => {
    expect(await shareWith({ share: () => Promise.reject(new DOMException('', 'AbortError')) }, DATA)).toBe('cancelled');
  });

  it('says unavailable without a sheet or when it fails', async () => {
    expect(await shareWith({}, DATA)).toBe('unavailable');
    expect(await shareWith({ share: () => Promise.reject(new DOMException('', 'NotAllowedError')) }, DATA)).toBe('unavailable');
  });
});

describe('copyWith', () => {
  it('copies, and says false when the phone refuses or has no clipboard', async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyWith({ writeText }, 'x')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('x');
    expect(await copyWith({ writeText: () => Promise.reject(new Error('denied')) }, 'x')).toBe(false);
    expect(await copyWith(undefined, 'x')).toBe(false);
  });
});

describe('screenHistory', () => {
  it('marks each screen with its depth and reports the depth on «назад»', () => {
    const history = { pushState: vi.fn(), go: vi.fn() };
    const target = new EventTarget();
    const back = vi.fn();
    const steps = screenHistory(history, target);
    steps.listen(back);
    steps.push(2);
    expect(history.pushState).toHaveBeenCalledWith({ depth: 2 }, '');
    steps.back(2);
    expect(history.go).toHaveBeenCalledWith(-2);
    target.dispatchEvent(Object.assign(new Event('popstate'), { state: { depth: 1 } }));
    target.dispatchEvent(Object.assign(new Event('popstate'), { state: null }));
    expect(back.mock.calls).toEqual([[1], [0]]);
  });
});
