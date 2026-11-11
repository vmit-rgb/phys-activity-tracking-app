import { describe, expect, it } from 'vitest';
import { withGrip } from './grip';

describe('withGrip (icon/resize-grip 73:3444 in the corner of a text field, п. 8, 18)', () => {
  it('wraps the field and adds the grip, hidden from screen readers', () => {
    const box = document.createElement('div');
    box.innerHTML = withGrip('<textarea class="field"></textarea>');
    const wrap = box.firstElementChild!;
    expect(wrap.className).toBe('field-wrap');
    expect(wrap.firstElementChild!.tagName).toBe('TEXTAREA');
    expect(wrap.lastElementChild!.className).toBe('field-grip');
    expect(wrap.lastElementChild!.getAttribute('aria-hidden')).toBe('true');
  });
});
