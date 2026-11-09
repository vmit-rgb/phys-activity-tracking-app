/*
 * Registers the service worker and offers a new version through the toast
 * («є нова версія :)» + «оновити», Olesia 2026-11-08). The page reloads only
 * after the person asked for it.
 */

interface WorkerLike extends EventTarget {
  readonly state: string;
  postMessage(message: unknown): void;
}

export interface RegistrationLike extends EventTarget {
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  update(): Promise<unknown>;
}

export interface WorkerContainerLike extends EventTarget {
  readonly controller: unknown;
  register(url: string, options: { scope: string }): Promise<RegistrationLike>;
}

export interface UpdateHooks {
  /** Show the offer; calling `apply` switches to the new version. */
  offer(apply: () => void): void;
  reload(): void;
  /** Fires when the person comes back to the app, to look for a new version then. */
  onReturn(check: () => void): void;
}

export async function watchForUpdates(container: WorkerContainerLike, base: string, hooks: UpdateHooks): Promise<void> {
  const registration = await container.register(`${base}sw.js`, { scope: base });
  // the first install has nothing to replace: only offer when a version is already running
  const hasOldVersion = container.controller !== null;
  let applied = false;

  const offer = (waiting: WorkerLike) => hooks.offer(() => {
    applied = true;
    waiting.postMessage('skip-waiting');
  });

  if (registration.waiting && hasOldVersion) offer(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && hasOldVersion) offer(installing);
    });
  });
  container.addEventListener('controllerchange', () => {
    if (applied) hooks.reload();
  });
  hooks.onReturn(() => void registration.update().catch(() => {}));
}
