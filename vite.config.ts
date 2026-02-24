import type { UserConfig } from 'vite'
import type { ViteSSGOptions } from 'vite-ssg'
import process from 'node:process'
/// <reference types="vite-ssg" />
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
import tsconfigPaths from 'vite-tsconfig-paths'
import AutoIconServerPlugin from './plugins/icon'

interface Configuration extends UserConfig {
  ssgOptions?: ViteSSGOptions
}

// https://vite.dev/config/
export default defineConfig({
  //
  build: {
    rollupOptions: {
      //
      external: [],
    },
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  esbuild: {
    // drop: ['console'],
  },
  //
  optimizeDeps: {
    exclude: [],
  },
  css: {
    preprocessorOptions: {
      scss: {},
      less: {},
    },
  },
  server: {
    host: true,
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
    AutoIconServerPlugin(),
    codeInspectorPlugin({
      bundler: 'vite',
    }),
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
