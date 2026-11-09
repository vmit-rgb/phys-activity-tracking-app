import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/typography.css';
import './styles/components.css';
import { ACCENTS, parseAccent } from './domain/accents';
import { wireAccordions } from './ui/accordion';
import { DEFAULT_APPEARANCE, startAppearance, type Appearance, type Theme } from './ui/appearance';
import { trackInputModality } from './ui/modality';
import { ICON_NAMES, iconSvg } from './ui/icons';
import { mountToast } from './ui/toast';

// The living component sheet: every base component in its states, with the
// appearance switches of the profile. Not part of the app itself.

const block = (title: string, body: string) => `
  <section class="sheet__block">
    <h2 class="t-h6">${title}</h2>
    <div class="sheet__row">${body}</div>
  </section>`;

const variants = ['primary', 'secondary', 'tertiary', 'destructive'] as const;

const buttons = variants.map((v) => `
  <button type="button" class="ctl btn btn--${v}">button/${v}</button>
  <button type="button" class="ctl btn btn--${v}" disabled>disabled</button>`).join('');

const iconButtons = (['primary', 'secondary'] as const).map((v) => `
  <button type="button" class="ctl icon-btn icon-btn--${v}" aria-label="меню">${iconSvg('menu')}</button>
  <button type="button" class="ctl icon-btn icon-btn--${v} icon-btn--small" aria-label="меню">${iconSvg('menu')}</button>
  <button type="button" class="ctl icon-btn icon-btn--${v}" aria-label="назад" disabled>${iconSvg('chevron-left')}</button>`).join('');

const icons = ICON_NAMES.map((name) => `<span class="sheet__icon" title="${name}">${iconSvg(name)}</span>`).join('');

const typography = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  '1st-regular', '1st-semibold', '1st-bold', '2nd-regular', '2nd-semibold', '2nd-bold',
  '3rd-regular', '3rd-semibold', '3rd-bold']
  .map((s) => `<p class="t-${s}">${s} · як минув день?</p>`).join('');

const tabs = `
  <div role="tablist" class="sheet__row">
    <button type="button" role="tab" class="ctl tab" aria-selected="true">день</button>
    <button type="button" role="tab" class="ctl tab" aria-selected="false">тиждень</button>
    <button type="button" role="tab" class="ctl tab" aria-selected="false" disabled>місяць</button>
  </div>`;

const checkboxes = `
  <label class="ctl checkbox"><input class="checkbox__input" type="checkbox" /><span class="checkbox__box" aria-hidden="true"></span><span class="checkbox__label">розминка</span></label>
  <label class="ctl checkbox"><input class="checkbox__input" type="checkbox" checked /><span class="checkbox__box" aria-hidden="true"></span><span class="checkbox__label">присідання</span></label>
  <label class="ctl checkbox" aria-disabled="true"><input class="checkbox__input" type="checkbox" disabled /><span class="checkbox__box" aria-hidden="true"></span><span class="checkbox__label">недоступно</span></label>`;

const number = (id: string, attrs = '') => `
  <label class="number" for="${id}">
    <span class="number__bracket" aria-hidden="true">[</span>
    <input class="number__input" id="${id}" inputmode="decimal" autocomplete="off" ${attrs} />
    <span class="number__bracket" aria-hidden="true">]</span>
    <span class="number__unit">хв</span>
  </label>`;

const fields = `
  <textarea class="field" rows="3" aria-label="нотатка" placeholder="як минув день? пиши як є"></textarea>
  <textarea class="field" rows="3" aria-label="нотатка з помилкою" aria-invalid="true">не вдалося зберегти</textarea>
  <textarea class="field" rows="3" aria-label="недоступна нотатка" disabled>...</textarea>
  ${number('n1')}${number('n2', 'value="25"')}${number('n3', 'value="abc" aria-invalid="true"')}${number('n4', 'disabled')}`;

const accordions = `
  <button type="button" class="ctl accordion accordion--section" aria-expanded="false" aria-controls="p1"><span class="accordion__title">тренування</span></button>
  <div id="p1" hidden><p class="t-2nd-regular">зміст секції</p></div>
  <button type="button" class="ctl accordion accordion--group" aria-expanded="false" aria-controls="p2"><span class="accordion__title">силові</span><span class="accordion__meta">25 хв · 4 вправи</span></button>
  <div id="p2" hidden><p class="t-2nd-regular">зміст групи</p></div>
  <button type="button" class="ctl accordion accordion--paragraph" aria-expanded="false" aria-controls="p3"><span class="accordion__title">як це працює</span></button>
  <div id="p3" hidden><p class="t-2nd-regular">зміст абзацу</p></div>
  <button type="button" class="ctl accordion accordion--mini" aria-expanded="false" aria-controls="p4"><span class="accordion__title">детальніше</span></button>
  <div id="p4" hidden><p class="t-3rd-regular">зміст</p></div>
  <button type="button" class="ctl accordion accordion--section" aria-expanded="false" aria-controls="p5" disabled><span class="accordion__title">недоступно</span></button>
  <div id="p5" hidden></div>`;

const toasts = `
  <button type="button" class="ctl btn btn--secondary" data-toast="saved">збережено :)</button>
  <button type="button" class="ctl btn btn--secondary" data-toast="removed">видалено + скасувати</button>
  <button type="button" class="ctl btn btn--secondary" data-toast="info">без ✓</button>`;

const controls = `
  <label class="t-3rd-regular">акцент <select id="accent">${ACCENTS.map((a) => `<option>${a}</option>`).join('')}</select></label>
  <label class="t-3rd-regular">тема <select id="theme"><option>system</option><option>dark</option><option>light</option></select></label>
  <label class="t-3rd-regular"><input id="text" type="checkbox" /> текст × 1.2</label>
  <label class="t-3rd-regular"><input id="targets" type="checkbox" /> тап 56</label>`;

const sheet = document.querySelector<HTMLElement>('#sheet')!;
sheet.innerHTML = `
  <header class="sheet__block"><h1 class="t-h4">компоненти · бета 0.9</h1><div class="sheet__row">${controls}</div></header>
  ${block('typography', `<div>${typography}</div>`)}
  ${block('icon', icons)}
  ${block('button', buttons)}
  ${block('button/icon', iconButtons)}
  ${block('tab', tabs)}
  ${block('checkbox', checkboxes)}
  ${block('input/base', fields)}
  ${block('divider', '<hr class="divider" style="width: 100%" />')}
  ${block('accordion/trigger', `<div class="sheet__column">${accordions}</div>`)}
  ${block('toast/saved', toasts)}
  <div class="noise" aria-hidden="true"></div>`;

const style = document.createElement('style');
style.textContent = `
  .sheet { max-width: 560px; margin: 0 auto; padding: 24px 16px 120px; }
  .sheet__block { display: grid; gap: 8px; margin-bottom: 32px; }
  .sheet__row { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
  .sheet__column { display: grid; gap: 8px; width: 100%; }
  .sheet__icon { color: var(--accent); }
  .sheet select { font: inherit; }`;
document.head.append(style);

wireAccordions(sheet);
const toast = mountToast(document.body);
const messages = {
  saved: { message: 'збережено', emoticon: ':)', showIcon: true },
  removed: { message: 'підхід видалено', showIcon: true, onUndo: () => {} },
  info: { message: 'за цей день записів немає' },
};
sheet.addEventListener('click', (event) => {
  const key = (event.target as Element).closest<HTMLElement>('[data-toast]')?.dataset.toast as keyof typeof messages | undefined;
  if (key) toast.show(messages[key]);
});

const read = (): Appearance => ({
  accent: parseAccent(sheet.querySelector<HTMLSelectElement>('#accent')!.value),
  theme: sheet.querySelector<HTMLSelectElement>('#theme')!.value as Theme,
  largerText: sheet.querySelector<HTMLInputElement>('#text')!.checked,
  largerTargets: sheet.querySelector<HTMLInputElement>('#targets')!.checked,
});
sheet.querySelector<HTMLSelectElement>('#accent')!.value = DEFAULT_APPEARANCE.accent;
const root = document.documentElement;
const apply = startAppearance(root, matchMedia('(prefers-color-scheme: light)'), DEFAULT_APPEARANCE);
trackInputModality(root);
sheet.addEventListener('change', () => apply(read()));
