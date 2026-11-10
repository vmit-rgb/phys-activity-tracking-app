import { vi } from 'vitest';
import type { JsonObject } from '../domain/diary';
import type { ThemeChoice } from '../storage/store';
import { backupMemory } from '../storage/store';
import type { DeviceEnv, ShareData } from './pages';

/**
 * The parts of AppEnv that reach the phone itself (files, share sheet,
 * clipboard, back button, theme), as fakes a test can look into.
 */
export function fakeDevice() {
  let theme: ThemeChoice = 'dark';
  let onBack: (depth: number) => void = () => {};
  const depths: number[] = [0];
  const device = {
    saved: [] as { name: string; text: string }[],
    shared: [] as ShareData[],
    copied: [] as string[],
    /** What the share sheet answers. */
    shareResult: 'shared' as Awaited<ReturnType<DeviceEnv['share']>>,
    copyWorks: true,
    saveWorks: true,
    /** Every profile whose look was put on screen, the last one shown now. */
    looks: [] as JsonObject[],
    /** The phone's «reduce motion». */
    motionReduced: false,
    /** The phone's own back button or gesture. */
    pressBack() {
      if (depths.length > 1) depths.pop();
      onBack(depths.at(-1)!);
    },
    depth: () => depths.at(-1)!,
  };
  const env: DeviceEnv = {
    theme: {
      shown: () => theme,
      choose: (next) => {
        theme = next;
      },
    },
    look: (profile) => device.looks.push(profile),
    motionReduced: () => device.motionReduced,
    backups: backupMemory(localStorage),
    saveFile(name, text) {
      if (!device.saveWorks) throw new Error('NotAllowedError');
      device.saved.push({ name, text });
    },
    share: vi.fn(async (data: ShareData) => {
      device.shared.push(data);
      return device.shareResult;
    }),
    copyText: vi.fn(async (text: string) => {
      if (device.copyWorks) device.copied.push(text);
      return device.copyWorks;
    }),
    now: () => new Date('2026-11-09T08:00:00Z'),
    history: {
      push: (depth) => depths.push(depth),
      back: (steps) => {
        depths.splice(depths.length - steps, steps);
        onBack(depths.at(-1)!);
      },
      listen: (back) => {
        onBack = back;
      },
    },
  };
  return { device, env };
}
