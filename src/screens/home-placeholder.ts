import { FOOTER, LANGUAGE_SWITCH } from './parts';

/*
 * Until the home screen arrives (stage 5): says the diary is saved. The
 * diary is already stored in its final format, so nothing moves later.
 * Texts are Нитка's draft.
 */
const MARKUP = `
  <div class="screen">
    ${LANGUAGE_SWITCH}
    <section class="screen__section" aria-labelledby="home-title">
      <p class="logo" aria-hidden="true">(ง•_•)ง</p>
      <h1 id="home-title" class="t-h3">налаштування збережено</h1>
      <p class="t-1st-regular">вони лежать тільки на цьому телефоні. головна сторінка зʼявиться в наступному оновленні — застосунок сам підкаже, коли воно буде :)</p>
    </section>
    ${FOOTER}
  </div>`;

export function showHomePlaceholder(host: HTMLElement): void {
  host.innerHTML = MARKUP;
}
