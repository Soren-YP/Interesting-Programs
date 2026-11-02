import {
  APP_STORAGE_KEY,
  RECOVERY_STORAGE_KEY,
  createDefaultState,
  normalizeState,
} from './domain.js';

const LEGACY_KEYS = ['bookmarks', 'categories', 'darkTheme'];

function parseJson(raw, fallback = null) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  }
  catch {
    return fallback;
  }
}

function captureLegacy(storage) {
  const raw = {};
  let found = false;
  LEGACY_KEYS.forEach((key) => {
    const value = storage.getItem(key);
    raw[key] = value;
    if (value !== null) found = true;
  });
  return found ? raw : null;
}

export function migrateLegacyState(storage) {
  const legacy = captureLegacy(storage);
  if (!legacy) return createDefaultState({ withSamples: true });

  const bookmarks = parseJson(legacy.bookmarks, []);
  const categories = parseJson(legacy.categories, []);
  const darkTheme = legacy.darkTheme === 'true';

  storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({
    kind: 'legacy',
    capturedAt: new Date().toISOString(),
    raw: legacy,
  }));

  return normalizeState({
    categories,
    bookmarks,
    settings: {
      theme: darkTheme ? 'dark' : 'light',
    },
  });
}

export class AppStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.state = this.load();
  }

  load() {
    const persisted = parseJson(this.storage.getItem(APP_STORAGE_KEY));
    const state = persisted
      ? normalizeState(persisted)
      : migrateLegacyState(this.storage);
    this.persist(state);
    return state;
  }

  persist(state = this.state) {
    try {
      this.storage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
    }
    catch (error) {
      const wrapped = new Error('无法保存数据，浏览器本地存储空间可能已满。');
      wrapped.cause = error;
      throw wrapped;
    }
  }

  getState() {
    return structuredClone(this.state);
  }

  update(mutator) {
    const draft = this.getState();
    const returned = mutator(draft);
    const next = normalizeState(returned ?? draft);
    this.persist(next);
    this.state = next;
    this.emit();
    return this.getState();
  }

  replace(nextState, { captureRecovery = true } = {}) {
    if (captureRecovery) this.captureRecovery('replace');
    const next = normalizeState(nextState);
    this.persist(next);
    this.state = next;
    this.emit();
    return this.getState();
  }

  captureRecovery(kind = 'manual') {
    this.storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({
      kind,
      capturedAt: new Date().toISOString(),
      state: this.state,
    }));
  }

  restoreRecovery() {
    const recovery = parseJson(this.storage.getItem(RECOVERY_STORAGE_KEY));
    if (!recovery?.state) return false;
    this.replace(recovery.state, { captureRecovery: false });
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
