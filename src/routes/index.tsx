import { createFileRoute, Link } from '@tanstack/react-router'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const tools = [
    {
      icon: <ImageIcon className="w-6 h-6" />,
      title: 'Image Crop',
      tag: 'WASM',
      description:
        'Professional grade image cropping with WebAssembly-powered WebP & AVIF export.',
      href: '/demo/image-crop',
      color: 'text-accent',
      bg: 'bg-accent-subtle/50',
    },
    // More tools can be added here in the future
  ]

  return (
    <div className="min-h-screen bg-bg text-text font-sans selection:bg-selection relative selection:text-accent">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-accent-subtle/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-secondary-subtle/20 rounded-full blur-[140px]" />
        {/* Fine Grain Texture via CSS Pattern */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Theme Toggle — integrated more subtly */}
      <div className="fixed top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      <main className="relative max-w-7xl mx-auto px-6 pt-20 pb-20">
        {/* Compact Tool-First Header */}
        <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8 pb-12 border-border/50 border-b">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent shadow-accent/30 shadow-[0_0_20px]">
                <Sparkles className="w-4 h-4 text-text-inverted" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase font-display italic">
                Pandora<span className="text-accent ml-1">Toolbox</span>
              </h1>
            </div>
            <p className="max-w-md text-sm text-text-secondary font-medium leading-relaxed">
              Privacy-centric, high-performance web utilities running entirely in
              your browser. Local-first speed, zero uploads.
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Status</span>
              <span className="text-xs font-bold text-text uppercase">All Systems Ready</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Vibe</span>
              <span className="text-xs font-bold text-text uppercase">Local-First WASM</span>
            </div>
          </div>
        </header>

        {/* Tools Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/50 border border-border/50 backdrop-blur-sm shadow-2xl animate-in fade-in zoom-in-95 duration-700">
          {tools.map((tool, index) => (
            <Link
              key={index}
              to={tool.href}
              className="group relative bg-bg p-10 transition-all duration-500 hover:bg-surface-hover overflow-hidden"
            >
              {/* Hover Glow */}
              <div className="absolute -inset-px bg-linear-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-12">
                  <div className={`p-4 rounded-none ${tool.bg} border border-border group-hover:border-accent/30 transition-colors duration-500`}>
                    <div className={tool.color}>{tool.icon}</div>
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-text-muted px-2 py-1 border border-border uppercase">
                    {tool.tag}
                  </span>
                </div>

                <div className="mt-auto">
                  <h3 className="text-3xl font-black mb-4 tracking-tight uppercase italic group-hover:text-accent transition-colors duration-300">
                    {tool.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed font-light text-sm group-hover:text-text transition-colors duration-500">
                    {tool.description}
                  </p>
                </div>

                {/* Arrow Decoration */}
                <div className="mt-12 flex items-center justify-end">
                  <div className="w-16 h-px bg-border group-hover:w-20 group-hover:bg-accent transition-all duration-500" />
                  <svg
                    className="w-4 h-4 ml-2 text-border group-hover:text-accent transition-colors duration-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}

          {/* Empty Slots */}
          {[1, 2].map((i) => (
            <div
              key={`empty-${i}`}
              className="hidden md:flex bg-bg/50 p-10 items-center justify-center border-border/20"
            >
              <div className="text-[10px] font-black text-text-muted/30 uppercase tracking-[0.4em]">
                Slot {i + 1} Empty
              </div>
            </div>
          ))}
        </div>

        {/* Minimal Footer */}
        <footer className="mt-24 pt-12 border-t border-border flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
          <div className="flex items-center gap-6">
             <img src="/logo.svg" alt="Pandora" className="h-6 w-auto opacity-50" />
             <div className="h-4 w-px bg-border" />
             <span className="text-[10px] font-bold tracking-widest uppercase text-text-muted">
               Built for Performance
             </span>
          </div>
          <img
            src="/tanstack-word-logo-white.svg"
            alt="TanStack"
            className="h-4 dark:invert-0 invert"
          />
        </footer>
      </main>
    </div>
  )
}
