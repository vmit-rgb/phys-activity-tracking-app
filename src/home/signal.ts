/*
 * The end of the pulse timer: vibration, a short sound and a flash of the
 * screen (ACCESSIBILITY.md: the person is counting with both hands busy).
 * The «доступність» checkboxes that switch these off come with the settings
 * (stage 6). Where a phone can't do one of them, the others still happen.
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

export function endSignal(): void {
  navigator.vibrate?.([200, 100, 200]);
  beep();
  flash();
}
