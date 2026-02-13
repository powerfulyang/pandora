import { useRef } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Box,
  Image as ImageIcon,
  LayoutGrid,
  Terminal,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import ThemeToggle from '@/components/ThemeToggle'
import { ClientClock, ClientDate } from '@/components/TimeWidgets'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const containerRef = useRef<HTMLDivElement>(null)

  // GSAP Animation for "System Ready" text scramble effect
  useGSAP(
    () => {
      const tl = gsap.timeline()

      tl.from('.gsap-hero-title', {
        duration: 1,
        y: 50,
        opacity: 0,
        ease: 'power3.out',
        stagger: 0.2,
      }).from(
        '.gsap-hero-deco',
        {
          duration: 1.5,
          opacity: 0,
          scale: 0.9,
          ease: 'power2.out',
        },
        '-=0.5',
      )
    },
    { scope: containerRef },
  )

  const tools = [
    {
      id: 'img-crop',
      title: 'Image Processor',
      icon: <ImageIcon strokeWidth={1.5} />,
      desc: '快速导出 Chrome Web Store 需要的图标与宣传图。',
      href: '/image-crop',
      status: 'ONLINE',
      stats: ['Local WASM', 'WebP/AVIF'],
    },
    {
      id: 'todo',
      title: 'Task Manager',
      icon: <Terminal strokeWidth={1.5} />,
      desc: 'Local-first persistent task tracking protocol.',
      href: '/todo',
      status: 'ONLINE',
      stats: ['Local Storage', 'Persistence'],
    },
    {
      id: 'compress',
      title: 'Compressor',
      icon: <Box strokeWidth={1.5} />,
      desc: 'Lossless compression engine.',
      href: '#',
      status: 'OFFLINE',
      stats: ['Module Missing'],
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
      },
    },
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-bg text-text font-sans selection:bg-accent/20 selection:text-accent flex flex-col"
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-4">
          <div className="w-5 h-5 bg-accent/10 border border-accent flex items-center justify-center rounded-[2px]">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          </div>
          <span className="font-display font-bold tracking-widest text-sm uppercase">
            Pandora<span className="text-text-muted">///OS</span>
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-text-muted">

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-8 flex flex-col gap-10">
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-border border border-border">
          {/* Hero Title Card */}
          <div className="col-span-1 lg:col-span-8 bg-bg p-8 md:p-12 border-b lg:border-b-0 border-border relative overflow-hidden group">
            {/* Background Deco */}
            <div className="gsap-hero-deco absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
              <Box className="w-96 h-96 stroke-1" />
            </div>

            <div className="relative z-10 flex flex-col items-start h-full justify-center">
              <div className="gsap-hero-title inline-flex items-center gap-2 px-3 py-1 bg-accent/5 border border-accent/20 text-accent text-[10px] font-bold tracking-widest mb-8 rounded-[2px]">
                <Zap className="w-3 h-3" /> SYSTEM READY v{APP_VERSION}
              </div>

              <h1 className="gsap-hero-title text-5xl md:text-7xl lg:text-8xl font-display font-black tracking-tighter text-text mb-6 uppercase leading-[0.9]">
                Pandora
                <br />
                <span className="text-text-muted">Toolbox</span>
              </h1>

              <p className="gsap-hero-title font-mono max-w-xl text-text-secondary text-lg leading-relaxed font-light mb-8">
                Advanced browser-based utilities. Local-first architecture. No
                server uploads. Maximum privacy.
              </p>

              <div className="gsap-hero-title flex items-center gap-4">
                <Link
                  to="/image-crop"
                  className="px-6 py-3 bg-text text-bg font-bold text-sm tracking-wide hover:bg-accent hover:text-white transition-colors uppercase"
                >
                  Launch Image Processor
                </Link>
              </div>
            </div>
          </div>

          {/* Stats / Controls Sidebar */}
          <div className="col-span-1 lg:col-span-4 bg-bg-subtle/10 flex flex-col">
            <div className="flex-1 p-6 border-b border-border bg-bg flex flex-col justify-center">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-text-muted uppercase tracking-widest">
                  Available Modules
                </span>
                <LayoutGrid className="w-4 h-4 text-text-muted" />
              </div>
              <div className="text-4xl font-black font-mono text-text mb-2">
                {tools
                  .filter((t) => t.status === 'ONLINE')
                  .length.toString()
                  .padStart(2, '0')}
              </div>
              <div className="h-1 w-full bg-border/50 rounded-none overflow-hidden">
                <div
                  className="h-full bg-success"
                  style={{
                    width: `${(tools.filter((t) => t.status === 'ONLINE').length / tools.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex-1 p-6 bg-bg flex flex-col justify-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-text-muted uppercase mb-1">
                  Local Time
                </span>
                <ClientClock />
              </div>
              <div className="h-px w-full bg-border/50" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-text-muted uppercase mb-1">
                  Date
                </span>
                <ClientDate />
              </div>
            </div>
          </div>
        </section>

        {/* Grid Header */}
        <div className="flex items-center gap-4">
          <LayoutGrid className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold tracking-widest uppercase text-text">
            Modules Directory
          </h2>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-mono text-text-muted">01—03</span>
        </div>

        {/* Tools Grid - Animated with Framer Motion */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {tools.map((tool) => (
            <motion.div key={tool.id} variants={itemVariants}>
              <Link
                to={tool.href}
                className={`group relative bg-bg p-8 min-h-[280px] flex flex-col justify-between transition-all hover:bg-bg-elevated overflow-hidden h-full ${tool.status === 'OFFLINE' ? 'pointer-events-none opacity-60 grayscale' : ''}`}
              >
                {/* Hover Tech Markers */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-accent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start">
                  <div
                    className={`p-3 rounded-none border ${tool.status === 'ONLINE' ? 'bg-accent/5 border-accent/20 text-accent' : 'bg-bg-muted border-border text-text-muted'}`}
                  >
                    {tool.icon}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-1 uppercase tracking-wider ${tool.status === 'ONLINE' ? 'bg-success/10 text-success' : 'bg-bg-muted text-text-disabled'}`}
                  >
                    {tool.status}
                  </span>
                </div>

                <div className="mt-8">
                  <h3 className="text-2xl font-display font-black uppercase mb-2 group-hover:text-accent transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-text-secondary font-mono mb-6 leading-relaxed">
                    {tool.desc}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {tool.stats.map((stat) => (
                      <span
                        key={stat}
                        className="text-[10px] border border-border/50 bg-bg-subtle/50 px-2 py-1 text-text-muted uppercase"
                      >
                        {stat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Arrow */}
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted group-hover:text-text transition-colors">
                  <span>Execute</span>
                  <ArrowRight className="w-4 h-4 text-accent transform -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
              </Link>
            </motion.div>
          ))}

          {/* Empty Slots */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="hidden lg:flex bg-bg-angled p-8 items-center justify-center opacity-40"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-dashed border-text-disabled/50" />
                <span className="font-mono text-[10px] tracking-widest text-text-disabled uppercase">
                  Empty Slot 0{i + 1}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Status Footer */}
      <footer className="border-t border-border bg-bg text-[10px] uppercase font-mono text-text-muted">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>System Online</span>
          </div>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <span>Pandora</span>
            <span className="text-border">|</span>
            <span>Inc 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
