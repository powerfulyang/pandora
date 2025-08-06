import process from 'node:process'
import legacy from '@vitejs/plugin-legacy'
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
import tsconfigPaths from 'vite-tsconfig-paths'
import AutoIconServerPlugin from './plugins/icon'

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
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
    AutoIconServerPlugin(),
    codeInspectorPlugin({
      bundler: 'vite',
    }),
    tsconfigPaths({
      projects: ['./tsconfig.app.json'],
      loose: true,
    }),
    vue(),
    vueJsx(),
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
})
