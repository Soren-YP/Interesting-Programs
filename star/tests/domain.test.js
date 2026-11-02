import { describe, expect, it } from 'vitest';
import {
  createDefaultState,
  deleteCategoryFromState,
  normalizeState,
  normalizeUrl,
  reorderVisibleBookmarks,
  selectBookmarks,
} from '../src/domain.js';

describe('URL normalization', () => {
  it('adds HTTPS and removes fragments', () => {
    expect(normalizeUrl('Example.com/docs#part')).toBe('https://example.com/docs');
  });

  it('rejects unsafe protocols and credentials', () => {
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(/HTTP/);
    expect(() => normalizeUrl('https://user:pass@example.com')).toThrow(/用户名/);
  });
});

describe('state normalization and selection', () => {
  it('migrates legacy category fields and fills the data model', () => {
    const state = normalizeState({
      categories: [{ id: 'work', name: '工作' }],
      bookmarks: [{ url: 'example.com', title: '', category: 'work' }],
      settings: { view: 'all' },
    });
    expect(state.bookmarks).toHaveLength(1);
    expect(state.bookmarks[0]).toMatchObject({
      url: 'https://example.com/',
      title: 'example.com',
      categoryId: 'work',
      pinned: false,
      visitCount: 0,
    });
  });

  it('applies favorites, tags, search, and sorting together', () => {
    const state = createDefaultState();
    state.bookmarks[0].tags = ['搜索', '工具'];
    state.bookmarks[0].visitCount = 4;
    state.bookmarks[1].tags = ['开发'];
    const result = selectBookmarks(state, {
      search: '工具',
      view: 'favorites',
      tagFilters: ['搜索'],
      sort: 'visits',
    });
    expect(result.map((bookmark) => bookmark.id)).toEqual(['bm1']);
  });

  it('moves bookmarks out of a deleted category', () => {
    const state = createDefaultState();
    const result = deleteCategoryFromState(state, 'work');
    expect(result.categories.some((category) => category.id === 'work')).toBe(false);
    expect(result.bookmarks.find((bookmark) => bookmark.id === 'bm1').categoryId)
      .toBe(result.categories[0].id);
  });
});

describe('filtered drag ordering', () => {
  it('reorders only visible positions while keeping unique global order', () => {
    const bookmarks = ['a', 'b', 'c', 'd'].map((id, order) => ({ id, order }));
    const result = reorderVisibleBookmarks(bookmarks, ['a', 'c'], 'c', 'a');
    expect(result.map((bookmark) => bookmark.id)).toEqual(['c', 'b', 'a', 'd']);
    expect(result.map((bookmark) => bookmark.order)).toEqual([0, 1, 2, 3]);
  });
});
