import { beforeEach, describe, expect, it } from 'vitest';
import { trackInputModality } from './modality';

describe('input modality', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('html');
    trackInputModality(root);
  });

  it('assumes touch until a key is pressed', () => {
    expect(root.dataset.modality).toBe('pointer');
  });

  it('switches to keyboard on a key, so fields show the focus ring', () => {
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(root.dataset.modality).toBe('keyboard');
  });

  it('switches back on a tap or a click', () => {
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.dataset.modality).toBe('pointer');
  });
});
