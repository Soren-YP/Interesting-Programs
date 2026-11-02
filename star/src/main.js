import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './styles.css';

import { checkLinks, fetchMetadata } from './api.js';
import {
  MAX_IMPORT_BYTES,
  collectTags,
  createId,
  deleteCategoryFromState,
  moveVisibleBookmark,
  normalizeTags,
  normalizeUrl,
  reorderVisibleBookmarks,
  selectBookmarks,
  titleFromUrl,
  urlKey,
} from './domain.js';
import {
  analyzeImport,
  downloadText,
  mergeImport,
  parseImportText,
  replaceWithImport,
  serializeBackup,
  serializeBrowserBookmarks,
} from './import-export.js';
import { AppStore } from './store.js';
import {
  isTypingTarget,
  shouldOpenCardFromEvent,
  shouldSwitchToAllOnSearch,
  trapFocus,
} from './ui-utils.js';

const SEARCH_ENGINES = {
  bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  baidu: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
  duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
};

const VIEWS = {
  favorites: { title: '常用', latin: 'FAVORITES', ordinal: 1, note: '置顶的收藏。悬停任一条目，查看它的注释。' },
  all: { title: '全部', latin: 'ALL ENTRIES', ordinal: 2, note: '除归档外的全部收藏。悬停任一条目，查看它的注释。' },
  archive: { title: '归档', latin: 'ARCHIVE', ordinal: 3, note: '归档的收藏不会出现在常用和全部里，随时可以恢复。' },
};

const SORT_LABELS = {
  manual: 'MANUAL ORDER',
  title: 'BY TITLE',
  created: 'RECENTLY ADDED',
  visited: 'RECENTLY VISITED',
  visits: 'MOST VISITED',
};

const elements = {
  activeFilters: document.getElementById('active-filters'),
  annotation: document.getElementById('annotation'),
  addCategoryButton: document.getElementById('add-category-button'),
  batchAddTags: document.getElementById('batch-add-tags'),
  batchArchive: document.getElementById('batch-archive'),
  batchCategory: document.getElementById('batch-category'),
  batchDelete: document.getElementById('batch-delete'),
  batchMove: document.getElementById('batch-move'),
  batchPin: document.getElementById('batch-pin'),
  batchRemoveTags: document.getElementById('batch-remove-tags'),
  batchRestore: document.getElementById('batch-restore'),
  batchTags: document.getElementById('batch-tags'),
  batchToolbar: document.getElementById('batch-toolbar'),
  batchUnpin: document.getElementById('batch-unpin'),
  bookmarkCategory: document.getElementById('bookmark-category'),
  bookmarkDialog: document.getElementById('bookmark-dialog'),
  bookmarkForm: document.getElementById('bookmark-form'),
  bookmarkGrid: document.getElementById('bookmark-grid'),
  bookmarkId: document.getElementById('bookmark-id'),
  bookmarkNotes: document.getElementById('bookmark-notes'),
  bookmarkPinned: document.getElementById('bookmark-pinned'),
  bookmarkSearch: document.getElementById('bookmark-search'),
  bookmarkSummary: document.getElementById('bookmark-summary'),
  bookmarkTags: document.getElementById('bookmark-tags'),
  bookmarkTitle: document.getElementById('bookmark-title'),
  bookmarkUrl: document.getElementById('bookmark-url'),
  categoryDialog: document.getElementById('category-dialog'),
  categoryForm: document.getElementById('category-form'),
  categoryId: document.getElementById('category-id'),
  categoryList: document.getElementById('category-list'),
  categoryName: document.getElementById('category-name'),
  checkLinksButton: document.getElementById('check-links-button'),
  collectionLatin: document.getElementById('collection-latin'),
  collectionMeta: document.getElementById('collection-meta'),
  collectionTitle: document.getElementById('collection-title'),
  clearTagsButton: document.getElementById('clear-tags-button'),
  confirmAccept: document.getElementById('confirm-accept'),
  confirmCancel: document.getElementById('confirm-cancel'),
  confirmDialog: document.getElementById('confirm-dialog'),
  confirmMessage: document.getElementById('confirm-message'),
  confirmTitle: document.getElementById('confirm-title'),
  exportHtmlButton: document.getElementById('export-html-button'),
  exportJsonButton: document.getElementById('export-json-button'),
  importButton: document.getElementById('import-button'),
  importDialog: document.getElementById('import-dialog'),
  importFile: document.getElementById('import-file'),
  importMerge: document.getElementById('import-merge'),
  importReplace: document.getElementById('import-replace'),
  importSummary: document.getElementById('import-summary'),
  leaderEnd: document.getElementById('leader-end'),
  leaderLayer: document.getElementById('leader-layer'),
  leaderLine: document.getElementById('leader-line'),
  leaderRing: document.getElementById('leader-ring'),
  metadataStatus: document.getElementById('metadata-status'),
  newBookmarkButton: document.getElementById('new-bookmark-button'),
  omniboxForm: document.getElementById('omnibox-form'),
  searchEngine: document.getElementById('search-engine'),
  selectedCount: document.getElementById('selected-count'),
  selectionModeButton: document.getElementById('selection-mode-button'),
  settingsButton: document.getElementById('settings-button'),
  sidebar: document.getElementById('sidebar'),
  sidebarClose: document.getElementById('sidebar-close'),
  sidebarMore: document.getElementById('sidebar-more'),
  sidebarScrim: document.getElementById('sidebar-scrim'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  sidebarViewNav: document.getElementById('sidebar-view-nav'),
  sortSelect: document.getElementById('sort-select'),
  tagList: document.getElementById('tag-list'),
  themeToggle: document.getElementById('theme-toggle'),
  toastRegion: document.getElementById('toast-region'),
  visibleSelectionToggle: document.getElementById('visible-selection-toggle'),
  viewTabs: document.querySelector('.view-tabs'),
};

const store = new AppStore();
const ui = {
  search: '',
  selectionMode: false,
  selectedIds: new Set(),
  importCandidate: null,
  importAnalysis: null,
  draggedId: null,
  metadataRequest: 0,
  dialogStack: [],
  confirmResolver: null,
  sidebarOpen: false,
  annotatedId: null,
};

const ICON_NAMES = {
  archive: 'archive',
  check: 'check',
  down: 'arrow-down',
  edit: 'pencil-simple',
  external: 'arrow-square-out',
  pin: 'star',
  restore: 'arrow-counter-clockwise',
  trash: 'trash',
  up: 'arrow-up',
};

function makeElement(tagName, className = '', text = '') {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function makeIcon(name, {
  className = '',
  weight = 'regular',
} = {}) {
  const iconElement = makeElement(
    'i',
    [
      weight === 'fill' ? 'ph-fill' : 'ph',
      `ph-${ICON_NAMES[name] ?? name}`,
      className,
    ].filter(Boolean).join(' '),
  );
  iconElement.setAttribute('aria-hidden', 'true');
  return iconElement;
}

function makeIconButton(action, id, iconName, label, extraClass = '') {
  const button = makeElement('button', extraClass);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.appendChild(makeIcon(iconName));
  return button;
}

function formatDate(value) {
  if (!value) return '从未';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  if (sameDay) return `今天 ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatRowDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const pad = (number) => String(number).padStart(2, '0');
  if (date.toDateString() === now.toDateString()) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
  }
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}`;
}

function currentVisible(state = store.getState()) {
  return selectBookmarks(state, { search: ui.search });
}

function setSidebarOpen(open) {
  ui.sidebarOpen = open;
  document.body.classList.toggle('sidebar-open', open);
  elements.sidebarToggle.setAttribute('aria-expanded', String(open));
  if (open) elements.sidebarClose.focus();
  else if (document.activeElement === elements.sidebarClose) elements.sidebarToggle.focus();
}

function selectView(view) {
  if (view === 'favorites' && ui.search.trim()) {
    ui.search = '';
    elements.bookmarkSearch.value = '';
  }
  updateState((state) => {
    state.settings.view = view;
    state.settings.tagFilters = [];
  });
  if (window.matchMedia?.('(max-width: 767px)').matches) {
    setSidebarOpen(false);
  }
}

function openExternal(destination) {
  const opened = window.open(destination, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
}

function searchTheWeb(query) {
  updateState((state) => {
    state.settings.searchEngine = elements.searchEngine.value;
  });
  openExternal(SEARCH_ENGINES[elements.searchEngine.value](query));
}

function looksLikeUrl(value) {
  const text = String(value).trim();
  return /^[a-z][a-z\d+.-]*:\/\//i.test(text)
    || /^localhost(?::\d+)?(?:\/|$)/i.test(text)
    || /^(?:[\p{L}\d-]+\.)+[\p{L}]{2,}(?::\d+)?(?:[/?#]|$)/iu.test(text);
}

function submitOmnibox({ forceWebSearch = false } = {}) {
  const query = elements.bookmarkSearch.value.trim();
  if (!query) return;
  if (forceWebSearch) {
    searchTheWeb(query);
    return;
  }

  if (looksLikeUrl(query)) {
    try {
      openExternal(normalizeUrl(query));
      return;
    }
    catch {
      // Invalid URL-like input continues through local results before web search.
    }
  }

  const firstMatch = currentVisible()[0];
  if (firstMatch) {
    openBookmark(firstMatch.id);
    return;
  }
  searchTheWeb(query);
}

function showToast(message, {
  type = 'info',
  actionLabel = '',
  onAction,
  duration = 4200,
} = {}) {
  const toast = makeElement('div', `toast ${type === 'error' ? 'error' : ''}`.trim());
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.appendChild(makeElement('span', '', message));

  if (actionLabel && onAction) {
    const button = makeElement('button', '', actionLabel);
    button.type = 'button';
    button.addEventListener('click', () => {
      onAction();
      toast.remove();
    });
    toast.appendChild(button);
  }
  elements.toastRegion.appendChild(toast);
  const timeout = setTimeout(() => toast.remove(), duration);
  toast.addEventListener('mouseenter', () => clearTimeout(timeout), { once: true });
}

function openDialog(dialog, focusTarget) {
  const previousFocus = document.activeElement;
  dialog.hidden = false;
  ui.dialogStack.push({ dialog, previousFocus });
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    (focusTarget ?? dialog.querySelector(
      'input:not([type="hidden"]), button:not([disabled]), select, textarea',
    ))?.focus();
  });
}

function closeDialog(dialog) {
  const index = ui.dialogStack.findLastIndex((entry) => entry.dialog === dialog);
  if (index < 0) return;
  const [{ previousFocus }] = ui.dialogStack.splice(index, 1);
  dialog.hidden = true;
  if (!ui.dialogStack.length) {
    document.body.style.overflow = '';
    previousFocus?.focus?.();
  }
  else {
    const top = ui.dialogStack.at(-1).dialog;
    top.querySelector('button, input, select, textarea')?.focus();
  }
}

function closeTopDialog() {
  const top = ui.dialogStack.at(-1)?.dialog;
  if (!top) return false;
  if (top === elements.confirmDialog) {
    resolveConfirm(false);
  }
  else {
    closeDialog(top);
  }
  return true;
}

function resolveConfirm(result) {
  const resolver = ui.confirmResolver;
  ui.confirmResolver = null;
  closeDialog(elements.confirmDialog);
  resolver?.(result);
}

function confirmAction({
  title = '请确认',
  message,
  confirmLabel = '确认',
  dangerous = true,
}) {
  if (ui.confirmResolver) resolveConfirm(false);
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAccept.textContent = confirmLabel;
  elements.confirmAccept.className = dangerous ? 'danger-button' : 'primary-button';
  openDialog(elements.confirmDialog, elements.confirmCancel);
  return new Promise((resolve) => {
    ui.confirmResolver = resolve;
  });
}

function applyTheme(state) {
  const dark = state.settings.theme === 'dark';
  document.body.classList.toggle('dark-theme', dark);
  elements.themeToggle.checked = dark;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b0b0d' : '#eceef1');
}

function renderCategoryOptions(state) {
  [elements.bookmarkCategory, elements.batchCategory].forEach((select) => {
    const current = select.value;
    select.replaceChildren();
    state.categories.forEach((category) => {
      const option = makeElement('option', '', category.name);
      option.value = category.id;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  });
}

function renderCategories(state) {
  elements.categoryList.replaceChildren();
  const baseVisible = selectBookmarks(state, {
    search: '',
    categoryId: 'all',
    tagFilters: [],
  });
  const rows = [
    { id: 'all', name: '全部', count: baseVisible.length, editable: false },
    ...state.categories.map((category) => ({
      ...category,
      count: baseVisible.filter((bookmark) => bookmark.categoryId === category.id).length,
      editable: true,
    })),
  ];

  rows.forEach((category) => {
    const row = makeElement(
      'div',
      `category-row ${state.settings.categoryId === category.id ? 'active' : ''}`.trim(),
    );
    row.dataset.categoryId = category.id;

    const select = makeElement('button', 'category-select');
    select.type = 'button';
    select.dataset.action = 'select-category';
    select.dataset.id = category.id;
    select.setAttribute('aria-pressed', String(state.settings.categoryId === category.id));
    const iconElement = makeIcon('folder', { className: 'category-icon' });
    const name = makeElement('span', 'category-name', category.name);
    const count = makeElement('span', 'category-count', String(category.count));
    select.append(iconElement, name, count);
    row.appendChild(select);

    if (category.editable) {
      const actions = makeElement('div', 'category-actions');
      actions.append(
        makeIconButton('edit-category', category.id, 'edit', `编辑分类 ${category.name}`),
        makeIconButton('delete-category', category.id, 'trash', `删除分类 ${category.name}`),
      );
      row.appendChild(actions);
    }
    elements.categoryList.appendChild(row);
  });
}

function renderTags(state) {
  elements.tagList.replaceChildren();
  const viewBookmarks = selectBookmarks(state, {
    search: '',
    categoryId: state.settings.categoryId,
    tagFilters: [],
  });
  const tags = collectTags(viewBookmarks, { includeArchived: state.settings.view === 'archive' });
  if (!tags.length) {
    elements.tagList.appendChild(makeElement('p', 'sidebar-empty', '暂无标签'));
    return;
  }

  const active = new Set(
    state.settings.tagFilters.map((tag) => tag.toLocaleLowerCase()),
  );
  tags.forEach((tag) => {
    const button = makeElement(
      'button',
      `tag-filter ${active.has(tag.name.toLocaleLowerCase()) ? 'active' : ''}`.trim(),
    );
    button.type = 'button';
    button.dataset.tag = tag.name;
    button.setAttribute(
      'aria-pressed',
      String(active.has(tag.name.toLocaleLowerCase())),
    );
    button.append(
      makeElement('span', 'tag-name', tag.name),
      makeElement('span', 'tag-count', String(tag.count)),
    );
    elements.tagList.appendChild(button);
  });
}

function renderActiveFilters(state) {
  elements.activeFilters.replaceChildren();
  if (state.settings.categoryId !== 'all') {
    const category = state.categories.find((item) => item.id === state.settings.categoryId);
    if (category) {
      elements.activeFilters.appendChild(
        makeElement('span', 'filter-chip', `分类：${category.name}`),
      );
    }
  }
  state.settings.tagFilters.forEach((tag) => {
    elements.activeFilters.appendChild(
      makeElement('span', 'filter-chip', `标签：${tag}`),
    );
  });
  if (ui.search.trim()) {
    elements.activeFilters.appendChild(
      makeElement('span', 'filter-chip', `搜索：${ui.search.trim()}`),
    );
  }
}

function faviconUrl(url) {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  }
  catch {
    return '/favicon.svg';
  }
}

function categoryName(state, id) {
  return state.categories.find((category) => category.id === id)?.name ?? '未分类';
}

function statusLabel(status) {
  if (!status) return '';
  if (status.state === 'ok') return status.statusCode ? `正常 ${status.statusCode}` : '正常';
  if (status.state === 'redirected') return status.statusCode
    ? `跳转 ${status.statusCode}`
    : '已跳转';
  return status.statusCode ? `异常 ${status.statusCode}` : '无法访问';
}

function renderBookmarkCard(bookmark, state, index, total) {
  const selected = ui.selectedIds.has(bookmark.id);
  const manual = state.settings.sort === 'manual';
  const card = makeElement(
    'article',
    [
      'bookmark-card',
      'bookmark-row',
      selected ? 'selected' : '',
      ui.selectionMode ? 'selection-enabled' : '',
    ].filter(Boolean).join(' '),
  );
  card.dataset.id = bookmark.id;
  card.tabIndex = 0;
  card.setAttribute('role', ui.selectionMode ? 'checkbox' : 'group');
  if (ui.selectionMode) card.setAttribute('aria-checked', String(selected));
  card.setAttribute(
    'aria-label',
    ui.selectionMode ? `选择 ${bookmark.title}` : `${bookmark.title}，按 Enter 打开`,
  );
  if (bookmark.notes) card.title = bookmark.notes;
  card.draggable = manual && !ui.selectionMode;

  const rowNo = makeElement('span', 'row-no', String(index + 1).padStart(2, '0'));
  rowNo.setAttribute('aria-hidden', 'true');

  const leading = makeElement('div', 'row-leading');
  const selection = makeElement('input', 'selection-control');
  selection.type = 'checkbox';
  selection.checked = selected;
  selection.dataset.action = 'toggle-selection';
  selection.dataset.id = bookmark.id;
  selection.setAttribute('aria-label', selected ? '取消选择' : `选择 ${bookmark.title}`);
  leading.appendChild(selection);

  if (manual) {
    const dragHandle = makeElement('button', 'drag-handle');
    dragHandle.type = 'button';
    dragHandle.tabIndex = -1;
    dragHandle.setAttribute('aria-label', `拖动排序 ${bookmark.title}`);
    dragHandle.title = '拖动排序';
    dragHandle.appendChild(makeIcon('dots-six-vertical'));
    leading.appendChild(dragHandle);
  }

  const image = makeElement('img', 'site-icon');
  image.alt = '';
  image.loading = 'lazy';
  image.src = faviconUrl(bookmark.url);
  image.addEventListener('error', () => {
    const initial = makeElement('span', 'site-initial', [...bookmark.title.trim()][0] ?? '·');
    initial.setAttribute('aria-hidden', 'true');
    image.replaceWith(initial);
  }, { once: true });
  leading.appendChild(image);

  let hostname = bookmark.url;
  try {
    hostname = new URL(bookmark.url).hostname.replace(/^www\./, '');
  }
  catch {
    // The normalized bookmark model normally guarantees a valid URL.
  }

  const titleCell = makeElement('div', 'row-title-cell');
  const titleLine = makeElement('div', 'row-title-line');
  const title = makeElement('h3', 'card-title', bookmark.title);
  titleLine.appendChild(title);
  if (bookmark.pinned) {
    const pinned = makeElement('span', 'pinned-mark');
    pinned.title = '常用收藏';
    pinned.appendChild(makeIcon('star', { weight: 'fill' }));
    titleLine.appendChild(pinned);
  }
  if (bookmark.archivedAt) {
    titleLine.appendChild(makeElement('span', 'archived-mark', '已归档'));
  }
  titleCell.appendChild(titleLine);

  const domainCell = makeElement('div', 'row-domain-cell');
  const link = makeElement('a', 'card-url', hostname);
  link.href = bookmark.url;
  link.dataset.action = 'open-bookmark';
  link.dataset.id = bookmark.id;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  domainCell.appendChild(link);

  if (bookmark.linkStatus) {
    const status = makeElement(
      'span',
      `status-indicator ${bookmark.linkStatus.state}`,
    );
    status.title = `${bookmark.linkStatus.message || statusLabel(bookmark.linkStatus)}；`
      + `检查时间：${formatDate(bookmark.linkStatus.checkedAt)}`;
    domainCell.appendChild(status);
  }

  titleCell.appendChild(domainCell);

  const metaCell = makeElement(
    'div',
    'row-meta-cell',
    bookmark.tags.length
      ? bookmark.tags.slice(0, 3).join(' · ')
      : categoryName(state, bookmark.categoryId),
  );

  const dateCell = makeElement(
    'time',
    'row-date',
    formatRowDate(bookmark.lastVisitedAt || bookmark.createdAt),
  );
  dateCell.dateTime = bookmark.lastVisitedAt || bookmark.createdAt;
  dateCell.title = bookmark.visitCount
    ? `访问 ${bookmark.visitCount} 次；最近访问 ${formatDate(bookmark.lastVisitedAt)}`
    : `添加于 ${formatDate(bookmark.createdAt)}`;

  const menu = makeElement('details', 'row-menu');
  const menuSummary = makeElement('summary', 'row-menu-trigger');
  menuSummary.setAttribute('aria-label', `管理 ${bookmark.title}`);
  menuSummary.title = '更多操作';
  menuSummary.appendChild(makeIcon('dots-three'));
  const menuPanel = makeElement('div', 'row-menu-panel');
  menuPanel.append(
    makeIconButton(
      'toggle-pin',
      bookmark.id,
      bookmark.pinned ? 'star-half' : 'star',
      bookmark.pinned ? '取消置顶' : '加入常用',
      'row-menu-item',
    ),
    makeIconButton('edit-bookmark', bookmark.id, 'edit', '编辑收藏', 'row-menu-item'),
    makeIconButton(
      bookmark.archivedAt ? 'restore-bookmark' : 'archive-bookmark',
      bookmark.id,
      bookmark.archivedAt ? 'restore' : 'archive',
      bookmark.archivedAt ? '恢复收藏' : '归档收藏',
      'row-menu-item',
    ),
  );
  if (manual) {
    const upButton = makeIconButton(
      'move-up',
      bookmark.id,
      'up',
      '向前移动',
      'row-menu-item mobile-order-action',
    );
    upButton.disabled = index === 0;
    const downButton = makeIconButton(
      'move-down',
      bookmark.id,
      'down',
      '向后移动',
      'row-menu-item mobile-order-action',
    );
    downButton.disabled = index === total - 1;
    menuPanel.append(upButton, downButton);
  }
  menuPanel.appendChild(
    makeIconButton(
      'delete-bookmark',
      bookmark.id,
      'trash',
      '删除收藏',
      'row-menu-item delete-card',
    ),
  );
  [...menuPanel.children].forEach((button) => {
    button.appendChild(makeElement('span', '', button.getAttribute('aria-label')));
  });
  menu.append(menuSummary, menuPanel);

  card.append(rowNo, leading, titleCell, metaCell, dateCell, menu);
  return card;
}

function renderBookmarks(state) {
  const visible = currentVisible(state);
  elements.bookmarkGrid.replaceChildren();

  elements.bookmarkSummary.textContent = `共 ${visible.length} 项`;

  if (!visible.length) {
    const empty = makeElement('div', 'empty-state');
    const copy = makeElement('div');
    const title = ui.search.trim() ? '没有匹配结果' : '这里还是空的';
    const description = state.settings.view === 'favorites'
      ? '将收藏加入常用后会显示在这里。'
      : state.settings.view === 'archive'
        ? '归档的收藏会安全地保存在这里。'
        : '新建收藏，开始整理你的网络入口。';
    copy.append(
      makeElement('h3', '', title),
      makeElement('p', '', description),
    );
    empty.append(makeIcon('folder-notch-open'), copy);
    elements.bookmarkGrid.appendChild(empty);
    return;
  }

  // 访问次数最多的前 3 条在静止时就被圈出
  const ranks = new Map(
    visible
      .filter((bookmark) => bookmark.visitCount > 0)
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 3)
      .map((bookmark, rank) => [bookmark.id, rank + 1]),
  );
  visible.forEach((bookmark, index) => {
    const card = renderBookmarkCard(bookmark, state, index, visible.length);
    if (ranks.has(bookmark.id)) card.classList.add(`circled-${ranks.get(bookmark.id)}`);
    elements.bookmarkGrid.appendChild(card);
  });
  const total = String(visible.length).padStart(2, '0');
  elements.bookmarkGrid.appendChild(makeElement('p', 'list-end', `— ${total} / ${total}`));
}

function renderBatchToolbar(state) {
  const validIds = new Set(state.bookmarks.map((bookmark) => bookmark.id));
  [...ui.selectedIds].forEach((id) => {
    if (!validIds.has(id)) ui.selectedIds.delete(id);
  });
  elements.batchToolbar.hidden = !ui.selectionMode;
  elements.selectionModeButton.querySelector('[data-label]').textContent = ui.selectionMode
    ? '退出批量'
    : '批量管理';
  elements.selectionModeButton.setAttribute('aria-pressed', String(ui.selectionMode));
  document.body.classList.toggle('selection-mode', ui.selectionMode);
  elements.selectedCount.textContent = `已选择 ${ui.selectedIds.size} 项`;
  const visibleIds = currentVisible(state).map((bookmark) => bookmark.id);
  const selectedVisible = visibleIds.filter((id) => ui.selectedIds.has(id)).length;
  elements.visibleSelectionToggle.checked = Boolean(visibleIds.length)
    && selectedVisible === visibleIds.length;
  elements.visibleSelectionToggle.indeterminate = selectedVisible > 0
    && selectedVisible < visibleIds.length;
  elements.visibleSelectionToggle.disabled = !visibleIds.length;
}

function makeOrdinal(number) {
  return makeElement('span', 'ordinal', String(number));
}

function makeKicker(number, label) {
  const kicker = makeElement('div', 'annotation-kicker');
  kicker.append(makeOrdinal(number), makeElement('span', '', label));
  return kicker;
}

function renderIdleAnnotation(state) {
  const view = VIEWS[state.settings.view] ?? VIEWS.all;
  const inner = makeElement('div', 'annotation-inner idle');
  inner.appendChild(makeKicker(view.ordinal, '最常访问'));
  const frequent = state.bookmarks
    .filter((bookmark) => !bookmark.archivedAt && bookmark.visitCount)
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 3);
  if (frequent.length) {
    const list = makeElement('ol', 'frequent');
    frequent.forEach((bookmark) => {
      const item = makeElement('li');
      const button = makeElement('button', 'frequent-item');
      button.type = 'button';
      button.dataset.openId = bookmark.id;
      button.append(
        makeElement('span', 'frequent-title', bookmark.title),
        makeElement('span', 'frequent-count', `${bookmark.visitCount} 次`),
      );
      item.appendChild(button);
      list.appendChild(item);
    });
    inner.appendChild(list);
  }
  else {
    inner.appendChild(makeElement('p', 'note-text', view.note));
  }
  inner.appendChild(makeElement('p', 'shortcuts', '/ 搜索 · N 新建 · CTRL ↵ 网页搜索'));
  return inner;
}

function renderBookmarkAnnotation(state, bookmark, number) {
  const inner = makeElement('div', 'annotation-inner');
  const details = makeElement('dl');
  const rows = [
    ['网址', bookmark.url, 'note-url'],
    ['分类', categoryName(state, bookmark.categoryId)],
    ['标签', bookmark.tags.join(' · ')],
    ['添加', formatDate(bookmark.createdAt)],
    ['访问', bookmark.visitCount
      ? `${bookmark.visitCount} 次 · 最近 ${formatDate(bookmark.lastVisitedAt)}`
      : ''],
    ['状态', bookmark.linkStatus ? statusLabel(bookmark.linkStatus) : ''],
  ];
  rows.filter(([, value]) => value).forEach(([term, value, className]) => {
    details.append(makeElement('dt', '', term), makeElement('dd', className, value));
  });
  inner.append(
    makeKicker(number, bookmark.archivedAt ? '已归档' : ''),
    makeElement('h3', '', bookmark.title),
    details,
  );
  if (bookmark.notes) inner.appendChild(makeElement('p', 'note-text', bookmark.notes));
  inner.appendChild(makeElement('span', 'note-open', ui.selectionMode ? 'SELECT ↵' : 'OPEN ↵'));
  return inner;
}

function annotationVisible() {
  return getComputedStyle(elements.annotation).display !== 'none';
}

function drawStroke(element) {
  if (typeof element.getTotalLength !== 'function' || typeof element.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const length = element.getTotalLength();
  element.style.strokeDasharray = `${length}`;
  element.animate(
    [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
    { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

// 节点被圈出；引线沿该行的底线画到注释，注释标题与这一行对齐
function positionLeader({ draw = false } = {}) {
  const card = [...elements.bookmarkGrid.querySelectorAll('.bookmark-card')]
    .find((item) => item.dataset.id === ui.annotatedId);
  const inner = elements.annotation.firstElementChild;
  if (!card || !inner || inner.classList.contains('idle') || !annotationVisible()) {
    elements.leaderLayer.classList.remove('visible');
    return;
  }
  const node = card.querySelector('.row-leading').getBoundingClientRect();
  const row = card.getBoundingClientRect();
  const panel = elements.annotation.getBoundingClientRect();
  const title = inner.querySelector('h3');
  const titleBottom = title.offsetTop + title.offsetHeight;
  const top = Math.min(
    Math.max(row.bottom - panel.top - titleBottom + 6, 24),
    panel.height - inner.offsetHeight - 24,
  );
  inner.style.top = `${top}px`;

  const cx = node.left + node.width / 2;
  const cy = node.top + node.height / 2;
  const baseline = row.bottom - 0.5;
  const titleRect = title.getBoundingClientRect();
  const endX = panel.left - 14;
  const endY = titleRect.bottom - 6;
  elements.leaderRing.setAttribute('cx', cx);
  elements.leaderRing.setAttribute('cy', cy);
  elements.leaderLine.setAttribute(
    'points',
    `${cx},${cy + 21} ${cx},${baseline} ${endX - 28},${baseline} ${endX},${endY}`,
  );
  elements.leaderEnd.setAttribute('cx', endX);
  elements.leaderEnd.setAttribute('cy', endY);
  elements.leaderLayer.classList.add('visible');
  if (draw) {
    drawStroke(elements.leaderRing);
    drawStroke(elements.leaderLine);
  }
}

function renderAnnotation(state = store.getState(), { draw = false } = {}) {
  const visible = currentVisible(state);
  const index = visible.findIndex((bookmark) => bookmark.id === ui.annotatedId);
  if (index < 0) ui.annotatedId = null;
  elements.bookmarkGrid.querySelectorAll('.bookmark-card').forEach((card) => {
    card.classList.toggle('annotated', card.dataset.id === ui.annotatedId);
  });
  elements.annotation.replaceChildren(
    index < 0
      ? renderIdleAnnotation(state)
      : renderBookmarkAnnotation(state, visible[index], index + 1),
  );
  positionLeader({ draw });
}

function annotate(id) {
  if (ui.annotatedId === id) return;
  ui.annotatedId = id;
  renderAnnotation(store.getState(), { draw: true });
}

function renderCollectionHeading(state) {
  const view = VIEWS[state.settings.view] ?? VIEWS.all;
  const count = currentVisible(state).length;
  elements.collectionTitle.textContent = view.title;
  elements.collectionLatin.textContent = view.latin;
  elements.collectionMeta.textContent = [
    `${String(count).padStart(2, '0')} ENTRIES`,
    SORT_LABELS[state.settings.sort] ?? '',
    '— YAPENG',
  ].join('\n');
}

function renderTabsAndControls(state) {
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === state.settings.view;
    button.classList.toggle('active', active);
    if (button.getAttribute('role') === 'tab') {
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    else {
      button.setAttribute('aria-current', active ? 'page' : 'false');
    }
  });
  elements.sortSelect.value = state.settings.sort;
  elements.searchEngine.value = state.settings.searchEngine;
  elements.clearTagsButton.disabled = !state.settings.tagFilters.length;
}

function renderAll(state = store.getState()) {
  applyTheme(state);
  renderTabsAndControls(state);
  renderCollectionHeading(state);
  renderCategoryOptions(state);
  renderCategories(state);
  renderTags(state);
  renderActiveFilters(state);
  renderBatchToolbar(state);
  renderBookmarks(state);
  renderAnnotation(state);
}

function updateState(mutator, errorMessage = '操作失败。') {
  try {
    return store.update(mutator);
  }
  catch (error) {
    showToast(error.message || errorMessage, { type: 'error', duration: 6500 });
    return null;
  }
}

function openBookmark(id) {
  const state = store.getState();
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) return;
  updateState((draft) => {
    const target = draft.bookmarks.find((item) => item.id === id);
    target.visitCount += 1;
    target.lastVisitedAt = new Date().toISOString();
  });
  openExternal(bookmark.url);
}

function toggleSelection(id) {
  ui.selectionMode = true;
  if (ui.selectedIds.has(id)) ui.selectedIds.delete(id);
  else ui.selectedIds.add(id);
  renderAll();
}

function openBookmarkForm(bookmark = null) {
  const state = store.getState();
  elements.bookmarkForm.reset();
  elements.metadataStatus.textContent = '';
  elements.metadataStatus.classList.remove('error');
  if (bookmark) {
    document.getElementById('bookmark-dialog-title').textContent = '编辑收藏';
    elements.bookmarkId.value = bookmark.id;
    elements.bookmarkUrl.value = bookmark.url;
    elements.bookmarkTitle.value = bookmark.title;
    elements.bookmarkCategory.value = bookmark.categoryId;
    elements.bookmarkTags.value = bookmark.tags.join(', ');
    elements.bookmarkNotes.value = bookmark.notes;
    elements.bookmarkPinned.checked = bookmark.pinned;
  }
  else {
    document.getElementById('bookmark-dialog-title').textContent = '新建收藏';
    elements.bookmarkId.value = '';
    const preferredCategory = state.settings.categoryId !== 'all'
      ? state.settings.categoryId
      : state.categories[0].id;
    elements.bookmarkCategory.value = preferredCategory;
    elements.bookmarkPinned.checked = state.settings.view === 'favorites';
  }
  openDialog(elements.bookmarkDialog, elements.bookmarkUrl);
}

async function loadMetadataForForm() {
  if (elements.bookmarkTitle.value.trim()) return;
  let url;
  try {
    url = normalizeUrl(elements.bookmarkUrl.value);
  }
  catch {
    return;
  }

  const requestId = ++ui.metadataRequest;
  elements.metadataStatus.textContent = '正在从本地服务读取网页标题…';
  elements.metadataStatus.classList.remove('error');
  try {
    const metadata = await fetchMetadata(url);
    if (requestId !== ui.metadataRequest) return;
    if (!elements.bookmarkTitle.value.trim()) {
      elements.bookmarkTitle.value = metadata.title || titleFromUrl(url);
    }
    if (metadata.finalUrl) elements.bookmarkUrl.value = metadata.finalUrl;
    elements.metadataStatus.textContent = metadata.redirected
      ? `已跟随跳转，状态 ${metadata.status}。`
      : `网页状态 ${metadata.status}。`;
  }
  catch (error) {
    if (requestId !== ui.metadataRequest) return;
    elements.metadataStatus.textContent = `无法自动读取标题：${error.message}`;
    elements.metadataStatus.classList.add('error');
  }
}

async function saveBookmark(event) {
  event.preventDefault();
  let url;
  try {
    url = normalizeUrl(elements.bookmarkUrl.value);
  }
  catch (error) {
    elements.metadataStatus.textContent = error.message;
    elements.metadataStatus.classList.add('error');
    elements.bookmarkUrl.focus();
    return;
  }

  const state = store.getState();
  const editingId = elements.bookmarkId.value;
  const duplicate = state.bookmarks.find((bookmark) => (
    bookmark.id !== editingId && urlKey(bookmark.url) === urlKey(url)
  ));
  if (duplicate) {
    const proceed = await confirmAction({
      title: '发现重复网址',
      message: `“${duplicate.title}”已经保存了相同网址。仍要继续保存吗？`,
      confirmLabel: '仍然保存',
      dangerous: false,
    });
    if (!proceed) return;
  }

  const timestamp = new Date().toISOString();
  const data = {
    url,
    title: elements.bookmarkTitle.value.trim().slice(0, 200) || titleFromUrl(url),
    categoryId: elements.bookmarkCategory.value,
    tags: normalizeTags(elements.bookmarkTags.value),
    notes: elements.bookmarkNotes.value.trim().slice(0, 2000),
    pinned: elements.bookmarkPinned.checked,
  };
  const saved = updateState((draft) => {
    if (editingId) {
      const target = draft.bookmarks.find((bookmark) => bookmark.id === editingId);
      if (!target) return;
      const urlChanged = urlKey(target.url) !== urlKey(url);
      Object.assign(target, data, {
        updatedAt: timestamp,
        linkStatus: urlChanged ? null : target.linkStatus,
      });
    }
    else {
      draft.bookmarks.push({
        id: createId('bm'),
        ...data,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: null,
        lastVisitedAt: null,
        visitCount: 0,
        order: draft.bookmarks.length,
        linkStatus: null,
      });
    }
  });
  if (!saved) return;
  closeDialog(elements.bookmarkDialog);
  showToast(editingId ? '收藏已更新。' : '收藏已添加。');
}

function openCategoryForm(category = null) {
  elements.categoryForm.reset();
  elements.categoryId.value = category?.id ?? '';
  elements.categoryName.value = category?.name ?? '';
  document.getElementById('category-dialog-title').textContent = category
    ? '编辑分类'
    : '新建分类';
  openDialog(elements.categoryDialog, elements.categoryName);
}

function saveCategory(event) {
  event.preventDefault();
  const name = elements.categoryName.value.trim().slice(0, 80);
  if (!name) return;
  const id = elements.categoryId.value;
  const state = store.getState();
  const duplicate = state.categories.find((category) => (
    category.id !== id && category.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  ));
  if (duplicate) {
    showToast('已经存在同名分类。', { type: 'error' });
    return;
  }

  updateState((draft) => {
    if (id) {
      const category = draft.categories.find((item) => item.id === id);
      if (category) category.name = name;
    }
    else {
      draft.categories.push({
        id: createId('cat'),
        name,
        order: draft.categories.length,
      });
    }
  });
  closeDialog(elements.categoryDialog);
  showToast(id ? '分类已更新。' : '分类已创建。');
}

async function deleteCategory(id) {
  const state = store.getState();
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;
  const count = state.bookmarks.filter((bookmark) => bookmark.categoryId === id).length;
  const fallback = state.categories.find((item) => item.id !== id)?.name ?? '未分类';
  const accepted = await confirmAction({
    title: '删除分类',
    message: `删除“${category.name}”后，其中 ${count} 个收藏将移动到“${fallback}”。`,
    confirmLabel: '删除分类',
  });
  if (!accepted) return;
  store.replace(deleteCategoryFromState(state, id), { captureRecovery: false });
  showToast(`分类已删除，相关收藏已移动到“${fallback}”。`);
}

async function deleteBookmarks(ids) {
  const count = ids.length;
  if (!count) return;
  const accepted = await confirmAction({
    title: count === 1 ? '删除收藏' : '批量删除收藏',
    message: `确定永久删除 ${count} 个收藏吗？此操作不能通过归档恢复。`,
    confirmLabel: '删除',
  });
  if (!accepted) return;
  const idSet = new Set(ids);
  updateState((draft) => {
    draft.bookmarks = draft.bookmarks
      .filter((bookmark) => !idSet.has(bookmark.id))
      .map((bookmark, index) => ({ ...bookmark, order: index }));
  });
  ids.forEach((id) => ui.selectedIds.delete(id));
  showToast(`已删除 ${count} 个收藏。`);
}

function updateBookmarksById(ids, updater) {
  const idSet = new Set(ids);
  const timestamp = new Date().toISOString();
  return updateState((draft) => {
    draft.bookmarks.forEach((bookmark) => {
      if (!idSet.has(bookmark.id)) return;
      updater(bookmark);
      bookmark.updatedAt = timestamp;
    });
  });
}

function handleCardAction(action, id) {
  const state = store.getState();
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) return;
  const visibleIds = currentVisible(state).map((item) => item.id);

  if (action === 'open-bookmark') openBookmark(id);
  else if (action === 'toggle-selection') toggleSelection(id);
  else if (action === 'edit-bookmark') openBookmarkForm(bookmark);
  else if (action === 'toggle-pin') {
    updateBookmarksById([id], (target) => {
      target.pinned = !target.pinned;
    });
  }
  else if (action === 'archive-bookmark') {
    updateBookmarksById([id], (target) => {
      target.archivedAt = new Date().toISOString();
      target.pinned = false;
    });
    showToast('收藏已归档。');
  }
  else if (action === 'restore-bookmark') {
    updateBookmarksById([id], (target) => {
      target.archivedAt = null;
    });
    showToast('收藏已恢复。');
  }
  else if (action === 'delete-bookmark') {
    deleteBookmarks([id]);
  }
  else if (action === 'move-up' || action === 'move-down') {
    updateState((draft) => {
      draft.bookmarks = moveVisibleBookmark(
        draft.bookmarks,
        visibleIds,
        id,
        action === 'move-up' ? -1 : 1,
      );
    });
  }
}

function selectedOrVisibleIds() {
  return ui.selectedIds.size
    ? [...ui.selectedIds]
    : currentVisible().map((bookmark) => bookmark.id);
}

async function runLinkCheck() {
  const ids = selectedOrVisibleIds();
  if (!ids.length) {
    showToast('当前没有可检查的收藏。');
    return;
  }
  const state = store.getState();
  const selected = state.bookmarks.filter((bookmark) => ids.includes(bookmark.id));
  const label = elements.checkLinksButton.querySelector('[data-label]');
  elements.checkLinksButton.disabled = true;
  label.textContent = `检查中 0/${selected.length}`;

  try {
    const results = await checkLinks(
      selected.map((bookmark) => bookmark.url),
      (complete, total) => {
        label.textContent = `检查中 ${complete}/${total}`;
      },
    );
    const byUrl = new Map(results.map((result) => [urlKey(result.url), result]));
    updateState((draft) => {
      draft.bookmarks.forEach((bookmark) => {
        const result = byUrl.get(urlKey(bookmark.url));
        if (!result) return;
        bookmark.linkStatus = {
          state: result.state,
          statusCode: result.statusCode,
          checkedAt: result.checkedAt,
          finalUrl: result.finalUrl,
          message: result.message,
        };
      });
    });
    const errors = results.filter((result) => result.state === 'error').length;
    showToast(
      errors
        ? `检查完成：${results.length - errors} 个正常，${errors} 个异常。`
        : `检查完成：${results.length} 个链接均可访问。`,
      { type: errors ? 'error' : 'info', duration: 6000 },
    );
  }
  catch (error) {
    showToast(`链接检查失败：${error.message}`, { type: 'error', duration: 6500 });
  }
  finally {
    elements.checkLinksButton.disabled = false;
    label.textContent = '检查链接';
  }
}

function renderImportPreview(analysis) {
  elements.importSummary.replaceChildren();
  const stats = [
    ['总收藏', analysis.totalCount],
    ['可新增', analysis.newCount],
    ['重复', analysis.duplicateCount],
    ['无效', analysis.invalidCount],
    ['分类', analysis.categoryCount],
  ];
  stats.forEach(([label, value]) => {
    const card = makeElement('div', 'import-stat');
    card.append(
      makeElement('strong', '', String(value)),
      makeElement('span', '', label),
    );
    elements.importSummary.appendChild(card);
  });
}

async function handleImportFile() {
  const [file] = elements.importFile.files;
  elements.importFile.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    showToast('导入文件超过 5 MB 限制。', { type: 'error' });
    return;
  }

  try {
    const candidate = parseImportText(await file.text(), file.name);
    const analysis = analyzeImport(candidate, store.getState());
    ui.importCandidate = candidate;
    ui.importAnalysis = analysis;
    renderImportPreview(analysis);
    openDialog(elements.importDialog, elements.importMerge);
  }
  catch (error) {
    showToast(`导入失败：${error.message}`, { type: 'error', duration: 7000 });
  }
}

function finishImport(mode) {
  if (!ui.importCandidate) return;
  try {
    const current = store.getState();
    const next = mode === 'merge'
      ? mergeImport(ui.importCandidate, current)
      : replaceWithImport(ui.importCandidate, current);
    store.replace(next, { captureRecovery: mode === 'replace' });
    closeDialog(elements.importDialog);
    ui.search = '';
    elements.bookmarkSearch.value = '';
    ui.selectedIds.clear();
    ui.importCandidate = null;
    ui.importAnalysis = null;
    if (mode === 'replace') {
      showToast('数据已完整替换。', {
        actionLabel: '撤销',
        duration: 9000,
        onAction: () => {
          if (store.restoreRecovery()) showToast('已恢复替换前的数据。');
        },
      });
    }
    else {
      showToast('新收藏已安全合并，重复网址已跳过。');
    }
  }
  catch (error) {
    showToast(`导入失败：${error.message}`, { type: 'error', duration: 7000 });
  }
}

function exportJson() {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    serializeBackup(store.getState()),
    `star-bookmarks-${date}.json`,
    'application/json;charset=utf-8',
  );
  showToast('JSON 备份已生成。');
}

function exportHtml() {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    serializeBrowserBookmarks(store.getState()),
    `star-bookmarks-${date}.html`,
    'text/html;charset=utf-8',
  );
  showToast('浏览器书签文件已生成。');
}

function runBatchAction(action) {
  const ids = [...ui.selectedIds];
  if (!ids.length) {
    showToast('请先选择收藏。');
    return;
  }
  if (action === 'delete') {
    deleteBookmarks(ids);
    return;
  }

  const tags = normalizeTags(elements.batchTags.value);
  if (['add-tags', 'remove-tags'].includes(action) && !tags.length) {
    showToast('请输入至少一个标签。');
    return;
  }
  const tagKeys = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
  updateBookmarksById(ids, (bookmark) => {
    if (action === 'move') bookmark.categoryId = elements.batchCategory.value;
    else if (action === 'pin') bookmark.pinned = true;
    else if (action === 'unpin') bookmark.pinned = false;
    else if (action === 'archive') {
      bookmark.archivedAt = new Date().toISOString();
      bookmark.pinned = false;
    }
    else if (action === 'restore') bookmark.archivedAt = null;
    else if (action === 'add-tags') {
      bookmark.tags = normalizeTags([...bookmark.tags, ...tags]);
    }
    else if (action === 'remove-tags') {
      bookmark.tags = bookmark.tags.filter(
        (tag) => !tagKeys.has(tag.toLocaleLowerCase()),
      );
    }
  });
  showToast(`已更新 ${ids.length} 个收藏。`);
}

function bindEvents() {
  store.subscribe(renderAll);

  elements.themeToggle.addEventListener('change', () => {
    updateState((state) => {
      state.settings.theme = elements.themeToggle.checked ? 'dark' : 'light';
    });
  });

  elements.omniboxForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOmnibox();
  });

  elements.searchEngine.addEventListener('change', () => {
    updateState((state) => {
      state.settings.searchEngine = elements.searchEngine.value;
    });
  });

  const handleViewNavigation = (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    selectView(button.dataset.view);
  };
  elements.viewTabs.addEventListener('click', handleViewNavigation);
  elements.sidebarViewNav.addEventListener('click', handleViewNavigation);

  elements.bookmarkSearch.addEventListener('input', () => {
    ui.search = elements.bookmarkSearch.value;
    const state = store.getState();
    if (shouldSwitchToAllOnSearch(state.settings.view, ui.search)) {
      updateState((draft) => {
        draft.settings.view = 'all';
      });
    }
    else {
      renderAll(state);
    }
  });
  elements.bookmarkSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    submitOmnibox({ forceWebSearch: true });
  });

  elements.sortSelect.addEventListener('change', () => {
    updateState((state) => {
      state.settings.sort = elements.sortSelect.value;
    });
  });

  elements.categoryList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'select-category') {
      updateState((state) => {
        state.settings.categoryId = state.settings.categoryId === id ? 'all' : id;
        state.settings.tagFilters = [];
      });
    }
    else if (action === 'edit-category') {
      const category = store.getState().categories.find((item) => item.id === id);
      if (category) openCategoryForm(category);
    }
    else if (action === 'delete-category') deleteCategory(id);
  });

  elements.tagList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tag]');
    if (!button) return;
    updateState((state) => {
      const key = button.dataset.tag.toLocaleLowerCase();
      const index = state.settings.tagFilters.findIndex(
        (tag) => tag.toLocaleLowerCase() === key,
      );
      if (index >= 0) state.settings.tagFilters.splice(index, 1);
      else state.settings.tagFilters.push(button.dataset.tag);
    });
  });

  elements.clearTagsButton.addEventListener('click', () => {
    updateState((state) => {
      state.settings.tagFilters = [];
    });
  });

  elements.bookmarkGrid.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      handleCardAction(actionButton.dataset.action, actionButton.dataset.id);
      actionButton.closest('details')?.removeAttribute('open');
      return;
    }
    const card = event.target.closest('.bookmark-card');
    if (!card) return;
    if (ui.selectionMode) {
      toggleSelection(card.dataset.id);
    }
    else if (shouldOpenCardFromEvent(event)) {
      openBookmark(card.dataset.id);
    }
  });

  elements.bookmarkGrid.addEventListener('keydown', (event) => {
    const card = event.target.closest('.bookmark-card');
    if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (ui.selectionMode) toggleSelection(card.dataset.id);
    else openBookmark(card.dataset.id);
  });

  elements.bookmarkGrid.addEventListener('mouseover', (event) => {
    const card = event.target.closest('.bookmark-card');
    if (card) annotate(card.dataset.id);
  });
  elements.bookmarkGrid.addEventListener('focusin', (event) => {
    const card = event.target.closest('.bookmark-card');
    if (card) annotate(card.dataset.id);
  });
  elements.bookmarkGrid.addEventListener('mouseleave', () => {
    if (!elements.bookmarkGrid.contains(document.activeElement)) annotate(null);
  });
  elements.bookmarkGrid.addEventListener('focusout', (event) => {
    if (!elements.bookmarkGrid.contains(event.relatedTarget)) annotate(null);
  });
  window.addEventListener('scroll', () => positionLeader(), { passive: true });
  window.addEventListener('resize', () => positionLeader());
  elements.annotation.addEventListener('click', (event) => {
    const item = event.target.closest('[data-open-id]');
    if (item) openBookmark(item.dataset.openId);
  });

  elements.bookmarkGrid.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.bookmark-card[draggable="true"]');
    if (!card) return;
    ui.draggedId = card.dataset.id;
    card.classList.add('dragging');
    event.dataTransfer.setData('text/plain', ui.draggedId);
    event.dataTransfer.effectAllowed = 'move';
  });

  elements.bookmarkGrid.addEventListener('dragover', (event) => {
    const card = event.target.closest('.bookmark-card');
    if (!card || !ui.draggedId) return;
    event.preventDefault();
    card.classList.add('drag-over');
  });

  elements.bookmarkGrid.addEventListener('dragleave', (event) => {
    event.target.closest('.bookmark-card')?.classList.remove('drag-over');
  });

  elements.bookmarkGrid.addEventListener('drop', (event) => {
    const card = event.target.closest('.bookmark-card');
    if (!card || !ui.draggedId) return;
    event.preventDefault();
    const targetId = card.dataset.id;
    const visibleIds = currentVisible().map((bookmark) => bookmark.id);
    updateState((state) => {
      state.bookmarks = reorderVisibleBookmarks(
        state.bookmarks,
        visibleIds,
        ui.draggedId,
        targetId,
      );
    });
    ui.draggedId = null;
  });

  elements.bookmarkGrid.addEventListener('dragend', () => {
    ui.draggedId = null;
    elements.bookmarkGrid.querySelectorAll('.bookmark-card').forEach((card) => {
      card.classList.remove('dragging', 'drag-over');
    });
  });

  elements.newBookmarkButton.addEventListener('click', () => openBookmarkForm());
  elements.bookmarkForm.addEventListener('submit', saveBookmark);
  elements.bookmarkUrl.addEventListener('blur', loadMetadataForForm);
  elements.addCategoryButton.addEventListener('click', () => openCategoryForm());
  elements.categoryForm.addEventListener('submit', saveCategory);

  elements.selectionModeButton.addEventListener('click', () => {
    ui.selectionMode = !ui.selectionMode;
    if (!ui.selectionMode) ui.selectedIds.clear();
    renderAll();
  });
  elements.visibleSelectionToggle.addEventListener('change', () => {
    const visibleIds = currentVisible().map((bookmark) => bookmark.id);
    if (!visibleIds.length) return;
    ui.selectionMode = true;
    if (elements.visibleSelectionToggle.checked) {
      visibleIds.forEach((id) => ui.selectedIds.add(id));
    }
    else {
      visibleIds.forEach((id) => ui.selectedIds.delete(id));
    }
    renderAll();
  });
  elements.checkLinksButton.addEventListener('click', runLinkCheck);
  elements.batchMove.addEventListener('click', () => runBatchAction('move'));
  elements.batchAddTags.addEventListener('click', () => runBatchAction('add-tags'));
  elements.batchRemoveTags.addEventListener('click', () => runBatchAction('remove-tags'));
  elements.batchPin.addEventListener('click', () => runBatchAction('pin'));
  elements.batchUnpin.addEventListener('click', () => runBatchAction('unpin'));
  elements.batchArchive.addEventListener('click', () => runBatchAction('archive'));
  elements.batchRestore.addEventListener('click', () => runBatchAction('restore'));
  elements.batchDelete.addEventListener('click', () => runBatchAction('delete'));

  elements.importButton.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', handleImportFile);
  elements.importMerge.addEventListener('click', () => finishImport('merge'));
  elements.importReplace.addEventListener('click', () => finishImport('replace'));
  elements.exportJsonButton.addEventListener('click', exportJson);
  elements.exportHtmlButton.addEventListener('click', exportHtml);

  elements.sidebarToggle.addEventListener('click', () => setSidebarOpen(true));
  elements.sidebarClose.addEventListener('click', () => setSidebarOpen(false));
  elements.sidebarScrim.addEventListener('click', () => setSidebarOpen(false));
  elements.settingsButton.addEventListener('click', () => {
    elements.sidebarMore.open = true;
    if (window.matchMedia?.('(max-width: 767px)').matches) {
      setSidebarOpen(true);
    }
    else {
      elements.sidebarMore.querySelector('summary').focus();
    }
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(button.closest('.dialog-backdrop')));
  });
  document.querySelectorAll('.dialog-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop && backdrop !== elements.confirmDialog) {
        closeDialog(backdrop);
      }
    });
  });
  elements.confirmCancel.addEventListener('click', () => resolveConfirm(false));
  elements.confirmAccept.addEventListener('click', () => resolveConfirm(true));

  window.addEventListener('keydown', (event) => {
    const top = ui.dialogStack.at(-1)?.dialog;
    if (top) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTopDialog();
      }
      else {
        trapFocus(event, top);
      }
      return;
    }
    if (event.key === 'Escape' && ui.selectionMode) {
      ui.selectionMode = false;
      ui.selectedIds.clear();
      renderAll();
      return;
    }
    if (event.key === 'Escape' && ui.sidebarOpen) {
      setSidebarOpen(false);
      return;
    }
    if (isTypingTarget(event.target)) return;
    if (event.key === '/' || (event.key.toLocaleLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      elements.bookmarkSearch.focus();
    }
    else if (event.key.toLocaleLowerCase() === 'n') {
      event.preventDefault();
      openBookmarkForm();
    }
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env?.DEV) {
    // 开发时 Service Worker 会缓存旧模块，导致改动看不到
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {});
    return;
  }
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('新版本已经准备好。', {
              actionLabel: '刷新',
              duration: 12_000,
              onAction: () => window.location.reload(),
            });
          }
        });
      });
    }
    catch {
      showToast('离线功能暂时不可用，核心收藏功能不受影响。', { type: 'error' });
    }
  });
}

bindEvents();
renderAll();
registerServiceWorker();
