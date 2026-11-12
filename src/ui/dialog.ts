import { esc } from './html';
import { EASE, MS, play, whenDone } from './motion';

/*
 * Two layers over a screen, both closed with Escape too:
 * - dialog/confirm (Figma 250:6304) over overlay/scrim: a question with a
 *   safe button («скасувати», «залишитися») and the action;
 * - overlay/text-edit (250:6286): one value, full screen, big, with the
 *   phone's keyboard; «готово» keeps it, «скасувати» gives the old one back.
 * The focus goes back where it was when the layer closes.
 */

export interface ConfirmSpec {
  readonly title: string;
  readonly body?: string;
  /** The action, in the error colour (Figma button/confirm). */
  readonly confirm: string;
  /** The safe way out, the outlined button; it gets the focus. */
  readonly cancel: string;
  /** A third button above the two, e.g. «зберегти копію» before erasing. */
  readonly extra?: string;
}

export type ConfirmAnswer = 'confirm' | 'cancel' | 'extra';

/**
 * Puts a layer on the page; `close` gives the focus back and removes it,
 * `dissolve` too, but the layer fades out first (and takes no taps meanwhile).
 */
function layer(markup: string): { root: HTMLElement; close(): void; dissolve(): void } {
  const before = document.activeElement as HTMLElement | null;
  document.body.insertAdjacentHTML('beforeend', markup);
  const root = document.body.lastElementChild as HTMLElement;
  return {
    root,
    close() {
      root.remove();
      before?.focus({ preventScroll: true });
    },
    dissolve() {
      root.inert = true;
      before?.focus({ preventScroll: true });
      whenDone(play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: MS.s, easing: EASE.in, fill: 'forwards' }), () => root.remove());
    },
  };
}

export function confirmDialog(spec: ConfirmSpec): Promise<ConfirmAnswer> {
  const { root, dissolve } = layer(`
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"${spec.body ? ' aria-describedby="dialog-body"' : ''}>
      <div class="dialog__scrim" data-answer="cancel"></div>
      <div class="dialog__panel">
        <p class="t-1st-bold" id="dialog-title">${esc(spec.title)}</p>
        ${spec.body ? `<p class="t-2nd-regular muted" id="dialog-body">${esc(spec.body)}</p>` : ''}
        ${spec.extra ? `<button type="button" class="ctl btn btn--primary btn--wide dialog__extra" data-answer="extra">${esc(spec.extra)}</button>` : ''}
        <div class="dialog__actions">
          <button type="button" class="ctl btn btn--secondary" data-answer="cancel">${esc(spec.cancel)}</button>
          <button type="button" class="ctl btn btn--destructive" data-answer="confirm">${esc(spec.confirm)}</button>
        </div>
      </div>
    </div>`);
  root.querySelector<HTMLElement>('[data-answer="cancel"].btn')!.focus();
  // comes up from below, the scrim darkens with it
  play(root.querySelector('.dialog__panel'), [{ opacity: 0, transform: 'translateY(32px)' }, { opacity: 1, transform: 'none' }], { duration: MS.m, easing: EASE.out });
  play(root.querySelector('.dialog__scrim'), [{ opacity: 0 }, { opacity: 1 }], { duration: MS.m, easing: EASE.out });
  return new Promise((resolve) => {
    const answer = (value: ConfirmAnswer) => {
      dissolve();
      resolve(value);
    };
    root.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-answer]');
      if (target) answer(target.dataset.answer as ConfirmAnswer);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') answer('cancel');
    });
  });
}

export interface TextEditSpec {
  /** Muted, above the value: what is being changed. */
  readonly label: string;
  readonly value: string;
  readonly maxLength: number;
}

/** The new text, or null when cancelled. */
export function editText(spec: TextEditSpec): Promise<string | null> {
  const { root, close } = layer(`
    <div class="text-edit" role="dialog" aria-modal="true" aria-label="${esc(spec.label)}">
      <div class="text-edit__actions">
        <button type="button" class="ctl btn btn--tertiary" data-answer="cancel">скасувати</button>
        <button type="button" class="ctl btn btn--secondary" data-answer="done">готово</button>
      </div>
      <label class="text-edit__field">
        <span class="t-3rd-regular muted">${esc(spec.label)}</span>
        <textarea class="text-edit__input" rows="4" autocomplete="off" enterkeyhint="done" maxlength="${spec.maxLength}">${esc(spec.value)}</textarea>
      </label>
    </div>`);
  // overlay/text-edit fills the screen gradually, gaining brightness (MICROINTERACTIONS.md)
  play(root, [
    { opacity: 0, filter: 'brightness(.3)', clipPath: 'inset(30% 0 30% 0)' },
    { opacity: 1, filter: 'brightness(1)', clipPath: 'inset(0 0 0 0)' },
  ], { duration: MS.l, easing: EASE.out });
  // a textarea, so a long phrase wraps instead of running off the screen; Enter still means «готово»
  const input = root.querySelector<HTMLTextAreaElement>('.text-edit__input')!;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  return new Promise((resolve) => {
    const answer = (done: boolean) => {
      close();
      resolve(done ? input.value.trim() : null);
    };
    root.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-answer]');
      if (target) answer(target.dataset.answer === 'done');
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') answer(false);
      if (event.key === 'Enter') {
        event.preventDefault();
        answer(true);
      }
    });
  });
}
