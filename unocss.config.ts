import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import { defineConfig, presetIcons, presetWind4 } from 'unocss'

export default defineConfig(
  {
    content: {
      filesystem: ['./src/**/*.{html,js,ts,jsx,tsx,vue}'],
    },
    presets: [
      presetWind4(),
      presetIcons({
        collections: {
          custom: FileSystemIconLoader('./icons'),
        },
      }),
    ],
  },
)
