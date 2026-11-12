import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ACCENT, parseAccent } from './accents';

describe('accents', () => {
  it('offers eleven accents around the hue circle (Olesia, 2026-11-12)', () => {
    expect(ACCENTS).toEqual([
      'gray', 'orange', 'pink', 'magenta', 'purple', 'violet', 'blue', 'sky', 'cyan', 'mint', 'green',
    ]);
  });

  it('uses pink when nothing is chosen', () => {
    expect(DEFAULT_ACCENT).toBe('pink');
    expect(parseAccent(undefined)).toBe('pink');
  });

  it.each(['cyan', 'sky', 'green'])('keeps a current accent %s as it is', (accent) => {
    expect(parseAccent(accent)).toBe(accent);
  });

  it.each([
    ['red', 'orange'],
    ['amber', 'orange'],
    ['yellow', 'orange'],
    ['lime', 'green'],
  ])('moves the removed accent %s to the nearest one, %s', (old, nearest) => {
    expect(parseAccent(old)).toBe(nearest);
  });

  it.each([42, 'turquoise', '', null, {}, 'toString'])('falls back to pink for %j', (value) => {
    expect(parseAccent(value)).toBe('pink');
  });
});
