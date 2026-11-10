import { iconSvg } from './icons';

export interface ToastMessage {
  readonly message: string;
  /** Shown in the accent colour after the message, e.g. «:)» (COPY.md rules). */
  readonly emoticon?: string;
  /** ✓ only when a process has a result: збережено, видалено, скасовано… */
  readonly showIcon?: boolean;
  /** One text button, e.g. «скасувати» (deleting always offers it) or «оновити». */
  readonly action?: ToastAction;
}

export interface ToastAction {
  readonly label: string;
  /** What to show next; nothing closes the toast. */
  readonly run: () => ToastMessage | void;
}

export interface Toast {
  show(message: ToastMessage): void;
}

const UNDONE: ToastMessage = { message: 'скасовано', showIcon: true };

/** «скасувати»: runs the undo, then says «скасовано». */
export function undo(run: () => void): ToastAction {
  return { label: 'скасувати', run: () => { run(); return UNDONE; } };
}

/**
 * The single toast of the app (Figma `toast/saved`). It never closes on its
 * own, only with × (ACCESSIBILITY.md rule 7), and a new message replaces the
 * current one.
 */
export function mountToast(host: HTMLElement): Toast {
  host.insertAdjacentHTML('beforeend', `
    <div class="toast" role="status" hidden>
      <div class="toast__inner">
        <span class="toast__check" hidden>${iconSvg('check')}</span>
        <p class="toast__message t-2nd-regular"></p>
        <button type="button" class="btn btn--tertiary toast__action" hidden></button>
        <button type="button" class="ctl icon-btn icon-btn--secondary toast__close" aria-label="закрити">${iconSvg('close')}</button>
      </div>
    </div>`);
  const box = host.querySelector<HTMLElement>('.toast:last-child')!;
  const check = box.querySelector<HTMLElement>('.toast__check')!;
  const text = box.querySelector<HTMLElement>('.toast__message')!;
  const button = box.querySelector<HTMLButtonElement>('.toast__action')!;
  let action: ToastAction | undefined;

  function show(next: ToastMessage): void {
    text.textContent = next.message;
    if (next.emoticon) {
      const emoticon = document.createElement('span');
      emoticon.className = 'toast__emoticon';
      emoticon.textContent = next.emoticon;
      text.append(' ', emoticon);
    }
    check.hidden = !next.showIcon;
    action = next.action;
    button.textContent = action?.label ?? '';
    button.hidden = !action;
    box.hidden = false;
  }

  button.addEventListener('click', () => {
    const after = action?.run();
    if (after) show(after);
    else box.hidden = true;
  });
  box.querySelector('.toast__close')!.addEventListener('click', () => {
    box.hidden = true;
  });
  return { show };
}
