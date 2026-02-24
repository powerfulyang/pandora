<script setup lang="ts">
import type { ImageFormat } from '@/lib/image-processor'
import type { ImageWorkerAPI } from '@/lib/image.worker'
import type { ProcessingRecord } from '@/lib/storage'
import * as Comlink from 'comlink'
import {
  ArrowLeft,
  CheckCircle2,
  Crop as CropIcon,
  Download,
  Eye,
  History,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import HistoryPreview from '@/components/HistoryPreview.vue'
import Modal from '@/components/Modal.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { recordStorage } from '@/lib/storage'
import { downloadFile, formatBytes, hasActiveInputElement } from '@/utils'
import 'vue-advanced-cropper/dist/style.css'

const imgSrc = ref('')
const scaleRatio = ref(1)
const originalFile = ref<File | null>(null)
const format = ref<ImageFormat>('webp')
const quality = ref(80)
const isProcessing = ref(false)
const showSuccess = ref(false)

const previewUrl = ref<string | null>(null)
const previewBlob = ref<Blob | null>(null)
const isPreviewing = ref(false)
const previewSize = ref('')

// Aspect ratio
const aspect = ref<number | undefined>(undefined)
const isCustom = ref(false)
const presetGroup = ref<'common' | 'store'>('common')
const customAspectInput = ref('1:1')

// Output Scaling
const cropWidth = ref('')
const cropHeight = ref('')
const outputWidth = ref('')
const outputHeight = ref('')
const isOutputExpanded = ref(false)
const isUpdatingOutputFromCrop = ref(true)

// Cropper ref
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

// Worker
let worker: Worker | null = null
let workerApi: Comlink.Remote<ImageWorkerAPI> | null = null

// History Records
const historyRecords = ref<ProcessingRecord[]>([])
const showHistoryModal = ref(false)

// Undo/Redo State
const cropperHistoryStack = ref<any[]>([])
const historyIndex = ref(-1)
const isUndoRedoAction = ref(false)

const isInteracting = ref(false)
let pendingCoordinates: any = null

function pushToHistory(coordinates: any) {
  const currentStateStr = JSON.stringify(coordinates)
  const lastStateStr = historyIndex.value >= 0
    ? JSON.stringify(cropperHistoryStack.value[historyIndex.value])
    : null

  if (currentStateStr === lastStateStr)
    return

  if (historyIndex.value < cropperHistoryStack.value.length - 1) {
    cropperHistoryStack.value = cropperHistoryStack.value.slice(0, historyIndex.value + 1)
  }

  cropperHistoryStack.value.push(JSON.parse(currentStateStr))

  if (cropperHistoryStack.value.length > 50) {
    cropperHistoryStack.value.shift()
  }
  else {
    historyIndex.value++
  }
}

function onInteractionStart() {
  isInteracting.value = true
}

function onInteractionEnd() {
  if (isInteracting.value) {
    isInteracting.value = false
    if (pendingCoordinates) {
      pushToHistory(pendingCoordinates)
      pendingCoordinates = null
    }
  }
}

async function loadHistory() {
  historyRecords.value = await recordStorage.getRecords()
}

async function removeHistory(id: string) {
  await recordStorage.deleteRecord(id)
  loadHistory()
}

async function clearAllHistory() {
  await recordStorage.clearRecords()
  loadHistory()
}

onMounted(() => {
  worker = new Worker(
    new URL('../lib/image.worker.ts', import.meta.url),
    { type: 'module' },
  )
  workerApi = Comlink.wrap<ImageWorkerAPI>(worker)

  window.addEventListener('paste', handlePaste)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('pointerup', onInteractionEnd)
  window.addEventListener('pointercancel', onInteractionEnd)
  loadHistory()
})

onUnmounted(() => {
  worker?.terminate()
  window.removeEventListener('paste', handlePaste)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('pointerup', onInteractionEnd)
  window.removeEventListener('pointercancel', onInteractionEnd)
})

// File handling
function onSelectFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    if (file)
      handleFile(file)
  }
  input.value = ''
}

function clearImage() {
  imgSrc.value = ''
  scaleRatio.value = 1
  originalFile.value = null
  cropWidth.value = ''
  cropHeight.value = ''
  outputWidth.value = ''
  outputHeight.value = ''
  cropperHistoryStack.value = []
  historyIndex.value = -1
  isUndoRedoAction.value = false
  isInteracting.value = false
  pendingCoordinates = null
}

function handleFile(file: File) {
  clearImage()
  originalFile.value = file

  const reader = new FileReader()
  reader.addEventListener('load', () => {
    const dataUrl = reader.result?.toString() || ''

    // Scale large images to prevent performance issues
    const img = new Image()
    img.onload = () => {
      const MAX_SIZE = 2048
      if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
        const ratio = Math.max(img.width / MAX_SIZE, img.height / MAX_SIZE)
        scaleRatio.value = ratio

        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width / ratio)
        canvas.height = Math.round(img.height / ratio)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }

        let mimeType = file.type || 'image/png'
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          mimeType = 'image/png'
        }
        imgSrc.value = canvas.toDataURL(mimeType, 0.95)
      }
      else {
        imgSrc.value = dataUrl
      }
    }
    img.src = dataUrl
  })
  reader.readAsDataURL(file)
}

// DnD
function handleDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file && file.type.startsWith('image/')) {
      handleFile(file)
    }
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

// Paste
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items)
    return
  for (const item of items) {
    if (item.type.includes('image')) {
      const file = item.getAsFile()
      if (file) {
        handleFile(file)
        break
      }
    }
  }
}

// Keyboard
function handleKeyDown(e: KeyboardEvent) {
  if (hasActiveInputElement())
    return

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      redo()
    }
    else {
      undo()
    }
  }
}

function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    isUndoRedoAction.value = true
    cropperRef.value?.setCoordinates(cropperHistoryStack.value[historyIndex.value])
  }
}

function redo() {
  if (historyIndex.value < cropperHistoryStack.value.length - 1) {
    historyIndex.value++
    isUndoRedoAction.value = true
    cropperRef.value?.setCoordinates(cropperHistoryStack.value[historyIndex.value])
  }
}

// Cropper change handler
function onCropChange({ coordinates }: any) {
  if (!coordinates)
    return

  // Calculate proportional size based on scale ratio
  const w = Math.round(coordinates.width * scaleRatio.value)
  const h = Math.round(coordinates.height * scaleRatio.value)

  cropWidth.value = w.toString()
  cropHeight.value = h.toString()

  if (isUpdatingOutputFromCrop.value) {
    outputWidth.value = w.toString()
    outputHeight.value = h.toString()
  }

  if (isUndoRedoAction.value) {
    isUndoRedoAction.value = false
    return
  }

  if (isInteracting.value) {
    pendingCoordinates = coordinates
  }
  else {
    pushToHistory(coordinates)
  }
}

// Aspect ratio presets
function selectAspect(ratio: number | undefined) {
  aspect.value = ratio
  isCustom.value = false
  isUpdatingOutputFromCrop.value = true
}

function applySizePreset(w: number, h: number) {
  const ratio = w / h
  aspect.value = ratio
  outputWidth.value = w.toString()
  outputHeight.value = h.toString()
  isOutputExpanded.value = true
  isUpdatingOutputFromCrop.value = false
}

function parseCustomAspect(input: string) {
  const match = input.match(/(\d+)\D+(\d+)/)
  if (match && match[1] && match[2]) {
    const w = Number.parseInt(match[1])
    const h = Number.parseInt(match[2])
    if (w > 0 && h > 0) {
      aspect.value = w / h
      return `${w}:${h}`
    }
  }
  return null
}

// Output handlers
function onOutputWidthChange(val: string) {
  outputWidth.value = val
  isUpdatingOutputFromCrop.value = false
  const num = Number.parseFloat(val)
  if (!Number.isNaN(num)) {
    const currentAspect = Number.parseFloat(cropWidth.value) / Number.parseFloat(cropHeight.value)
    if (!Number.isNaN(currentAspect)) {
      outputHeight.value = Math.round(num / currentAspect).toString()
    }
  }
}

function onOutputHeightChange(val: string) {
  outputHeight.value = val
  isUpdatingOutputFromCrop.value = false
  const num = Number.parseFloat(val)
  if (!Number.isNaN(num)) {
    const currentAspect = Number.parseFloat(cropWidth.value) / Number.parseFloat(cropHeight.value)
    if (!Number.isNaN(currentAspect)) {
      outputWidth.value = Math.round(num * currentAspect).toString()
    }
  }
}

function resetOutputSize() {
  outputWidth.value = cropWidth.value
  outputHeight.value = cropHeight.value
  isUpdatingOutputFromCrop.value = true
}

function rotateImage(angle: number) {
  if (cropperRef.value) {
    cropperRef.value.rotate(angle)
  }
}

// Cropper stencil props
const stencilProps = computed(() => {
  if (aspect.value) {
    return { aspectRatio: aspect.value }
  }
  return {}
})

// Preview & Download
async function handlePreview() {
  if (!cropperRef.value || !workerApi)
    return

  isProcessing.value = true

  try {
    const { canvas } = cropperRef.value.getResult()
    if (!canvas)
      throw new Error('No canvas available')

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b: Blob | null) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/png',
      )
    })

    const resultBlob = await workerApi.processFile(blob, {
      format: format.value,
      quality: quality.value,
      width: Number.parseInt(outputWidth.value) || undefined,
      height: Number.parseInt(outputHeight.value) || undefined,
    })

    previewBlob.value = resultBlob
    previewUrl.value = URL.createObjectURL(resultBlob)
    previewSize.value = formatBytes(resultBlob.size)
    isPreviewing.value = true
  }
  catch (e) {
    console.error('Error during image processing:', e)
    // eslint-disable-next-line no-alert
    alert('Failed to process image. Check console for details.')
  }
  finally {
    isProcessing.value = false
  }
}

function handleDownload() {
  if (previewBlob.value) {
    const filename = `pandora-image-${Date.now()}.${format.value}`
    downloadFile(previewBlob.value, filename)
    showSuccess.value = true

    recordStorage.saveRecord({
      id: globalThis.crypto.randomUUID(),
      originalName: originalFile.value?.name || filename,
      timestamp: Date.now(),
      format: format.value,
      originalSize: originalFile.value?.size || 0,
      processedSize: previewBlob.value.size,
      quality: quality.value,
      savedFile: previewBlob.value,
    }).then(() => loadHistory())

    setTimeout(() => {
      showSuccess.value = false
      closePreview()
    }, 1500)
  }
}

function closePreview() {
  isPreviewing.value = false
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  previewBlob.value = null
}

const hasCrop = computed(() => !!cropWidth.value && !!cropHeight.value)
</script>

<template>
  <div class="text-pd-text bg-pd-bg flex flex-col h-screen relative overflow-hidden">
    <!-- Header -->
    <header
      class="px-6 border-b border-pd-border bg-pd-bg/80 flex shrink-0 h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md"
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
            <CropIcon class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Pandora<span class="text-pd-text-muted">///Processor</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <button
          class="text-pd-text-muted flex gap-2 cursor-pointer transition-colors items-center hover:text-pd-accent"
          @click="showHistoryModal = true"
        >
          <History class="h-4 w-4" />
          <span class="tracking-widest font-bold hidden uppercase md:inline">History</span>
        </button>
        <div class="bg-pd-border h-4 w-px" />
        <div class="gap-2 hidden items-center md:flex">
          <span class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">Mode</span>
          <span class="text-xs text-pd-accent">WASM_CLIENT</span>
        </div>
        <div class="mx-2 bg-pd-border h-4 w-px" />
        <ThemeToggle />
      </div>
    </header>

    <div class="flex-1 grid grid-cols-1 min-h-0 overflow-hidden lg:grid-cols-12">
      <!-- Sidebar Settings -->
      <div class="border-r border-pd-border bg-pd-bg-subtle/30 flex flex-col min-h-0 overflow-y-auto lg:col-span-3">
        <div class="p-5 space-y-8">
          <!-- Header -->
          <div>
            <h2 class="text-xs text-pd-text-muted tracking-widest font-bold mb-1 uppercase">
              // Control Panel
            </h2>
            <div class="mt-3 bg-pd-border h-px w-full" />
          </div>

          <!-- Export Settings -->
          <div class="space-y-3">
            <div class="text-[10px] text-pd-text-muted tracking-widest flex uppercase items-center justify-between">
              <span>[01] Format</span>
            </div>
            <div class="p-px rounded-[2px] bg-pd-border gap-px grid grid-cols-4">
              <button
                v-for="f in (['webp', 'avif', 'jpeg', 'png'] as const)"
                :key="f"
                class="text-[10px] font-bold py-1.5 text-center cursor-pointer uppercase transition-all"
                :class="[
                  format === f
                    ? 'bg-pd-text text-pd-bg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                    : 'bg-pd-bg hover:bg-pd-surface text-pd-text-muted',
                ]"
                @click="format = f"
              >
                {{ f }}
              </button>
            </div>

            <div v-if="format !== 'png'" class="pt-2 space-y-2">
              <div class="text-[10px] text-pd-text-muted flex uppercase justify-between">
                <span>Quality</span>
                <span class="text-pd-accent">{{ quality }}%</span>
              </div>
              <input
                v-model.number="quality"
                type="range"
                min="1"
                max="100"
                class="appearance-none accent-[var(--pd-accent)] rounded-none bg-pd-border h-1 w-full cursor-pointer"
              >
            </div>
          </div>

          <!-- Aspect Ratio -->
          <div class="space-y-3">
            <div class="text-[10px] text-pd-text-muted tracking-widest flex uppercase items-center justify-between">
              <span>[02] Aspect Ratio</span>
              <button
                v-if="aspect !== undefined"
                class="text-[9px] text-pd-accent cursor-pointer transition-colors hover:text-pd-text"
                @click="selectAspect(undefined)"
              >
                RESET
              </button>
            </div>

            <div class="mb-2 p-px rounded-[2px] bg-pd-border gap-px grid grid-cols-4">
              <button
                class="text-[10px] font-bold py-1.5 text-center cursor-pointer uppercase transition-all"
                :class="[!aspect && !isCustom ? 'bg-pd-text text-pd-bg' : 'bg-pd-bg hover:bg-pd-surface text-pd-text-muted']"
                @click="selectAspect(undefined)"
              >
                Free
              </button>
              <button
                class="text-[10px] font-bold py-1.5 text-center cursor-pointer uppercase transition-all"
                :class="[aspect !== undefined && presetGroup === 'common' && !isCustom ? 'bg-pd-text text-pd-bg' : 'bg-pd-bg hover:bg-pd-surface text-pd-text-muted']"
                @click="presetGroup = 'common'; selectAspect(1)"
              >
                Ratio
              </button>
              <button
                class="text-[10px] font-bold py-1.5 text-center cursor-pointer uppercase transition-all"
                :class="[aspect !== undefined && presetGroup === 'store' && !isCustom ? 'bg-pd-text text-pd-bg' : 'bg-pd-bg hover:bg-pd-surface text-pd-text-muted']"
                @click="presetGroup = 'store'; isCustom = false; applySizePreset(128, 128)"
              >
                Store
              </button>
              <button
                class="text-[10px] font-bold py-1.5 text-center cursor-pointer uppercase transition-all"
                :class="[isCustom ? 'bg-pd-text text-pd-bg' : 'bg-pd-bg hover:bg-pd-surface text-pd-text-muted']"
                @click="isCustom = true; presetGroup = 'common'; parseCustomAspect(customAspectInput)"
              >
                Custom
              </button>
            </div>

            <!-- Presets based on group -->
            <div v-if="!isCustom && aspect !== undefined && presetGroup === 'common'" class="gap-1 grid grid-cols-5">
              <button
                v-for="opt in [{ l: '1:1', v: 1 }, { l: '4:3', v: 4 / 3 }, { l: '16:9', v: 16 / 9 }, { l: '3:2', v: 3 / 2 }, { l: '2:3', v: 2 / 3 }]"
                :key="opt.l"
                class="text-[10px] py-1 border rounded-[2px] cursor-pointer transition-colors"
                :class="[aspect === opt.v ? 'border-transparent bg-pd-text text-pd-bg' : 'border-pd-border text-pd-text-muted hover:text-pd-text hover:border-pd-border-hover']"
                @click="selectAspect(opt.v)"
              >
                {{ opt.l }}
              </button>
            </div>

            <div v-if="!isCustom && aspect !== undefined && presetGroup === 'store'" class="flex flex-col gap-1">
              <button
                v-for="opt in [
                  { label: 'CWS Icon', w: 128, h: 128 },
                  { label: 'Small Tile', w: 440, h: 280 },
                  { label: 'Large Tile', w: 920, h: 680 },
                  { label: 'Marquee', w: 1400, h: 560 },
                  { label: 'Screenshot', w: 1280, h: 800 },
                ]"
                :key="opt.label"
                class="text-[10px] px-2 py-1.5 border rounded-[2px] flex cursor-pointer transition-colors items-center justify-between"
                :class="[
                  outputWidth === opt.w.toString() && outputHeight === opt.h.toString()
                    ? 'border-transparent bg-pd-text text-pd-bg'
                    : 'border-pd-border text-pd-text-muted hover:text-pd-text hover:border-pd-text-muted',
                ]"
                @click="applySizePreset(opt.w, opt.h)"
              >
                <span>{{ opt.label }}</span>
                <span class="opacity-50">{{ opt.w }}x{{ opt.h }}</span>
              </button>
            </div>

            <div v-if="isCustom" class="relative">
              <input
                v-model="customAspectInput"
                type="text"
                class="text-xs text-pd-text px-2 py-1.5 border border-pd-border rounded-[2px] bg-pd-bg w-full transition-colors focus:outline-none focus:border-pd-accent"
                placeholder="RATIO (16:9)"
                @input="parseCustomAspect(customAspectInput)"
                @blur="() => { const f = parseCustomAspect(customAspectInput); if (f) customAspectInput = f }"
              >
            </div>
          </div>

          <!-- Geometry & Scaling -->
          <div class="space-y-3">
            <div class="text-[10px] text-pd-text-muted tracking-widest flex uppercase items-center justify-between">
              <span>[03] Dimensions</span>
              <button
                class="text-[9px] text-pd-accent flex gap-1 cursor-pointer transition-colors items-center hover:text-pd-text"
                @click="resetOutputSize"
              >
                <RefreshCw class="h-3 w-3" /> RESET TARGET
              </button>
            </div>

            <div class="border border-pd-border rounded-[2px] bg-pd-bg flex flex-col overflow-hidden">
              <!-- Source Crop -->
              <div class="border-b border-pd-border flex divide-pd-border divide-x">
                <div class="p-2 bg-pd-bg-subtle/30 flex flex-1 flex-col gap-1">
                  <span class="text-[9px] text-pd-text-muted uppercase">Crop W</span>
                  <span class="text-xs text-pd-text">{{ cropWidth || '-' }}</span>
                </div>
                <div class="p-2 bg-pd-bg-subtle/30 flex flex-1 flex-col gap-1">
                  <span class="text-[9px] text-pd-text-muted uppercase">Crop H</span>
                  <span class="text-xs text-pd-text">{{ cropHeight || '-' }}</span>
                </div>
              </div>
              <!-- Output Target -->
              <div class="bg-pd-bg flex divide-pd-border divide-x">
                <div class="p-2 flex flex-1 flex-col gap-1 transition-colors focus-within:bg-pd-accent/5">
                  <span class="text-[9px] text-pd-text-muted uppercase">Target W</span>
                  <input
                    :value="outputWidth"
                    type="number"
                    class="text-xs text-pd-accent bg-transparent w-full focus:outline-none"
                    placeholder="Auto"
                    @input="onOutputWidthChange(($event.target as HTMLInputElement).value)"
                  >
                </div>
                <div class="p-2 flex flex-1 flex-col gap-1 transition-colors focus-within:bg-pd-accent/5">
                  <span class="text-[9px] text-pd-text-muted uppercase">Target H</span>
                  <input
                    :value="outputHeight"
                    type="number"
                    class="text-xs text-pd-accent bg-transparent w-full focus:outline-none"
                    placeholder="Auto"
                    @input="onOutputHeightChange(($event.target as HTMLInputElement).value)"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Area -->
        <div class="mt-auto p-5 border-t border-pd-border bg-pd-bg-subtle/50">
          <button
            :disabled="!hasCrop || isProcessing"
            class="group text-xs tracking-widest font-bold py-3.5 rounded-[2px] flex gap-3 w-full cursor-pointer uppercase transition-all items-center justify-center relative overflow-hidden"
            :class="[
              !hasCrop || isProcessing
                ? 'bg-pd-bg-inset text-pd-text-disabled cursor-not-allowed border border-pd-border'
                : 'bg-pd-text text-pd-bg hover:bg-pd-accent hover:text-white border border-transparent',
            ]"
            @click="handlePreview"
          >
            <component
              :is="isProcessing ? RefreshCw : Eye"
              class="h-4 w-4"
              :class="[
                isProcessing ? 'animate-spin' : '',
              ]"
            />
            <span>
              {{ isProcessing ? 'Processing...' : 'Preview Output' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Main Area -->
      <div class="bg-bg-angled flex flex-col relative overflow-hidden lg:col-span-9">
        <template v-if="!imgSrc">
          <label
            class="group m-6 border border-pd-border rounded-sm border-dashed flex flex-1 flex-col cursor-pointer transition-all items-center justify-center relative overflow-hidden hover:border-pd-accent/50 hover:bg-pd-accent/5"
            @drop="handleDrop"
            @dragover="handleDragOver"
          >
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="onSelectFile"
            >

            <!-- Decorative corners -->
            <div class="border-l-2 border-t-2 border-pd-text-muted h-4 w-4 transition-colors left-0 top-0 absolute group-hover:border-pd-accent" />
            <div class="border-r-2 border-t-2 border-pd-text-muted h-4 w-4 transition-colors right-0 top-0 absolute group-hover:border-pd-accent" />
            <div class="border-b-2 border-l-2 border-pd-text-muted h-4 w-4 transition-colors bottom-0 left-0 absolute group-hover:border-pd-accent" />
            <div class="border-b-2 border-r-2 border-pd-text-muted h-4 w-4 transition-colors bottom-0 right-0 absolute group-hover:border-pd-accent" />

            <div class="flex flex-col items-center relative z-10 space-y-4">
              <div
                class="border border-pd-border rounded-full bg-pd-bg-elevated flex h-20 w-20 shadow-xl transition-transform duration-300 items-center justify-center group-hover:scale-110"
              >
                <Upload class="text-pd-text-muted h-8 w-8 transition-colors group-hover:text-pd-accent" />
              </div>
              <div class="text-center">
                <h3 class="text-2xl text-pd-text tracking-widest font-bold uppercase">
                  Initialize Workspace
                </h3>
                <p
                  class="text-[10px] text-pd-text-muted mt-2 px-4 py-1.5 border border-pd-border/50 rounded-sm bg-pd-bg-inset"
                >
                  [DROP ASSETS • CLICK TO BROWSE • <span class="text-pd-accent">CTRL+V</span> TO PASTE]
                </p>
              </div>
              <div class="flex gap-2">
                <span
                  v-for="type in ['JPG', 'PNG', 'WEBP', 'AVIF']"
                  :key="type"
                  class="text-[10px] text-pd-text-disabled font-bold px-2 py-1 border border-pd-border rounded-[1px] bg-pd-surface"
                >
                  {{ type }}
                </span>
              </div>
            </div>
          </label>
        </template>

        <template v-else>
          <div class="flex flex-col h-full w-full relative">
            <!-- Workspace Toolbar -->
            <div class="flex gap-2 items-center left-4 top-4 absolute z-20">
              <div
                class="px-3 py-1.5 border border-pd-border rounded-sm bg-pd-bg-elevated/80 flex gap-3 shadow-lg items-center backdrop-blur-md"
              >
                <div class="flex flex-col">
                  <span class="text-[9px] text-pd-text-muted tracking-wider font-bold uppercase">
                    Active Selection
                  </span>
                  <span class="text-sm text-pd-accent font-bold">
                    {{ cropWidth ? `${cropWidth} × ${cropHeight}` : 'No Selection' }}
                  </span>
                </div>
                <template
                  v-if="outputWidth && (outputWidth !== cropWidth || outputHeight !== cropHeight)"
                >
                  <div class="pl-6 border-l border-pd-border flex flex-col">
                    <span class="text-xs text-pd-text-muted tracking-tighter font-bold uppercase">
                      Final Output
                    </span>
                    <span class="text-lg text-pd-secondary font-black">
                      {{ outputWidth }} × {{ outputHeight }}
                    </span>
                  </div>
                </template>
              </div>

              <!-- Rotate and Undo Controls -->
              <div class="ml-2 flex gap-1">
                <button
                  :disabled="historyIndex <= 0"
                  class="text-pd-text-muted p-1.5 border border-pd-border rounded-sm bg-pd-bg-elevated/80 cursor-pointer shadow-lg transition-all backdrop-blur-md hover:text-pd-accent hover:border-pd-accent/50 hover:bg-pd-accent/5 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Undo (Ctrl+Z)"
                  @click="undo"
                >
                  <Undo2 class="h-4 w-4" />
                </button>
                <button
                  :disabled="historyIndex >= cropperHistoryStack.length - 1"
                  class="text-pd-text-muted p-1.5 border border-pd-border rounded-sm bg-pd-bg-elevated/80 cursor-pointer shadow-lg transition-all backdrop-blur-md hover:text-pd-accent hover:border-pd-accent/50 hover:bg-pd-accent/5 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Redo (Ctrl+Shift+Z)"
                  @click="redo"
                >
                  <Redo2 class="h-4 w-4" />
                </button>
                <div class="mx-1 my-1 bg-pd-border w-px" />
                <button
                  class="text-pd-text-muted p-1.5 border border-pd-border rounded-sm bg-pd-bg-elevated/80 cursor-pointer shadow-lg transition-all backdrop-blur-md hover:text-pd-accent hover:border-pd-accent/50 hover:bg-pd-accent/5"
                  title="Rotate Left"
                  @click="rotateImage(-90)"
                >
                  <RotateCcw class="h-4 w-4" />
                </button>
                <button
                  class="text-pd-text-muted p-1.5 border border-pd-border rounded-sm bg-pd-bg-elevated/80 cursor-pointer shadow-lg transition-all backdrop-blur-md hover:text-pd-accent hover:border-pd-accent/50 hover:bg-pd-accent/5"
                  title="Rotate Right"
                  @click="rotateImage(90)"
                >
                  <RotateCw class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              class="bg-bg-angled p-8 border-b border-t border-pd-border flex grow items-center justify-center relative overflow-hidden"
              @pointerdown="onInteractionStart"
            >
              <div class="border border-pd-border/20 max-h-[calc(100vh-200px)] max-w-full shadow-2xl shadow-black/50 relative">
                <Cropper
                  ref="cropperRef"
                  :src="imgSrc"
                  :stencil-props="stencilProps"
                  class="max-h-[calc(100vh-200px)] max-w-full"
                  @change="onCropChange"
                />
              </div>
            </div>

            <button
              class="text-pd-text-muted p-2 border border-pd-border rounded-sm bg-pd-surface/50 cursor-pointer transition-all right-4 top-4 absolute z-10 backdrop-blur-md hover:text-pd-danger hover:border-pd-danger hover:bg-pd-danger-muted"
              title="Clear Image"
              @click="clearImage"
            >
              <RefreshCw class="h-4 w-4" />
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Preview Modal -->
    <Modal :show="isPreviewing" title="Output Preview" @close="closePreview">
      <template #icon>
        <Eye class="text-pd-text-muted h-4 w-4" />
      </template>

      <div class="p-6 flex min-h-[300px] items-center justify-center relative">
        <img v-if="previewUrl" :src="previewUrl" class="border border-pd-border/20 max-h-[60vh] max-w-full object-contain drop-shadow-2xl">
      </div>

      <template #footer>
        <div class="flex gap-6">
          <div class="flex flex-col">
            <span class="text-[9px] text-pd-text-muted tracking-wider uppercase">Format</span>
            <span class="text-xs text-pd-text uppercase">{{ format }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] text-pd-text-muted tracking-wider uppercase">Dimensions</span>
            <span class="text-xs text-pd-text">{{ outputWidth }} × {{ outputHeight }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] text-pd-text-muted tracking-wider uppercase">Original Size</span>
            <span class="text-xs text-pd-text">{{ originalFile ? formatBytes(originalFile.size) : '-' }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] text-pd-text-muted tracking-wider uppercase">Output Size</span>
            <span class="text-xs text-pd-accent">{{ previewSize }}</span>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            class="text-xs text-pd-text-muted tracking-widest font-bold px-4 py-2 border border-pd-border rounded-[2px] cursor-pointer uppercase transition-colors hover:text-pd-text hover:bg-pd-surface"
            @click="closePreview"
          >
            Cancel
          </button>
          <button
            class="text-xs text-pd-bg tracking-widest font-bold px-5 py-2 rounded-[2px] bg-pd-text flex gap-2 cursor-pointer uppercase transition-colors items-center hover:text-white hover:bg-pd-accent"
            @click="handleDownload"
          >
            <component :is="showSuccess ? CheckCircle2 : Download" class="h-3.5 w-3.5" />
            {{ showSuccess ? 'Exported' : 'Save Image' }}
          </button>
        </div>
      </template>
    </Modal>

    <!-- History Modal -->
    <Modal :show="showHistoryModal" title="Processing History" @close="showHistoryModal = false">
      <template #icon>
        <History class="text-pd-text-muted h-4 w-4" />
      </template>

      <div class="custom-scrollbar p-4 flex flex-1 flex-col max-h-[70vh] min-h-[400px] overflow-y-auto">
        <div
          v-if="historyRecords.length === 0"
          class="text-pd-text-muted py-20 opacity-50 flex flex-1 flex-col h-full items-center justify-center"
        >
          <History class="mb-4 h-12 w-12" :stroke-width="1" />
          <p class="text-sm">
            No history available
          </p>
        </div>
        <div v-else class="gap-4 grid grid-cols-1 md:grid-cols-2">
          <div
            v-for="record in historyRecords"
            :key="record.id"
            class="group border border-pd-border bg-pd-bg-subtle/40 opacity-90 flex flex-col transition-opacity overflow-hidden hover:opacity-100"
          >
            <!-- Preview Area -->
            <div class="bg-bg-angled p-2 border-b border-pd-border flex shrink-0 h-40 w-full items-center justify-center relative overflow-hidden">
              <template v-if="record.savedFile">
                <HistoryPreview :blob="record.savedFile" />
              </template>
              <div
                class="opacity-0 flex gap-2 transition-opacity right-2 top-2 absolute group-hover:opacity-100"
              >
                <button
                  v-if="record.savedFile"
                  class="text-pd-text-muted p-1.5 border border-pd-border rounded-sm bg-pd-bg cursor-pointer shadow-sm transition-colors hover:text-pd-accent"
                  title="Download"
                  @click="downloadFile(record.savedFile!, record.originalName, record.format)"
                >
                  <Download class="h-3 w-3" />
                </button>
                <button
                  class="text-pd-text-muted p-1.5 border border-pd-border rounded-sm bg-pd-bg cursor-pointer shadow-sm transition-colors hover:text-pd-danger"
                  title="Remove"
                  @click="removeHistory(record.id)"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </div>
            </div>

            <!-- Info Bar -->
            <div class="p-3 space-y-2">
              <div class="min-w-0">
                <h4 class="text-xs text-pd-text font-bold mb-0.5 truncate">
                  {{ record.originalName }}
                </h4>
                <span class="text-[9px] text-pd-text-disabled tracking-tighter uppercase">
                  {{ new Date(record.timestamp).toLocaleString() }}
                </span>
              </div>

              <div class="text-[10px] pt-1.5 border-t border-pd-border/50 flex items-center justify-between">
                <div class="flex gap-2 items-center">
                  <span class="text-pd-text-muted">{{ formatBytes(record.originalSize) }}</span>
                  <span class="text-[8px] text-pd-text-disabled">&rarr;</span>
                  <span class="text-pd-accent font-bold">{{ formatBytes(record.processedSize) }}</span>
                </div>
                <span class="text-[9px] text-pd-accent font-bold px-1.5 py-0.5 border border-pd-accent/20 bg-pd-accent-muted">
                  {{ record.format.toUpperCase() }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-1 justify-between">
          <button
            v-if="historyRecords.length > 0"
            class="text-xs text-pd-danger tracking-widest font-bold px-4 py-2 border border-pd-border rounded-[2px] cursor-pointer uppercase transition-colors hover:border-pd-danger hover:bg-pd-danger/10"
            @click="clearAllHistory"
          >
            Clear History
          </button>
          <div v-else />
          <button
            class="text-xs text-pd-text-muted tracking-widest font-bold px-4 py-2 border border-pd-border rounded-[2px] cursor-pointer uppercase transition-colors hover:text-pd-text hover:bg-pd-surface"
            @click="showHistoryModal = false"
          >
            Close
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style>
/* Cropper theme overrides */
.vue-advanced-cropper {
  background: transparent !important;
}

.vue-advanced-cropper__background {
  background: var(--pd-bg-subtle) !important;
}
</style>
