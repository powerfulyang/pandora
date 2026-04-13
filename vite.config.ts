import type { UserConfig } from 'vite'
import type { ViteSSGOptions } from 'vite-ssg'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import MotionResolver from 'motion-v/resolver'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'

import { VitePWA } from 'vite-plugin-pwa'
import Layouts from 'vite-plugin-vue-layouts'
import wasm from 'vite-plugin-wasm'
import tsconfigPaths from 'vite-tsconfig-paths'
import AutoIconServerPlugin from './plugins/icon'

interface Configuration extends UserConfig {
  ssgOptions?: ViteSSGOptions
}

// https://vite.dev/config/
export default defineConfig({
  //
  //
  assetsInclude: ['**/*.wasm'],
  css: {
    preprocessorOptions: {
      scss: {},
    },
    transformer: 'lightningcss',
    lightningcss: {
      drafts: {
        customMedia: true,
      },
    },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 4000,
    cssMinify: 'lightningcss',
    rollupOptions: {
      output: {
        // experimentalMinChunkSize: 20_000, // merge chunks smaller than 20KB
        manualChunks(id) {
          // Monaco editor workers are kept separate (loaded as web workers)
          if (id.includes('monaco-editor') && id.includes('.worker'))
            return null

          // Monaco editor core + all languages → single chunk
          if (id.includes('monaco-editor'))
            return 'vendor-monaco'

          // Mermaid diagramming library and its dependency Langium
          if (id.includes('mermaid') || id.includes('langium'))
            return 'vendor-mermaid'

          // PDF processing
          if (id.includes('pdfjs-dist'))
            return 'vendor-pdf'

          // Excel & Spreadsheet processing
          if (id.includes('xlsx') || id.includes('exceljs'))
            return 'vendor-excel'

          // Canvas & Image manipulation
          if (id.includes('fabric'))
            return 'vendor-canvas'

          // Syntax highlighting
          if (id.includes('highlight.js'))
            return 'vendor-hljs'

          // Lucide icons
          if (id.includes('lucide-vue-next'))
            return 'vendor-icons'

          // JSquash WASM codecs
          if (id.includes('@jsquash'))
            return 'vendor-jsquash'

          // Lodash-es isolate to verify tree-shaking size
          if (id.includes('lodash-es'))
            return 'vendor-lodash'

          // Large utilities
          if (id.includes('jszip') || id.includes('papaparse') || id.includes('axios') || id.includes('qs'))
            return 'vendor-utils'

          // Vue ecosystem → single chunk
          if (id.includes('node_modules') && (
            id.includes('/vue/')
            || id.includes('/vue-router/')
            || id.includes('/@vue/')
            || id.includes('/pinia/')
            || id.includes('/@vueuse/')
            || id.includes('/@unocss/')
            || id.includes('motion-v')
            || id.includes('vue-json-pretty')
            || id.includes('vue-advanced-cropper')
            || id.includes('@tanstack/vue-query')
          )) {
            return 'vendor-vue'
          }

          return null
        },
      },
    },
  },
  esbuild: {
    // drop: ['console'],
  },
  //
  optimizeDeps: {
    exclude: [
      '@jsquash/avif',
      '@jsquash/jpeg',
      '@jsquash/webp',
      '@jsquash/resize',
      '@jsquash/oxipng',
    ],
  },
  server: {
    host: true,
  },
  worker: {
    format: 'es',
    plugins: () => [wasm()],
    rollupOptions: {
      output: {},
    },
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vue Starter Template',
        short_name: 'VueApp',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 10485760, // 10MB
        cleanupOutdatedCaches: true,
      },
    }),
    ...(process.env.NODE_ENV !== 'production'
      ? [
          codeInspectorPlugin({ bundler: 'vite' }),
          AutoIconServerPlugin(),
        ]
      : []),
    tsconfigPaths({
      projects: ['./tsconfig.app.json'],
      loose: true,
    }),
    VueRouter({
      root: '.',
      // Add your own custom pages here. Just add it to the array. Example: 'src/welcome/pages'
      routesFolder: [
        {
          src: 'src/views',
          path: '/',
        },
      ],
      dts: 'src/auto-typings/typed-router.d.ts',
      extensions: ['.vue'],
      exclude: ['**/components/**'],
    }),
    Layouts({
      layoutsDirs: 'src/layouts',
      defaultLayout: 'default',
    }),
    wasm(),
    vue(),
    vueJsx(),
    UnoCSS(),
    Components({
      dirs: [
        'src/components',
      ],
      directoryAsNamespace: true,
      dts: 'src/auto-typings/components.d.ts',
      resolvers: [
        MotionResolver(),
      ],
    }),
    AutoImport({
      imports: [
        'vue',
        VueRouterAutoImports,
        '@vueuse/core',
        'pinia',
      ],
      resolvers: [],
      dts: 'src/auto-typings/auto-imports.d.ts',
      dirs: [
        'src/hooks',
      ],
    }),
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: './dist/report.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  ssr: {
    noExternal: [
      'monaco-editor',
      'vue-json-pretty',
      'vue-advanced-cropper',
      'mermaid',
      'pdfjs-dist',
      'fabric',
      'lucide-vue-next',
      '@jsquash/avif',
      '@jsquash/jpeg',
      '@jsquash/oxipng',
      '@jsquash/resize',
      '@jsquash/webp',
    ],
  },
}) as Configuration
