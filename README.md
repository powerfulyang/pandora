# Pandora Toolkit 🧰

> 基于 Vue 3 和 Vite 构建的现代前端多功能工具箱组合。
> 包含了一系列常用的在线工具（如图片压缩、图片裁剪、JSON 解析等），并提供完全的 PWA 离线使用支持。

## ✨ 核心特性

- 🖼️ **图片转换处理器**: 基于 WebAssembly (`@jsquash`)，实现**纯前端、本地离线**的图片格式转换与压缩，支持 PNG, JPEG, WEBP, AVIF 等现代图片格式。
- ✂️ **高级图片裁剪**: 基于 `vue-advanced-cropper` 实现的高级图片裁剪工具，支持拖拽、比例缩放及实时预览。
- 📝 **JSON 查阅器**: 提供左右分栏结构的 JSON 数据格式化、高亮显示、及行号点击定位交互等功能。
- 🏎️ **SSG & PWA 支持**: 深度集成了 `vite-ssg` 及 `vite-plugin-pwa`，全面支持静默更新及离线访问，打造原生级的免安装体验。
- 💅 **UnoCSS 驱动**: 构建响应式与现代化的绚丽 UI 界面，提供灵活的定制功能。

## 🛠️ 技术栈

- **核心架构**: [Vue 3](https://v3.vuejs.org/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **路由与状态**: [Vue Router](https://router.vuejs.org/) (基于文件路由 `unplugin-vue-router`) + [Pinia](https://pinia.vuejs.org/)
- **网络与数据**: [Axios](https://axios-http.com/) + [Vue Query](https://tanstack.com/query/v5/docs/vue/overview) + [localforage](https://localforage.github.io/localForage/)
- **样式与动画**: [UnoCSS](https://unocss.dev/) + [Motion One for Vue](https://motion.dev/)
- **核心工具库**: @vueuse/core, @jsquash (WASM 图片处理), Comlink (Web Worker 处理)

## 🔧 安装运行

请确保您已安装 Node.js 和 PNPM环境。

```bash
# 安装依赖
pnpm install

# 启动开发服务器的本地预览
pnpm dev

# 构建生产环境代码 (包含 Vite SSG 静态生成)
pnpm build

# 本地预览产物文件
pnpm preview
```

## 🧪 测试指令

```bash
# 运行单元测试
pnpm test:unit

# 运行 Cypress 端到端测试
pnpm test:e2e
```

## 🗂️ 目录结构概述

```bash
pandora/
├── src/
│   ├── components/       # 公共业务组件与 UI 元素
│   ├── views/            # 基于页面的路由组件 (Image Cropper, Json Viewer 等)
│   ├── plugins/          # 插件注册与配置
│   ├── ...
│   └── main.ts           # 应用入口文件
├── public/               # 公共静态资源与 PWA Manfiest 配置
├── cypress/              # E2E 测试目录
└── vite.config.ts        # Vite, PWA, SSG 及 WASM 处理相关配置
```

## 📜 许可证

本工具集基于 [MIT](LICENSE) 许可证开源使用。
