<script setup lang="ts">
import Prism from 'prismjs'
import { computed } from 'vue'

// Include languages we want to support
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

// Include Atom Dark theme from prism-themes
import 'prism-themes/themes/prism-atom-dark.css'

const props = defineProps<{
  language?: string
  code: string
}>()

const highlightedCode = computed(() => {
  const code = props.code || ''

  // Clean language mapped aliases (e.g., vue -> markup, ts -> typescript, js -> javascript)
  let lang = props.language || 'text'
  if (lang === 'js')
    lang = 'javascript'
  if (lang === 'ts')
    lang = 'typescript'
  if (lang === 'html' || lang === 'xml' || lang === 'vue')
    lang = 'markup'
  if (lang === 'sh')
    lang = 'bash'
  if (lang === 'yml')
    lang = 'yaml'
  if (lang === 'py')
    lang = 'python'
  if (lang === 'md')
    lang = 'markdown'

  const language = Prism.languages[lang]
  if (language) {
    try {
      return Prism.highlight(code, language, lang)
    }
    catch {
      // Fallback
    }
  }

  // Basic escaping for un-highlighted code
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
})
</script>

<template>
  <div class="syntax-highlighter-wrapper">
    <div class="mac-header print:hidden">
      <div class="mac-dots">
        <span class="dot close" />
        <span class="dot minimize" />
        <span class="dot maximize" />
      </div>
      <div v-if="language" class="lang-label">
        {{ language }}
      </div>
    </div>
    <pre :class="`language-${language || 'text'}`"><code :class="`language-${language || 'text'}`" v-html="highlightedCode" /></pre>
  </div>
</template>

<style scoped>
.syntax-highlighter-wrapper {
  background: #1d1f21;
  border-radius: 8px;
  overflow: hidden;
  margin: 1.5em 0;
  border: 1px solid #2d3135;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  page-break-inside: avoid;
}

.mac-header {
  height: 38px;
  background: #1d1f21;
  border-bottom: 1px solid #2d3135;
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: relative;
}

.mac-dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.close {
  background: #fc625d;
}
.dot.minimize {
  background: #fdbc40;
}
.dot.maximize {
  background: #35cd4b;
}

.lang-label {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: #c5c8c6;
  font-size: 12px;
  opacity: 0.6;
}

pre {
  margin: 0 !important;
  padding: 16px !important;
  overflow-x: auto;
  background: transparent !important;
  color: #c5c8c6;
  font-size: 13px;
  line-height: 1.6;
  border-radius: 0 !important;
  text-shadow: none !important;
}

code {
  background: transparent !important;
  padding: 0 !important;
  border: none !important;
  color: inherit !important;
  font-size: inherit !important;
  font-family: inherit !important;
  display: block;
  text-shadow: none !important;
}
</style>
