/*
 * Units after a number, small and muted, as Figma draws the sums
 * («3 × 12 повт. · 10 кг», history/day-block, workout-active). Takes text
 * that is already escaped and returns markup.
 */
const UNIT = /(\d) (повт\.|кг|км|хв|кроків|кроки|крок|с)(?=$|[\s,·;)])/g;

export function smallUnits(escaped: string): string {
  return escaped.replace(UNIT, '$1 <span class="unit">$2</span>');
}
