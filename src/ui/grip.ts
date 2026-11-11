/**
 * A text field with Figma's icon/resize-grip (73:3444) in its bottom right
 * corner. The grip is drawn by CSS (a mask in the muted colour, so it follows
 * the accent) and lets taps through to the field's own resize handle.
 */
export function withGrip(textarea: string): string {
  return `<span class="field-wrap">${textarea}<span class="field-grip" aria-hidden="true"></span></span>`;
}
