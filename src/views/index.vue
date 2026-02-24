<script lang="ts" setup>
import { motion } from 'motion-v'

// Layout configuration
const features = [
  {
    icon: 'i-material-symbols:rocket-launch-rounded',
    title: 'Modern Stack',
    description: 'Built with Vue 3, Vite, TypeScript and UnoCSS for maximum developer velocity.',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    icon: 'i-material-symbols:auto-awesome-rounded',
    title: 'Premium Design',
    description: 'Sophisticated aesthetics featuring motion-v animations and curated color palettes.',
    color: 'from-purple-400 to-pink-500',
  },
  {
    icon: 'i-material-symbols:speed-rounded',
    title: 'High Performance',
    description: 'Optimized for speed with SSG support, PWA capabilities, and minimal bundle size.',
    color: 'from-amber-400 to-orange-500',
  },
]
</script>

<template>
  <div class="bg-white min-h-screen relative overflow-hidden dark:bg-slate-950 selection:bg-indigo-100">
    <!-- Sophisticated Background Gradients -->
    <div class="pointer-events-none inset-0 absolute overflow-hidden">
      <div class="rounded-full bg-blue-100/50 h-96 w-96 absolute blur-3xl dark:bg-blue-900/20 -left-20 -top-24" />
      <div class="rounded-full bg-purple-100/50 h-96 w-96 top-1/2 absolute blur-3xl dark:bg-purple-900/20 -right-20" />
      <div class="rounded-full bg-indigo-100/30 h-96 w-96 left-1/2 absolute blur-3xl dark:bg-indigo-900/10 -translate-x-1/2 -bottom-24" />
    </div>

    <!-- Main Content -->
    <main class="mx-auto px-6 py-24 max-w-7xl relative z-10 lg:px-8 sm:py-32">
      <div class="text-center">
        <!-- Badge -->
        <motion.div
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6 }"
          class="text-sm text-indigo-600 font-medium mb-8 px-3 py-1 rounded-full bg-indigo-50 inline-flex ring-1 ring-indigo-200 ring-inset items-center dark:text-indigo-300 dark:bg-indigo-900/30 dark:ring-indigo-800"
        >
          <span class="mr-2 rounded-full bg-indigo-500 h-2 w-2 animate-pulse" />
          Vue Starter Template
        </motion.div>

        <!-- Hero Title -->
        <motion.h1
          :initial="{ opacity: 0, scale: 0.95 }"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="{ duration: 0.8, delay: 0.2 }"
          class="text-5xl text-slate-900 tracking-tight font-bold mb-6 sm:text-7xl dark:text-white"
        >
          Build for the
          <span class="text-transparent from-indigo-500 to-pink-500 via-purple-500 bg-gradient-to-r bg-clip-text">
            Next Generation
          </span>
        </motion.h1>

        <!-- Hero Subtitle -->
        <motion.p
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ duration: 0.8, delay: 0.4 }"
          class="text-lg text-slate-600 leading-8 mx-auto max-w-2xl dark:text-slate-400"
        >
          A meticulously crafted starter template designed for developers who value speed,
          type-safety, and exceptional user experience right out of the box.
        </motion.p>

        <!-- CTA Buttons -->
        <motion.div
          :initial="{ opacity: 0, y: 30 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.6 }"
          class="mt-10 flex gap-x-6 items-center justify-center"
        >
          <button
            class="text-sm text-white font-semibold px-8 py-4 rounded-xl bg-indigo-600 shadow-xl transition-all hover:bg-indigo-500 hover:shadow-indigo-500/25 active:scale-95"
          >
            Get Started
          </button>
          <a
            href="https://github.com/powerfulyang/vue-starter-template"
            target="_blank"
            class="group text-sm text-slate-900 leading-6 font-semibold flex items-center dark:text-white"
          >
            Github Repo
            <span class="ml-2 transition-transform group-hover:translate-x-1">→</span>
          </a>
        </motion.div>
      </div>

      <!-- Feature Grid -->
      <div class="mt-32 sm:mt-40">
        <div class="gap-8 grid grid-cols-1 md:grid-cols-3">
          <motion.div
            v-for="(feature, index) in features"
            :key="feature.title"
            :initial="{ opacity: 0, y: 50 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.6, delay: 0.8 + index * 0.1 }"
            class="group p-8 border border-slate-200 rounded-3xl bg-white/50 transition-all relative overflow-hidden dark:border-slate-800 hover:border-indigo-200 dark:bg-slate-900/50 hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:border-indigo-500/30"
          >
            <div
              :class="feature.color"
              class="mb-6 rounded-2xl flex h-12 w-12 shadow-indigo-500/20 shadow-lg items-center justify-center bg-gradient-to-br"
            >
              <div :class="feature.icon" class="text-white h-6 w-6" />
            </div>
            <h3 class="text-xl text-slate-900 font-bold dark:text-white">
              {{ feature.title }}
            </h3>
            <p class="text-slate-600 leading-7 mt-4 dark:text-slate-400">
              {{ feature.description }}
            </p>
          </motion.div>
        </div>
      </div>
    </main>

    <!-- Decorative Footer Shape -->
    <div class="h-32 bottom-0 left-0 right-0 absolute from-slate-50 to-transparent bg-gradient-to-t dark:from-slate-900/50" />
  </div>
</template>

<style scoped>
/* Custom animations or refinements if needed */
</style>
