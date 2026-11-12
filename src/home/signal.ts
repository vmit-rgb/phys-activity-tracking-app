import type { Accessibility } from '../domain/settings';

/*
 * The pulse timer's start (after 3 s to get ready): a short buzz and the tone.
 * Its end: vibration, a short sound and a flash of the
 * screen (ACCESSIBILITY.md: the person is counting with both hands busy).
 * «вимкнути вібровідгук» and «вимкнути звук» switch the first two off; the
 * flash always comes (with «вимкнути всі анімації» as a still layer, CSS), so
 * the end is never lost. Where a phone can't do one of them, the others still happen.
 */

let audio: AudioContext | undefined;

/** Phones only allow sound that starts from a tap: call this on the tap that starts the timer. */
export function prepareSound(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = undefined;
  }
}

function beep(): void {
  if (!audio) return;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.frequency.value = 880;
  volume.gain.setValueAtTime(0.2, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.36);
  tone.connect(volume).connect(audio.destination);
  tone.start();
  tone.stop(audio.currentTime + 0.36);
}

/** 360 ms, from the duration scale (MICROINTERACTIONS.md); one flash, far from the 3-a-second limit. */
export const FLASH_MS = 360;

function flash(): void {
  const layer = document.createElement('div');
  layer.className = 'flash';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  setTimeout(() => layer.remove(), FLASH_MS);
}

/** The count starts: one short buzz and the tone; the digits change on screen too. */
export function startSignal(off: Pick<Accessibility, 'noVibration' | 'noSound'>): void {
  buzz(150, off);
  if (!off.noSound) beep();
}

export function endSignal(off: Pick<Accessibility, 'noVibration' | 'noSound'>): void {
  buzz([200, 100, 200], off);
  if (!off.noSound) beep();
  flash();
}

/** A vibration, unless «вимкнути вібровідгук»; each one has a visible twin, so nothing is lost without it. */
export function buzz(pattern: number | number[], off: Pick<Accessibility, 'noVibration'>): void {
  if (!off.noVibration) navigator.vibrate?.(pattern);
}
