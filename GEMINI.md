# Pandora 设计系统与项目约束

## 设计原则 (Design Principles)
- **视觉风格 (Aesthetics)**: 
  - **Workstation / The Vault**: 整体风格追求冷峻、精密的工作站质感。
  - **极简主义**: 严禁使用大面积柔和阴影，优先使用边框 (`border`) 和背景色差区分层次。
  - **质感层级**: 采用 border-px 拼接网格布局，背景辅以极细的胶片颗粒感 (Fine Grain) 纹理。
- **色彩规范 (Color Palette)**: 
  - **暗色优先**: 确保暗色模式下文本高度可读。主文字使用纯白(`#ffffff`)，次要文字使用 Zinc-300。
  - **对比度控制**: 针对禁用 (Disabled) 状态文字需保持足够对比度（使用专属 `--pd-text-disabled`）。
- **字体规范 (Typography)**: 
  - **展示 (Display)**: 使用 **Outfit** (几何感、现代感，用于标题)。
  - **正文 (Body)**: 使用 **Inter** (高可读性无衬线字体)。
- **边框与圆角 (Borders & Corners)**: 
  - **窄圆角约束**: 严格禁用 `rounded-lg` 及以上。统一使用 `rounded-md`, `rounded-sm` 或 `rounded-none`。
  - **一致性**: 所有容器、按钮及输入框必须遵循此约束。

## 基础架构规则 (Architecture)
- **本地优先 / WASM**: 优先使用 WebAssembly 在客户端处理敏感数据 (如 jSquash)，确保隐私与性能。
- **剪贴板集成**: 必须支持图片/文本的粘贴 (Paste) 交互。

## 开发工作流 (Workflow)
- **框架**: TanStack Start (Router + Server Functions)。
- **样式**: Tailwind CSS 4 (`@theme` 驱动)。
- **图标**: Lucide React。
