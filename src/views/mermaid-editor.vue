<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FileCode2,
  GitBranch,
  Maximize2,
  Minimize2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import {
  getMermaidParseError,
  initMermaid,
  renderMermaid,
  updateMermaidTheme,
} from '@/lib/mermaid'

// ── Mermaid Source Code ───────────────────────────────────────────
const mermaidSource = ref('')
const parseError = ref<string | null>(null)
const copied = ref(false)
const isValid = ref(false)

// ── Preview State ─────────────────────────────────────────────
const renderedSvg = shallowRef<string>('')
const renderId = ref(0)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStartX = ref(0)
const panStartY = ref(0)
const isFullscreen = ref(false)
const previewContainerRef = ref<HTMLElement | null>(null)

// ── Split Pane ────────────────────────────────────────────────
const leftWidth = ref(45)
const isDragging = ref(false)
const isDesktop = ref(false)

const leftPanelStyle = computed(() => (isDesktop.value
  ? { width: `${leftWidth.value}%`, flex: `0 0 ${leftWidth.value}%` }
  : {}))
const rightPanelStyle = computed(() => ((isDesktop.value && !isFullscreen.value)
  ? { width: `${100 - leftWidth.value}%`, flex: `0 0 ${100 - leftWidth.value}%` }
  : {}))

// ── Monaco Editor ─────────────────────────────────────────────
const editorContainer = ref<HTMLElement | null>(null)
let editor: any = null
let monacoInstance: any = null

// ── Sample Mermaid ────────────────────────────────────────────
const SAMPLE_MERMAID = `flowchart TD
    A[Pandora Toolbox] --> B[Image Tools]
    A --> C[Data Tools]
    A --> D[Dev Tools]
    A --> E[Document Tools]

    B --> B1[Image Processor]
    B --> B2[Image Converter]
    B --> B3[PDF to Image]

    C --> C1[JSON Viewer]
    C --> C2[Data Parser]
    C --> C3[Text Codec]

    D --> D1[Dev Toolkit]
    D --> D2[SVG Editor]

    E --> E1[Mermaid Editor]
    E --> E2[Resume Builder]

    style A fill:#e94560,stroke:#333,stroke-width:2px
    style E1 fill:#bbf,stroke:#f66,stroke-width:2px`

// ── Debounced Render ──────────────────────────────────────────
let renderTimer: ReturnType<typeof setTimeout> | null = null

async function processMermaid(code: string) {
  if (!code.trim()) {
    renderedSvg.value = ''
    parseError.value = null
    isValid.value = false
    return
  }

  // Validate syntax
  const error = await getMermaidParseError(code)
  if (error) {
    parseError.value = error
    isValid.value = false
    renderedSvg.value = ''
    return
  }

  parseError.value = null
  isValid.value = true

  // Render SVG
  renderId.value++
  const svg = await renderMermaid(`mermaid-diagram-${renderId.value}`, code)
  renderedSvg.value = svg
}

watch(mermaidSource, (newVal) => {
  if (renderTimer)
    clearTimeout(renderTimer)
  renderTimer = setTimeout(() => processMermaid(newVal), 300)
})

// ── Stats ─────────────────────────────────────────────────────
const stats = computed(() => {
  if (!mermaidSource.value.trim())
    return { lines: 0, size: '0 B' }
  const lines = mermaidSource.value.split('\n').filter(l => l.trim()).length
  const bytes = new Blob([mermaidSource.value]).size
  return { lines, size: formatBytes(bytes) }
})

function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

// ── Actions ───────────────────────────────────────────────────
function handleLoadSample() {
  mermaidSource.value = SAMPLE_MERMAID
  syncEditorValue()
}

function handleClear() {
  mermaidSource.value = ''
  parseError.value = null
  isValid.value = false
  renderedSvg.value = ''
  syncEditorValue()
}

async function handleCopy() {
  if (!mermaidSource.value)
    return
  await navigator.clipboard.writeText(mermaidSource.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function handlePaste() {
  try {
    let text = await navigator.clipboard.readText()
    if (text.trim()) {
      // Auto-strip markdown mermaid code block markers
      // Matches: ```mermaid ... ``` or ``` ... ```
      const codeBlockMatch = text.match(/^```(?:mermaid)?\n([\s\S]*?)\n?```$/m)
      if (codeBlockMatch && codeBlockMatch[1]) {
        text = codeBlockMatch[1]
      }
      mermaidSource.value = text
      syncEditorValue()
    }
  }
  catch (e) {
    console.error('Failed to read clipboard', e)
  }
}

// ── File Upload ───────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)

function handleUploadClick() {
  fileInputRef.value?.click()
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (content) {
      mermaidSource.value = content
      syncEditorValue()
    }
  }
  reader.readAsText(file)
  target.value = ''
}

// ── Export ───────────────────────────────────────────────────
function exportSVG() {
  if (!renderedSvg.value)
    return
  const blob = new Blob([renderedSvg.value], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mermaid-diagram.svg'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Zoom Controls ─────────────────────────────────────────────
function handleZoomIn() {
  zoom.value = zoom.value * 1.2
}

function handleZoomOut() {
  zoom.value = Math.max(zoom.value / 1.2, 0.1)
}

function handleZoomReset() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

// ── Pan Controls ──────────────────────────────────────────────
function handlePreviewMouseDown(e: MouseEvent) {
  if (e.button === 0) { // Left click to pan
    isPanning.value = true
    panStartX.value = e.clientX - panX.value
    panStartY.value = e.clientY - panY.value
    e.preventDefault()
  }
}

function handlePreviewMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    panX.value = e.clientX - panStartX.value
    panY.value = e.clientY - panStartY.value
  }
}

function handlePreviewMouseUp() {
  isPanning.value = false
}

// ── Wheel Zoom ─────────────────────────────────────────────────
function handleWheel(e: WheelEvent) {
  if (!renderedSvg.value)
    return
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    zoom.value = Math.max(zoom.value * delta, 0.1)
  }
}

// ── Fullscreen ────────────────────────────────────────────────
function toggleFullscreen() {
  if (!previewContainerRef.value)
    return

  if (!document.fullscreenElement) {
    previewContainerRef.value.requestFullscreen()
    isFullscreen.value = true
  }
  else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// ── Split Pane ────────────────────────────────────────────────
function onDividerMouseDown(e: MouseEvent) {
  if (!isDesktop.value)
    return
  isDragging.value = true
  e.preventDefault()
}

function onDividerMouseMove(e: MouseEvent) {
  if (!isDragging.value)
    return
  const container = document.getElementById('mermaid-split-container')
  if (!container)
    return
  const rect = container.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  leftWidth.value = Math.min(Math.max(pct, 20), 80)
}

function onDividerMouseUp() {
  isDragging.value = false
}

function updateViewportMode() {
  isDesktop.value = window.innerWidth >= 960
  if (!isDesktop.value)
    isDragging.value = false
}

// ── Monaco Sync ───────────────────────────────────────────────
function syncEditorValue() {
  if (editor && monacoInstance && mermaidSource.value !== editor.getValue()) {
    const model = editor.getModel()
    if (model) {
      editor.pushUndoStop()
      editor.executeEdits('external-sync', [{
        range: model.getFullModelRange(),
        text: mermaidSource.value,
      }])
      editor.pushUndoStop()
    }
    else {
      editor.setValue(mermaidSource.value)
    }
  }
}

// ── Theme Sync ────────────────────────────────────────────────
const observer = ref<MutationObserver | null>(null)

function updateTheme() {
  const isDark = document.documentElement.classList.contains('dark')
  updateMermaidTheme(isDark ? 'dark' : 'default')
  if (monacoInstance && editor) {
    monacoInstance.editor.setTheme(isDark ? 'vs-dark' : 'vs')
  }
  // Re-render current diagram with new theme
  if (mermaidSource.value.trim()) {
    processMermaid(mermaidSource.value)
  }
}

// ── Monaco Init ───────────────────────────────────────────────
onMounted(async () => {
  if (typeof window === 'undefined')
    return

  updateViewportMode()
  window.addEventListener('mousemove', onDividerMouseMove)
  window.addEventListener('mousemove', handlePreviewMouseMove)
  window.addEventListener('mouseup', onDividerMouseUp)
  window.addEventListener('mouseup', handlePreviewMouseUp)
  window.addEventListener('resize', updateViewportMode)
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  // Initialize Mermaid
  const isDark = document.documentElement.classList.contains('dark')
  initMermaid(isDark ? 'dark' : 'default')

  // Theme observer
  observer.value = new MutationObserver(() => {
    updateTheme()
  })
  observer.value.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  nextTick(() => {
    // Auto-load sample after a short delay
    setTimeout(() => {
      if (!mermaidSource.value) {
        handleLoadSample()
      }
    }, 100)
  })

  // Dynamically import Monaco
  try {
    // @ts-expect-error - editor.api doesn't have a specific type declaration
    const monaco = (await import('monaco-editor/esm/vs/editor/editor.api')) as any
    // @ts-expect-error - contribution files don't have types
    await import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution')

    monacoInstance = monaco

    if (editorContainer.value) {
      editor = monaco.editor.create(editorContainer.value, {
        value: mermaidSource.value,
        language: 'markdown',
        theme: isDark ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 22,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        padding: { top: 12, bottom: 12 },
        scrollbar: {
          verticalScrollbarSize: 4,
          horizontalScrollbarSize: 4,
        },
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        guides: {
          indentation: true,
          bracketPairs: true,
        },
      })

      editor.onDidChangeModelContent(() => {
        const value = editor?.getValue() || ''
        mermaidSource.value = value
      })
    }
  }
  catch (err) {
    console.error('Failed to load Monaco Editor:', err)
  }
})

onUnmounted(() => {
  editor?.dispose()
  observer.value?.disconnect()
  window.removeEventListener('mousemove', onDividerMouseMove)
  window.removeEventListener('mousemove', handlePreviewMouseMove)
  window.removeEventListener('mouseup', onDividerMouseUp)
  window.removeEventListener('mouseup', handlePreviewMouseUp)
  window.removeEventListener('resize', updateViewportMode)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col min-h-screen selection:text-pd-bg selection:bg-pd-accent md:h-screen"
  >
    <!-- Header -->
    <header
      class="px-4 border-b border-pd-border bg-pd-bg/80 flex h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md md:px-6"
    >
      <div class="flex gap-3 min-w-0 items-center md:gap-4">
        <router-link
          to="/"
          class="text-pd-text-muted flex gap-2 transition-colors items-center hover:text-pd-accent"
        >
          <ArrowLeft class="h-4 w-4" :stroke-width="1.5" />
          <span class="text-xs tracking-widest hidden uppercase md:inline">Back</span>
        </router-link>
        <div class="bg-pd-border h-5 w-px" />
        <div class="flex gap-2 items-center">
          <div class="p-1.5 border border-pd-accent/20 rounded-[2px] bg-pd-accent-muted">
            <GitBranch class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Mermaid<span class="text-pd-text-muted">///Editor</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex shrink-0 gap-2 items-center md:gap-3">
        <template v-if="mermaidSource && !parseError">
          <span
            class="text-pd-success px-2 py-0.5 border border-pd-success/20 rounded-[2px] bg-pd-success-muted hidden md:inline"
          >
            VALID
          </span>
          <span class="hidden lg:inline">
            {{ stats.lines }} lines · {{ stats.size }}
          </span>
          <div class="mx-1 bg-pd-border h-3 w-px hidden md:block" />
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
      id="mermaid-split-container"
      class="flex flex-1 min-h-0"
      :class="[
        isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto',
        { 'select-none': isDragging },
      ]"
    >
      <!-- Left Panel: Code Editor -->
      <div
        class="border-r border-pd-border flex flex-col min-h-[50vh] min-w-0 overflow-hidden"
        :class="isDesktop ? 'flex-none border-b-0 min-h-0' : 'w-full border-b'"
        :style="leftPanelStyle"
      >
        <!-- Editor Toolbar -->
        <div class="px-3 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex flex-wrap gap-2 items-center justify-between md:px-4">
          <div class="flex flex-wrap gap-1 items-center justify-end">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              SOURCE
            </span>
            <span class="text-[10px] text-pd-text-disabled">
              Mermaid Syntax
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Paste from clipboard"
              @click="handlePaste"
            >
              <ClipboardPaste class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Paste
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Load sample diagram"
              @click="handleLoadSample"
            >
              <FileCode2 class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Sample
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Upload .mmd file"
              @click="handleUploadClick"
            >
              <Upload class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Upload
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Copy source code"
              @click="handleCopy"
            >
              <component
                :is="copied ? Check : Copy"
                class="mr-1 h-3 w-3 inline"
                :class="[copied ? 'text-pd-success' : '']"
                :stroke-width="1.5"
              />
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-danger hover:border-pd-danger/20 hover:bg-pd-danger/5"
              title="Clear editor"
              @click="handleClear"
            >
              <Eraser class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Clear
            </button>
          </div>
        </div>

        <!-- Monaco Editor Container -->
        <div class="flex-1 min-h-0 relative overflow-hidden">
          <div ref="editorContainer" class="h-full w-full" />

          <!-- Empty State Overlay -->
          <div
            v-if="!mermaidSource"
            class="bg-pd-bg flex flex-col pointer-events-none items-center inset-0 justify-center absolute"
          >
            <GitBranch class="text-pd-border mb-4 h-16 w-16" :stroke-width="0.5" />
            <p class="text-xs text-pd-text-disabled tracking-widest mb-1 uppercase">
              No diagram loaded
            </p>
            <p class="text-[10px] text-pd-text-disabled">
              Click "Sample" or "Paste" to start
            </p>
          </div>
        </div>

        <!-- Parse Error Bar -->
        <div
          v-if="parseError"
          class="px-4 py-3 border-t border-pd-danger/20 bg-pd-danger/5 flex gap-2 items-start"
        >
          <FileCode2 class="text-pd-danger mt-0.5 shrink-0 h-4 w-4" :stroke-width="1.5" />
          <div class="flex-1 min-w-0">
            <p class="text-[10px] text-pd-danger tracking-wider font-bold mb-1 uppercase">
              Syntax Error
            </p>
            <p class="text-xs text-pd-danger/80 leading-relaxed break-all line-clamp-2">
              {{ parseError }}
            </p>
          </div>
        </div>

        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept=".mmd,.mermaid,text/markdown"
          class="hidden"
          @change="handleFileUpload"
        >
      </div>

      <!-- Divider -->
      <div
        v-if="isDesktop"
        class="group bg-pd-border/40 shrink-0 w-1 cursor-col-resize transition-colors relative hover:bg-pd-accent/40"
        title="Drag to resize"
        @mousedown="onDividerMouseDown"
      >
        <div
          class="bg-pd-border w-px transition-colors inset-y-0 left-1/2 absolute group-hover:bg-pd-accent/60 -translate-x-1/2"
        />
      </div>

      <!-- Right Panel: Preview -->
      <div
        ref="previewContainerRef"
        class="flex flex-1 flex-col min-h-[50vh] min-w-0 overflow-hidden"
        :class="[isDesktop ? 'flex-none min-h-0' : 'w-full', { 'bg-pd-bg': isFullscreen }]"
        :style="rightPanelStyle"
      >
        <!-- Preview Toolbar -->
        <div class="px-3 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex flex-wrap gap-2 items-center justify-between md:px-4">
          <div class="flex flex-wrap gap-1 items-center justify-end">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              PREVIEW
            </span>
            <span v-if="renderedSvg" class="text-[10px] text-pd-success">
              ● RENDERED
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <!-- Zoom Controls -->
            <button
              class="text-pd-text-muted p-1.5 rounded-[2px] cursor-pointer transition-all hover:text-pd-accent hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Zoom Out"
              :disabled="!renderedSvg"
              @click="handleZoomOut"
            >
              <ZoomOut class="h-3.5 w-3.5" :stroke-width="1.5" />
            </button>
            <button
              class="text-[10px] text-pd-text-muted px-1.5 py-1 text-center rounded-[2px] min-w-[48px] cursor-pointer transition-all tabular-nums hover:text-pd-accent hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Reset Zoom"
              :disabled="!renderedSvg"
              @click="handleZoomReset"
            >
              {{ zoomPercent }}
            </button>
            <button
              class="text-pd-text-muted p-1.5 rounded-[2px] cursor-pointer transition-all hover:text-pd-accent hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Zoom In"
              :disabled="!renderedSvg"
              @click="handleZoomIn"
            >
              <ZoomIn class="h-3.5 w-3.5" :stroke-width="1.5" />
            </button>

            <div class="mx-1 bg-pd-border h-4 w-px" />

            <!-- Fullscreen -->
            <button
              class="text-pd-text-muted p-1.5 rounded-[2px] cursor-pointer transition-all hover:text-pd-accent hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
              :disabled="!renderedSvg"
              @click="toggleFullscreen"
            >
              <component
                :is="isFullscreen ? Minimize2 : Maximize2"
                class="h-3.5 w-3.5"
                :stroke-width="1.5"
              />
            </button>

            <div class="mx-1 bg-pd-border h-4 w-px" />

            <!-- Export SVG -->
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="!renderedSvg"
              @click="exportSVG"
            >
              <Download class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Export SVG
            </button>
          </div>
        </div>

        <!-- Preview Area -->
        <div
          class="bg-pd-bg-subtle/30 flex-1 min-h-0 relative overflow-hidden"
          :class="[
            isPanning ? 'cursor-grabbing' : renderedSvg ? 'cursor-grab' : '',
          ]"
          @mousedown="handlePreviewMouseDown"
          @wheel.prevent="handleWheel"
        >
          <div
            v-show="renderedSvg"
            class="flex h-full w-full items-center justify-center"
          >
            <div
              class="mermaid-preview-container"
              :style="{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              }"
              v-html="renderedSvg"
            />
          </div>

          <!-- Empty Preview State -->
          <template v-if="!renderedSvg && !parseError">
            <div class="flex flex-col h-full items-center justify-center">
              <div
                class="p-6 border border-pd-border rounded-[2px] border-dashed flex flex-col gap-3 items-center"
              >
                <GitBranch class="text-pd-text-disabled h-10 w-10" :stroke-width="0.8" />
                <span class="text-[10px] text-pd-text-disabled tracking-widest uppercase">
                  Preview Ready
                </span>
                <span class="text-[10px] text-pd-text-disabled">
                  Write Mermaid code to render
                </span>
              </div>
            </div>
          </template>

          <!-- Error State -->
          <template v-if="parseError && mermaidSource">
            <div class="flex flex-col h-full items-center justify-center">
              <div
                class="p-6 border border-pd-danger/20 rounded-[2px] bg-pd-danger/5 flex flex-col gap-3 items-center"
              >
                <FileCode2 class="text-pd-danger h-10 w-10" :stroke-width="0.8" />
                <span class="text-[10px] text-pd-danger tracking-widest uppercase">
                  Syntax Error
                </span>
                <span class="text-[10px] text-pd-text-disabled">
                  Fix the code to see preview
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- Preview Footer -->
        <div
          class="text-[10px] text-pd-text-muted px-4 py-2 border-t border-pd-border bg-pd-bg-subtle/30 flex gap-4 items-center justify-between"
        >
          <div class="flex gap-4">
            <span>
              ZOOM: <span class="text-pd-text tabular-nums">{{ zoomPercent }}</span>
            </span>
            <span>
              PAN: <span class="text-pd-text tabular-nums">{{ Math.round(panX) }}, {{ Math.round(panY) }}</span>
            </span>
          </div>
          <div class="flex gap-4">
            <span v-if="isValid">
              STATUS: <span class="text-pd-success uppercase">VALID</span>
            </span>
            <span v-else-if="parseError">
              STATUS: <span class="text-pd-danger uppercase">INVALID</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.mermaid-preview-container :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  display: block;
  border-radius: 2px;
}
</style>
