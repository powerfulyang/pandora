import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import { defineConfig, presetIcons, presetTypography, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig(
  {
    content: {
      filesystem: ['./src/**/*.{html,js,ts,jsx,tsx,vue}'],
    },
    theme: {
      colors: {
        // Pandora Design System — Semantic tokens mapped from CSS vars
        'pd-bg': 'var(--pd-bg)',
        'pd-bg-subtle': 'var(--pd-bg-subtle)',
        'pd-bg-muted': 'var(--pd-bg-muted)',
        'pd-bg-elevated': 'var(--pd-bg-elevated)',
        'pd-bg-inset': 'var(--pd-bg-inset)',

        'pd-surface': 'var(--pd-surface)',
        'pd-surface-hover': 'var(--pd-surface-hover)',

        'pd-border': 'var(--pd-border)',
        'pd-border-subtle': 'var(--pd-border-subtle)',
        'pd-border-hover': 'var(--pd-border-hover)',

        'pd-text': 'var(--pd-text)',
        'pd-text-secondary': 'var(--pd-text-secondary)',
        'pd-text-muted': 'var(--pd-text-muted)',
        'pd-text-disabled': 'var(--pd-text-disabled)',
        'pd-text-inverted': 'var(--pd-text-inverted)',

        'pd-accent': 'var(--pd-accent)',
        'pd-accent-hover': 'var(--pd-accent-hover)',
        'pd-accent-muted': 'var(--pd-accent-muted)',
        'pd-accent-subtle': 'var(--pd-accent-subtle)',

        'pd-secondary': 'var(--pd-secondary)',
        'pd-secondary-hover': 'var(--pd-secondary-hover)',
        'pd-secondary-muted': 'var(--pd-secondary-muted)',
        'pd-secondary-subtle': 'var(--pd-secondary-subtle)',

        'pd-success': 'var(--pd-success)',
        'pd-success-muted': 'var(--pd-success-muted)',
        'pd-danger': 'var(--pd-danger)',
        'pd-danger-muted': 'var(--pd-danger-muted)',
        'pd-warning': 'var(--pd-warning)',
        'pd-warning-muted': 'var(--pd-warning-muted)',

        'pd-overlay': 'var(--pd-overlay)',
        'pd-selection': 'var(--pd-selection)',
        'pd-shadow': 'var(--pd-shadow)',
      },
      fontFamily: {
        sans: '\'JetBrains Mono\', ui-monospace, \'Cascadia Code\', \'Fira Code\', monospace',
        display: '\'Outfit\', ui-sans-serif, system-ui, sans-serif',
      },
    },
    shortcuts: [
      ['btn', 'px-4 py-2 rounded-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'],
      ['btn-accent', 'btn bg-pd-accent text-white hover:bg-pd-accent-hover'],
      ['pd-card', 'bg-pd-bg border border-pd-border rounded-sm'],
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
