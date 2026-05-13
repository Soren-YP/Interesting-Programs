let bookmarks = [];
let currentCategory = 'all';
let editingBookmarkId = null;
let editingCategoryId = null;

const bookmarksContainer = document.getElementById('bookmarks-container');
const starSection = document.getElementById('star-section');
const toggleStarBtn = document.getElementById('toggle-star-btn');
const bookmarkSummary = document.getElementById('bookmark-summary');
const webSearchForm = document.getElementById('web-search-form');
const webSearchInput = document.getElementById('web-search-input');
const webSearchEngine = document.getElementById('web-search-engine');
const addBookmarkBtn = document.getElementById('add-bookmark-btn');
const addModal = document.getElementById('add-modal');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.getElementById('cancel-btn');
const bookmarkForm = document.getElementById('bookmark-form');
const categoryList = document.getElementById('category-list');
const addCategoryBtn = document.getElementById('add-category-btn');
const newCategoryInput = document.getElementById('new-category');
const bookmarkCategorySelect = document.getElementById('bookmark-category');
const searchInput = document.getElementById('search-input');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const themeToggle = document.getElementById('theme-toggle');
const modalTitle = document.getElementById('modal-title');

const FAVICON_CACHE_KEY = 'faviconUrlCache';
const DEFAULT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="12" x2="52" y1="8" y2="56"><stop stop-color="#0A84FF"/><stop offset="1" stop-color="#34C759"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><path fill="#fff" d="M20 18.5A4.5 4.5 0 0 1 24.5 14h15A4.5 4.5 0 0 1 44 18.5V50L32 42.6 20 50V18.5Z" opacity=".94"/></svg>`;
const DEFAULT_ICON_DATA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(DEFAULT_ICON_SVG);

const CUSTOM_ICONS = {
    'chatgpt.com': 'https://chatgpt.com/favicon.ico',
    'www.chatgpt.com': 'https://chatgpt.com/favicon.ico',
    'openai.com': 'https://openai.com/favicon.ico',
    'www.openai.com': 'https://openai.com/favicon.ico',
    'github.com': 'https://github.com/favicon.ico',
    'www.github.com': 'https://github.com/favicon.ico'
};

const SEARCH_ENGINES = {
    bing: query => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    google: query => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    baidu: query => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
    duckduckgo: query => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
};

function initApp() {
    loadBookmarks();
    loadCategories();
    loadThemePreference();
    setupEventListeners();
    renderBookmarks();
}

function getDomainFromUrl(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return url;
    }
}

function looksLikeUrl(value) {
    const text = value.trim();
    return /^https?:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(text);
}

function normalizeDestination(value) {
    const text = value.trim();
    if (/^https?:\/\//i.test(text)) return text;
    return `https://${text}`;
}

function safeParse(raw, fallback) {
    try {
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function getCategories() {
    return safeParse(localStorage.getItem('categories'), []);
}

function saveCategories(categories) {
    localStorage.setItem('categories', JSON.stringify(categories));
}

function loadCategories() {
    const savedCategories = getCategories();
    if (savedCategories.length) {
        renderCategories(savedCategories);
        return;
    }

    const defaultCategories = [
        { id: 'work', name: '工作' },
        { id: 'study', name: '学习' },
        { id: 'entertainment', name: '娱乐' }
    ];
    saveCategories(defaultCategories);
    renderCategories(defaultCategories);
}

function loadBookmarks() {
    bookmarks = safeParse(localStorage.getItem('bookmarks'), []);
    if (bookmarks.length) return;

    bookmarks = [
        {
            id: 'bm1',
            url: 'https://www.google.com',
            title: 'Google 搜索',
            category: 'work',
            notes: '快速检索资料、图片和灵感。',
            createdAt: new Date().toISOString(),
            order: 0
        },
        {
            id: 'bm2',
            url: 'https://www.github.com',
            title: 'GitHub',
            category: 'study',
            notes: '代码托管、开源项目和开发者社区。',
            createdAt: new Date().toISOString(),
            order: 1
        }
    ];
    saveBookmarks();
}

function saveBookmarks() {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function readFaviconCache() {
    return safeParse(localStorage.getItem(FAVICON_CACHE_KEY), {});
}

function writeFaviconCache(cache) {
    localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(cache));
}

function getCachedFaviconUrl(domain) {
    return readFaviconCache()[domain] || null;
}

function cacheFaviconUrl(domain, url) {
    const cache = readFaviconCache();
    cache[domain] = url;
    writeFaviconCache(cache);
}

function removeCachedFaviconUrl(domain) {
    const cache = readFaviconCache();
    if (Object.prototype.hasOwnProperty.call(cache, domain)) {
        delete cache[domain];
        writeFaviconCache(cache);
    }
}

function clearAllFaviconCache() {
    localStorage.removeItem(FAVICON_CACHE_KEY);
}

window.clearAllFaviconCache = clearAllFaviconCache;

function getFaviconCandidates(domain) {
    if (CUSTOM_ICONS[domain]) {
        return [
            CUSTOM_ICONS[domain],
            `https://${domain}/favicon.ico`,
            `https://icon.horse/icon/${domain}`,
            `https://api.faviconkit.com/${domain}/64`
        ];
    }

    return [
        `https://${domain}/favicon.ico`,
        `https://icon.horse/icon/${domain}`,
        `https://api.faviconkit.com/${domain}/64`
    ];
}

function setFavicon(imgEl, domain) {
    const cached = getCachedFaviconUrl(domain);
    if (cached) {
        imgEl.onerror = () => {
            imgEl.onerror = null;
            removeCachedFaviconUrl(domain);
            setFaviconFromSources(imgEl, domain);
        };
        imgEl.src = cached;
        return;
    }
    setFaviconFromSources(imgEl, domain);
}

function setFaviconFromSources(imgEl, domain) {
    const urls = getFaviconCandidates(domain);
    let index = 0;

    const tryNext = () => {
        if (index >= urls.length) {
            imgEl.onload = null;
            imgEl.onerror = null;
            imgEl.src = DEFAULT_ICON_DATA_URI;
            return;
        }

        const url = urls[index++];
        imgEl.onload = () => {
            if (imgEl.naturalWidth >= 16 && imgEl.naturalHeight >= 16) {
                cacheFaviconUrl(domain, url);
                imgEl.onload = null;
                imgEl.onerror = null;
            } else {
                tryNext();
            }
        };
        imgEl.onerror = tryNext;
        imgEl.src = url;
    };

    tryNext();
}

function getCategoryName(categoryId) {
    const category = getCategories().find(item => item.id === categoryId);
    return category ? category.name : '未分类';
}

function getVisibleBookmarks() {
    let visible = [...bookmarks];

    if (currentCategory !== 'all') {
        visible = visible.filter(bookmark => bookmark.category === currentCategory);
    }

    const keyword = searchInput.value.trim().toLowerCase();
    if (keyword) {
        visible = visible.filter(bookmark =>
            bookmark.title.toLowerCase().includes(keyword) ||
            bookmark.url.toLowerCase().includes(keyword) ||
            (bookmark.notes || '').toLowerCase().includes(keyword)
        );
    }

    return visible.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function renderBookmarks() {
    bookmarksContainer.innerHTML = '';
    const visibleBookmarks = getVisibleBookmarks();
    updateBookmarkSummary(visibleBookmarks.length);

    if (visibleBookmarks.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'no-bookmarks';
        emptyState.innerHTML = '<div><i class="fas fa-bookmark"></i><p>暂无收藏</p></div>';
        bookmarksContainer.appendChild(emptyState);
        return;
    }

    visibleBookmarks.forEach((bookmark, index) => {
        const card = document.createElement('article');
        card.className = 'bookmark-card';
        card.draggable = true;
        card.dataset.id = bookmark.id;
        card.dataset.url = bookmark.url;
        card.style.animationDelay = `${Math.min(index * 35, 280)}ms`;

        const header = document.createElement('div');
        header.className = 'bookmark-header';

        const icon = document.createElement('img');
        icon.className = 'bookmark-icon';
        icon.alt = '';

        const title = document.createElement('h3');
        title.className = 'bookmark-title';
        title.textContent = bookmark.title;

        const actions = document.createElement('div');
        actions.className = 'bookmark-actions';
        actions.innerHTML = `
            <button class="edit-btn" data-id="${bookmark.id}" title="编辑"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" data-id="${bookmark.id}" title="删除"><i class="fas fa-trash"></i></button>
        `;

        header.append(icon, title, actions);
        card.appendChild(header);

        const link = document.createElement('a');
        link.href = bookmark.url;
        link.className = 'bookmark-url';
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = bookmark.url;
        card.appendChild(link);

        if (bookmark.notes) {
            const notes = document.createElement('div');
            notes.className = 'bookmark-notes';
            notes.textContent = bookmark.notes;
            card.appendChild(notes);
        }

        const category = document.createElement('div');
        category.className = 'bookmark-category';
        category.textContent = getCategoryName(bookmark.category);
        card.appendChild(category);

        bookmarksContainer.appendChild(card);
        setFavicon(icon, getDomainFromUrl(bookmark.url));
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            openEditModal(event.currentTarget.dataset.id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            deleteBookmark(event.currentTarget.dataset.id);
        });
    });

    document.querySelectorAll('.bookmark-card').forEach(card => {
        card.addEventListener('click', handleCardClick);
    });

    setupDragAndDrop();
}

function handleCardClick(event) {
    if (event.target.closest('.bookmark-actions')) return;
    if (this.dataset.url) window.open(this.dataset.url, '_blank');
}

function updateBookmarkSummary(count) {
    const keyword = searchInput.value.trim();
    if (keyword) {
        bookmarkSummary.textContent = count ? `找到 ${count} 个匹配收藏。` : '没有找到匹配的收藏。';
        return;
    }

    const categoryName = currentCategory === 'all' ? '全部分类' : getCategoryName(currentCategory);
    bookmarkSummary.textContent = `${categoryName} · 共 ${count} 个收藏，打开时先展示一部分。`;
}

function toggleStarSection() {
    const isCollapsed = starSection.classList.toggle('is-collapsed');
    starSection.classList.toggle('is-expanded', !isCollapsed);
    toggleStarBtn.setAttribute('aria-expanded', String(!isCollapsed));
    toggleStarBtn.querySelector('span').textContent = isCollapsed ? '展开全部' : '收起';
}

function handleWebSearch(event) {
    event.preventDefault();
    const query = webSearchInput.value.trim();
    if (!query) return;

    const destination = looksLikeUrl(query)
        ? normalizeDestination(query)
        : SEARCH_ENGINES[webSearchEngine.value](query);

    window.open(destination, '_blank');
}

function renderCategories(categories = []) {
    categoryList.innerHTML = '';

    const allItem = createCategoryItem({ id: 'all', name: '全部收藏' }, false);
    categoryList.appendChild(allItem);

    categories.forEach(category => {
        categoryList.appendChild(createCategoryItem(category, true, categories));
    });

    updateCategoryDropdown(categories);
    bindCategoryEvents(categories);
}

function createCategoryItem(category, editable, categories = []) {
    const item = document.createElement('li');
    item.dataset.category = category.id;
    item.className = `${currentCategory === category.id ? 'active' : ''}${editable ? ' category-item' : ''}`.trim();

    if (editingCategoryId === category.id) {
        const form = document.createElement('div');
        form.className = 'category-edit-form';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-category-input';
        input.value = category.name;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-category-btn';
        saveBtn.dataset.id = category.id;
        saveBtn.innerHTML = '<i class="fas fa-check"></i>';

        form.append(input, saveBtn);
        item.appendChild(form);
        return item;
    }

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = category.name;
    item.appendChild(name);

    if (editable) {
        const actions = document.createElement('div');
        actions.className = 'category-actions';
        actions.innerHTML = `
            <button class="edit-category-btn" data-id="${category.id}" title="编辑分类"><i class="fas fa-edit"></i></button>
            <button class="delete-category-btn" data-id="${category.id}" title="删除分类"><i class="fas fa-trash"></i></button>
        `;
        item.appendChild(actions);
    }

    return item;
}

function bindCategoryEvents(categories) {
    document.querySelectorAll('#category-list li').forEach(item => {
        item.addEventListener('click', event => {
            if (event.target.closest('button') || event.target.closest('.category-edit-form')) return;
            currentCategory = item.dataset.category;
            editingCategoryId = null;
            renderCategories(getCategories());
            renderBookmarks();
        });
    });

    document.querySelectorAll('.edit-category-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            editingCategoryId = event.currentTarget.dataset.id;
            renderCategories(categories);
            setTimeout(() => document.querySelector('.edit-category-input')?.focus(), 20);
        });
    });

    document.querySelectorAll('.save-category-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const input = event.currentTarget.closest('.category-edit-form').querySelector('.edit-category-input');
            saveEditedCategory(event.currentTarget.dataset.id, input.value.trim(), categories);
        });
    });

    document.querySelectorAll('.delete-category-btn').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            deleteCategory(event.currentTarget.dataset.id, categories);
        });
    });

    document.querySelectorAll('.edit-category-input').forEach(input => {
        input.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const id = event.currentTarget.closest('.category-edit-form').querySelector('.save-category-btn').dataset.id;
            saveEditedCategory(id, event.currentTarget.value.trim(), categories);
        });
    });
}

function updateCategoryDropdown(categories = []) {
    bookmarkCategorySelect.innerHTML = '';

    if (!categories.length) {
        const option = document.createElement('option');
        option.value = 'uncategorized';
        option.textContent = '未分类';
        bookmarkCategorySelect.appendChild(option);
        return;
    }

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        bookmarkCategorySelect.appendChild(option);
    });
}

function openAddModal() {
    modalTitle.textContent = '添加收藏';
    editingBookmarkId = null;
    bookmarkForm.reset();
    openModal();
}

function openEditModal(id) {
    const bookmark = bookmarks.find(item => item.id === id);
    if (!bookmark) return;

    modalTitle.textContent = '编辑收藏';
    document.getElementById('bookmark-id').value = bookmark.id;
    document.getElementById('bookmark-url').value = bookmark.url;
    document.getElementById('bookmark-title').value = bookmark.title;
    document.getElementById('bookmark-category').value = bookmark.category;
    document.getElementById('bookmark-notes').value = bookmark.notes || '';
    editingBookmarkId = id;
    openModal();
}

function openModal() {
    addModal.classList.add('is-open');
    setTimeout(() => document.getElementById('bookmark-url').focus(), 80);
}

function closeModal() {
    addModal.classList.remove('is-open');
    bookmarkForm.reset();
}

function saveBookmark(event) {
    event.preventDefault();

    const url = document.getElementById('bookmark-url').value.trim();
    const title = document.getElementById('bookmark-title').value.trim();
    const category = document.getElementById('bookmark-category').value;
    const notes = document.getElementById('bookmark-notes').value.trim();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('请输入以 http:// 或 https:// 开头的有效网址。');
        return;
    }

    if (editingBookmarkId) {
        const index = bookmarks.findIndex(item => item.id === editingBookmarkId);
        if (index !== -1) {
            const oldDomain = getDomainFromUrl(bookmarks[index].url);
            const newDomain = getDomainFromUrl(url);
            bookmarks[index] = {
                ...bookmarks[index],
                url,
                title,
                category,
                notes,
                updatedAt: new Date().toISOString()
            };

            if (oldDomain !== newDomain && !bookmarks.some((item, itemIndex) => itemIndex !== index && getDomainFromUrl(item.url) === oldDomain)) {
                removeCachedFaviconUrl(oldDomain);
            }
        }
    } else {
        const maxOrder = bookmarks.reduce((max, item) => Math.max(max, item.order ?? -1), -1);
        bookmarks.push({
            id: `bm${Date.now()}`,
            url,
            title,
            category,
            notes,
            createdAt: new Date().toISOString(),
            order: maxOrder + 1
        });
    }

    saveBookmarks();
    closeModal();
    renderBookmarks();
}

function deleteBookmark(id) {
    if (!confirm('确定要删除这个收藏吗？')) return;

    const toDelete = bookmarks.find(item => item.id === id);
    bookmarks = bookmarks.filter(item => item.id !== id);
    saveBookmarks();

    if (toDelete?.url) {
        const domain = getDomainFromUrl(toDelete.url);
        if (!bookmarks.some(item => getDomainFromUrl(item.url) === domain)) {
            removeCachedFaviconUrl(domain);
        }
    }

    renderBookmarks();
}

function addCategory() {
    const categoryName = newCategoryInput.value.trim();
    if (!categoryName) return;

    const categories = getCategories();
    categories.push({ id: `cat${Date.now()}`, name: categoryName });
    saveCategories(categories);
    newCategoryInput.value = '';
    renderCategories(categories);
}

function saveEditedCategory(categoryId, newName, categories) {
    if (!newName) return;

    const index = categories.findIndex(item => item.id === categoryId);
    if (index === -1) return;

    categories[index].name = newName;
    editingCategoryId = null;
    saveCategories(categories);
    renderCategories(categories);
    renderBookmarks();
}

function deleteCategory(categoryId, categories) {
    if (!confirm('确定要删除此分类吗？此分类中的收藏会移动到其他分类。')) return;

    const updatedCategories = categories.filter(item => item.id !== categoryId);
    const fallbackCategory = updatedCategories[0]?.id || 'uncategorized';

    bookmarks.forEach(bookmark => {
        if (bookmark.category === categoryId) bookmark.category = fallbackCategory;
    });

    if (currentCategory === categoryId) currentCategory = 'all';
    saveBookmarks();
    saveCategories(updatedCategories);
    renderCategories(updatedCategories);
    renderBookmarks();
}

function importBookmarks() {
    importFile.click();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
        try {
            const data = JSON.parse(event.target.result);
            if (!Array.isArray(data)) throw new Error('数据格式无效');
            bookmarks = data.map((bookmark, index) => ({ ...bookmark, order: bookmark.order ?? index }));
            saveBookmarks();
            renderBookmarks();
            alert('收藏导入成功。');
        } catch (error) {
            alert(`导入失败：${error.message}`);
        }
    };
    reader.readAsText(file);
    importFile.value = '';
}

function exportBookmarks() {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileName = `bookmarks_${new Date().toISOString().slice(0, 10)}.json`;

    const link = document.createElement('a');
    link.href = dataUri;
    link.download = exportFileName;
    link.click();
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('darkTheme', document.body.classList.contains('dark-theme'));
}

function loadThemePreference() {
    const darkTheme = localStorage.getItem('darkTheme');
    if (darkTheme === 'true') {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.bookmark-card');

    cards.forEach(card => {
        card.addEventListener('dragstart', function (event) {
            this.classList.add('dragging');
            event.dataTransfer.setData('text/plain', this.dataset.id);
        });

        card.addEventListener('dragend', function () {
            this.classList.remove('dragging');
            document.querySelectorAll('.bookmark-card').forEach(item => item.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', function (event) {
            event.preventDefault();
            this.classList.add('drag-over');
        });

        card.addEventListener('dragleave', function () {
            this.classList.remove('drag-over');
        });

        card.addEventListener('drop', function (event) {
            event.preventDefault();
            const draggedId = event.dataTransfer.getData('text/plain');
            const targetId = this.dataset.id;
            if (draggedId !== targetId) reorderBookmarks(draggedId, targetId);
            this.classList.remove('drag-over');
        });
    });

    bookmarksContainer.addEventListener('dragover', event => event.preventDefault());
    bookmarksContainer.addEventListener('drop', event => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain');
        if (draggedId && !event.target.closest('.bookmark-card')) moveBookmarkToEnd(draggedId);
    });
}

function ensureOrder() {
    bookmarks.forEach((bookmark, index) => {
        if (bookmark.order === undefined) bookmark.order = index;
    });
}

function reorderBookmarks(draggedId, targetId) {
    ensureOrder();
    const visibleBookmarks = getVisibleBookmarks();
    const draggedIndex = visibleBookmarks.findIndex(item => item.id === draggedId);
    const targetIndex = visibleBookmarks.findIndex(item => item.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const dragged = visibleBookmarks[draggedIndex];
    visibleBookmarks.splice(draggedIndex, 1);
    visibleBookmarks.splice(targetIndex, 0, dragged);
    visibleBookmarks.forEach((bookmark, index) => {
        const source = bookmarks.find(item => item.id === bookmark.id);
        if (source) source.order = index;
    });

    saveBookmarks();
    renderBookmarks();
}

function moveBookmarkToEnd(draggedId) {
    ensureOrder();
    const dragged = bookmarks.find(item => item.id === draggedId);
    if (!dragged) return;

    dragged.order = Math.max(...bookmarks.map(item => item.order ?? 0)) + 1;
    saveBookmarks();
    renderBookmarks();
}

function setupEventListeners() {
    webSearchForm.addEventListener('submit', handleWebSearch);
    toggleStarBtn.addEventListener('click', toggleStarSection);
    addBookmarkBtn.addEventListener('click', openAddModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    addModal.addEventListener('click', event => {
        if (event.target === addModal) closeModal();
    });

    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && addModal.classList.contains('is-open')) closeModal();
    });

    bookmarkForm.addEventListener('submit', saveBookmark);
    addCategoryBtn.addEventListener('click', addCategory);
    newCategoryInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') addCategory();
    });
    searchInput.addEventListener('input', renderBookmarks);
    importBtn.addEventListener('click', importBookmarks);
    exportBtn.addEventListener('click', exportBookmarks);
    importFile.addEventListener('change', handleImport);
    themeToggle.addEventListener('change', toggleTheme);
}

document.addEventListener('DOMContentLoaded', initApp);
