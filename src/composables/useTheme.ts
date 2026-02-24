import { computed, onMounted, onUnmounted, ref } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'pandora-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined')
    return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined')
    return 'system'

  return (localStorage.getItem(STORAGE_KEY) as Theme | null) || 'system'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined')
    return

  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('light', resolved === 'light')
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

// Global reactive state (shared across all components)
const theme = ref<Theme>(getStoredTheme())

export function useTheme() {
  const resolvedTheme = computed<'light' | 'dark'>(() =>
    theme.value === 'system' ? getSystemTheme() : theme.value,
  )

  function setTheme(newTheme: Theme, event?: MouseEvent) {
    if (newTheme === theme.value)
      return

    const apply = () => {
      theme.value = newTheme
      localStorage.setItem(STORAGE_KEY, newTheme)
      applyTheme(newTheme)
    }

    // View Transition API support
    if (!event || !('startViewTransition' in document)) {
      apply()
      return
    }

    const { clientX: x, clientY: y } = event
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const isNowDark = !document.documentElement.classList.contains('light')
    const isExpanding = !isNowDark

    document.documentElement.dataset.transitionDirection = isExpanding
      ? 'expand'
      : 'shrink'

    const transition = (document as any).startViewTransition(() => {
      apply()
    })

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ]

      document.documentElement.animate(
        {
          clipPath: isExpanding ? clipPath : clipPath.reverse(),
        },
        {
          duration: 400,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'both' as FillMode,
          pseudoElement: isExpanding
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)',
        },
      )
    })

    transition.finished.finally(() => {
      delete document.documentElement.dataset.transitionDirection
    })
  }

  // Apply on mount
  onMounted(() => {
    applyTheme(theme.value)

    // Listen for system theme changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)

    onUnmounted(() => {
      mq.removeEventListener('change', handler)
    })
  })

  return { theme, setTheme, resolvedTheme }
}
