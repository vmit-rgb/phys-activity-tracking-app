import { beforeEach, describe, expect, it } from 'vitest';
import { wireAccordions } from './accordion';

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
