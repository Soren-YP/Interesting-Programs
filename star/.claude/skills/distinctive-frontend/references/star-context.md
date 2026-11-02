# Star 项目上下文

重构 Star 前端时必须知道的事实。风格方面这里一概不写——那由 SKILL.md 的流程产生。

## 必须保留的功能

完整功能见项目根目录 `README.md`。重构界面时以下能力都不能丢：

- 统一搜索框：搜收藏 / 输入网址直接打开 / 无匹配时网页搜索；`Ctrl/Cmd+Enter` 强制网页搜索；
  可选搜索引擎
- 三个视图：常用（置顶）、全部、归档
- 分类（增删改、计数）和标签（多选过滤、清除）
- 排序（含手动排序），手动排序下可拖拽和键盘上下移动
- 收藏的新建、编辑、删除；保存时自动读取网页标题；备注字段
- 批量管理：选择、移动分类、加 / 删标签、置顶 / 取消、归档 / 恢复、删除
- 链接检查（用户主动触发，显示进度）
- 导入（JSON / 浏览器书签 HTML，先预览再合并或替换）与导出
- 浅色 / 深色主题；Toast 提示；确认弹窗
- 快捷键：`/` 或 `Ctrl/Cmd+K` 聚焦搜索，`N` 新建，`Esc` 关闭弹窗 / 退出批量
- 移动端：侧栏抽屉 + 遮罩
- 网站图标加载失败时回退到本地图标；离线可用（Service Worker）

## 代码约束

- 逻辑在 `src/main.js`，通过 `document.getElementById` 绑定约 60 个元素（见文件开头的
  `elements` 对象），并依赖 `.bookmark-card`、`.card-title`、`.card-url`、`.selection-control`、
  `.view-tabs`、`[data-view]`、`[data-action]`、`[data-close-dialog]`、`[data-label]` 等钩子。
  可以改 DOM 结构和类名，但必须同步修改 `main.js` 和 `tests/main.integration.test.js`，
  而不是为了保住钩子而保住旧布局。
- 数据层（`domain.js`、`store.js`、`import-export.js`）和 `server/` 与视觉无关，原则上不动。
- 不依赖在线字体或图标 CDN（本地优先 / 离线）。图标目前用本地打包的 `@phosphor-icons/web`，
  可以替换；新字体必须随项目打包，并注意中文字体体积。
- 无前端框架，原生 ES Modules + Vite。不要为了重设计引入框架。
- 改完必须：`npm test` 全绿、`npm run build` 成功。

## 在浏览器里截图（评审循环用）

1. `.claude/launch.json` 已配置 `star-dev`（`npm run dev`，端口 5173，会同时启动本地 API）。
   用 `mcp__Claude_Browser__preview_start`，参数 `name: "star-dev"` 打开。
2. 载入固定的设计数据，保证每轮截图内容一致（会先备份当前数据）：

   ```js
   localStorage.setItem('star.appState.v1.backup', localStorage.getItem('star.appState.v1'));
   localStorage.setItem('star.appState.v1',
     await fetch('/tests/fixtures/design-state.json').then(r => r.text()));
   location.reload();
   ```

   用 `mcp__Claude_Browser__javascript_tool` 执行。数据量或内容不适合新设计时，
   可以修改这个 fixture（它也被 Design QA 使用）。
3. 用 `mcp__Claude_Browser__resize_window` 设定视口（例如 1440×900、768×1024、375×812；
   `colorScheme` 切深色），再用 `computer` 的 `screenshot` 截图。工具结果里会给出图片保存路径，
   把这个路径交给评审子代理。截图会被缩到 800px 宽，细节用 `zoom` 截局部补充
   （`region` 用截图的坐标系）。
   **截图前先等页面稳定**：刷新后立刻截图会拍到图标未加载、入场动画进行中的画面，
   曾因此误判"图标不显示""按钮发灰"。可先等 2 秒，或用 JS 确认
   `[...document.images].every(i => i.complete)` 再截。
4. 交互状态（悬停行、批量模式、弹窗、空状态、搜索中）需要分别截图。
   **首选 [scripts/shoot.mjs](../scripts/shoot.mjs)**：通过 DevTools 协议驱动无头 Edge，
   精确视口、可模拟悬停、可切深色，不依赖浏览器面板。真实应用先经过开发专用的
   `/design/qa-fixture.html`（写入设计数据，`?theme=dark`、`?view=all` 可选）再跳回首页：

   ```bash
   node .claude/skills/distinctive-frontend/scripts/shoot.mjs \
     "http://127.0.0.1:5173/design/qa-fixture.html" <scratchpad>/shots/x.png 1440 900 ".bookmark-card:nth-child(4)"
   ```

   参数依次为：网址、输出路径、宽、高、可选的悬停选择器、可选的 `dark`（模拟系统深色）。

   **浏览器面板被隐藏时截图会超时**。也可以直接用 Edge 的 `--screenshot`（无法悬停）：

   ```bash
   "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
     --hide-scrollbars --force-device-scale-factor=1 --window-size=1470,995 \
     --virtual-time-budget=5000 --screenshot="<scratchpad>/shots/x.png" "<url>" < /dev/null
   ```

   `--window-size` 包含约 30×95 的窗口边框，`1470,995` 才对应 1440×900 视口；输出图片右侧和
   底部的空白不是页面的一部分。此方式无法带入 localStorage，适合静态样张；真实应用仍用面板。
5. 结束后用 `resize_window` 的 `preset: "desktop"` 恢复视口。

## 现状备忘（2026-11 首次查看时）

- 现有设计是"Yapeng · 纸本索引"：纸色背景、衬线标题、朱红强调色，参考图
  `design/reference-yapeng-paper-index.png`，由上一个 AI 生成。用户对它不满意，
  **不要把它当作必须延续的方向**；它只能作为 Discover 阶段被比较的一个选项。
- 实测截图中：桌面宽度（1440px）下侧栏仍显示关闭按钮 ×。重构时顺带解决。
