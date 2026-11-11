import { describe, expect, it } from 'vitest';
import { trackNumberFill } from './number-fill';

describe('number field line', () => {
  it('follows what is typed, so the line starts after the digits', () => {
    const root = document.createElement('div');
    root.innerHTML = '<label class="number"><input class="number__input" style="--len: 0" /></label><input class="other" />';
    trackNumberFill(root);
    const input = root.querySelector<HTMLInputElement>('.number__input')!;
    input.value = '1234';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.style.getPropertyValue('--len')).toBe('4');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.style.getPropertyValue('--len')).toBe('0');
  });

  it('leaves other inputs alone', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input class="other" />';
    trackNumberFill(root);
    const other = root.querySelector<HTMLInputElement>('.other')!;
    other.value = 'abc';
    other.dispatchEvent(new Event('input', { bubbles: true }));
    expect(other.style.getPropertyValue('--len')).toBe('');
  });
});
