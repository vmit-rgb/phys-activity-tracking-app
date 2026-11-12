import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountToast, undo, type Toast } from './toast';
import { fakeAnimate } from './test-animate';

describe('toast', () => {
  let host: HTMLElement;
  let toast: Toast;
  const box = () => host.querySelector<HTMLElement>('.toast')!;
  const text = () => host.querySelector<HTMLElement>('.toast__message')!;
  const action = () => host.querySelector<HTMLButtonElement>('.toast__action')!;
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
    toast.show({ message: 'підхід видалено', showIcon: true, action: undo(onUndo) });
    expect(action().textContent).toBe('скасувати');
    action().click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(text().textContent).toBe('скасовано');
    expect(action().hidden).toBe(true);
    expect(box().hidden).toBe(false);
  });

  it('hides the action for a message without one', () => {
    expect(action().classList).toContain('ctl');
    toast.show({ message: 'видалено', action: undo(() => {}) });
    toast.show({ message: 'не вдалося зберегти' });
    expect(action().hidden).toBe(true);
  });

  it('runs another action under its own label and closes when it has nothing more to say', () => {
    const update = vi.fn();
    toast.show({ message: 'є нова версія', emoticon: ':)', action: { label: 'оновити', run: update } });
    expect(action().textContent).toBe('оновити');
    action().click();
    expect(update).toHaveBeenCalledTimes(1);
    expect(box().hidden).toBe(true);
  });

  it('keeps a single toast when shown again', () => {
    toast.show({ message: 'один' });
    toast.show({ message: 'два' });
    expect(host.querySelectorAll('.toast')).toHaveLength(1);
    expect(text().textContent).toBe('два');
  });
});

describe('toast in motion (MICROINTERACTIONS.md)', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  let host: HTMLElement;
  let toast: Toast;
  const box = () => host.querySelector<HTMLElement>('.toast')!;
  const check = () => host.querySelector<HTMLElement>('.toast__check')!;

  beforeEach(() => {
    vi.useFakeTimers();
    fake = fakeAnimate();
    host = document.createElement('div');
    toast = mountToast(host);
  });
  afterEach(() => {
    fake.restore();
    vi.useRealTimers();
  });

  it('comes out from under the bar in 360 ms', () => {
    toast.show({ message: 'збережено' });
    const [rise] = fake.on(box());
    expect(rise!.keyframes[0]).toMatchObject({ transform: 'translateY(100%)' });
    expect(rise!.options.duration).toBe(360);
  });

  it('types the message in letter by letter, the emoticon as one', () => {
    toast.show({ message: 'ок', emoticon: ':)' });
    expect(host.querySelector('.toast__message')!.textContent).toBe('ок :)');
    expect(fake.on(host.querySelector('.toast__emoticon'))).toHaveLength(1);
    expect(fake.played.filter((run) => run.el.classList.contains('fx-ch'))).toHaveLength(3);
  });

  it('assembles ✓ out of characters', () => {
    toast.show({ message: 'видалено', showIcon: true });
    const frames = [check().dataset.g];
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(80);
      frames.push(check().dataset.g);
    }
    expect(frames).toEqual(['.', '\\', 'v', undefined]);
  });

  it('hides faster than it comes, in 240 ms, and only then is gone', () => {
    toast.show({ message: 'видалено' });
    fake.finishAll();
    host.querySelector<HTMLButtonElement>('.toast__close')!.click();
    expect(box().hidden).toBe(false);
    const fall = fake.on(box()).at(-1)!;
    expect(fall.options.duration).toBe(240);
    fall.finish();
    expect(box().hidden).toBe(true);
  });

  it('stays when a new message comes while it hides', () => {
    toast.show({ message: 'видалено' });
    host.querySelector<HTMLButtonElement>('.toast__close')!.click();
    toast.show({ message: 'збережено' });
    fake.finishAll();
    expect(box().hidden).toBe(false);
  });

  it('does not come out again when it is already shown', () => {
    toast.show({ message: 'один' });
    fake.finishAll();
    toast.show({ message: 'два' });
    expect(fake.on(box())).toHaveLength(1);
  });
});
