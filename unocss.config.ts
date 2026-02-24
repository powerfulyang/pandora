import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import { defineConfig, presetIcons, presetTypography, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig(
  {
    content: {
      filesystem: ['./src/**/*.{html,js,ts,jsx,tsx,vue}'],
    },
    theme: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
    shortcuts: [
      ['btn', 'px-4 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'],
      ['btn-primary', 'btn bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30'],
      ['card', 'bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-6 border border-gray-100'],
    ],
    presets: [
      presetWind4(),
      presetIcons({
        autoInstall: true,
        extraProperties: {
          'display': 'inline-block',
          'vertical-align': 'middle',
        },
        collections: {
          custom: FileSystemIconLoader('./icons'),
        },
      }),
      presetTypography(),
    ],
    transformers: [
      transformerDirectives(),
      transformerVariantGroup(),
    ],
  },
)
