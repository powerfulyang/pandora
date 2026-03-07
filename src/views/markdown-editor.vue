<script setup lang="ts">
import highlight from 'highlight.js'
import katex from 'katex'
import { ArrowLeft, Quote } from 'lucide-vue-next'
import { config, MdEditor } from 'md-editor-v3'
import mermaid from 'mermaid'
import * as parserMarkdown from 'prettier/plugins/markdown'

// Import offline dependencies for md-editor-v3
import * as prettier from 'prettier/standalone'
import screenfull from 'screenfull'
import { computed, onMounted, ref } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useTheme } from '@/composables/useTheme'
import 'highlight.js/styles/atom-one-dark.css'
import 'md-editor-v3/lib/style.css'
import 'katex/dist/katex.min.css'

config({
  editorExtensions: {
    prettier: {
      prettierInstance: prettier,
      parserMarkdownInstance: parserMarkdown,
    },
    highlight: {
      instance: highlight,
    },
    screenfull: {
      instance: screenfull,
    },
    katex: {
      instance: katex,
    },
    mermaid: {
      instance: mermaid,
    },
  },
})

const { resolvedTheme } = useTheme()
const theme = computed(() => resolvedTheme.value === 'dark' ? 'dark' : 'light')

const text = ref(`# Pandora Markdown

Welcome to the **Pandora Markdown Tool**. This is a high-performance offline Markdown environment.

## 🧮 Math Formulas (Katex)
Inline formula: $E = mc^2$

Block formula:
$$
\\frac{1}{2} \\pi = \\int_{-\\infty}^{\\infty} e^{-x^2} dx
$$

## 💻 Code Highlighting
\`\`\`ts
import { ref } from 'vue';

export default function useCounter() {
  const count = ref(0);
  const inc = () => count.value++;
  return { count, inc };
}
\`\`\`

## 📊 Flowcharts (Mermaid)
\`\`\`mermaid
graph TD
  A[Start] --> B{Condition}
  B -->|Yes| C[Process]
  B -->|No| D[Terminate]
  C --> A
\`\`\`

## 📝 Todo Tasks
- [x] Configure Vue 3 Setup
- [x] Enable offline WASM processing
- [x] High-precision Markdown rendering
- [ ] Add remaining utilities
`)

// Some stats
const wordCount = computed(() => {
  return text.value.trim().split(/\s+/).filter(w => w.length > 0).length
})
const charCount = computed(() => text.value.length)

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div class="text-pd-text bg-pd-bg flex flex-col h-screen overflow-hidden selection:text-pd-bg selection:bg-pd-accent">
    <!-- Header -->
    <header class="px-6 border-b border-pd-border bg-pd-bg/80 flex h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md">
      <div class="flex gap-4 items-center">
        <router-link to="/" class="text-pd-text-muted flex gap-2 transition-colors items-center hover:text-pd-accent">
          <ArrowLeft class="h-4 w-4" :stroke-width="1.5" />
          <span class="text-xs tracking-widest uppercase">Back</span>
        </router-link>
        <div class="bg-pd-border h-5 w-px" />
        <div class="flex gap-2 items-center">
          <div class="p-1.5 border border-pd-accent/20 rounded-[2px] bg-pd-accent-muted">
            <Quote class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Markdown<span class="text-pd-text-muted">///Editor</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <span class="hidden md:inline">
          {{ wordCount }} words · {{ charCount }} chars
        </span>
        <div class="mx-1 bg-pd-border h-3 w-px" />
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main id="md-editor-container" class="m-0 p-0 flex flex-1 h-full w-full relative overflow-hidden">
      <MdEditor
        v-if="isMounted"
        v-model="text"
        :theme="theme"
        language="en-US"
        class="border-none flex-1 !h-full"
        style="height: 100%"
      />
    </main>
  </div>
</template>

<style scoped>
#md-editor-container :deep(.md-editor) {
  --md-bk-color: var(--pd-bg);
  --md-bk-hover-color: rgba(255, 255, 255, 0.05);
  --md-color: var(--pd-text);
  --md-border-color: var(--pd-border);
  --md-border-hover-color: var(--pd-accent);
}
:root.dark #md-editor-container :deep(.md-editor) {
  --md-bk-hover-color: rgba(255, 255, 255, 0.05);
}
:root.light #md-editor-container :deep(.md-editor) {
  --md-bk-hover-color: rgba(0, 0, 0, 0.05);
}

/* Beautiful Code Block Action Buttons */
#md-editor-container :deep(.md-editor-preview .md-editor-code) {
  border-radius: 8px;
  border: 1px solid var(--pd-border);
  overflow: hidden;
  /* Beautiful Mermaid Diagram Container */
  #md-editor-container :deep(.md-editor-preview .md-editor-mermaid) {
    border-radius: 8px;
    background-color: var(--pd-bg-subtle);
    border: 1px solid var(--pd-border);
    padding: 24px;
    margin: 1rem 0;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    overflow: auto;
    transition: all 0.3s ease;
    position: relative;
  }

  #md-editor-container :deep(.md-editor-preview .md-editor-mermaid:not([data-processed])) {
    color: transparent;
    font-size: 0;
  }

  #md-editor-container :deep(.md-editor-preview .md-editor-mermaid:not([data-processed])::after) {
    content: 'Rendering Diagram...';
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--pd-text-muted);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: diagram-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  #md-editor-container :deep(.md-editor-preview .md-editor-mermaid[data-processed='']) {
    animation: fade-in 0.4s ease-out forwards;
  }

  @keyframes diagram-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  margin: 1rem 0;
}

#md-editor-container :deep(.md-editor-preview .md-editor-code-head) {
  padding: 8px 16px;
  background-color: var(--pd-bg-subtle);
  border-bottom: 1px solid var(--pd-border);
  display: flex !important;
  justify-content: space-between;
  align-items: center;

  .md-editor-code-flag {
    margin-top: -8px;
  }
  .md-editor-copy-button {
    line-height: 18px;
  }
}

#md-editor-container :deep(.md-editor-preview .md-editor-code-action) {
  display: flex;
  align-items: center;
  gap: 12px;
}

#md-editor-container :deep(.md-editor-preview .md-editor-code-lang) {
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--pd-text-disabled);
  letter-spacing: 0.05em;
}

#md-editor-container :deep(.md-editor-preview .md-editor-copy-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--pd-text-muted);
  padding: 4px 10px;
  border: 1px solid var(--pd-border);
  border-radius: 6px;
  background-color: var(--pd-bg);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px var(--pd-shadow);
}

#md-editor-container :deep(.md-editor-preview .md-editor-copy-button:hover) {
  color: var(--pd-accent);
  background-color: var(--pd-bg-muted);
  border-color: var(--pd-accent-muted);
  transform: translateY(-1px);
}

#md-editor-container :deep(.md-editor-preview .md-editor-copy-button:active) {
  transform: translateY(0);
}
</style>
