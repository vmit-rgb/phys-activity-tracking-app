import { describe, expect, it } from 'vitest';
import { ICON_NAMES, iconSvg } from './icons';

describe('icons', () => {
  it.each(ICON_NAMES)('draws %s in the colour of its button, hidden from screen readers', (name) => {
    const host = document.createElement('div');
    host.innerHTML = iconSvg(name);
    const svg = host.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 25 25');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg.innerHTML).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});
