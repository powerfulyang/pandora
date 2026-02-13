# Pandora 设计系统与项目约束

## 项目愿景 (Project Vision)

**Pandora** 是一个以“本地优先”(Local-First) 为核心的现代 Web 工具箱。

- **核心理念**: 隐私至上、极致性能、无服务器依赖。
- **视觉语言**: **The Vault / Workstation** —— 冷峻、精密、高密度的信息展示风格。

## 设计原则 (Design Principles)

- **视觉风格 (Aesthetics)**:
  - **Workstation / The Vault**: 整体风格追求冷峻、精密的工作站质感。
  - **极简主义**: 严禁使用大面积柔和阴影，优先使用边框 (`border`) 和背景色差区分层次。
  - **质感层级**: 采用 `border-px` 拼接网格布局，背景辅以极细的胶片颗粒感 (Fine Grain) 纹理。
  - **动效**: 使用微交互 (Micro-interactions) 增强反馈，但避免过度动画。
- **色彩规范 (Color Palette)**:
  - **暗色优先**: 默认 Dark Mode。确保高对比度和可读性。
  - **主色 (Primary)**: 纯白 (`#ffffff`) 用于主要强调。
  - **次要色 (Secondary)**: `Zinc-300` / `Zinc-400` 用于辅助信息。
  - **强调色 (Accent)**: 用于状态指示、选中态和关键操作。
  - **状态色**: 严格区分 Success, Warning, Error, Disabled (`--pd-text-disabled`)。
- **字体规范 (Typography)**:
  - **展示 (Display)**: **Outfit** (几何感、现代感，用于标题、大号数字)。
  - **正文 (Body)**: **Inter** (高可读性无衬线字体，用于UI界面)。
  - **代码 (Mono)**: **JetBrains Mono** 或系统默认等宽字体 (用于数据、日志、状态码)。
- **边框与圆角 (Borders & Corners)**:
  - **窄圆角约束**: 严格禁用 `rounded-lg` 及以上。统一使用 `rounded-md`, `rounded-sm` 或 `rounded-none`。
  - **一致性**: 所有容器、按钮及输入框必须遵循此约束。

## 技术栈规范 (Tech Stack)

- **核心框架**:
  - [TanStack Start](https://tanstack.com/start) (Router + Server Functions)
  - [React 19](https://react.dev/)
- **样式系统**:
  - [Tailwind CSS 4](https://tailwindcss.com/) (`@theme` 驱动配置)
  - **Lucide React** (统一图标库，使用 `strokeWidth={1.5}` 保持精致感)
- **核心能力**:
  - **WASM**: 使用 `@jsquash/*` 系列库进行本地图片处理 (AVIF, WebP, PNG, JPEG)。
  - **Validation**: 使用 `Zod` 进行严格的数据验证。
  - **RPC**: 使用 `@orpc/*` 处理类型安全的 API 通信。
- **动画系统 (Animation)**:
  - **Framer Motion**: 用于组件级交互动画 (Enter/Exit, Hover)。
  - **GSAP**: 用于复杂的时间轴动画或高性能滚动动画。

## 基础架构规则 (Architecture)

- **本地优先 (Local-First)**:
  - 敏感数据（如图片处理）必须在客户端 (Browser/WASM) 完成。
  - 严禁非必要的服务端上传。
- **剪贴板集成**:
  - 必须支持图片/文本的粘贴 (Paste) 交互，提供原生应用般的体验。
- **性能优化**:
  - 图片/资源需按需加载。
  - 耗时操作需提供明确的加载状态或进度条。

## 目录结构 (Directory Structure)

- `src/routes`: 页面路由 (File-based routing)。
- `src/components`: 通用 UI 组件。
- `src/lib`: 工具函数、Hooks、全局配置。
- `src/integrations`: 第三方服务集成 (如有)。
- `src/styles.css`: 全局样式与 Tailwind Theme 配置。

## 开发工作流 (Workflow)

1. **新建模块**: 在 `src/routes` 下建立新文件，并在 `src/routes/index.tsx` 的 Dashboard Grid 中注册。
2. **样式开发**: 优先使用 Tailwind Utility Class，复杂组件可提取 `cva` 配置。
3. **图标使用**: 统一从 `lucide-react` 引入，保持视觉一致性。
