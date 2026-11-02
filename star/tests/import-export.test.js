import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/domain.js';
import {
  analyzeImport,
  mergeImport,
  parseBrowserBookmarksHtml,
  parseJsonImport,
  serializeBackup,
  serializeBrowserBookmarks,
} from '../src/import-export.js';

describe('JSON backup', () => {
  it('round-trips categories, bookmarks, and settings without volatile link state', () => {
    const state = createDefaultState();
    state.bookmarks[0].linkStatus = {
      state: 'ok',
      statusCode: 200,
      checkedAt: new Date().toISOString(),
    };
    const parsed = parseJsonImport(serializeBackup(state));
    expect(parsed.categories).toEqual(state.categories);
    expect(parsed.bookmarks[0].linkStatus).toBeUndefined();
    expect(parsed.settings).toEqual(state.settings);
  });

  it('accepts the legacy array export', () => {
    const parsed = parseJsonImport(JSON.stringify([{
      url: 'https://example.com',
      title: 'Example',
      category: 'custom',
    }]));
    expect(parsed.sourceType).toBe('legacy-json');
    expect(parsed.categories[0]).toMatchObject({ id: 'custom', name: 'custom' });
  });
});

describe('browser bookmark HTML', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <DL><p>
      <DT><H3>开发</H3>
      <DL><p>
        <DT><H3>文档</H3>
        <DL><p>
          <DT><A HREF="https://developer.mozilla.org/" TAGS="Web,参考">MDN</A>
        </DL><p>
      </DL><p>
    </DL><p>`;

  it('flattens nested folders and imports tags', () => {
    const parsed = parseBrowserBookmarksHtml(html);
    expect(parsed.categories.map((category) => category.name)).toContain('开发 / 文档');
    expect(parsed.bookmarks[0]).toMatchObject({
      title: 'MDN',
      tags: ['Web', '参考'],
    });
  });

  it('exports a Netscape-compatible document', () => {
    const text = serializeBrowserBookmarks(createDefaultState());
    expect(text).toContain('NETSCAPE-Bookmark-file-1');
    expect(text).toContain('Google 搜索');
    expect(text).toContain('<H3>工作</H3>');
  });
});

describe('safe merge', () => {
  it('skips duplicate URLs and maps categories by name', () => {
    const current = createDefaultState();
    const candidate = {
      sourceType: 'json',
      invalidCount: 0,
      categories: [{ id: 'different-id', name: '工作', order: 0 }],
      bookmarks: [
        { ...current.bookmarks[0], id: 'duplicate', categoryId: 'different-id' },
        {
          ...current.bookmarks[0],
          id: 'new',
          url: 'https://example.com/',
          title: 'Example',
          categoryId: 'different-id',
        },
      ],
      settings: current.settings,
    };
    const analysis = analyzeImport(candidate, current);
    const merged = mergeImport(candidate, current);
    expect(analysis).toMatchObject({ newCount: 1, duplicateCount: 1 });
    expect(merged.bookmarks).toHaveLength(current.bookmarks.length + 1);
    expect(merged.categories).toHaveLength(current.categories.length);
  });
});
