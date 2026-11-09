/**
 * Remembers whether the person is using a keyboard or touch/mouse, as
 * data-modality on the root. Text fields match :focus-visible even on a tap,
 * so their focus ring (Figma `focus/ring`) is shown only for the keyboard;
 * a tap shows the «selected» look instead.
 */
export function trackInputModality(root: HTMLElement): void {
  root.dataset.modality = 'pointer';
  root.addEventListener('keydown', () => {
    root.dataset.modality = 'keyboard';
  });
  root.addEventListener('pointerdown', () => {
    root.dataset.modality = 'pointer';
  });
}
