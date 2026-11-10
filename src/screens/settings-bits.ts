import { esc } from '../ui/html';
import { iconSvg, type IconName } from '../ui/icons';

/* Small pieces of the settings page, shared by its parts. */

export function checkbox(label: string, checked: boolean, data: string, disabled = false): string {
  return `
    <label class="ctl checkbox"><input class="checkbox__input" type="checkbox" ${data}${checked ? ' checked' : ''}${disabled ? ' disabled' : ''} /><span class="checkbox__box" aria-hidden="true"></span>
      <span class="checkbox__label t-1st-semibold">${label}</span></label>`;
}

export const act = (name: string, extra = '') => `data-act="${name}"${extra ? ` ${extra}` : ''}`;
export const tertiary = (label: string, data: string) => `<button type="button" class="ctl btn btn--tertiary" ${data}>${label}</button>`;
export const secondary = (label: string, data: string) => `<button type="button" class="ctl btn btn--secondary st-wide" ${data}>${label}</button>`;
export const destructive = (label: string, data: string) => `<button type="button" class="ctl btn btn--destructive" ${data}>${label}</button>`;

export function iconButton(icon: IconName, label: string, data: string, disabled = false): string {
  return `<button type="button" class="ctl icon-btn icon-btn--secondary" ${data} aria-label="${esc(label)}"${disabled ? ' disabled' : ''}>${iconSvg(icon)}</button>`;
}

export interface DaysSpec {
  readonly label: string;
  readonly value: number;
  /** `data-act` of − and +, and `data-input` of the slider. */
  readonly name: string;
  /** More data attributes for all three, e.g. `data-kind="workout"`. */
  readonly data?: string;
  /** Said after «менше» / «більше» for screen readers. */
  readonly spoken: string;
}

/** Days per week, 0–7: the value, − slider + (Figma group/weekly-goal). */
export function daysSlider({ label, value, name, data = '', spoken }: DaysSpec): string {
  const extra = data ? ` ${data}` : '';
  const step = (delta: number, word: string, icon: IconName, off: boolean) =>
    iconButton(icon, `${word}: ${spoken}`, `${act(name, `data-delta="${delta}"${extra}`)}`, off);
  return `
        <div class="st-days">
          <div class="st-days__head"><span class="t-1st-semibold">${label}</span><span class="st-days__value t-3rd-semibold" aria-live="polite">${value}/7</span></div>
          <div class="slider-row">${step(-1, 'менше', 'remove', value <= 0)}
            <input type="range" class="slider" min="0" max="7" step="1" value="${value}" aria-label="${esc(spoken)}" aria-valuetext="${value} з 7" data-input="${name}"${extra} />${
  step(1, 'більше', 'add', value >= 7)}
          </div>
        </div>`;
}
