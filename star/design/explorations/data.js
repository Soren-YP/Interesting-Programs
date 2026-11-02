// 样张共用的静态数据，取自 tests/fixtures/design-state.json
// 用普通脚本而非 ES Module，保证 file:// 直接打开也能运行
(() => {
const categories = [
  { id: 'work', name: '工作', code: 'W', en: 'WORK' },
  { id: 'study', name: '学习', code: 'S', en: 'STUDY' },
  { id: 'design', name: '设计', code: 'D', en: 'DESIGN' },
];

const bookmarks = [
  ['github.com', 'GitHub', 'work', ['工具'], '07.29', '09:41'],
  ['developer.mozilla.org', 'MDN Web Docs', 'study', ['文档', '前端'], '07.29', '09:15'],
  ['www.figma.com', 'Figma 社区', 'design', ['设计'], '07.28', '18:32'],
  ['linear.app', 'Linear', 'work', ['工具', '产品'], '07.28', '11:07'],
  ['sspai.com', '少数派 - 高效工作，品质生活', 'study', ['资讯', '效率'], '07.28', '10:21'],
  ['juejin.cn', '掘金', 'study', ['前端'], '05.26', '14:00'],
  ['www.notion.so', 'Notion', 'work', ['工具', '产品'], '05.25', '14:00'],
  ['www.ruanyifeng.com', '阮一峰的网络日志', 'study', ['资讯'], '05.24', '14:00'],
  ['www.chensilu.com', '产品沉思录', 'work', ['产品'], '05.23', '14:00'],
  ['web.dev', 'Web.dev', 'study', ['文档', '前端'], '05.22', '14:00'],
  ['dribbble.com', 'Dribbble', 'design', ['设计', '灵感'], '05.21', '14:00'],
  ['react.dev', 'React 官方文档', 'study', ['文档', '前端'], '05.20', '14:00'],
].map(([host, title, categoryId, tags, date, time], index) => ({
  host, title, categoryId, tags, date, time, index: index + 1,
  favicon: `https://${host}/favicon.ico`,
}));

const tags = [
  ['前端', 4], ['工具', 3], ['文档', 3], ['产品', 3],
  ['设计', 2], ['资讯', 2], ['效率', 1], ['灵感', 1],
];

function categoryOf(id) {
  return categories.find((category) => category.id === id);
}

function countIn(id) {
  return bookmarks.filter((bookmark) => bookmark.categoryId === id).length;
}

const pad = (value, size = 2) => String(value).padStart(size, '0');

window.MOCK = { categories, bookmarks, tags, categoryOf, countIn, pad };
})();
