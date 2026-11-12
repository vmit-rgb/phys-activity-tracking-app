import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { confirmDialog, editText } from './dialog';
import { fakeAnimate } from './test-animate';

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
const click = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!.click();

beforeEach(() => {
  document.body.innerHTML = '<button type="button" id="before">тут був фокус</button>';
  document.querySelector<HTMLElement>('#before')!.focus();
});

describe('confirmDialog (dialog/confirm 250:6304)', () => {
  it('asks with a title only, focuses the safe button and gives the focus back', async () => {
    const answer = confirmDialog({ title: 'видалити?', confirm: 'видалити', cancel: 'скасувати' });
    const dialog = document.querySelector('.dialog')!;
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    expect(dialog.querySelector('#dialog-body')).toBeNull();
    expect(dialog.querySelector('.dialog__extra')).toBeNull();
    expect(document.activeElement!.textContent).toBe('скасувати');
    key(dialog, 'Tab');
    expect(document.querySelector('.dialog')).not.toBeNull();
    click('видалити');
    expect(await answer).toBe('confirm');
    expect(document.querySelector('.dialog')).toBeNull();
    expect(document.activeElement!.id).toBe('before');
  });

  it('answers «cancel» on Escape and on a tap beside it; «extra» on the third button', async () => {
    const escaped = confirmDialog({ title: 'вийти?', body: 'зміни пропадуть.', confirm: 'вийти', cancel: 'залишитися' });
    expect(document.querySelector('.dialog')!.getAttribute('aria-describedby')).toBe('dialog-body');
    key(document.querySelector('.dialog')!, 'Escape');
    expect(await escaped).toBe('cancel');

    const beside = confirmDialog({ title: 'вийти?', confirm: 'вийти', cancel: 'залишитися' });
    document.querySelector<HTMLElement>('.dialog__scrim')!.click();
    expect(await beside).toBe('cancel');

    const extra = confirmDialog({ title: 'стерти все?', confirm: 'стерти все', cancel: 'скасувати', extra: 'зберегти копію' });
    // the main filled button across the panel (example/settings-delete-all-confirm, п. 31)
    expect(document.querySelector('.dialog__extra')!.className).toBe('ctl btn btn--primary btn--wide dialog__extra');
    document.querySelector<HTMLElement>('.dialog__panel')!.click();
    expect(document.querySelector('.dialog')).not.toBeNull();
    click('зберегти копію');
    expect(await extra).toBe('extra');
  });
});

describe('editText (overlay/text-edit 250:6286)', () => {
  it('starts with the value, the caret at its end, and keeps the trimmed text on «готово»', async () => {
    const typed = editText({ label: 'підбадьорлива фраза', value: 'старе', maxLength: 80 });
    const input = document.querySelector<HTMLTextAreaElement>('.text-edit__input')!;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(5);
    expect(input.maxLength).toBe(80);
    input.value = '  нове  ';
    key(input, 'a');
    expect(document.querySelector('.text-edit')).not.toBeNull();
    document.querySelector<HTMLElement>('.text-edit__field')!.click();
    expect(document.querySelector('.text-edit')).not.toBeNull();
    click('готово');
    expect(await typed).toBe('нове');
    expect(document.activeElement!.id).toBe('before');
  });

  it('keeps on Enter and gives nothing back on Escape or «скасувати»', async () => {
    const entered = editText({ label: 'фраза', value: 'а', maxLength: 80 });
    key(document.querySelector('.text-edit__input')!, 'Enter');
    expect(await entered).toBe('а');
    const escaped = editText({ label: 'фраза', value: 'а', maxLength: 80 });
    key(document.querySelector('.text-edit__input')!, 'Escape');
    expect(await escaped).toBeNull();
    const cancelled = editText({ label: 'фраза', value: 'а', maxLength: 80 });
    click('скасувати');
    expect(await cancelled).toBeNull();
  });
});

describe('confirmDialog in motion (MICROINTERACTIONS.md)', () => {
  let fake: ReturnType<typeof fakeAnimate>;
  beforeEach(() => {
    fake = fakeAnimate();
  });
  afterEach(() => fake.restore());

  it('comes up from below', () => {
    void confirmDialog({ title: 'видалити?', confirm: 'видалити', cancel: 'скасувати' });
    const [rise] = fake.on(document.querySelector('.dialog__panel'));
    expect(rise!.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateY(32px)' });
    expect(rise!.options.duration).toBe(360);
  });

  it('dissolves after the answer: the focus is back at once, the layer goes when it has faded', async () => {
    const answer = confirmDialog({ title: 'видалити?', confirm: 'видалити', cancel: 'скасувати' });
    click('видалити');
    expect(await answer).toBe('confirm');
    expect(document.activeElement!.id).toBe('before');
    const dialog = document.querySelector<HTMLElement>('.dialog')!;
    expect(dialog.inert).toBe(true);
    const fade = fake.on(dialog).at(-1)!;
    expect(fade.keyframes.at(-1)).toEqual({ opacity: 0 });
    expect(fade.options.duration).toBe(240);
    fade.finish();
    expect(document.querySelector('.dialog')).toBeNull();
  });
});
