import { describe, expect, it, vi } from 'vitest';
import { watchForUpdates, type RegistrationLike, type UpdateHooks, type WorkerContainerLike } from './updates';

class FakeWorker extends EventTarget {
  state = 'installing';
  messages: unknown[] = [];
  postMessage(message: unknown) { this.messages.push(message); }
  become(state: string) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}

class FakeRegistration extends EventTarget implements RegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  update = vi.fn(() => Promise.resolve());
  startInstalling(worker: FakeWorker) { this.installing = worker; this.dispatchEvent(new Event('updatefound')); }
}

class FakeContainer extends EventTarget implements WorkerContainerLike {
  registered: [string, { scope: string }] | null = null;
  constructor(readonly controller: unknown, readonly registration = new FakeRegistration()) { super(); }
  register(url: string, options: { scope: string }) {
    this.registered = [url, options];
    return Promise.resolve(this.registration);
  }
}

function hooks() {
  const offers: (() => void)[] = [];
  const returns: (() => void)[] = [];
  const value: UpdateHooks = {
    offer: (apply) => offers.push(apply),
    reload: vi.fn(),
    onReturn: (check) => returns.push(check),
  };
  return { value, offers, returns };
}

describe('watchForUpdates', () => {
  it('registers the worker for the app’s own address', async () => {
    const container = new FakeContainer(null);
    await watchForUpdates(container, '/phys-activity-tracking-app/', hooks().value);
    expect(container.registered).toEqual(['/phys-activity-tracking-app/sw.js', { scope: '/phys-activity-tracking-app/' }]);
  });

  it('offers a version that is already waiting, and switches only when asked', async () => {
    const container = new FakeContainer({});
    const waiting = new FakeWorker();
    container.registration.waiting = waiting;
    const h = hooks();
    await watchForUpdates(container, '/', h.value);
    expect(h.offers).toHaveLength(1);
    expect(waiting.messages).toEqual([]);
    h.offers[0]!();
    expect(waiting.messages).toEqual(['skip-waiting']);
    container.dispatchEvent(new Event('controllerchange'));
    expect(h.value.reload).toHaveBeenCalledTimes(1);
  });

  it('offers a version that finishes installing while the app is open', async () => {
    const container = new FakeContainer({});
    const h = hooks();
    await watchForUpdates(container, '/', h.value);
    const next = new FakeWorker();
    container.registration.startInstalling(next);
    next.become('installing');
    expect(h.offers).toHaveLength(0);
    next.become('installed');
    expect(h.offers).toHaveLength(1);
  });

  it('offers nothing on the very first install', async () => {
    const container = new FakeContainer(null);
    const h = hooks();
    await watchForUpdates(container, '/', h.value);
    const first = new FakeWorker();
    container.registration.startInstalling(first);
    first.become('installed');
    expect(h.offers).toHaveLength(0);
  });

  it('does not reload when another tab switched the version', async () => {
    const container = new FakeContainer({});
    const h = hooks();
    await watchForUpdates(container, '/', h.value);
    container.dispatchEvent(new Event('controllerchange'));
    expect(h.value.reload).not.toHaveBeenCalled();
  });

  it('looks for a new version when the person comes back, quietly offline', async () => {
    const container = new FakeContainer({});
    container.registration.update.mockRejectedValueOnce(new Error('offline'));
    const h = hooks();
    await watchForUpdates(container, '/', h.value);
    h.returns[0]!();
    expect(container.registration.update).toHaveBeenCalledTimes(1);
  });
});
