export const APP_STATE_VERSION = 1;
export const APP_STORAGE_KEY = 'star.appState.v1';
export const RECOVERY_STORAGE_KEY = 'star.recovery.v1';
export const BACKUP_FORMAT = 'star-bookmarks';
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_BOOKMARKS = 10_000;

export const DEFAULT_CATEGORIES = [
  { id: 'work', name: '工作', order: 0 },
  { id: 'study', name: '学习', order: 1 },
  { id: 'entertainment', name: '娱乐', order: 2 },
];

export const DEFAULT_SETTINGS = {
  theme: 'light',
  searchEngine: 'bing',
  view: 'favorites',
  sort: 'manual',
  categoryId: 'all',
  tagFilters: [],
};

function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix = 'id') {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('网址不能为空。');
  }

  let text = value.trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(text)) {
    text = `https://${text}`;
  }

  let url;
  try {
    url = new URL(text);
  }
  catch {
    throw new Error('网址格式无效。');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('只允许 HTTP 或 HTTPS 网址。');
  }
  if (!url.hostname) {
    throw new Error('网址缺少有效域名。');
  }
  if (url.username || url.password) {
    throw new Error('网址不能包含用户名或密码。');
  }
  if (url.href.length > 2048) {
    throw new Error('网址不能超过 2048 个字符。');
  }

  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443')
    || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  return url.href;
}

export function urlKey(value) {
  return normalizeUrl(value);
}

export function titleFromUrl(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./i, '');
  }
  catch {
    return '未命名收藏';
  }
}

export function normalizeTag(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function normalizeTags(values) {
  const source = Array.isArray(values)
    ? values
    : String(values ?? '').split(/[,，]/);
  const seen = new Set();
  const tags = [];

  for (const value of source) {
    const tag = normalizeTag(value);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 20) break;
  }
  return tags;
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function validIso(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function normalizeLinkStatus(value) {
  if (!value || typeof value !== 'object') return null;
  const allowed = new Set(['ok', 'redirected', 'error']);
  if (!allowed.has(value.state)) return null;
  return {
    state: value.state,
    statusCode: Number.isInteger(value.statusCode) ? value.statusCode : null,
    checkedAt: validIso(value.checkedAt) ?? nowIso(),
    finalUrl: value.finalUrl ? cleanText(value.finalUrl, 2048) : null,
    message: value.message ? cleanText(value.message, 200) : '',
  };
}

export function normalizeCategory(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, 80);
  if (!name) return null;
  return {
    id: cleanText(raw.id, 120) || createId('cat'),
    name,
    order: Number.isFinite(raw.order) ? Number(raw.order) : index,
  };
}

export function normalizeBookmark(raw, index = 0, categoryIds = new Set()) {
  if (!raw || typeof raw !== 'object') return null;

  let url;
  try {
    url = normalizeUrl(raw.url);
  }
  catch {
    return null;
  }

  const createdAt = validIso(raw.createdAt) ?? nowIso();
  const requestedCategory = cleanText(raw.categoryId ?? raw.category, 120);
  const fallbackCategory = categoryIds.values().next().value ?? 'uncategorized';
  const categoryId = categoryIds.has(requestedCategory)
    ? requestedCategory
    : fallbackCategory;

  return {
    id: cleanText(raw.id, 160) || createId('bm'),
    url,
    title: cleanText(raw.title, 200) || titleFromUrl(url),
    categoryId,
    notes: cleanText(raw.notes, 2000),
    tags: normalizeTags(raw.tags),
    pinned: Boolean(raw.pinned),
    archivedAt: validIso(raw.archivedAt),
    createdAt,
    updatedAt: validIso(raw.updatedAt),
    lastVisitedAt: validIso(raw.lastVisitedAt),
    visitCount: Math.max(0, Number.parseInt(raw.visitCount, 10) || 0),
    order: Number.isFinite(raw.order) ? Number(raw.order) : index,
    linkStatus: normalizeLinkStatus(raw.linkStatus),
  };
}

function uniqueById(items, prefix) {
  const seen = new Set();
  return items.map((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }
    const next = { ...item, id: createId(prefix) };
    seen.add(next.id);
    return next;
  });
}

export function createDefaultState({ withSamples = true } = {}) {
  const timestamp = nowIso();
  const bookmarks = withSamples
    ? [
      {
        id: 'bm1',
        url: 'https://www.google.com/',
        title: 'Google 搜索',
        categoryId: 'work',
        notes: '快速检索资料、图片和灵感。',
        tags: ['搜索'],
        pinned: true,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: null,
        lastVisitedAt: null,
        visitCount: 0,
        order: 0,
        linkStatus: null,
      },
      {
        id: 'bm2',
        url: 'https://github.com/',
        title: 'GitHub',
        categoryId: 'study',
        notes: '代码托管、开源项目和开发者社区。',
        tags: ['开发'],
        pinned: true,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: null,
        lastVisitedAt: null,
        visitCount: 0,
        order: 1,
        linkStatus: null,
      },
    ]
    : [];

  return {
    version: APP_STATE_VERSION,
    categories: structuredClone(DEFAULT_CATEGORIES),
    bookmarks,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function normalizeState(raw, { withSamples = false } = {}) {
  const fallback = createDefaultState({ withSamples });
  if (!raw || typeof raw !== 'object') return fallback;

  let categories = Array.isArray(raw.categories)
    ? raw.categories
      .map((category, index) => normalizeCategory(category, index))
      .filter(Boolean)
    : [];
  categories = uniqueById(categories, 'cat');

  if (!categories.length) {
    categories = [{ id: 'uncategorized', name: '未分类', order: 0 }];
  }
  categories.sort((a, b) => a.order - b.order);
  categories.forEach((category, index) => {
    category.order = index;
  });

  const categoryIds = new Set(categories.map((category) => category.id));
  let bookmarks = Array.isArray(raw.bookmarks)
    ? raw.bookmarks
      .slice(0, MAX_BOOKMARKS)
      .map((bookmark, index) => normalizeBookmark(bookmark, index, categoryIds))
      .filter(Boolean)
    : [];
  bookmarks = uniqueById(bookmarks, 'bm');
  bookmarks.sort((a, b) => a.order - b.order);
  bookmarks.forEach((bookmark, index) => {
    bookmark.order = index;
  });

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}),
  };
  settings.theme = ['light', 'dark'].includes(settings.theme) ? settings.theme : 'light';
  settings.searchEngine = ['bing', 'google', 'baidu', 'duckduckgo'].includes(settings.searchEngine)
    ? settings.searchEngine
    : 'bing';
  settings.view = ['favorites', 'all', 'archive'].includes(settings.view)
    ? settings.view
    : 'favorites';
  settings.sort = ['manual', 'title', 'created', 'visited', 'visits'].includes(settings.sort)
    ? settings.sort
    : 'manual';
  settings.categoryId = settings.categoryId === 'all' || categoryIds.has(settings.categoryId)
    ? settings.categoryId
    : 'all';
  settings.tagFilters = normalizeTags(settings.tagFilters);

  return {
    version: APP_STATE_VERSION,
    categories,
    bookmarks,
    settings,
  };
}

export function selectBookmarks(state, {
  search = '',
  view = state.settings.view,
  categoryId = state.settings.categoryId,
  tagFilters = state.settings.tagFilters,
  sort = state.settings.sort,
} = {}) {
  const keyword = String(search).trim().toLocaleLowerCase();
  const selectedTags = normalizeTags(tagFilters).map((tag) => tag.toLocaleLowerCase());
  let result = state.bookmarks.filter((bookmark) => {
    if (view === 'archive' && !bookmark.archivedAt) return false;
    if (view !== 'archive' && bookmark.archivedAt) return false;
    if (view === 'favorites' && !bookmark.pinned) return false;
    if (categoryId !== 'all' && bookmark.categoryId !== categoryId) return false;
    if (selectedTags.length) {
      const tags = bookmark.tags.map((tag) => tag.toLocaleLowerCase());
      if (!selectedTags.every((tag) => tags.includes(tag))) return false;
    }
    if (!keyword) return true;
    return [
      bookmark.title,
      bookmark.url,
      bookmark.notes,
      ...bookmark.tags,
    ].some((value) => String(value).toLocaleLowerCase().includes(keyword));
  });

  const byDate = (value) => value ? Date.parse(value) || 0 : 0;
  const sorters = {
    manual: (a, b) => a.order - b.order,
    title: (a, b) => a.title.localeCompare(b.title, 'zh-CN'),
    created: (a, b) => byDate(b.createdAt) - byDate(a.createdAt),
    visited: (a, b) => byDate(b.lastVisitedAt) - byDate(a.lastVisitedAt),
    visits: (a, b) => b.visitCount - a.visitCount || a.order - b.order,
  };
  result = [...result].sort(sorters[sort] ?? sorters.manual);
  return result;
}

export function reorderVisibleBookmarks(bookmarks, visibleIds, draggedId, targetId) {
  const ordered = [...bookmarks].sort((a, b) => a.order - b.order);
  const visibleSet = new Set(visibleIds);
  const visible = visibleIds
    .map((id) => ordered.find((bookmark) => bookmark.id === id))
    .filter(Boolean);
  const draggedIndex = visible.findIndex((bookmark) => bookmark.id === draggedId);
  const targetIndex = visible.findIndex((bookmark) => bookmark.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
    return ordered.map((bookmark, index) => ({ ...bookmark, order: index }));
  }

  const [dragged] = visible.splice(draggedIndex, 1);
  visible.splice(targetIndex, 0, dragged);
  let replacementIndex = 0;
  const result = ordered.map((bookmark) => (
    visibleSet.has(bookmark.id) ? visible[replacementIndex++] : bookmark
  ));
  return result.map((bookmark, index) => ({ ...bookmark, order: index }));
}

export function moveVisibleBookmark(bookmarks, visibleIds, bookmarkId, direction) {
  const index = visibleIds.indexOf(bookmarkId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= visibleIds.length) return bookmarks;
  return reorderVisibleBookmarks(
    bookmarks,
    visibleIds,
    bookmarkId,
    visibleIds[targetIndex],
  );
}

export function collectTags(bookmarks, { includeArchived = false } = {}) {
  const counts = new Map();
  bookmarks
    .filter((bookmark) => includeArchived || !bookmark.archivedAt)
    .forEach((bookmark) => {
      bookmark.tags.forEach((tag) => {
        const key = tag.toLocaleLowerCase();
        const current = counts.get(key) ?? { name: tag, count: 0 };
        current.count += 1;
        counts.set(key, current);
      });
    });
  return [...counts.values()].sort((a, b) => (
    b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')
  ));
}

export function deleteCategoryFromState(state, categoryId) {
  const categories = state.categories.filter((category) => category.id !== categoryId);
  if (!categories.length) {
    categories.push({ id: 'uncategorized', name: '未分类', order: 0 });
  }
  categories.forEach((category, index) => {
    category.order = index;
  });
  const fallbackId = categories[0].id;
  const bookmarks = state.bookmarks.map((bookmark) => (
    bookmark.categoryId === categoryId
      ? { ...bookmark, categoryId: fallbackId, updatedAt: nowIso() }
      : bookmark
  ));
  return normalizeState({
    ...state,
    categories,
    bookmarks,
    settings: {
      ...state.settings,
      categoryId: state.settings.categoryId === categoryId
        ? 'all'
        : state.settings.categoryId,
    },
  });
}
