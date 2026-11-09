/**
 * Long phrases get a smaller header (Olesia, 2026-10-30; COPY.md «Home»):
 * header 1 → 2 → 3 → 4, the largest that fits in 3 lines; otherwise
 * header 4, which may take 4 lines.
 */
export const HERO_STYLES = ['t-h1', 't-h2', 't-h3', 't-h4'] as const;
export type HeroStyle = (typeof HERO_STYLES)[number];

/** `lines` tells how many lines the phrase takes in a style. */
export function heroStyle(lines: (style: HeroStyle) => number): HeroStyle {
  return HERO_STYLES.find((style) => lines(style) <= 3) ?? 't-h4';
}
