// 收藏夹Plus应用逻辑

// 收藏数据存储
let bookmarks = [];
let currentCategory = 'all';
let editingBookmarkId = null;
let editingCategoryId = null;

// DOM元素
const bookmarksContainer = document.getElementById('bookmarks-container');
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

// 初始化应用
function initApp() {
    loadBookmarks();
    loadCategories();
    loadThemePreference();
    renderBookmarks();
    setupEventListeners();
}

// 加载书签数据
function loadBookmarks() {
    const savedBookmarks = localStorage.getItem('bookmarks');
    if (savedBookmarks) {
        bookmarks = JSON.parse(savedBookmarks);
    } else {
        // 初始示例书签
        bookmarks = [
            {
                id: 'bm1',
                url: 'https://www.google.com',
                title: '谷歌搜索',
                category: 'work',
                notes: '全球最大的搜索引擎',
                createdAt: new Date().toISOString()
            },
            {
                id: 'bm2',
                url: 'https://www.github.com',
                title: 'GitHub',
                category: 'study',
                notes: '开发者社区和代码托管平台',
                createdAt: new Date().toISOString()
            }
        ];
        saveBookmarks();
    }
}

// 加载分类数据
function loadCategories() {
    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
        const categories = JSON.parse(savedCategories);
        renderCategories(categories);
    } else {
        // 如果本地没有存储分类，创建默认分类
        const defaultCategories = [
            { id: 'work', name: '工作' },
            { id: 'study', name: '学习' },
            { id: 'entertainment', name: '娱乐' }
        ];
        saveCategories(defaultCategories);
        renderCategories(defaultCategories);
    }
}

// 保存书签数据
function saveBookmarks() {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

// 保存分类数据
function saveCategories(categories) {
    localStorage.setItem('categories', JSON.stringify(categories));
}

// 渲染书签
function renderBookmarks() {
    bookmarksContainer.innerHTML = '';

    let filteredBookmarks = bookmarks;

    // 分类筛选
    if (currentCategory !== 'all') {
        filteredBookmarks = bookmarks.filter(bookmark => bookmark.category === currentCategory);
    }

    // 搜索筛选
    if (searchInput.value.trim() !== '') {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filteredBookmarks = filteredBookmarks.filter(bookmark =>
            bookmark.title.toLowerCase().includes(searchTerm) ||
            bookmark.url.toLowerCase().includes(searchTerm) ||
            bookmark.notes.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredBookmarks.length === 0) {
        bookmarksContainer.innerHTML = `
            <div class="no-bookmarks">
                <i class="fas fa-bookmark"></i>
                <p>暂无收藏</p>
            </div>
        `;
        return;
    }

    // 按顺序属性（如果有）或创建时间排序
    filteredBookmarks.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    filteredBookmarks.forEach(bookmark => {
        const card = document.createElement('div');
        card.className = 'bookmark-card';
        card.draggable = true;
        card.dataset.id = bookmark.id;
        card.dataset.url = bookmark.url; // 存储URL用于点击跳转

        // 提取域名，用于获取favicon
        let domain = '';
        try {
            domain = new URL(bookmark.url).hostname;
        } catch (e) {
            domain = bookmark.url;
        }

        card.innerHTML = `
            <div class="bookmark-header">
                <img class="bookmark-icon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="Icon" 
                     onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/solid/globe.svg';">
                <h3 class="bookmark-title">${bookmark.title}</h3>
                <div class="bookmark-actions">
                    <button class="edit-btn" data-id="${bookmark.id}" title="编辑"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-id="${bookmark.id}" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <a href="${bookmark.url}" class="bookmark-url" target="_blank">${bookmark.url}</a>
            ${bookmark.notes ? `<div class="bookmark-notes">${bookmark.notes}</div>` : ''}
            <div class="bookmark-category">${getCategoryName(bookmark.category)}</div>
        `;

        bookmarksContainer.appendChild(card);
    });

    // 添加编辑和删除事件监听
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation(); // 阻止事件冒泡以防止触发卡片点击
            const id = e.currentTarget.getAttribute('data-id');
            openEditModal(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation(); // 阻止事件冒泡以防止触发卡片点击
            const id = e.currentTarget.getAttribute('data-id');
            deleteBookmark(id);
        });
    });

    // 为每个卡片添加点击跳转事件
    document.querySelectorAll('.bookmark-card').forEach(card => {
        card.addEventListener('click', handleCardClick);
    });

    // 添加拖拽事件监听
    setupDragAndDrop();
}

// 处理卡片点击事件
function handleCardClick(e) {
    // 如果点击的是按钮或其子元素，不进行跳转
    if (e.target.closest('.bookmark-actions')) {
        return;
    }

    const url = this.dataset.url;
    if (url) {
        window.open(url, '_blank');
    }
}

// 获取分类名称
function getCategoryName(categoryId) {
    let categoryName = categoryId; // 默认返回ID

    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
        const categories = JSON.parse(savedCategories);
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
            categoryName = category.name;
        }
    }

    return categoryName;
}

// 渲染分类
function renderCategories(categories = []) {
    let categoryHtml = `
        <li data-category="all" class="${currentCategory === 'all' ? 'active' : ''}">全部收藏</li>
    `;

    // 所有分类都可编辑（除了"全部"分类）
    categories.forEach(category => {
        if (editingCategoryId === category.id) {
            // 编辑状态
            categoryHtml += `
                <li data-category="${category.id}" class="category-item ${currentCategory === category.id ? 'active' : ''}">
                    <div class="category-edit-form">
                        <input type="text" class="edit-category-input" value="${category.name}">
                        <button class="save-category-btn" data-id="${category.id}"><i class="fas fa-check"></i></button>
                    </div>
                </li>
            `;
        } else {
            // 正常显示状态
            categoryHtml += `
                <li data-category="${category.id}" class="category-item ${currentCategory === category.id ? 'active' : ''}">
                    <span class="category-name">${category.name}</span>
                    <div class="category-actions">
                        <button class="edit-category-btn" data-id="${category.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-category-btn" data-id="${category.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </li>
            `;
        }
    });

    categoryList.innerHTML = categoryHtml;

    // 更新分类下拉选择框
    updateCategoryDropdown(categories);

    // 为新渲染的分类添加事件监听
    document.querySelectorAll('#category-list li').forEach(item => {
        item.addEventListener('click', e => {
            // 只有当点击的不是按钮时才切换分类
            if (!e.target.closest('button') && !e.target.closest('.category-edit-form')) {
                document.querySelectorAll('#category-list li').forEach(li => li.classList.remove('active'));
                item.classList.add('active');
                currentCategory = item.getAttribute('data-category');
                renderBookmarks();
            }
        });
    });

    // 为编辑和删除按钮添加事件监听
    document.querySelectorAll('.edit-category-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            editingCategoryId = e.currentTarget.getAttribute('data-id');
            renderCategories(categories);
            // 自动聚焦到编辑输入框
            setTimeout(() => {
                const inputField = document.querySelector('.edit-category-input');
                if (inputField) inputField.focus();
            }, 10);
        });
    });

    document.querySelectorAll('.save-category-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const categoryId = e.currentTarget.getAttribute('data-id');
            const newName = document.querySelector('.edit-category-input').value.trim();
            if (newName) {
                saveEditedCategory(categoryId, newName, categories);
            }
        });
    });

    document.querySelectorAll('.delete-category-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const categoryId = e.currentTarget.getAttribute('data-id');
            deleteCategory(categoryId, categories);
        });
    });

    // 监听编辑输入框的Enter键
    document.querySelectorAll('.edit-category-input').forEach(input => {
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const categoryId = e.currentTarget.parentNode.querySelector('.save-category-btn').getAttribute('data-id');
                const newName = e.currentTarget.value.trim();
                if (newName) {
                    saveEditedCategory(categoryId, newName, categories);
                }
            }
        });
    });
}

// 更新分类下拉列表
function updateCategoryDropdown(categories = []) {
    // 清空并重新填充下拉列表
    bookmarkCategorySelect.innerHTML = '';

    // 添加所有分类
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        bookmarkCategorySelect.appendChild(option);
    });

    // 如果没有分类，添加一个默认选项
    if (categories.length === 0) {
        const option = document.createElement('option');
        option.value = 'uncategorized';
        option.textContent = '未分类';
        bookmarkCategorySelect.appendChild(option);
    }
}

// 打开添加书签模态框
function openAddModal() {
    modalTitle.textContent = '添加收藏';
    editingBookmarkId = null;
    bookmarkForm.reset();
    addModal.style.display = 'block';
}

// 打开编辑书签模态框
function openEditModal(id) {
    const bookmark = bookmarks.find(bm => bm.id === id);
    if (bookmark) {
        modalTitle.textContent = '编辑收藏';
        document.getElementById('bookmark-id').value = bookmark.id;
        document.getElementById('bookmark-url').value = bookmark.url;
        document.getElementById('bookmark-title').value = bookmark.title;
        document.getElementById('bookmark-category').value = bookmark.category;
        document.getElementById('bookmark-notes').value = bookmark.notes;

        editingBookmarkId = id;
        addModal.style.display = 'block';
    }
}

// 关闭模态框
function closeModal() {
    addModal.style.display = 'none';
    bookmarkForm.reset();
}

// 保存书签
function saveBookmark(e) {
    e.preventDefault();

    const id = editingBookmarkId || 'bm' + new Date().getTime();
    const url = document.getElementById('bookmark-url').value.trim();
    const title = document.getElementById('bookmark-title').value.trim();
    const category = document.getElementById('bookmark-category').value;
    const notes = document.getElementById('bookmark-notes').value.trim();

    // 验证URL格式
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('请输入有效的URL，以http://或https://开头');
        return;
    }

    if (editingBookmarkId) {
        // 更新已有书签
        const index = bookmarks.findIndex(bm => bm.id === editingBookmarkId);
        if (index !== -1) {
            bookmarks[index] = {
                ...bookmarks[index],
                url,
                title,
                category,
                notes,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // 添加新书签
        bookmarks.push({
            id,
            url,
            title,
            category,
            notes,
            createdAt: new Date().toISOString()
        });
    }

    saveBookmarks();
    closeModal();
    renderBookmarks();
}

// 删除书签
function deleteBookmark(id) {
    if (confirm('确定要删除这个收藏吗？')) {
        bookmarks = bookmarks.filter(bm => bm.id !== id);
        saveBookmarks();
        renderBookmarks();
    }
}

// 添加分类
function addCategory() {
    const categoryName = newCategoryInput.value.trim();

    if (categoryName) {
        const categoryId = 'cat' + new Date().getTime();

        let categories = [];
        const savedCategories = localStorage.getItem('categories');
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
        }

        categories.push({
            id: categoryId,
            name: categoryName
        });

        saveCategories(categories);
        renderCategories(categories);
        newCategoryInput.value = '';
    }
}

// 保存编辑后的分类
function saveEditedCategory(categoryId, newName, categories) {
    const index = categories.findIndex(cat => cat.id === categoryId);
    if (index !== -1) {
        categories[index].name = newName;
        saveCategories(categories);
        editingCategoryId = null;
        renderCategories(categories);
    }
}

// 删除分类
function deleteCategory(categoryId, categories) {
    if (confirm('确定要删除此分类吗？此分类中的收藏将被移至"未分类"')) {
        // 更新任何使用此分类的书签
        bookmarks.forEach(bookmark => {
            if (bookmark.category === categoryId) {
                // 如果还有其他分类，移到第一个分类，否则设为"未分类"
                if (categories.length > 1) {
                    const firstCategoryId = categories.find(cat => cat.id !== categoryId)?.id || 'uncategorized';
                    bookmark.category = firstCategoryId;
                } else {
                    bookmark.category = 'uncategorized';
                }
            }
        });
        saveBookmarks();

        // 删除分类
        const updatedCategories = categories.filter(cat => cat.id !== categoryId);
        saveCategories(updatedCategories);

        // 如果删除的是当前显示的分类，则切换到全部
        if (currentCategory === categoryId) {
            currentCategory = 'all';
        }

        renderCategories(updatedCategories);
        renderBookmarks();
    }
}

// 导入书签
function importBookmarks() {
    importFile.click();
}

// 处理导入文件
function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    bookmarks = data;
                    saveBookmarks();
                    renderBookmarks();
                    alert('书签导入成功！');
                } else {
                    throw new Error('无效的数据格式');
                }
            } catch (err) {
                alert('导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }
}

// 导出书签
function exportBookmarks() {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileName = 'bookmarks_' + new Date().toISOString().slice(0, 10) + '.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
}

// 切换主题
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDarkMode = document.body.classList.contains('dark-theme');
    localStorage.setItem('darkTheme', isDarkMode);
}

// 加载主题偏好
function loadThemePreference() {
    const darkTheme = localStorage.getItem('darkTheme');
    if (darkTheme === 'true') {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }
}

// 设置拖拽功能
function setupDragAndDrop() {
    const cards = document.querySelectorAll('.bookmark-card');
    let isDragging = false;
    let dragStartTime = 0;

    cards.forEach(card => {
        // 拖拽开始
        card.addEventListener('dragstart', function (e) {
            isDragging = true;
            dragStartTime = Date.now();
            this.classList.add('dragging');
            e.dataTransfer.setData('text/plain', this.dataset.id);
        });

        // 拖拽结束
        card.addEventListener('dragend', function () {
            isDragging = false;
            this.classList.remove('dragging');
            document.querySelectorAll('.bookmark-card').forEach(c => {
                c.classList.remove('drag-over');
            });
        });

        // 拖拽经过
        card.addEventListener('dragover', function (e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        // 拖拽离开
        card.addEventListener('dragleave', function () {
            this.classList.remove('drag-over');
        });

        // 放置
        card.addEventListener('drop', function (e) {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = this.dataset.id;

            if (draggedId !== targetId) {
                reorderBookmarks(draggedId, targetId);
            }

            this.classList.remove('drag-over');
        });
    });

    // 允许在容器内放置
    bookmarksContainer.addEventListener('dragover', function (e) {
        e.preventDefault();
    });

    bookmarksContainer.addEventListener('drop', function (e) {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');

        // 如果拖拽到容器末尾，将项目放在最后
        if (!e.target.closest('.bookmark-card')) {
            moveBookmarkToEnd(draggedId);
        }
    });
}

// 重新排序书签
function reorderBookmarks(draggedId, targetId) {
    // 获取当前显示的书签列表
    const visibleBookmarks = currentCategory === 'all'
        ? bookmarks
        : bookmarks.filter(bm => bm.category === currentCategory);

    // 为所有书签添加顺序属性（如果还没有）
    bookmarks.forEach((bookmark, index) => {
        if (bookmark.order === undefined) {
            bookmark.order = index;
        }
    });

    const draggedIndex = visibleBookmarks.findIndex(bm => bm.id === draggedId);
    const targetIndex = visibleBookmarks.findIndex(bm => bm.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
        const draggedBookmark = visibleBookmarks[draggedIndex];
        const targetOrder = visibleBookmarks[targetIndex].order;

        // 确定新顺序
        if (draggedIndex < targetIndex) {
            // 向下拖动
            for (let i = draggedIndex + 1; i <= targetIndex; i++) {
                bookmarks.find(bm => bm.id === visibleBookmarks[i].id).order--;
            }
            draggedBookmark.order = targetOrder;
        } else {
            // 向上拖动
            for (let i = targetIndex; i < draggedIndex; i++) {
                bookmarks.find(bm => bm.id === visibleBookmarks[i].id).order++;
            }
            draggedBookmark.order = targetOrder;
        }

        // 保存并重新渲染
        saveBookmarks();
        renderBookmarks();
    }
}

// 将书签移至末尾
function moveBookmarkToEnd(draggedId) {
    const visibleBookmarks = currentCategory === 'all'
        ? bookmarks
        : bookmarks.filter(bm => bm.category === currentCategory);

    const draggedIndex = visibleBookmarks.findIndex(bm => bm.id === draggedId);

    if (draggedIndex !== -1) {
        const draggedBookmark = bookmarks.find(bm => bm.id === draggedId);
        const maxOrder = Math.max(...bookmarks.map(bm => bm.order || 0));
        draggedBookmark.order = maxOrder + 1;

        // 保存并重新渲染
        saveBookmarks();
        renderBookmarks();
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 添加书签按钮点击事件
    addBookmarkBtn.addEventListener('click', openAddModal);

    // 关闭模态框
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', e => {
        if (e.target === addModal) {
            closeModal();
        }
    });

    // 提交表单
    bookmarkForm.addEventListener('submit', saveBookmark);

    // 添加分类
    addCategoryBtn.addEventListener('click', addCategory);

    // 搜索
    searchInput.addEventListener('input', renderBookmarks);

    // 导入/导出
    importBtn.addEventListener('click', importBookmarks);
    exportBtn.addEventListener('click', exportBookmarks);
    importFile.addEventListener('change', handleImport);

    // 主题切换
    themeToggle.addEventListener('change', toggleTheme);
}

// 应用初始化
document.addEventListener('DOMContentLoaded', initApp);
