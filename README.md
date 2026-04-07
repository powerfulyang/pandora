# Pandora Toolkit 🧰

<p align="center">
  <img src="/public/favicon.svg" width="100" height="100" alt="Pandora Logo" />
</p>

<p align="center">
  <strong>高性能、隐私优先、离线可用的现代 Web 工具箱</strong>
</p>

<p align="center">
  基于 Vue 3 + Vite + WebAssembly 构建，所有运算均在浏览器本地完成。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-4fc08d?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Vite-6.x-646cff?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/UnoCSS-Atomic-333333?logo=unocss" alt="UnoCSS" />
  <img src="https://img.shields.io/badge/PWA-Enabled-orange?logo=pwa" alt="PWA" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## 🌟 项目简介

**Pandora** 是一个为开发者和创作者打造的现代 Web 工具箱。不同于传统的在线工具，Pandora 强调 **"本地安全"** 与 **"极致性能"**。

通过利用 **WebAssembly (WASM)** 和 **Web Workers**，我们将曾经需要后端处理的复杂计算（如图片重采样、格式转换、PDF 处理）搬到了您的浏览器中。这意味着您的数据永远不会离开您的设备，既保护了隐私，又获得了原生般的响应速度。

## ✨ 核心特性

- 🚀 **高性能计算**: 集成 `@jsquash` (WASM) 进行高效的图片编解码，配合 `Comlink` 实现多线程处理。
- 🔒 **隐私安全**: 100% 纯前端处理，无后端服务器参与，您的文件不会上传到任何服务器。
- 📶 **离线优先**: 基于 PWA 和 Vite SSG 技术，一次加载后即可在无网络环境下完全使用。
- 💎 **现代美学**: 采用工业感十足的 UI 设计，支持深色模式，内置平滑的微动画效果。
- 📦 **开箱即用**: 无需安装任何软件，通过浏览器即可使用一系列强大的生产力工具。

## 🛠️ 工具模块

### 🖼️ 图像处理

- **Image Processor**: 快速导出 Chrome 商店图标、社交媒体图片，支持智能裁剪。
- **Image Converter**: 批量格式转换与压缩（지원 PNG, JPEG, WebP, AVIF），基于 WASM。
- **PDF to Image**: 将 PDF 页面高品质转换为图像，支持 ZIP 批量导出。
- **SVG Editor**: 交互式 SVG 矢量编辑器，支持实时代码同步。

### 💻 开发者工具

- **JSON Viewer**: 交互式树形视图，支持格式化、压缩及大规模数据预览。
- **Dev Toolkit**: 正则测试、时间戳转换、代码比对 (Diff)、颜色提取。
- **Text Codec**: 编解码大全（Base64, URL, Hash, JWT, Unicode 等）。

### 📝 生产力与分析

- **Mermaid Editor**: 实时预览的 Mermaid 流程图与图表编辑器。
- **Data Parser**: 从 Excel/CSV 提取 JSON 并自动生成 TypeScript 类型定义。
- **Resume Builder**: 专业简历构建器，支持实时预览与 PDF 导出。

## 🚀 技术架构

- **前端框架**: [Vue 3](https://v3.vuejs.org/) (Composition API + `<script setup>`)
- **构建工具**: [Vite](https://vitejs.dev/) + [Vite SSG](https://github.com/antfu/vite-ssg)
- **样式方案**: [UnoCSS](https://unocss.dev/) (极速原子化 CSS)
- **核心动力**:
  - **WebAssembly**: [jsquash](https://github.com/jprendes/jsquash) 用于高级图片处理。
  - **Off-screen Rendering**: 使用 Web Workers 避免阻塞主线程。
  - **State Management**: [Pinia](https://pinia.vuejs.org/)。
- **离线增强**: [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) 提供完整的离线访问支持。

## 🔧 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发调试

```bash
pnpm dev
```

### 构建与编译 (SSG)

```bash
pnpm build
```

### 环境要求

- Node.js 18+
- PNPM 8+

## 📅 项目现状

Pandora 正在积极开发中，未来将添加更多如：视频转 GIF、浏览器插件注入、代码混淆加密等模块。欢迎提交 Issue 或 Pull Request。

## 📜 许可证

本项目采用 [MIT](LICENSE) 许可证。
