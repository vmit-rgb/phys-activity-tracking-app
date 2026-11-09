import { describe, expect, it } from 'vitest';
import { heroStyle, type HeroStyle } from './hero-fit';

const lines = (byStyle: Record<HeroStyle, number>) => (style: HeroStyle) => byStyle[style];

describe('heroStyle', () => {
  it('keeps header 1 when the phrase fits in 3 lines', () => {
    expect(heroStyle(lines({ 't-h1': 3, 't-h2': 2, 't-h3': 2, 't-h4': 1 }))).toBe('t-h1');
  });
  it('steps down to the largest style that fits in 3 lines', () => {
    expect(heroStyle(lines({ 't-h1': 4, 't-h2': 4, 't-h3': 3, 't-h4': 2 }))).toBe('t-h3');
  });
  it('falls back to header 4 when nothing fits', () => {
    expect(heroStyle(lines({ 't-h1': 7, 't-h2': 6, 't-h3': 5, 't-h4': 4 }))).toBe('t-h4');
  });
});
