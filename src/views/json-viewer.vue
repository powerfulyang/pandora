<script setup lang="ts">
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Eraser,
  FileJson2,
  Maximize2,
  Minimize2,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { calcJSONStats, formatBytes, hasActiveInputElement } from '@/utils'
import 'vue-json-pretty/lib/styles.css'

const rawInput = ref('')
const parsedData = ref<any>(null)
const parseError = ref<string | null>(null)
const copied = ref(false)
const expandLevel = ref(3)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)

// ── Split-pane ────────────────────────────────────────────────
const leftWidth = ref(50) // percentage
const isDragging = ref(false)

function onDividerMouseDown(e: MouseEvent) {
  isDragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value)
    return
  const container = document.getElementById('split-container')
  if (!container)
    return
  const rect = container.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  leftWidth.value = Math.min(Math.max(pct, 20), 80)
}

function onMouseUp() {
  isDragging.value = false
}

function syncScroll() {
  if (textareaRef.value && gutterRef.value) {
    gutterRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

const stats = ref({ keys: 0, depth: 0, size: '0 B' })

const SAMPLE_JSON = {
  name: 'Pandora Toolbox',
  version: '1.0.0',
  description: 'Local-first browser utilities',
  architecture: {
    runtime: 'Browser + WASM',
    framework: 'Vue 3 + Vite',
    styling: 'UnoCSS',
  },
  modules: [
    {
      id: 'image-processor',
      status: 'ONLINE',
      capabilities: ['crop', 'resize', 'export'],
    },
    {
      id: 'image-converter',
      status: 'ONLINE',
      capabilities: ['batch', 'format-convert', 'compress'],
    },
    {
      id: 'json-viewer',
      status: 'ONLINE',
      capabilities: ['parse', 'format', 'validate'],
    },
  ],
  metadata: {
    timestamp: new Date().toISOString(),
    locale: 'zh-CN',
    privacyLevel: 'LOCAL_ONLY',
    serverUploads: false,
    supportedFormats: ['JSON', 'JSONL'],
    limits: {
      maxInputSize: '10MB',
      maxDepth: null,
    },
  },
}

function handleParse(text: string) {
  rawInput.value = text
  if (!text.trim()) {
    parsedData.value = null
    parseError.value = null
    stats.value = { keys: 0, depth: 0, size: '0 B' }
    return
  }

  try {
    const data = JSON.parse(text)
    parsedData.value = data
    parseError.value = null

    const { keys, depth } = calcJSONStats(data)
    const bytes = new Blob([text]).size
    stats.value = { keys, depth, size: formatBytes(bytes) }
  }
  catch (e) {
    parsedData.value = null
    parseError.value = e instanceof Error ? e.message : 'Invalid JSON'
    stats.value = { keys: 0, depth: 0, size: '0 B' }
  }
}

function handleFormat() {
  if (!parsedData.value)
    return
  rawInput.value = JSON.stringify(parsedData.value, null, 2)
}

function handleMinify() {
  if (!parsedData.value)
    return
  rawInput.value = JSON.stringify(parsedData.value)
}

async function handleCopy() {
  if (!parsedData.value)
    return
  const text = JSON.stringify(parsedData.value, null, 2)
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function handleClear() {
  rawInput.value = ''
  parsedData.value = null
  parseError.value = null
  stats.value = { keys: 0, depth: 0, size: '0 B' }
  nextTick(() => textareaRef.value?.focus())
}

function handleLoadSample() {
  const text = JSON.stringify(SAMPLE_JSON, null, 2)
  handleParse(text)
}

async function handlePasteFromClipboard() {
  const text = await navigator.clipboard.readText()
  if (text)
    handleParse(text)
}

const lineCount = computed(() => rawInput.value.split('\n').length)
const lines = computed(() => Array.from({ length: lineCount.value }, (_, i) => i + 1))

const dataType = computed(() => {
  if (!parsedData.value)
    return ''
  return Array.isArray(parsedData.value) ? 'Array' : typeof parsedData.value
})

// Global paste handler
function onGlobalPaste(e: ClipboardEvent) {
  if (hasActiveInputElement())
    return
  const text = e.clipboardData?.getData('text/plain')
  if (text) {
    e.preventDefault()
    handleParse(text)
  }
}

onMounted(() => {
  document.addEventListener('paste', onGlobalPaste)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('paste', onGlobalPaste)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

function jumpToError() {
  if (!parseError.value || !textareaRef.value)
    return

  const errorMsg = parseError.value
  let position = -1

  // Case 1: "at position 123" (Chrome/V8) or "char 123"
  const posMatch = errorMsg.match(/at position (\d+)/i) || errorMsg.match(/char (\d+)/i)
  if (posMatch && posMatch[1]) {
    position = parseInt(posMatch[1], 10)
  }
  // Case 2: "line 1 column 2" (Firefox/SpiderMonkey)
  else {
    const lineColMatch = errorMsg.match(/line (\d+),? column (\d+)/i)
    if (lineColMatch && lineColMatch[1] && lineColMatch[2]) {
      const line = parseInt(lineColMatch[1], 10)
      const col = parseInt(lineColMatch[2], 10)

      const linesContent = rawInput.value.split('\n')
      position = 0
      for (let i = 0; i < Math.min(line - 1, linesContent.length); i++) {
        const lineText = linesContent[i]
        if (lineText !== undefined)
          position += lineText.length + 1 // +1 for \n
      }
      position += col - 1
    }
  }

  if (position >= 0) {
    const el = textareaRef.value
    el.focus()
    el.setSelectionRange(position, position + 1)

    // Scroll to the error line
    const textBefore = rawInput.value.substring(0, position)
    const lineIndex = textBefore.split('\n').length - 1
    const lineHeight = 24 // matching leading-6 (1.5rem)
    const padding = 16 // matching p-4
    const lineTop = lineIndex * lineHeight + padding
    const textareaHeight = el.clientHeight

    el.scrollTo({
      top: Math.max(0, lineTop - textareaHeight / 2),
      behavior: 'smooth',
    })
  }
}
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col h-screen overflow-hidden selection:text-pd-bg selection:bg-pd-accent"
  >
    <!-- Header -->
    <header
      class="px-6 border-b border-pd-border bg-pd-bg/80 flex h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md"
    >
      <div class="flex gap-4 items-center">
        <router-link
          to="/"
          class="text-pd-text-muted flex gap-2 transition-colors items-center hover:text-pd-accent"
        >
          <ArrowLeft class="h-4 w-4" :stroke-width="1.5" />
          <span class="text-xs tracking-widest uppercase">Back</span>
        </router-link>
        <div class="bg-pd-border h-5 w-px" />
        <div class="flex gap-2 items-center">
          <div class="p-1.5 border border-pd-accent/20 rounded-[2px] bg-pd-accent-muted">
            <Braces class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            JSON<span class="text-pd-text-muted">///Viewer</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <template v-if="parsedData !== null">
          <span
            class="text-pd-success px-2 py-0.5 border border-pd-success/20 rounded-[2px] bg-pd-success-muted hidden sm:inline"
          >
            VALID
          </span>
          <span class="hidden md:inline">
            {{ stats.keys }} keys · depth {{ stats.depth }} · {{ stats.size }}
          </span>
          <div class="mx-1 bg-pd-border h-3 w-px" />
        </template>
        <span
          v-if="parseError"
          class="text-pd-danger px-2 py-0.5 border border-pd-danger/20 rounded-[2px] bg-pd-danger-muted"
        >
          INVALID
        </span>
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main
      id="split-container"
      class="flex flex-1 overflow-hidden"
      :class="{ 'select-none': isDragging }"
    >
      <!-- Left Panel: Input -->
      <div
        class="border-r border-pd-border flex flex-col min-h-0 min-w-0 overflow-hidden"
        :style="{ width: `${leftWidth}%` }"
      >
        <!-- Input Toolbar -->
        <div
          class="px-4 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex items-center justify-between"
        >
          <div class="flex gap-1 items-center">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              INPUT
            </span>
            <span class="text-[10px] text-pd-text-disabled">
              {{ lineCount }} lines
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Load sample JSON"
              @click="handleLoadSample"
            >
              <FileJson2 class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Sample
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Paste from clipboard"
              @click="handlePasteFromClipboard"
            >
              <ClipboardPaste class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Paste
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-danger hover:border-pd-danger/20 hover:bg-pd-danger/5"
              title="Clear input"
              @click="handleClear"
            >
              <Eraser class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Clear
            </button>
          </div>
        </div>

        <!-- Textarea -->
        <!-- Input & Gutter -->
        <div class="flex flex-1 min-h-[200px] relative overflow-hidden lg:min-h-0">
          <!-- Gutter -->
          <div
            ref="gutterRef"
            class="px-2 py-4 text-right border-r border-pd-border bg-pd-bg-subtle/50 flex flex-col w-10 select-none overflow-hidden"
          >
            <div
              v-for="line in lines"
              :key="line"
              class="text-[11px] text-pd-text-disabled leading-6 h-6"
            >
              {{ line }}
            </div>
          </div>

          <!-- Textarea area -->
          <div class="flex-1 relative">
            <textarea
              ref="textareaRef"
              :value="rawInput"
              placeholder="Paste or type JSON here...

Shortcut: Ctrl/Cmd + V anywhere on the page to auto-paste."
              class="custom-scrollbar text-[13px] text-pd-text leading-6 p-4 bg-transparent h-full w-full resize-none placeholder:text-pd-text-disabled/50 focus:outline-none"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
              @scroll="syncScroll"
              @input="handleParse(($event.target as HTMLTextAreaElement).value)"
            />

            <!-- Empty State -->
            <div
              v-if="!rawInput"
              class="flex flex-col pointer-events-none items-center inset-0 justify-center absolute"
            >
              <Braces class="text-pd-border mb-4 h-16 w-16" :stroke-width="0.5" />
              <p class="text-xs text-pd-text-disabled tracking-widest mb-1 uppercase">
                No data loaded
              </p>
              <p class="text-[10px] text-pd-text-disabled">
                Paste JSON or click "Sample" to start
              </p>
            </div>
          </div>
        </div>

        <!-- Parse Error -->
        <div
          v-if="parseError"
          class="group px-4 py-3 border-t border-pd-danger/20 bg-pd-danger/5 flex gap-2 cursor-pointer transition-colors items-start hover:bg-pd-danger/10"
          title="Click to jump to error position"
          @click="jumpToError"
        >
          <AlertTriangle class="text-pd-danger mt-0.5 shrink-0 h-4 w-4" :stroke-width="1.5" />
          <div class="flex-1 min-w-0">
            <div class="mb-1 flex items-center justify-between">
              <p class="text-[10px] text-pd-danger tracking-wider font-bold uppercase">
                Parse Error
              </p>
              <span class="text-[9px] text-pd-danger/70 flex gap-1 uppercase items-center">
                <Maximize2 class="h-2.5 w-2.5" />
                Jump to Error
              </span>
            </div>
            <p class="text-xs text-pd-danger/80 leading-relaxed break-all">
              {{ parseError }}
            </p>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div
        class="group bg-pd-border/40 shrink-0 w-1 cursor-col-resize transition-colors relative hover:bg-pd-accent/40"
        title="Drag to resize"
        @mousedown="onDividerMouseDown"
      >
        <!-- visual handle -->
        <div
          class="bg-pd-border w-px transition-colors inset-y-0 left-1/2 absolute group-hover:bg-pd-accent/60 -translate-x-1/2"
        />
      </div>

      <!-- Right Panel: Viewer -->
      <div
        class="flex flex-col min-h-0 min-w-0 overflow-hidden"
        :style="{ width: `${100 - leftWidth}%` }"
      >
        <!-- Viewer Toolbar -->
        <div
          class="px-4 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex items-center justify-between"
        >
          <div class="flex gap-1 items-center">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              TREE VIEW
            </span>
            <span v-if="parsedData !== null" class="text-[10px] text-pd-success">
              ● RENDERED
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <!-- Expand Level Control -->
            <div class="mr-1 flex gap-0.5 items-center">
              <button
                class="text-[10px] px-1.5 py-0.5 rounded-[2px] cursor-pointer transition-all" :class="[
                  expandLevel === 0
                    ? 'bg-pd-accent-muted text-pd-accent border border-pd-accent/20'
                    : 'text-pd-text-disabled hover:text-pd-text-muted border border-transparent',
                ]"
                title="Collapse all"
                @click="expandLevel = 0"
              >
                <ChevronRight class="h-3 w-3" :stroke-width="1.5" />
              </button>
              <button
                v-for="lvl in [1, 2, 3, 5]"
                :key="lvl"
                class="text-[10px] px-1.5 py-0.5 rounded-[2px] cursor-pointer transition-all" :class="[
                  expandLevel === lvl
                    ? 'bg-pd-accent-muted text-pd-accent border border-pd-accent/20'
                    : 'text-pd-text-disabled hover:text-pd-text-muted border border-transparent',
                ]"
                :title="`Expand to level ${lvl}`"
                @click="expandLevel = lvl"
              >
                {{ lvl }}
              </button>
              <button
                class="text-[10px] px-1.5 py-0.5 rounded-[2px] cursor-pointer transition-all" :class="[
                  expandLevel === Infinity
                    ? 'bg-pd-accent-muted text-pd-accent border border-pd-accent/20'
                    : 'text-pd-text-disabled hover:text-pd-text-muted border border-transparent',
                ]"
                title="Expand all"
                @click="expandLevel = Infinity"
              >
                <ChevronDown class="h-3 w-3" :stroke-width="1.5" />
              </button>
            </div>

            <div class="mx-1 bg-pd-border h-4 w-px" />

            <button
              :disabled="!parsedData"
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Pretty-print JSON"
              @click="handleFormat"
            >
              <Maximize2 class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Format
            </button>
            <button
              :disabled="!parsedData"
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Minify JSON"
              @click="handleMinify"
            >
              <Minimize2 class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Minify
            </button>
            <button
              :disabled="!parsedData"
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Copy formatted JSON"
              @click="handleCopy"
            >
              <component
                :is="copied ? Check : Copy"
                class="mr-1 h-3 w-3 inline" :class="[copied ? 'text-pd-success' : '']"
                :stroke-width="1.5"
              />
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>

        <!-- JSON Tree Viewer -->
        <div
          class="custom-scrollbar p-4 flex-1 min-h-0 w-full relative overflow-auto"
        >
          <template v-if="parsedData !== null">
            <VueJsonPretty
              :data="parsedData"
              :deep="expandLevel"
              :show-length="true"
              :show-line="false"
              :show-double-quotes="true"
              :show-icon="true"
            />
          </template>
          <template v-else>
            <div class="flex flex-col h-full items-center justify-center">
              <div
                class="p-4 border border-pd-border rounded-[2px] border-dashed flex flex-col gap-3 items-center"
              >
                <Braces class="text-pd-text-disabled h-8 w-8" :stroke-width="0.8" />
                <span class="text-[10px] text-pd-text-disabled tracking-widest uppercase">
                  Awaiting valid JSON input
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- Stats Footer -->
        <div
          v-if="parsedData !== null"
          class="text-[10px] text-pd-text-muted px-4 py-2 border-t border-pd-border bg-pd-bg-subtle/30 flex gap-4 items-center"
        >
          <span>
            KEYS: <span class="text-pd-text">{{ stats.keys }}</span>
          </span>
          <span>
            DEPTH: <span class="text-pd-text">{{ stats.depth }}</span>
          </span>
          <span>
            SIZE: <span class="text-pd-text">{{ stats.size }}</span>
          </span>
          <span>
            TYPE:
            <span class="text-pd-accent uppercase">
              {{ dataType }}
            </span>
          </span>
        </div>
      </div>
    </main>
  </div>
</template>
