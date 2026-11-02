import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  globalThis.localStorage?.clear();
  if (globalThis.document) document.body.innerHTML = '';
});

afterEach(() => {
  globalThis.localStorage?.clear();
});
