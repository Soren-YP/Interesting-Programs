import {
  APP_STATE_VERSION,
  BACKUP_FORMAT,
  DEFAULT_SETTINGS,
  MAX_BOOKMARKS,
  createId,
  normalizeState,
  normalizeTags,
  normalizeUrl,
  titleFromUrl,
  urlKey,
} from './domain.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function validDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function bookmarkForBackup(bookmark) {
  const { linkStatus: _linkStatus, ...portable } = bookmark;
  return portable;
}

export function createBackup(state) {
  return {
    format: BACKUP_FORMAT,
    version: APP_STATE_VERSION,
    exportedAt: new Date().toISOString(),
    categories: structuredClone(state.categories),
    bookmarks: state.bookmarks.map(bookmarkForBackup),
    settings: structuredClone(state.settings),
  };
}

export function serializeBackup(state) {
  return JSON.stringify(createBackup(state), null, 2);
}

function parseLegacyArray(data) {
  const categoryIds = new Set(
    data
      .map((bookmark) => String(bookmark?.category ?? bookmark?.categoryId ?? '').trim())
      .filter(Boolean),
  );
  const names = {
    work: '工作',
    study: '学习',
    entertainment: '娱乐',
    uncategorized: '未分类',
  };
  const categories = [...categoryIds].map((id, index) => ({
    id,
    name: names[id] ?? id,
    order: index,
  }));
  if (!categories.length) {
    categories.push({ id: 'uncategorized', name: '未分类', order: 0 });
  }
  return {
    sourceType: 'legacy-json',
    categories,
    bookmarks: data,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function parseJsonImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  }
  catch {
    throw new Error('JSON 文件无法解析。');
  }

  if (Array.isArray(data)) return parseLegacyArray(data);
  if (!data || typeof data !== 'object') {
    throw new Error('JSON 顶层必须是备份对象或收藏数组。');
  }
  if (data.format !== BACKUP_FORMAT) {
    throw new Error('这不是 Star 收藏夹备份文件。');
  }
  if (data.version !== APP_STATE_VERSION) {
    throw new Error(`暂不支持备份版本 ${String(data.version)}。`);
  }
  if (!Array.isArray(data.bookmarks) || !Array.isArray(data.categories)) {
    throw new Error('备份缺少收藏或分类数据。');
  }

  return {
    sourceType: 'json',
    categories: data.categories,
    bookmarks: data.bookmarks,
    settings: data.settings && typeof data.settings === 'object'
      ? data.settings
      : { ...DEFAULT_SETTINGS },
  };
}

function directChild(element, selector) {
  return [...element.children].find((child) => child.matches(selector)) ?? null;
}

function parseBrowserAnchor(anchor, categoryId, index) {
  let url;
  try {
    url = normalizeUrl(anchor.getAttribute('href') ?? '');
  }
  catch {
    return null;
  }

  const unixSeconds = Number.parseInt(anchor.getAttribute('add_date'), 10);
  const createdAt = Number.isFinite(unixSeconds) && unixSeconds > 0
    ? new Date(unixSeconds * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: createId('bm'),
    url,
    title: anchor.textContent.trim().slice(0, 200) || titleFromUrl(url),
    categoryId,
    notes: '',
    tags: normalizeTags(anchor.getAttribute('tags') ?? ''),
    pinned: false,
    archivedAt: null,
    createdAt,
    updatedAt: null,
    lastVisitedAt: null,
    visitCount: 0,
    order: index,
    linkStatus: null,
  };
}

export function parseBrowserBookmarksHtml(text) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境不支持解析浏览器书签。');
  }
  const document = new DOMParser().parseFromString(text, 'text/html');
  const categories = [];
  const categoryByPath = new Map();
  const bookmarks = [];
  let invalidCount = 0;

  const ensureCategory = (pathParts) => {
    const name = pathParts.length ? pathParts.join(' / ') : '未分类';
    const key = name.toLocaleLowerCase();
    if (categoryByPath.has(key)) return categoryByPath.get(key);
    const category = {
      id: createId('cat'),
      name: name.slice(0, 80),
      order: categories.length,
    };
    categories.push(category);
    categoryByPath.set(key, category.id);
    return category.id;
  };

  const walk = (container, pathParts = []) => {
    const children = [...container.children];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child.tagName === 'DL') {
        walk(child, pathParts);
        continue;
      }
      if (child.tagName !== 'DT') continue;

      const heading = directChild(child, 'h3');
      const anchor = directChild(child, 'a');
      if (anchor) {
        const parsed = parseBrowserAnchor(
          anchor,
          ensureCategory(pathParts),
          bookmarks.length,
        );
        if (parsed) bookmarks.push(parsed);
        else invalidCount += 1;
      }

      if (heading) {
        const folderName = heading.textContent.trim().slice(0, 80);
        const nextPath = folderName ? [...pathParts, folderName] : pathParts;
        const nested = directChild(child, 'dl')
          ?? (children[index + 1]?.tagName === 'DL' ? children[++index] : null);
        if (nested) walk(nested, nextPath);
      }
    }
  };

  const root = document.querySelector('dl');
  if (!root) throw new Error('文件中没有找到浏览器书签结构。');
  walk(root);

  if (!categories.length) ensureCategory([]);
  if (!bookmarks.length && !invalidCount) {
    throw new Error('文件中没有找到可导入的书签。');
  }
  return {
    sourceType: 'browser-html',
    categories,
    bookmarks,
    settings: null,
    invalidCount,
  };
}

function sanitizeCandidate(candidate) {
  const rawBookmarks = Array.isArray(candidate.bookmarks)
    ? candidate.bookmarks.slice(0, MAX_BOOKMARKS)
    : [];
  const preliminary = normalizeState({
    categories: candidate.categories,
    bookmarks: rawBookmarks,
    settings: candidate.settings ?? DEFAULT_SETTINGS,
  });
  return {
    ...candidate,
    categories: preliminary.categories,
    bookmarks: preliminary.bookmarks,
    settings: preliminary.settings,
    invalidCount: (candidate.invalidCount ?? 0)
      + Math.max(0, candidate.bookmarks.length - preliminary.bookmarks.length),
  };
}

export function parseImportText(text, fileName = '') {
  const lower = fileName.toLocaleLowerCase();
  const candidate = lower.endsWith('.html') || lower.endsWith('.htm')
    ? parseBrowserBookmarksHtml(text)
    : parseJsonImport(text);
  return sanitizeCandidate(candidate);
}

export function analyzeImport(candidate, currentState) {
  const existingKeys = new Set(currentState.bookmarks.map((bookmark) => urlKey(bookmark.url)));
  const candidateKeys = new Set();
  let duplicateCount = 0;
  let newCount = 0;

  candidate.bookmarks.forEach((bookmark) => {
    const key = urlKey(bookmark.url);
    if (existingKeys.has(key) || candidateKeys.has(key)) duplicateCount += 1;
    else newCount += 1;
    candidateKeys.add(key);
  });

  return {
    sourceType: candidate.sourceType,
    totalCount: candidate.bookmarks.length,
    newCount,
    duplicateCount,
    invalidCount: candidate.invalidCount ?? 0,
    categoryCount: candidate.categories.length,
  };
}

function buildCategoryMerge(candidate, currentState) {
  const categories = structuredClone(currentState.categories);
  const byName = new Map(
    categories.map((category) => [category.name.toLocaleLowerCase(), category.id]),
  );
  const idMap = new Map();

  candidate.categories.forEach((category) => {
    const key = category.name.toLocaleLowerCase();
    let targetId = byName.get(key);
    if (!targetId) {
      targetId = createId('cat');
      categories.push({
        id: targetId,
        name: category.name,
        order: categories.length,
      });
      byName.set(key, targetId);
    }
    idMap.set(category.id, targetId);
  });
  return { categories, idMap };
}

export function mergeImport(candidate, currentState) {
  const { categories, idMap } = buildCategoryMerge(candidate, currentState);
  const existingKeys = new Set(currentState.bookmarks.map((bookmark) => urlKey(bookmark.url)));
  const bookmarks = structuredClone(currentState.bookmarks);
  let nextOrder = bookmarks.length;

  candidate.bookmarks.forEach((bookmark) => {
    const key = urlKey(bookmark.url);
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    bookmarks.push({
      ...bookmark,
      id: createId('bm'),
      categoryId: idMap.get(bookmark.categoryId) ?? categories[0].id,
      order: nextOrder++,
      linkStatus: null,
    });
  });

  return normalizeState({
    categories,
    bookmarks,
    settings: currentState.settings,
  });
}

export function replaceWithImport(candidate, currentState) {
  const settings = candidate.sourceType === 'browser-html'
    ? currentState.settings
    : candidate.settings;
  return normalizeState({
    categories: candidate.categories,
    bookmarks: candidate.bookmarks.map((bookmark) => ({
      ...bookmark,
      linkStatus: null,
    })),
    settings,
  });
}

export function serializeBrowserBookmarks(state) {
  const categoryNames = new Map(
    state.categories.map((category) => [category.id, category.name]),
  );
  const groups = new Map(state.categories.map((category) => [category.name, []]));
  state.bookmarks.forEach((bookmark) => {
    const categoryName = categoryNames.get(bookmark.categoryId)
      ?? state.categories[0]?.name
      ?? '未分类';
    const folderName = bookmark.archivedAt
      ? `归档 / ${categoryName}`
      : categoryName;
    if (!groups.has(folderName)) groups.set(folderName, []);
    groups.get(folderName).push(bookmark);
  });

  const folders = [];
  groups.forEach((bookmarks, name) => {
    if (!bookmarks.length) return;
    const links = bookmarks.map((bookmark) => {
      const addDate = Math.floor((Date.parse(bookmark.createdAt) || Date.now()) / 1000);
      const tags = bookmark.tags.length
        ? ` TAGS="${escapeHtml(bookmark.tags.join(','))}"`
        : '';
      return '        <DT><A '
        + `HREF="${escapeHtml(bookmark.url)}" `
        + `ADD_DATE="${addDate}"${tags}>`
        + `${escapeHtml(bookmark.title)}</A>`;
    });
    folders.push([
      `    <DT><H3>${escapeHtml(name)}</H3>`,
      '    <DL><p>',
      ...links,
      '    </DL><p>',
    ].join('\n'));
  });

  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Star 收藏夹</TITLE>',
    '<H1>Star 收藏夹</H1>',
    '<DL><p>',
    ...folders,
    '</DL><p>',
    '',
  ].join('\n');
}

export function downloadText(text, fileName, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
