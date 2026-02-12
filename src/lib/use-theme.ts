import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'pandora-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  const setTheme = useCallback((newTheme: Theme, event?: React.MouseEvent | MouseEvent) => {
    if (newTheme === theme) return

    const apply = () => {
      setThemeState(newTheme)
      localStorage.setItem(STORAGE_KEY, newTheme)
      applyTheme(newTheme)
    }

    // View Transition API support
    if (!event || !document.startViewTransition) {
      apply()
      return
    }

    const { clientX: x, clientY: y } = event
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    // Determine direction based on current dark state
    const isNowDark = document.documentElement.classList.contains('dark')
    // As per user request: Light -> Dark = Expand, Dark -> Light = Shrink
    const isExpanding = !isNowDark 

    document.documentElement.dataset.transitionDirection = isExpanding ? 'expand' : 'shrink'

    const transition = document.startViewTransition(() => {
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
          fill: 'both',
          pseudoElement: isExpanding 
            ? '::view-transition-new(root)' 
            : '::view-transition-old(root)',
        }
      )
    })

    transition.finished.finally(() => {
      delete document.documentElement.dataset.transitionDirection
    })
  }, [theme])

  // Apply on mount (initial load)
  useEffect(() => {
    applyTheme(theme)
  }, [])

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? getSystemTheme() : theme

  return { theme, setTheme, resolvedTheme }
}
