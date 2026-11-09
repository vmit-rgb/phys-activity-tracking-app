import type { Phone } from '../app/start';
import { VERSION_LABEL } from '../version';

/* Pieces shared by the screens. Every text here is static: nothing the person typed goes into HTML. */

/** UA/EN switch: shown, English not ready yet (Olesia, 2026-11-08). */
export const LANGUAGE_SWITCH = `
  <nav class="lang" aria-label="мова">
    <button type="button" class="ctl btn btn--tertiary" aria-current="true">укр</button>
    <span class="lang__slash" aria-hidden="true">/</span>
    <button type="button" class="ctl btn btn--tertiary lang__soon" aria-disabled="true" title="англійська версія буде згодом">eng</button>
  </nav>`;

/** layout/footer (113:4801) */
export const FOOTER = `
  <footer class="footer t-3rd-regular">
    <p>(Олеся + Нитка / AI)</p>
    <p class="muted">${VERSION_LABEL}</p>
    <p class="muted">© 2026 Олеся Кіштанова · усі права захищено</p>
  </footer>`;

export const PHONE_NAMES: Record<Phone, string> = {
  android: 'андроїд',
  iphone: 'айфон',
};

/** tabs/platform: two toggles, one per phone. `prefix` is «маю » on the first screen. */
export function platformToggles(prefix: string): string {
  const toggle = (platform: Phone) =>
    `<button type="button" class="ctl tab" aria-pressed="false" data-platform="${platform}">${prefix}${PHONE_NAMES[platform]}</button>`;
  return `<div class="segmented" role="group" aria-label="твій телефон">${toggle('android')}${toggle('iphone')}</div>`;
}

/** Marks the chosen phone and calls back on every choice. */
export function wirePlatformToggles(host: HTMLElement, onChoose: (phone: Phone) => void): (phone: Phone) => void {
  const toggles = [...host.querySelectorAll<HTMLButtonElement>('[data-platform]')];
  const choose = (phone: Phone) => {
    for (const toggle of toggles) toggle.setAttribute('aria-pressed', String(toggle.dataset.platform === phone));
    onChoose(phone);
  };
  for (const toggle of toggles) {
    toggle.addEventListener('click', () => choose(toggle.dataset.platform === 'iphone' ? 'iphone' : 'android'));
  }
  return choose;
}

/** Finds an element the screen's own markup must have. */
export function part<T extends Element>(host: ParentNode, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`screen part missing: ${selector}`);
  return element;
}
