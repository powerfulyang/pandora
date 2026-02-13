import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import type { Theme } from '@/lib/use-theme'
import { useTheme } from '@/lib/use-theme'

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = (e: React.MouseEvent) => {
    const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme, e)
  }

  if (!mounted) {
    return (
      <button
        className="p-2 text-text-secondary opacity-50 cursor-wait"
        aria-hidden="true"
      >
        <div className="w-4 h-4" />
        <span className="sr-only">Loading theme</span>
      </button>
    )
  }

  const Icon = resolvedTheme === 'light' ? Sun : Moon

  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-text-secondary hover:text-accent hover:border-accent/40 transition-all duration-300 bg-transparent active:scale-95 group"
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Icon className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
