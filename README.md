# Pandora

> **Advanced Browser Utilities. Local-first architecture.**
> **Maximum privacy. No server uploads.**

Pandora is a modern web toolbox designed with a "Workstation / The Vault" aesthetic. It provides a suite of high-performance tools that run entirely in your browser using WebAssembly (WASM), ensuring your data never leaves your device.

![Pandora Dashboard](https://via.placeholder.com/800x450.png?text=Pandora+Dashboard+Preview)

## ✨ Features (Modules)

Pandora is organized into modular utilities:

- **🖼️ Image Processor (ONLINE)**
  - Powered by `@jsquash` WASM modules.
  - Supports cropping, resizing, and format conversion (WebP, AVIF, PNG, JPEG).
  - Privacy-focused: All processing happens locally.

- **📦 Compressor (OFFLINE)**
  - Lossless compression engine.
  - _Status: Module Missing (Coming Soon)_

- **💻 JSON Parser (OFFLINE)**
  - Strict type validation & formatter.
  - _Status: Module Missing (Coming Soon)_

## 🛠️ Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 + Router)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Core Technology:**
  - **WASM:** `@jsquash/*` for high-performance image processing.
  - **Validation:** `Zod` for strict data validation.
  - **RPC:** `@orpc/*` for type-safe API communication.

## 🚀 Getting Started

Ensure you have [Node.js](https://nodejs.org/) installed. This project uses `pnpm`.

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

Start the development server:

```bash
pnpm dev
# Open http://localhost:3000
```

### Building for Production

```bash
pnpm build
```

The output will be generated in the `.output` directory (or as configured in `vite.config.ts`).

### Testing

Run unit tests with Vitest:

```bash
pnpm test
```

### Linting

```bash
pnpm lint
pnpm format
```

## 🎨 Design System

Pandora follows a strict "The Vault" design language:

- **Dark Mode Only**: High contrast, technical aesthetic.
- **Fine Grain**: Subtle noise textures for depth.
- **Monospace**: Extensive use of monospace fonts for data and metrics.
- **Micro-interactions**: Subtle feedback loop for all user actions.

See [GEMINI.md](./GEMINI.md) for detailed design guidelines and project constraints.

## 📂 Project Structure

```
src/
├── components/   # Reusable UI components
├── routes/       # File-based routing (pages)
├── lib/          # Utilities and hooks
├── integrations/ # Third-party integrations
└── styles.css    # Global styles & Tailwind config
```

---

© 2026 Pandora Corp. System Ready.
