/**
 * Number fields (Figma input/base): the line between the brackets starts
 * after the typed digits. The field's input carries --len, the number of
 * letters in it; the markup sets it first, this keeps it up to date.
 */
export function trackNumberFill(root: HTMLElement): void {
  root.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.classList.contains('number__input')) input.style.setProperty('--len', String(input.value.length));
  });
}
