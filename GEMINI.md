# Gemini Assistant Instructions for Pandora Toolkit 🤖

This file serves as the definitive reference guide and prompt instructions for the AI assistant (Gemini) working on the **Pandora** project. Please refer to these guidelines whenever making modifications, refactoring code, or designing new features for this codebase.

## 🎯 Project Overview

- **Name**: Pandora
- **Goal**: A modern, high-performance web toolkit featuring in-browser tools (e.g., Image Converter via JSquash, Image Cropper, JSON Viewer, Bilibili Danmaku Fetcher, etc.).
- **Architecture**: Designed with Vite SSG and fully configured for offline use (PWA). Emphasizes running intensive computations (like WebAssembly/WASM tools) in the user's browser via Web Workers (`Comlink`) rather than relying on a backend server.

## 🛠️ Tech Stack & Frameworks

1. **Vue 3 (Composition API)**: Exclusively use `<script setup lang="ts">`. Avoid Option API.
2. **TypeScript**: Strictly type variables, ref values, inputs, and events.
3. **Vite**: Use the latest Vite features. Keep an eye on `vite.config.ts` for top-level await and WASM plugins (`vite-plugin-wasm`).
4. **Style**:
   - Use **UnoCSS** for all atomic styling. Avoid writing raw CSS/SCSS unless it's necessary for complex animations or scoped third-party library overrides.
   - Refrain from redundant classes (e.g., don't add both ``and`font-sans` if one overrides the other; check system defaults).
5. **State**:
   - **Pinia** for global store (when necessary).
   - Use Vue references (`ref`, `computed`) for local component state.
6. **Icons**: Use `lucide-vue-next` for iconography. Ensure semantic icon choices and unified sizes across similar UI controls.

## 💡 Best Practices for AI Changes

### 1. **Component Design**

- Maintain a **clean, modular** Vue component structure.
- Try to use **split panes** when applicable (like the JSON Viewer layout).
- Ensure smooth **Micro-animations** for improved user experience (e.g., hover states, transitions using UnoCSS classes like `transition-colors duration-200`, `scale`, etc.).
- Avoid generic colors; use tailwind-like UnoCSS preset theme colors (e.g., `zinc-900`, `blue-500`) and standard breakpoints.

### 2. **Performance & SSG Constraints**

- Be cautious of **Browser APIs** (like `window`, `document`, or `navigator`) running during the Server-Side Generation (SSG) phase. If needed, wrap in `if (typeof window !== 'undefined')` or `onMounted`.
- For heavy tasks like image manipulation (`@jsquash`, `vue-advanced-cropper`), decouple logic using Web Workers and `Comlink` to prevent blocking the main thread.
- Avoid using external CDNs directly within the HTML/Index if possible; bundle locally for PWA fully offline support.

### 3. **UI / UX Rules**

- Add clear **feedback mechanisms**: loaders/spinners for async actions (like processing images), distinct "download" vs "preview" functionality.
- Support **Dark Mode** implicitly via UnoCSS `dark:` variants if the project configuration relies on it.

### 4. **Code Quality & Maintenance**

- **Type-checking**: Keep an eye out for TS errors. The project has strict typing rules (`npm run type-check`).
- Document complex logic with concise, meaningful comments.
- Regularly **clean up unused code** and utility classes to minimize technical debt.

---

**When asked to add a new tool or feature**, always construct an aesthetically pleasing standard layout referencing existing tool patterns, ensuring mobile responsiveness and semantic consistency across routing.
