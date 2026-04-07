<script setup lang="ts">
import * as fabric from 'fabric'
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FileCode2,
  Image,
  Maximize2,
  PenTool,
  Redo,
  Undo,
  Upload,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

// ── SVG Source Code ───────────────────────────────────────────
const svgSource = ref('')
const parseError = ref<string | null>(null)
const copied = ref(false)

// ── Preview State ─────────────────────────────────────────────
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStartX = ref(0)
const panStartY = ref(0)
const showGrid = ref(true)
const fabricCanvasRef = ref<HTMLCanvasElement | null>(null)
const fabricCanvas = shallowRef<fabric.Canvas | null>(null)
let lastGeneratedSvg = ''
const originalWidth = ref(800)
const originalHeight = ref(600)

// ── Split Pane ────────────────────────────────────────────────
const leftWidth = ref(45)
const isDragging = ref(false)
const isDesktop = ref(false)

const leftPanelStyle = computed(() => (isDesktop.value
  ? { width: `${leftWidth.value}%`, flex: `0 0 ${leftWidth.value}%` }
  : {}))
const rightPanelStyle = computed(() => (isDesktop.value
  ? { width: `${100 - leftWidth.value}%`, flex: `0 0 ${100 - leftWidth.value}%` }
  : {}))

// ── Monaco Editor ─────────────────────────────────────────────
const editorContainer = ref<HTMLElement | null>(null)
let editor: any = null
let monacoInstance: any = null

// ── Sample SVG ────────────────────────────────────────────────
const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0f3460;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#e2e2e2;stop-opacity:1" />
      <stop offset="60%" style="stop-color:#c4c4c4;stop-opacity:0.6" />
      <stop offset="100%" style="stop-color:#c4c4c4;stop-opacity:0" />
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Sky -->
  <rect width="800" height="600" fill="url(#skyGrad)" />

  <!-- Stars -->
  <g fill="#ffffff" opacity="0.8">
    <circle cx="120" cy="80" r="1.5" />
    <circle cx="250" cy="45" r="1" />
    <circle cx="380" cy="120" r="1.8" />
    <circle cx="500" cy="60" r="1.2" />
    <circle cx="620" cy="95" r="1.5" />
    <circle cx="700" cy="40" r="1" />
    <circle cx="180" cy="160" r="1.3" />
    <circle cx="450" cy="180" r="1" />
    <circle cx="580" cy="150" r="1.6" />
    <circle cx="75" cy="200" r="1.2" />
    <circle cx="340" cy="30" r="1.4" />
    <circle cx="680" cy="170" r="1.1" />
  </g>

  <!-- Moon -->
  <circle cx="650" cy="120" r="60" fill="url(#moonGlow)" filter="url(#glow)" />
  <circle cx="650" cy="120" r="45" fill="#e2e2e2" />
  <circle cx="635" cy="108" r="8" fill="#c8c8c8" opacity="0.5" />
  <circle cx="660" cy="130" r="5" fill="#c8c8c8" opacity="0.4" />
  <circle cx="645" cy="140" r="3" fill="#c8c8c8" opacity="0.3" />

  <!-- Mountains -->
  <polygon points="0,450 150,280 300,450" fill="#0f3460" opacity="0.8" />
  <polygon points="200,450 400,250 600,450" fill="#16213e" opacity="0.9" />
  <polygon points="450,450 650,300 800,450" fill="#0f3460" opacity="0.7" />

  <!-- Ground -->
  <rect x="0" y="440" width="800" height="160" fill="url(#groundGrad)" />

  <!-- Trees -->
  <g fill="#0a1628">
    <polygon points="100,440 115,340 130,440" />
    <polygon points="300,440 320,320 340,440" />
    <polygon points="550,440 565,360 580,440" />
    <polygon points="700,440 712,370 724,440" />
  </g>

  <!-- Title -->
  <text x="400" y="530" text-anchor="middle" fill="#e94560" font-family="monospace" font-size="28" font-weight="bold" filter="url(#glow)">
    PANDORA SVG EDITOR
  </text>
  <text x="400" y="560" text-anchor="middle" fill="#a1a1aa" font-family="monospace" font-size="12">
    Edit · Preview · Export — All in your browser
  </text>
</svg>`

// ── Parse & Validate ──────────────────────────────────────────
function validateSvgSync(code: string) {
  if (!code.trim()) {
    parseError.value = null
    return true
  }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(code, 'image/svg+xml')
    const errorNode = doc.querySelector('parsererror')
    if (errorNode) {
      parseError.value = errorNode.textContent || 'Invalid SVG markup'
      return false
    }
    parseError.value = null
    return true
  }
  catch (e) {
    parseError.value = e instanceof Error ? e.message : 'Invalid SVG'
    return false
  }
}

watch(svgSource, async (newVal) => {
  if (newVal === lastGeneratedSvg)
    return

  if (!validateSvgSync(newVal)) {
    return
  }

  if (fabricCanvas.value && newVal.trim()) {
    try {
      // Preprocess SVG: Fabric does not support <mask ...> well, but it fully supports <clipPath>
      // Most simple vector masks can be perfectly approximated by converting them to clipPaths.
      const safeSvg = newVal
        .replace(/<mask/gi, '<clipPath')
        .replace(/<\/mask>/gi, '</clipPath>')
        .replace(/\smask=(["'])/gi, ' clip-path=$1')
        .replace(/style="mask-type:[^"]*"/gi, '')

      const { objects, options } = await fabric.loadSVGFromString(safeSvg)
      // Guard against race conditions where the user types rapidly
      if (svgSource.value !== newVal)
        return

      fabricCanvas.value.clear()
      if (objects && objects.length) {
        // Extract dimensions from the loaded SVG options
        let width = options?.width
        let height = options?.height

        if (options?.viewBox) {
          if (!width || width === 0)
            width = options.viewBox.width
          if (!height || height === 0)
            height = options.viewBox.height
        }

        // Fallback to defaults
        width = width || 800
        height = height || 600

        const isNewSize = originalWidth.value !== width || originalHeight.value !== height
        originalWidth.value = width
        originalHeight.value = height

        if (isNewSize) {
          const container = document.getElementById('svg-split-container')
          if (container) {
            const rect = container.getBoundingClientRect()
            const availableWidth = rect.width * (100 - leftWidth.value) / 100 - 40
            const availableHeight = rect.height - 100 // roughly account for headers
            const scaleX = availableWidth / width
            const scaleY = availableHeight / height
            const initialZoom = Math.min(scaleX, scaleY) * 0.9 // 90% fit
            zoom.value = Math.min(Math.max(initialZoom, 0.1), 30)
          }
          else {
            zoom.value = 1
          }
          panX.value = 0
          panY.value = 0
        }

        // Resize the canvas natively to the current zoom level to avoid pixelation
        fabricCanvas.value.setDimensions({
          width: width * zoom.value,
          height: height * zoom.value,
        })
        fabricCanvas.value.setZoom(zoom.value)

        // Add objects directly so they map 1-to-1 to what's in the canvas individually
        const validObjects = objects.filter((o): o is fabric.FabricObject => !!o)
        fabricCanvas.value.add(...validObjects)
        fabricCanvas.value.renderAll()
      }
    }
    catch (e) {
      console.warn('Fabric parsing error', e)
    }
  }
  else if (fabricCanvas.value) {
    fabricCanvas.value.clear()
  }
})

// ── SVG Stats ─────────────────────────────────────────────────
const svgStats = computed(() => {
  if (!svgSource.value.trim())
    return { elements: 0, size: '0 B' }
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgSource.value, 'image/svg+xml')
  if (doc.querySelector('parsererror'))
    return { elements: 0, size: '0 B' }
  const elements = doc.querySelectorAll('*').length
  const bytes = new Blob([svgSource.value]).size
  return {
    elements,
    size: formatBytes(bytes),
  }
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
  svgSource.value = SAMPLE_SVG
  syncEditorValue()
}

function handleClear() {
  svgSource.value = ''
  parseError.value = null
  syncEditorValue()
}

async function handleCopy() {
  if (!svgSource.value)
    return
  await navigator.clipboard.writeText(svgSource.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function handleFormat() {
  if (!svgSource.value.trim())
    return
  // Simple XML formatter
  let formatted = ''
  let indent = 0
  const lines = svgSource.value
    .replace(/>\s*</g, '>\n<')
    .split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line)
      continue

    // Closing tag
    if (line.startsWith('</')) {
      indent = Math.max(0, indent - 1)
    }

    formatted += `${'  '.repeat(indent) + line}\n`

    // Opening tag (not self-closing, not closing)
    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.includes('</')) {
      indent++
    }
  }

  svgSource.value = formatted.trim()
  syncEditorValue()
}

// ── File Upload & Paste ───────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText()
    if (!text)
      return
    let svgText = text.trim()

    if (svgText.startsWith('data:image/svg+xml;base64,')) {
      const base64 = svgText.split(',')[1]
      if (base64) {
        svgText = decodeURIComponent(escape(atob(base64)))
      }
    }
    else if (svgText.startsWith('data:image/svg+xml;utf8,')) {
      const utf8Str = svgText.split(',')[1]
      if (utf8Str) {
        svgText = decodeURIComponent(utf8Str)
      }
    }

    if (!svgText.includes('<svg')) {
      console.warn('Clipboard does not contain a valid SVG')
      return
    }

    svgSource.value = svgText
    syncEditorValue()
  }
  catch (e) {
    console.error('Failed to read clipboard', e)
  }
}

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
      svgSource.value = content
      syncEditorValue()
    }
  }
  reader.readAsText(file)
  target.value = '' // Reset input
}

// ── Export ───────────────────────────────────────────────────
const showExportMenu = ref(false)

function toggleExportMenu() {
  showExportMenu.value = !showExportMenu.value
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('#export-menu-container')) {
    showExportMenu.value = false
  }
}

function exportSVG() {
  if (!svgSource.value)
    return
  const blob = new Blob([svgSource.value], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pandora-export.svg'
  a.click()
  URL.revokeObjectURL(url)
}

function exportPNG() {
  if (!fabricCanvasRef.value)
    return
  const dataUrl = fabricCanvasRef.value.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'pandora-export.png'
  a.click()
}

// ── Undo & Redo ───────────────────────────────────────────────
function handleUndo() {
  if (editor) {
    editor.focus()
    editor.trigger('keyboard', 'undo', null)
  }
}

function handleRedo() {
  if (editor) {
    editor.focus()
    editor.trigger('keyboard', 'redo', null)
  }
}

function syncCanvasToEditor() {
  if (fabricCanvas.value) {
    const currentZoom = fabricCanvas.value.getZoom()
    const { width, height } = fabricCanvas.value

    // Temporarily reset to 1x to ensure the exported coordinates match the original document size
    fabricCanvas.value.setZoom(1)
    fabricCanvas.value.setDimensions({ width: originalWidth.value, height: originalHeight.value })

    const genSVG = fabricCanvas.value.toSVG({
      viewBox: {
        x: 0,
        y: 0,
        width: originalWidth.value,
        height: originalHeight.value,
      },
      width: `${originalWidth.value}`,
      height: `${originalHeight.value}`,
    })

    // Restore viewport seamlessly
    fabricCanvas.value.setDimensions({ width, height })
    fabricCanvas.value.setZoom(currentZoom)

    if (genSVG) {
      lastGeneratedSvg = genSVG
      svgSource.value = genSVG
      syncEditorValue()
    }
  }
}

// Global Keyboard Shortcuts
function handleKeyDown(e: KeyboardEvent) {
  // If Monaco is focused, let it handle its own shortcuts
  if (editor && editor.hasTextFocus()) {
    return
  }

  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

  if (cmdOrCtrl) {
    // Redo: (Ctrl+Y or Cmd+Shift+Z)
    if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault()
      handleRedo()
      return
    }
    // Undo: (Ctrl+Z)
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      handleUndo()
      return
    }
  }

  // Delete active canvas items when Delete/Backspace is pressed
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const target = e.target as HTMLElement
    if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') {
      return
    }

    if (fabricCanvas.value) {
      const activeObjects = fabricCanvas.value.getActiveObjects()
      if (activeObjects.length > 0) {
        e.preventDefault()
        activeObjects.forEach(obj => fabricCanvas.value?.remove(obj))
        fabricCanvas.value.discardActiveObject()
        syncCanvasToEditor()
      }
    }
  }
}

// ── Fabric Init ───────────────────────────────────────────────
function initFabric() {
  if (!fabricCanvasRef.value)
    return

  fabricCanvas.value = new fabric.Canvas(fabricCanvasRef.value, {
    width: 800,
    height: 600,
    preserveObjectStacking: true,
  })

  fabricCanvas.value.on('object:modified', syncCanvasToEditor)
}

// ── Zoom & Pan ────────────────────────────────────────────────
function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    zoom.value = Math.min(Math.max(zoom.value * delta, 0.1), 30)
  }
  else {
    // Pan
    panX.value -= e.deltaX
    panY.value -= e.deltaY
  }
}

watch(zoom, (newZoom) => {
  if (fabricCanvas.value) {
    fabricCanvas.value.setDimensions({
      width: originalWidth.value * newZoom,
      height: originalHeight.value * newZoom,
    })
    fabricCanvas.value.setZoom(newZoom)
  }
})

// Pan interactions with CSS transform
function handleCanvasMouseDown(e: MouseEvent) {
  if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle click or shift+left to pan
    isPanning.value = true
    panStartX.value = e.clientX - panX.value
    panStartY.value = e.clientY - panY.value
    e.preventDefault()
  }
}

function handleCanvasMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    panX.value = e.clientX - panStartX.value
    panY.value = e.clientY - panStartY.value
  }
}

function handleCanvasMouseUp() {
  isPanning.value = false
}

// ── Split Pane ────────────────────────────────────────────────
function onDividerMouseDown(e: MouseEvent) {
  if (!isDesktop.value)
    return
  isDragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value)
    return
  const container = document.getElementById('svg-split-container')
  if (!container)
    return
  const rect = container.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  leftWidth.value = Math.min(Math.max(pct, 20), 80)
}

function onMouseUp() {
  isDragging.value = false
  isPanning.value = false
}

function updateViewportMode() {
  isDesktop.value = window.innerWidth >= 960
  if (!isDesktop.value)
    isDragging.value = false
}

// ── Monaco Sync ───────────────────────────────────────────────
function syncEditorValue() {
  if (editor && monacoInstance && svgSource.value !== editor.getValue()) {
    const model = editor.getModel()
    if (model) {
      editor.pushUndoStop()
      editor.executeEdits('canvas-sync', [{
        range: model.getFullModelRange(),
        text: svgSource.value,
      }])
      editor.pushUndoStop()
    }
    else {
      editor.setValue(svgSource.value)
    }
  }
}

// ── Monaco Init ───────────────────────────────────────────────
onMounted(async () => {
  if (typeof window === 'undefined')
    return

  updateViewportMode()
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', updateViewportMode)
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleDocumentClick)

  // Wait to ensure DOM elements are attached
  nextTick(() => {
    initFabric()

    // Auto-load sample to show off logic
    setTimeout(() => {
      if (!svgSource.value) {
        handleLoadSample()
      }
    }, 100)
  })

  // Dynamically import Monaco
  try {
    // @ts-expect-error - editor.api doesn't have a specific type declaration
    const monaco = (await import('monaco-editor/esm/vs/editor/editor.api')) as any
    // @ts-expect-error - contribution files don't have types
    await import('monaco-editor/esm/vs/basic-languages/xml/xml.contribution')

    monacoInstance = monaco

    if (editorContainer.value) {
      editor = monaco.editor.create(editorContainer.value, {
        value: svgSource.value,
        language: 'xml',
        theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs',
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
        svgSource.value = value
      })
    }
  }
  catch (err) {
    console.error('Failed to load Monaco Editor:', err)
  }
})

onUnmounted(() => {
  editor?.dispose()
  if (fabricCanvas.value) {
    fabricCanvas.value.dispose()
  }
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', updateViewportMode)
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleDocumentClick)
})

// Watch for theme changes to update Monaco
const observer = ref<MutationObserver | null>(null)
onMounted(() => {
  if (typeof window === 'undefined')
    return
  observer.value = new MutationObserver(() => {
    if (monacoInstance && editor) {
      const isDark = document.documentElement.classList.contains('dark')
      monacoInstance.editor.setTheme(isDark ? 'vs-dark' : 'vs')
    }
  })
  observer.value.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onUnmounted(() => {
  observer.value?.disconnect()
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
            <PenTool class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            SVG<span class="text-pd-text-muted">///Editor</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex shrink-0 gap-2 items-center md:gap-3">
        <template v-if="svgSource && !parseError">
          <span
            class="text-pd-success px-2 py-0.5 border border-pd-success/20 rounded-[2px] bg-pd-success-muted hidden md:inline"
          >
            VALID
          </span>
          <span class="hidden lg:inline">
            {{ svgStats.elements }} elements · {{ svgStats.size }}
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

    <!-- 修改后 -->
    <main
      id="svg-split-container"
      class="flex flex-1 min-h-0"
      :class="[
        isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto',
        { 'select-none': isDragging || isPanning },
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
              XML / SVG
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Paste SVG code or URL"
              @click="handlePaste"
            >
              <ClipboardPaste class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Paste
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Load sample SVG"
              @click="handleLoadSample"
            >
              <FileCode2 class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Sample
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Upload SVG file"
              @click="handleUploadClick"
            >
              <Upload class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Upload
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Format SVG code"
              @click="handleFormat"
            >
              <Maximize2 class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Format
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Copy SVG source"
              @click="handleCopy"
            >
              <component
                :is="copied ? Check : Copy"
                class="mr-1 h-3 w-3 inline" :class="[copied ? 'text-pd-success' : '']"
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
            v-if="!svgSource"
            class="bg-pd-bg flex flex-col pointer-events-none items-center inset-0 justify-center absolute"
          >
            <PenTool class="text-pd-border mb-4 h-16 w-16" :stroke-width="0.5" />
            <p class="text-xs text-pd-text-disabled tracking-widest mb-1 uppercase">
              No SVG loaded
            </p>
            <p class="text-[10px] text-pd-text-disabled">
              Click "Sample" or "Upload" to start editing
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
              SVG Parse Error
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
          accept=".svg,image/svg+xml"
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

      <!-- Right Panel: Preview Canvas -->
      <div
        class="flex flex-1 flex-col min-h-[50vh] min-w-0 overflow-hidden"
        :class="isDesktop ? 'flex-none min-h-0' : 'w-full'"
        :style="rightPanelStyle"
      >
        <!-- Preview Toolbar -->
        <div class="px-3 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex flex-wrap gap-2 items-center justify-between md:px-4">
          <div class="flex flex-wrap gap-1 items-center justify-end">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              PREVIEW
            </span>
            <span v-if="svgSource && !parseError" class="text-[10px] text-pd-success">
              ● RENDERED
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <!-- Undo / Redo -->
            <button
              class="text-pd-text-muted p-1.5 rounded-[2px] cursor-pointer transition-all hover:text-pd-accent hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Undo modification"
              @click="handleUndo"
            >
              <Undo class="h-3 w-3" :stroke-width="1.5" />
            </button>
            <button
              class="text-pd-text-muted p-1.5 rounded-[2px] cursor-pointer transition-all hover:text-pd-accent hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Redo modification"
              @click="handleRedo"
            >
              <Redo class="h-3 w-3" :stroke-width="1.5" />
            </button>

            <div class="mx-1 bg-pd-border h-4 w-px" />

            <!-- Export Dropdown -->
            <div id="export-menu-container" class="relative">
              <button
                class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
                :disabled="!svgSource || parseError !== null"
                @click.stop="toggleExportMenu"
              >
                <Download class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
                Export
              </button>
              <div
                v-if="showExportMenu"
                class="mt-1 border border-pd-border rounded-sm bg-pd-bg w-36 shadow-lg right-0 absolute z-50 overflow-hidden"
              >
                <button
                  class="text-[10px] text-pd-text-muted tracking-wider px-3 py-2 text-left flex gap-2 w-full cursor-pointer transition-all items-center hover:text-pd-accent hover:bg-pd-accent/5"
                  @click="exportSVG(); showExportMenu = false"
                >
                  <FileCode2 class="h-3 w-3" :stroke-width="1.5" />
                  Export SVG
                </button>
                <div class="bg-pd-border h-px" />
                <button
                  class="text-[10px] text-pd-text-muted tracking-wider px-3 py-2 text-left flex gap-2 w-full cursor-pointer transition-all items-center hover:text-pd-accent hover:bg-pd-accent/5"
                  @click="exportPNG(); showExportMenu = false"
                >
                  <Image class="h-3 w-3" :stroke-width="1.5" />
                  Export PNG
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Canvas Area -->
        <div
          class="flex-1 min-h-0 relative overflow-hidden"
          :class="[
            showGrid ? 'svg-canvas-grid' : 'bg-pd-bg-subtle/30',
            isPanning ? 'cursor-grabbing' : 'cursor-grab',
          ]"
          @wheel.prevent="handleWheel"
          @mousedown="handleCanvasMouseDown"
          @mousemove="handleCanvasMouseMove"
          @mouseup="handleCanvasMouseUp"
          @mouseleave="handleCanvasMouseUp"
        >
          <div
            v-show="svgSource && !parseError"
            class="p-8 flex h-full w-full items-center justify-center overflow-hidden"
          >
            <div
              class="will-change-transform relative"
              :style="{
                transform: `translate(${panX}px, ${panY}px)`,
                width: `${originalWidth * zoom}px`,
                height: `${originalHeight * zoom}px`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              }"
            >
              <canvas ref="fabricCanvasRef" class="h-full w-full block" />
            </div>
          </div>

          <!-- Empty Canvas State -->
          <template v-if="!svgSource && !parseError">
            <div class="flex flex-col h-full items-center justify-center">
              <div
                class="p-6 border border-pd-border rounded-[2px] border-dashed flex flex-col gap-3 items-center"
              >
                <PenTool class="text-pd-text-disabled h-10 w-10" :stroke-width="0.8" />
                <span class="text-[10px] text-pd-text-disabled tracking-widest uppercase">
                  Canvas Ready
                </span>
                <span class="text-[10px] text-pd-text-disabled">
                  Load SVG source to preview
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- Canvas Footer -->
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
            <span v-if="svgSource && !parseError">
              ELEMENTS: <span class="text-pd-text">{{ svgStats.elements }}</span>
            </span>
            <span v-if="svgSource && !parseError">
              SIZE: <span class="text-pd-text">{{ svgStats.size }}</span>
            </span>
            <span>
              GRID: <span class="text-pd-accent uppercase">{{ showGrid ? 'ON' : 'OFF' }}</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Transparent grid background for canvas */
.svg-canvas-grid {
  background-color: var(--pd-bg-subtle);
  background-image:
    linear-gradient(45deg, var(--pd-border) 25%, transparent 25%),
    linear-gradient(-45deg, var(--pd-border) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--pd-border) 75%),
    linear-gradient(-45deg, transparent 75%, var(--pd-border) 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  opacity: 1;
}

/* Make the SVG preview look good inside the container */
.svg-preview-container :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  display: block;
  border-radius: 2px;
  background: white;
}
</style>
