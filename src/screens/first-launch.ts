import type { Phone, Platform } from '../app/start';
import { FOOTER, LANGUAGE_SWITCH, part, PHONE_NAMES, platformToggles, wirePlatformToggles, wireRestore } from './parts';
import { withGrip } from '../ui/grip';

export interface FirstLaunchActions {
  copyPrompt(): void;
  applySettings(text: string): void;
  restore(file: File): void;
  startWithoutAi(): void;
}

/* screen/first-launch (390:9149). Texts: Figma, Нитка's draft (COPY.md). */

const WARNINGS: readonly (readonly [marker: string, kind: string, label: string, text: string])[] = [
  ['[i]', 'info', 'до відома', 'розмова з ШІ займає час. можна вийти й повернутися — застосунок відкриється одразу на полі для вставки.'],
  ['[!]', 'warn', 'важливо', 'це розмова з ШІ про твоє здоровʼя. у налаштуваннях свого ШІ можна вимкнути навчання на твоїх розмовах.'],
  ['[!]', 'warn', 'важливо', 'вправи від ШІ — не програма від фахівця. краще, коли вправи даєш ти: програму від фізіотерапевта чи лікаря передай своєму ШІ <3'],
  ['[*]', 'ai', 'посилання від ШІ', 'посилання на вправи дає ШІ, і ніхто їх не перевіряв. вони позначені *.'],
  ['[i]', 'info', 'до відома', 'застосунок нікуди не відправляє твої дані.'],
];

const consoleRows = WARNINGS.map(([marker, kind, label, text]) => `
  <li class="console__row">
    <span class="console__marker console__marker--${kind}" aria-label="${label}">${marker}</span>
    <span class="t-2nd-regular">${text.replace('<3', '&lt;3')}</span>
  </li>`).join('');

const PASTE_HOW: Record<Phone, string> = {
  android: 'у чаті з ШІ скопіюй його відповідь з налаштуваннями. тут натисни в полі → «вставити».',
  iphone: 'у чаті з ШІ скопіюй його відповідь з налаштуваннями. тут тапни в полі → «вставити».',
};

const MARKUP = `
  <div class="screen">
    ${LANGUAGE_SWITCH}
    <section class="screen__section" aria-labelledby="intro-title">
      <h1 id="intro-title" class="t-h3">привіт! почнімо з налаштувань :)</h1>
      <ol class="steps t-1st-regular">
        <li>скопіюй промпт і встав у чат зі своїм ШІ.</li>
        <li>відповідай на його питання — він складе налаштування.</li>
        <li>скопіюй його відповідь і встав нижче.</li>
      </ol>
      <button type="button" class="ctl btn btn--primary btn--wide" data-copy-prompt>скопіювати промпт</button>
    </section>

    <section class="screen__section" aria-labelledby="warnings-title">
      <h2 id="warnings-title" class="t-h4">перед початком</h2>
      <div class="console">
        <p class="console__command t-2nd-bold" aria-hidden="true">$ cat before-you-start.txt</p>
        <ul class="console__rows">${consoleRows}</ul>
      </div>
    </section>

    <section class="screen__section" aria-labelledby="paste-title">
      <h2 id="paste-title" class="t-h4">встав відповідь ШІ</h2>
      <p class="t-2nd-regular muted" data-platform-hint></p>
      ${platformToggles('маю ')}
      <div class="paste" data-paste hidden>
        <p class="t-1st-regular" data-paste-how></p>
        ${withGrip('<textarea class="field paste__field" rows="3" aria-label="відповідь ШІ" placeholder="встав сюди відповідь ШІ" data-paste-field></textarea>')}
        <button type="button" class="ctl btn btn--primary btn--wide" data-apply disabled>застосувати</button>
        <p class="t-3rd-regular muted">кнопка стане активною, щойно встав текст.</p>
      </div>
    </section>

    <section class="screen__section screen__section--tight" aria-labelledby="other-title">
      <h2 id="other-title" class="t-2nd-bold muted">або</h2>
      <div class="option">
        <button type="button" class="ctl btn btn--tertiary" data-restore>відновити з копії</button>
        <p class="t-3rd-regular muted">якщо переїжджаєш на новий телефон.</p>
        <input type="file" accept=".json,application/json,text/plain" hidden data-restore-file />
      </div>
      <div class="option">
        <button type="button" class="ctl btn btn--tertiary" data-start-without-ai>почати без ШІ</button>
        <p class="t-3rd-regular muted">з прикладами замість твоїх вправ. усе можна змінити в налаштуваннях.</p>
      </div>
    </section>
    ${FOOTER}
  </div>`;

function wirePaste(host: HTMLElement, detected: Platform, actions: FirstLaunchActions): void {
  const hint = part<HTMLElement>(host, '[data-platform-hint]');
  const paste = part<HTMLElement>(host, '[data-paste]');
  const how = part<HTMLElement>(host, '[data-paste-how]');
  const field = part<HTMLTextAreaElement>(host, '[data-paste-field]');
  const apply = part<HTMLButtonElement>(host, '[data-apply]');

  hint.textContent = detected === 'unknown'
    ? 'не вдалося визначити телефон. обери свій — і зʼявиться поле для вставки.'
    : `схоже, у тебе ${PHONE_NAMES[detected]}.`;
  const choose = wirePlatformToggles(host, (phone) => {
    how.textContent = PASTE_HOW[phone];
    paste.hidden = false;
  });
  if (detected !== 'unknown') choose(detected);

  field.addEventListener('input', () => {
    apply.disabled = field.value.trim() === '';
  });
  apply.addEventListener('click', () => actions.applySettings(field.value));
}

function wireOtherWays(host: HTMLElement, actions: FirstLaunchActions): void {
  wireRestore(host, actions.restore);
  part(host, '[data-start-without-ai]').addEventListener('click', () => actions.startWithoutAi());
}

export function showFirstLaunch(host: HTMLElement, detected: Platform, actions: FirstLaunchActions): void {
  host.innerHTML = MARKUP;
  part(host, '[data-copy-prompt]').addEventListener('click', () => actions.copyPrompt());
  wirePaste(host, detected, actions);
  wireOtherWays(host, actions);
}
