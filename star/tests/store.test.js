import { describe, expect, it } from 'vitest';
import {
  APP_STORAGE_KEY,
  RECOVERY_STORAGE_KEY,
} from '../src/domain.js';
import { AppStore } from '../src/store.js';

describe('AppStore', () => {
  it('migrates legacy keys and keeps a recovery snapshot', () => {
    localStorage.setItem('categories', JSON.stringify([{ id: 'work', name: '工作' }]));
    localStorage.setItem('bookmarks', JSON.stringify([{
      id: 'old',
      url: 'https://example.com',
      title: '旧收藏',
      category: 'work',
    }]));
    localStorage.setItem('darkTheme', 'true');

    const store = new AppStore(localStorage);
    expect(store.getState().bookmarks[0]).toMatchObject({
      id: 'old',
      categoryId: 'work',
    });
    expect(store.getState().settings.theme).toBe('dark');
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY)).kind).toBe('legacy');
  });

  it('restores the last replacement snapshot', () => {
    const store = new AppStore(localStorage);
    const originalCount = store.getState().bookmarks.length;
    store.replace({
      categories: [{ id: 'only', name: '唯一' }],
      bookmarks: [],
      settings: {},
    });
    expect(store.getState().bookmarks).toHaveLength(0);
    expect(store.restoreRecovery()).toBe(true);
    expect(store.getState().bookmarks).toHaveLength(originalCount);
  });
});
