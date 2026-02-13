import { URL, fileURLToPath } from 'node:url'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

const jsquashExternals = {
  '@jsquash/avif': 'https://esm.sh/@jsquash/avif@2.1.1',
  '@jsquash/jpeg': 'https://esm.sh/@jsquash/jpeg@1.6.0',
  '@jsquash/png': 'https://esm.sh/@jsquash/png@3.1.1',
  '@jsquash/webp': 'https://esm.sh/@jsquash/webp@1.5.0',
  '@jsquash/resize': 'https://esm.sh/@jsquash/resize@2.1.1',
}

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  worker: {
    format: 'es',
    plugins: () => [viteTsConfigPaths()],
    rollupOptions: {
      external: Object.keys(jsquashExternals),
      output: {
        paths: jsquashExternals,
      },
    },
  },
  optimizeDeps: {
    exclude: Object.keys(jsquashExternals),
  },
  build: {
    rollupOptions: {
      external: Object.keys(jsquashExternals),
      output: {
        paths: jsquashExternals,
      },
    },
  },
})

export default config
