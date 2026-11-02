import { describe, expect, it, vi } from 'vitest';
import {
  isTypingTarget,
  shouldOpenCardFromEvent,
  shouldSwitchToAllOnSearch,
  trapFocus,
} from '../src/ui-utils.js';

describe('UI interaction guards', () => {
  it('switches a favorites search to the all view', () => {
    expect(shouldSwitchToAllOnSearch('favorites', 'github')).toBe(true);
    expect(shouldSwitchToAllOnSearch('favorites', '  ')).toBe(false);
    expect(shouldSwitchToAllOnSearch('archive', 'github')).toBe(false);
  });

  it('does not treat links and actions as card activation', () => {
    document.body.innerHTML = `
      <article class="bookmark-card">
        <a href="https://example.com">Example</a>
        <button type="button">Edit</button>
        <span class="plain">Plain</span>
      </article>`;
    expect(shouldOpenCardFromEvent({ target: document.querySelector('a') })).toBe(false);
    expect(shouldOpenCardFromEvent({ target: document.querySelector('button') })).toBe(false);
    expect(shouldOpenCardFromEvent({ target: document.querySelector('.plain') })).toBe(true);
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
  });

  it('wraps focus inside a dialog', () => {
    document.body.innerHTML = `
      <section>
        <button id="first">First</button>
        <button id="last">Last</button>
      </section>`;
    const container = document.querySelector('section');
    const first = document.getElementById('first');
    const last = document.getElementById('last');
    last.focus();
    const event = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    };
    trapFocus(event, container);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(first);
  });
});
