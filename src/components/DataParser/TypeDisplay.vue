<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { createHighlighter } from 'shiki'
import { onMounted, ref, watch } from 'vue'

import { useTheme } from '@/composables/useTheme'

const props = defineProps<{
  types: string
}>()

const copied = ref(false)
const highlightedTypes = ref('')
const { resolvedTheme } = useTheme()

let highlighter: any = null

async function initHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['vitesse-dark', 'vitesse-light'],
      langs: ['typescript'],
    })
  }
  updateHighlight()
}

function updateHighlight() {
  if (!highlighter || !props.types)
    return
  highlightedTypes.value = highlighter.codeToHtml(props.types, {
    lang: 'typescript',
    theme: resolvedTheme.value === 'dark' ? 'vitesse-dark' : 'vitesse-light',
  })
}

watch(() => props.types, updateHighlight)
watch(resolvedTheme, updateHighlight)

onMounted(initHighlighter)

async function handleCopy() {
  await navigator.clipboard.writeText(props.types)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm text-pd-text tracking-widest font-bold flex gap-2 uppercase items-center">
        TypeScript Definitions
      </h3>
      <button
        class="text-[10px] tracking-widest font-bold px-4 py-1.5 border border-pd-border rounded-sm bg-pd-bg flex gap-2 uppercase transition-all items-center hover:text-pd-accent hover:border-pd-accent"
        @click="handleCopy"
      >
        <component :is="copied ? Check : Copy" class="h-3.5 w-3.5" />
        {{ copied ? 'Copied' : 'Copy Codes' }}
      </button>
    </div>

    <div
      class="custom-scrollbar text-[var(--shiki-fg)] p-6 border border-pd-border rounded-sm bg-[var(--shiki-bg)] max-h-[600px] transition-colors overflow-auto"
      v-html="highlightedTypes"
    />

    <div class="p-4 border border-pd-accent/20 rounded-sm bg-pd-accent/5">
      <p class="text-[10px] text-pd-accent tracking-widest font-bold mb-1 uppercase">
        Usage Tip
      </p>
      <p class="text-xs text-pd-text-muted leading-relaxed">
        These types are automatically inferred from your data structure. You can use them directly in your project to ensure type safety when working with this data.
      </p>
    </div>
  </div>
</template>

<style>
/* Shiki dynamic colors using vitesse themes */
.shiki {
  padding: 0 !important;
  background-color: transparent !important;
  font-size: 12px;
  line-height: var(--un-line-height-relaxed);
  font-family: var(--un-font-sans);
}
</style>
