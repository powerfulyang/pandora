<script setup lang="ts">
import { Archive, ArrowRight, Braces, Crop, Zap } from 'lucide-vue-next'
import { motion } from 'motion-v'
import ClientClock from '@/components/ClientClock.vue'
import ClientDate from '@/components/ClientDate.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const tools = [
  {
    id: 'image-processor',
    title: 'Image Processor',
    icon: Crop,
    desc: 'Quickly export icons and promotional images for Chrome Web Store.',
    href: '/image-processor',
    status: 'ONLINE',
    stats: ['Local WASM', 'WebP/AVIF'],
  },
  {
    id: 'json-viewer',
    title: 'JSON Viewer',
    icon: Braces,
    desc: 'Interactive JSON tree viewer with formatting & validation.',
    href: '/json-viewer',
    status: 'ONLINE',
    stats: ['Tree View', 'Format / Minify'],
  },
  {
    id: 'image-converter',
    title: 'Image Converter',
    icon: Archive,
    desc: 'Batch process, convert format, and compress images.',
    href: '/image-converter',
    status: 'ONLINE',
    stats: ['Batch Mode', 'History Log'],
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
} as const

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
} as const
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col h-screen overflow-hidden selection:text-pd-accent selection:bg-pd-accent-muted"
  >
    <!-- Top Navigation Bar -->
    <header
      class="px-6 border-b border-pd-border bg-pd-bg/80 flex shrink-0 h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md"
    >
      <div class="flex gap-4 items-center">
        <span class="text-sm tracking-widest font-bold uppercase">
          Pandora<span class="text-pd-text-muted">///OS</span>
        </span>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-6 items-center">
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto p-6 flex flex-1 flex-col gap-6 w-full overflow-auto md:p-8">
      <!-- Dashboard Header & Stats -->
      <section class="gap-6 grid grid-cols-1 md:grid-cols-12">
        <div class="flex flex-col col-span-1 justify-end md:col-span-8">
          <motion.div
            :initial="{ opacity: 0, y: 20 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.6 }"
          >
            <div class="mb-2 flex gap-2 items-center">
              <Zap class="text-pd-accent h-4 w-4" />
              <span class="text-xs text-pd-accent tracking-widest uppercase">System Ready v1.0.0</span>
            </div>
            <h1
              class="text-3xl text-pd-text tracking-tight font-bold uppercase md:text-4xl"
            >
              Module Directory
            </h1>
            <p class="text-sm text-pd-text-muted mt-2 max-w-2xl">
              Select a utility module to begin. All operations execute locally within your
              browser secure sandbox.
            </p>
          </motion.div>
        </div>

        <div class="text-right flex gap-6 col-span-1 items-end justify-end md:col-span-4">
          <div class="flex flex-col">
            <span class="text-[10px] text-pd-text-muted font-bold mb-1 uppercase">
              Local Time
            </span>
            <ClientClock />
          </div>
          <div class="bg-pd-border h-8 w-px" />
          <div class="flex flex-col">
            <span class="text-[10px] text-pd-text-muted font-bold mb-1 uppercase"> Date </span>
            <ClientDate />
          </div>
        </div>
      </section>

      <div class="bg-pd-border h-px w-full" />

      <!-- Tools Grid -->
      <motion.div
        class="gap-4 grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 xl:grid-cols-4"
        :initial="containerVariants.hidden"
        :animate="containerVariants.visible"
      >
        <motion.div
          v-for="tool in tools"
          :key="tool.id"
          :initial="itemVariants.hidden"
          :animate="itemVariants.visible"
          class="h-full"
        >
          <router-link
            :to="tool.href"
            class="group p-5 border border-pd-border rounded-sm bg-pd-bg-subtle/30 flex flex-col gap-4 h-full transition-all relative overflow-hidden hover:border-pd-accent/50 hover:bg-pd-bg-subtle/50"
          >
            <!-- Hover Glow -->
            <div
              class="bg-pd-accent/5 opacity-0 pointer-events-none transition-opacity inset-0 absolute group-hover:opacity-100"
            />

            <div class="flex items-start justify-between z-10">
              <div
                class="p-2 border rounded-[2px]" :class="[
                  tool.status === 'ONLINE'
                    ? 'bg-pd-accent-muted border-pd-accent/20 text-pd-accent'
                    : 'bg-pd-bg-muted border-pd-border text-pd-text-muted',
                ]"
              >
                <component :is="tool.icon" :stroke-width="1.5" class="h-6 w-6" />
              </div>
              <span
                class="text-[9px] tracking-wider font-bold px-1.5 py-0.5 rounded-[2px] uppercase" :class="[
                  tool.status === 'ONLINE'
                    ? 'bg-pd-success-muted text-pd-success border border-pd-success/20'
                    : 'bg-pd-bg-muted text-pd-text-disabled border border-pd-border',
                ]"
              >
                {{ tool.status }}
              </span>
            </div>

            <div class="z-10">
              <h3
                class="text-lg font-bold mb-1 uppercase transition-colors group-hover:text-pd-accent"
              >
                {{ tool.title }}
              </h3>
              <p
                class="text-xs text-pd-text-secondary leading-relaxed min-h-[2.5em] line-clamp-2"
              >
                {{ tool.desc }}
              </p>
            </div>

            <div
              class="mt-auto pt-4 border-t border-pd-border/50 flex items-center justify-between z-10"
            >
              <div class="flex gap-2">
                <span
                  v-for="stat in tool.stats.slice(0, 1)"
                  :key="stat"
                  class="text-[9px] text-pd-text-muted uppercase"
                >
                  {{ stat }}
                </span>
              </div>
              <ArrowRight
                class="text-pd-text-muted h-3.5 w-3.5 transition-all group-hover:text-pd-accent group-hover:translate-x-1"
              />
            </div>
          </router-link>
        </motion.div>

        <!-- New Module Placeholder -->
        <motion.div
          :initial="itemVariants.hidden"
          :animate="itemVariants.visible"
          class="h-full min-h-[180px]"
        >
          <div
            class="bg-bg-angled text-pd-text-disabled p-5 border border-pd-border rounded-sm border-dashed flex flex-col gap-3 h-full cursor-default transition-colors items-center justify-center hover:text-pd-text-muted hover:border-pd-text-muted/50"
          >
            <div
              class="border border-pd-border rounded-full bg-pd-bg flex h-8 w-8 items-center justify-center"
            >
              <span class="text-lg leading-none mb-1">+</span>
            </div>
            <span class="text-[10px] tracking-widest uppercase">
              More Modules Coming Soon
            </span>
          </div>
        </motion.div>
      </motion.div>
    </main>

    <!-- Footer -->
    <footer
      class="text-[10px] text-pd-text-muted border-t border-pd-border bg-pd-bg shrink-0 uppercase"
    >
      <div class="px-6 py-3 flex items-center justify-between">
        <div class="flex gap-2 items-center">
          <div class="rounded-full bg-pd-success h-1.5 w-1.5 animate-pulse" />
          <span>System Online</span>
        </div>
        <div class="flex gap-2 items-center">
          <span>Pandora</span>
          <span class="text-pd-border">|</span>
          <span>Local-First Toolset</span>
        </div>
      </div>
    </footer>
  </div>
</template>
