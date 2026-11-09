import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountToast, type Toast } from './toast';

describe('toast', () => {
  let host: HTMLElement;
  let toast: Toast;
  const box = () => host.querySelector<HTMLElement>('.toast')!;
  const text = () => host.querySelector<HTMLElement>('.toast__message')!;
  const undo = () => host.querySelector<HTMLButtonElement>('.toast__undo');
  const close = () => host.querySelector<HTMLButtonElement>('.toast__close')!;

  beforeEach(() => {
    host = document.createElement('div');
    toast = mountToast(host);
  });

  it('stays hidden until something happens, but is already announced as a status', () => {
    expect(box().hidden).toBe(true);
    expect(box().getAttribute('role')).toBe('status');
  });

  it('shows the message with the emoticon in its own accent span', () => {
    toast.show({ message: 'збережено', emoticon: ':)' });
    expect(box().hidden).toBe(false);
    expect(text().textContent).toBe('збережено :)');
    expect(text().querySelector('.toast__emoticon')!.textContent).toBe(':)');
  });

  it('shows ✓ only when a process has a result', () => {
    toast.show({ message: 'збережено', showIcon: true });
    expect(host.querySelector('.toast__check')!.hasAttribute('hidden')).toBe(false);
    toast.show({ message: 'за цей день записів немає' });
    expect(host.querySelector('.toast__check')!.hasAttribute('hidden')).toBe(true);
  });

  it('never closes on its own, only with ×', () => {
    vi.useFakeTimers();
    toast.show({ message: 'видалено', showIcon: true });
    vi.advanceTimersByTime(60_000);
    expect(box().hidden).toBe(false);
    close().click();
    expect(box().hidden).toBe(true);
    vi.useRealTimers();
  });

  it('runs undo once and then says «скасовано» without another undo', () => {
    const onUndo = vi.fn();
    toast.show({ message: 'підхід видалено', showIcon: true, onUndo });
    undo()!.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(text().textContent).toBe('скасовано');
    expect(undo()!.hidden).toBe(true);
    expect(box().hidden).toBe(false);
  });

  it('hides undo for a message that cannot be undone', () => {
    toast.show({ message: 'видалено', onUndo: () => {} });
    toast.show({ message: 'не вдалося зберегти' });
    expect(undo()!.hidden).toBe(true);
  });

  it('keeps a single toast when shown again', () => {
    toast.show({ message: 'один' });
    toast.show({ message: 'два' });
    expect(host.querySelectorAll('.toast')).toHaveLength(1);
    expect(text().textContent).toBe('два');
  });
});
