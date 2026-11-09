import { describe, expect, it } from 'vitest';
import { part } from './parts';

describe('part', () => {
  it('finds a part of the screen', () => {
    const host = document.createElement('div');
    host.innerHTML = '<p data-x>так</p>';
    expect(part(host, '[data-x]').textContent).toBe('так');
  });

  it('names the missing part instead of failing later without a trace', () => {
    expect(() => part(document.createElement('div'), '[data-apply]')).toThrow('screen part missing: [data-apply]');
  });
});
