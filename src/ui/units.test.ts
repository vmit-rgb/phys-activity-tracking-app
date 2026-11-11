import { describe, expect, it } from 'vitest';
import { smallUnits } from './units';

describe('smallUnits (units small and muted, as Figma draws sums: «3 × 12 повт. · 10 кг»)', () => {
  it('wraps the units that follow a number', () => {
    expect(smallUnits('2 × 10 повт. · 5 кг, 30 с')).toBe(
      '2 × 10 <span class="unit">повт.</span> · 5 <span class="unit">кг</span>, 30 <span class="unit">с</span>');
    expect(smallUnits('3,5 км · 45 хв · 1200 кроків')).toBe(
      '3,5 <span class="unit">км</span> · 45 <span class="unit">хв</span> · 1200 <span class="unit">кроків</span>');
  });

  it('leaves words that only start like a unit alone', () => {
    expect(smallUnits('5 сходинок, 2 кола')).toBe('5 сходинок, 2 кола');
  });
});
