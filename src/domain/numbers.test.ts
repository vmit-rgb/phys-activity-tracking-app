import { describe, expect, it } from 'vitest';
import { formatNumber, parseNumber, plural } from './numbers';

describe('parseNumber', () => {
  it.each<[string, number | null]>([
    ['12', 12],
    ['2,5', 2.5],
    [' 7.25 ', 7.25],
    ['', null],
    ['   ', null],
    ['дванадцять', null],
    ['1e400', null],
  ])('reads «%s» as %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });
});

describe('formatNumber', () => {
  it('writes the Ukrainian comma and at most two decimals', () => {
    expect(formatNumber(2.5)).toBe('2,5');
    expect(formatNumber(3.14159)).toBe('3,14');
    expect(formatNumber(40)).toBe('40');
  });

  it('writes nothing for no number', () => {
    expect(formatNumber(null)).toBe('');
  });
});

describe('plural', () => {
  const laps = (n: number) => plural(n, ['коло', 'кола', 'кіл']);
  it.each<[number, string]>([[1, 'коло'], [2, 'кола'], [4, 'кола'], [5, 'кіл'], [11, 'кіл'], [14, 'кіл'], [21, 'коло'], [22, 'кола'], [0, 'кіл']])(
    '%s → %s', (n, word) => {
      expect(laps(n)).toBe(word);
    },
  );
});
