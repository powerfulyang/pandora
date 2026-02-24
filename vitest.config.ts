import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig as any,
  defineConfig({
    plugins: [tsconfigPaths()],
    test: {
      globals: true,
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }),
)
