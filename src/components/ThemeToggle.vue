<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { resolvedTheme, setTheme } = useTheme()

function toggleTheme(e: MouseEvent) {
  const nextTheme = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  setTheme(nextTheme, e)
}
</script>

<template>
  <button
    class="group text-pd-text-secondary p-2 bg-transparent cursor-pointer transition-all duration-300 hover:text-pd-accent active:scale-95"
    :title="`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`"
    @click="toggleTheme"
  >
    <component
      :is="resolvedTheme === 'light' ? Sun : Moon"
      class="h-4 w-4 transition-transform duration-300 group-hover:rotate-12"
    />
    <span class="sr-only">Toggle theme</span>
  </button>
</template>
