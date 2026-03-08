import type { UserConfig } from 'vite'
import type { ViteSSGOptions } from 'vite-ssg'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import MotionResolver from 'motion-v/resolver'
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
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 20_000, // merge chunks smaller than 20KB
        manualChunks(id) {
          // Monaco editor workers are kept separate (loaded as web workers)
          if (id.includes('monaco-editor') && id.includes('.worker'))
            return undefined

          // Monaco editor core + all languages → single chunk
          if (id.includes('monaco-editor') && !id.includes('.worker'))
            return 'vendor-monaco'

          // Lucide icons → single chunk
          if (id.includes('lucide-vue-next'))
            return 'vendor-icons'

          // JSquash WASM codecs → single chunk
          if (id.includes('@jsquash'))
            return 'vendor-jsquash'

          // Shiki languages & themes → single chunk
          if (id.includes('shiki') || id.includes('@shikijs'))
            return 'vendor-shiki'

          // Vue ecosystem → single chunk
          if (id.includes('node_modules') && (
            id.includes('/vue/')
            || id.includes('/vue-router/')
            || id.includes('/@vue/')
            || id.includes('/pinia/')
            || id.includes('/@vueuse/')
          )) {
            return 'vendor-vue'
          }
        },
      },
    },
    sourcemap: process.env.NODE_ENV !== 'production',
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
  css: {
    preprocessorOptions: {
      scss: {},
    },
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
    AutoIconServerPlugin(),
    ...(process.env.NODE_ENV !== 'production'
      ? [codeInspectorPlugin({ bundler: 'vite' })]
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
  ],
}) as Configuration
