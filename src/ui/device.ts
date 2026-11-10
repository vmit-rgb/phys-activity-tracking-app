import type { DeviceEnv, ShareData } from '../app/pages';

/* The phone's own tools, behind the small interfaces the app asks for (DeviceEnv). */

/**
 * Hands a file to the phone as a download (Android: «Завантаження»): text
 * (JSON) or bytes (PDF), typed by its name.
 * The link is clicked once and removed; the file's address lives a moment
 * longer, because some browsers read it after the click.
 */
export function saveFile(doc: Document, name: string, content: string | Uint8Array<ArrayBuffer>): void {
  const type = name.endsWith('.pdf') ? 'application/pdf' : 'application/json';
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface Sharing {
  share?(data: ShareData): Promise<void>;
}

/** The system share sheet. Closing it is not a failure; a phone without one says 'unavailable'. */
export async function shareWith(navigator: Sharing, data: ShareData): Promise<Awaited<ReturnType<DeviceEnv['share']>>> {
  if (!navigator.share) return 'unavailable';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}

interface Clipboard {
  writeText(text: string): Promise<void>;
}

export async function copyWith(clipboard: Clipboard | undefined, text: string): Promise<boolean> {
  try {
    await clipboard!.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface History {
  pushState(state: unknown, title: string): void;
  go(delta: number): void;
}

/** Each screen over home is one entry in the browser's history, marked with its depth. */
export function screenHistory(history: History, window: Pick<Window, 'addEventListener'>): DeviceEnv['history'] {
  return {
    push: (depth) => history.pushState({ depth }, ''),
    back: (steps) => history.go(-steps),
    listen(onBack) {
      window.addEventListener('popstate', (event) => {
        const depth = (event.state as { depth?: unknown } | null)?.depth;
        onBack(typeof depth === 'number' ? depth : 0);
      });
    },
  };
}
