import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ACCENT, parseAccent } from './accents';

describe('accents', () => {
  it('offers the nine accents in the order of the Figma picker', () => {
    expect(ACCENTS).toEqual([
      'gray', 'orange', 'pink', 'magenta', 'purple', 'violet', 'blue', 'cyan', 'mint',
    ]);
  });

  it('uses pink when nothing is chosen', () => {
    expect(DEFAULT_ACCENT).toBe('pink');
    expect(parseAccent(undefined)).toBe('pink');
  });

  it('keeps a current accent as it is', () => {
    expect(parseAccent('cyan')).toBe('cyan');
  });

  it.each([
    ['red', 'orange'],
    ['amber', 'orange'],
    ['yellow', 'orange'],
    ['green', 'mint'],
    ['lime', 'mint'],
  ])('moves the removed accent %s to the nearest one, %s', (old, nearest) => {
    expect(parseAccent(old)).toBe(nearest);
  });

  it.each([42, 'turquoise', '', null, {}, 'toString'])('falls back to pink for %j', (value) => {
    expect(parseAccent(value)).toBe('pink');
  });
});
