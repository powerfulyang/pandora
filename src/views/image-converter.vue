<script setup lang="ts">
import type { ImageFormat } from '@/lib/image-processor'
import type { ImageWorkerAPI } from '@/lib/image.worker'
import type { ProcessingRecord } from '@/lib/storage'
import * as Comlink from 'comlink'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  FileImage,
  History,
  ImagePlus,
  Layers,
  Play,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from 'lucide-vue-next'
import { motion } from 'motion-v'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import HistoryPreview from '@/components/HistoryPreview.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { recordStorage } from '@/lib/storage'
import { downloadFile, formatBytes } from '@/utils'

interface FileItem {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number
  resultBlob?: Blob
  error?: string
  originalSize: number
  processedSize?: number
  format?: ImageFormat
  quality?: number
  previewUrl?: string
}

const files = ref<FileItem[]>([])
const isDragging = ref(false)
const configuration = ref({
  format: 'webp' as ImageFormat,
  quality: 80,
})
const isProcessing = ref(false)
const history = ref<ProcessingRecord[]>([])
const activeTab = ref<'queue' | 'history'>('queue')
const fileInputRef = ref<HTMLInputElement | null>(null)

// Worker setup
let worker: Worker | null = null
let workerApi: Comlink.Remote<ImageWorkerAPI> | null = null

async function loadHistory() {
  history.value = await recordStorage.getRecords()
}

onMounted(() => {
  worker = new Worker(
    new URL('../lib/image.worker.ts', import.meta.url),
    { type: 'module' },
  )
  workerApi = Comlink.wrap<ImageWorkerAPI>(worker)
  loadHistory()

  window.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  worker?.terminate()
  window.removeEventListener('paste', handlePaste)
  // Cleanup preview URLs
  files.value.forEach((f) => {
    if (f.previewUrl)
      URL.revokeObjectURL(f.previewUrl)
  })
})

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const droppedFiles = Array.from(e.dataTransfer?.files || []).filter(f =>
    f.type.startsWith('image/'),
  )
  addFiles(droppedFiles)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    const selectedFiles = Array.from(input.files).filter(f =>
      f.type.startsWith('image/'),
    )
    addFiles(selectedFiles)
  }
  input.value = ''
}

function addFiles(newFiles: File[]) {
  const newItems: FileItem[] = newFiles.map(file => ({
    id: globalThis.crypto.randomUUID(),
    file,
    status: 'pending',
    progress: 0,
    originalSize: file.size,
    previewUrl: URL.createObjectURL(file),
  }))
  files.value = [...files.value, ...newItems]
}

function removeFile(id: string) {
  const file = files.value.find(f => f.id === id)
  if (file?.previewUrl)
    URL.revokeObjectURL(file.previewUrl)
  files.value = files.value.filter(f => f.id !== id)
}

function clearQueue() {
  files.value.forEach((f) => {
    if (f.previewUrl)
      URL.revokeObjectURL(f.previewUrl)
  })
  files.value = []
}

async function clearHistory() {
  await recordStorage.clearRecords()
  loadHistory()
}

async function removeHistory(id: string) {
  await recordStorage.deleteRecord(id)
  loadHistory()
}

async function processQueue() {
  if (!workerApi)
    return
  isProcessing.value = true

  const queue = files.value.filter(f => f.status === 'pending')

  for (const item of queue) {
    files.value = files.value.map(f =>
      f.id === item.id ? { ...f, status: 'processing' as const, progress: 10 } : f,
    )

    try {
      const blob = await workerApi.processFile(item.file, {
        format: configuration.value.format,
        quality: configuration.value.quality,
      })

      const record: ProcessingRecord = {
        id: item.id,
        originalName: item.file.name,
        timestamp: Date.now(),
        format: configuration.value.format,
        originalSize: item.originalSize,
        processedSize: blob.size,
        quality: configuration.value.quality,
        savedFile: blob,
      }

      await recordStorage.saveRecord(record)

      files.value = files.value.map(f =>
        f.id === item.id
          ? {
              ...f,
              status: 'done' as const,
              progress: 100,
              resultBlob: blob,
              processedSize: blob.size,
              format: configuration.value.format,
              quality: configuration.value.quality,
            }
          : f,
      )
    }
    catch (error) {
      console.error('Processing error:', error)
      files.value = files.value.map(f =>
        f.id === item.id ? { ...f, status: 'error' as const, error: 'Processing failed' } : f,
      )
    }
  }

  isProcessing.value = false
  loadHistory()
}

async function processSingleFile(id: string) {
  if (!workerApi)
    return

  const item = files.value.find(f => f.id === id)
  if (!item || item.status !== 'pending')
    return

  files.value = files.value.map(f =>
    f.id === item.id ? { ...f, status: 'processing' as const, progress: 10 } : f,
  )

  try {
    const blob = await workerApi.processFile(item.file, {
      format: configuration.value.format,
      quality: configuration.value.quality,
    })

    const record: ProcessingRecord = {
      id: item.id,
      originalName: item.file.name,
      timestamp: Date.now(),
      format: configuration.value.format,
      originalSize: item.originalSize,
      processedSize: blob.size,
      quality: configuration.value.quality,
      savedFile: blob,
    }

    await recordStorage.saveRecord(record)

    files.value = files.value.map(f =>
      f.id === item.id
        ? {
            ...f,
            status: 'done' as const,
            progress: 100,
            resultBlob: blob,
            processedSize: blob.size,
            format: configuration.value.format,
            quality: configuration.value.quality,
          }
        : f,
    )
  }
  catch (error) {
    console.error('Processing error:', error)
    files.value = files.value.map(f =>
      f.id === item.id ? { ...f, status: 'error' as const, error: 'Processing failed' } : f,
    )
  }

  loadHistory()
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items)
    return

  const imageFiles: File[] = []
  for (const item of items) {
    if (item.type.includes('image')) {
      const file = item.getAsFile()
      if (file)
        imageFiles.push(file)
    }
  }
  if (imageFiles.length > 0) {
    addFiles(imageFiles)
  }
}

const pendingCount = computed(() => files.value.filter(f => f.status === 'pending').length)
const reversedFiles = computed(() => [...files.value].reverse())

// History item preview URL management
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col h-screen overflow-hidden selection:text-pd-accent selection:bg-pd-accent-muted"
  >
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
            <Archive class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Pandora<span class="text-pd-text-muted">///Converter</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <div class="gap-2 hidden items-center md:flex">
          <span class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
            Mode
          </span>
          <span class="text-xs text-pd-accent"> WASM_MULTI_THREADED </span>
        </div>
        <div class="mx-2 bg-pd-border h-4 w-px" />
        <ThemeToggle />
      </div>
    </header>

    <!-- Main -->
    <main
      class="bg-bg-angled p-4 flex-1 gap-6 grid grid-cols-1 min-h-0 overflow-hidden lg:p-8 sm:p-6 lg:gap-8 lg:grid-cols-12"
    >
      <!-- Left Panel: Upload & Settings -->
      <section class="custom-scrollbar pr-2 flex flex-col gap-6 col-span-1 overflow-y-auto lg:col-span-4 xl:col-span-3">
        <div class="space-y-2">
          <h2 class="text-lg text-pd-text tracking-tight font-bold flex gap-2 uppercase items-center">
            Image Converter
          </h2>
          <p class="text-[11px] text-pd-text-secondary leading-relaxed max-w-sm">
            Batch process images efficiently and securely. All processing is executed fully locally within your browser.
          </p>
        </div>

        <!-- Upload Zone -->
        <div
          class="group border-2 rounded-sm border-dashed flex flex-col gap-4 h-64 transition-all duration-200 items-center justify-center relative overflow-hidden" :class="[
            isDragging
              ? 'border-pd-accent bg-pd-accent/5'
              : 'border-pd-border/50 hover:border-pd-accent/50 bg-pd-bg-subtle/40',
          ]"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept="image/*"
            class="opacity-0 h-full w-full cursor-pointer inset-0 absolute z-10"
            @change="handleFileSelect"
          >
          <div
            class="p-4 border border-pd-border rounded-full bg-pd-bg shadow-sm transition-transform group-hover:scale-110"
          >
            <ImagePlus class="text-pd-text-muted h-6 w-6 transition-colors group-hover:text-pd-accent" :stroke-width="1.5" />
          </div>
          <div class="text-center flex flex-col gap-3 items-center">
            <div class="space-y-1">
              <p class="text-xs text-pd-text-secondary tracking-widest font-bold uppercase">
                Workspace Input
              </p>
              <div class="mx-auto bg-pd-accent/30 h-px w-8" />
            </div>
            <div
              class="text-[10px] text-pd-text-muted tracking-widest px-3 py-1.5 border border-pd-border/50 rounded-sm bg-pd-bg-subtle/50 flex gap-2 uppercase items-center"
            >
              <span>Drop</span>
              <span class="opacity-30">•</span>
              <span>Browse</span>
              <span class="opacity-30">•</span>
              <span class="text-pd-accent group-hover:animate-pulse">Paste</span>
            </div>
            <p class="text-[9px] text-pd-text-disabled tracking-tighter uppercase">
              Format: WebP, AVIF, PNG, JPEG
            </p>
          </div>
        </div>

        <!-- Settings Panel -->
        <div
          class="p-6 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-6 shadow-black/5 shadow-xl"
        >
          <div class="pb-4 border-b border-pd-border flex gap-2 items-center">
            <Settings class="text-pd-accent h-4 w-4" />
            <span class="text-xs tracking-widest font-bold uppercase">Configuration</span>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs text-pd-text-muted uppercase">Output Format</label>
              <div class="w-full relative">
                <select
                  v-model="configuration.format"
                  class="text-sm py-2 pl-3 pr-8 appearance-none border border-pd-border rounded-sm bg-pd-bg-subtle w-full cursor-pointer focus:outline-none focus:border-pd-accent"
                >
                  <option value="webp">
                    WebP (Recommended)
                  </option>
                  <option value="avif">
                    AVIF (Best Compression)
                  </option>
                  <option value="jpeg">
                    JPEG
                  </option>
                  <option value="png">
                    PNG
                  </option>
                </select>
                <ChevronDown class="text-pd-text-muted h-4 w-4 pointer-events-none right-2.5 top-1/2 absolute -translate-y-1/2" :stroke-width="1.5" />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between">
                <label class="text-xs text-pd-text-muted uppercase">Quality</label>
                <span class="text-xs text-pd-accent">{{ configuration.quality }}%</span>
              </div>
              <input
                v-model.number="configuration.quality"
                type="range"
                min="1"
                max="100"
                class="appearance-none accent-[var(--pd-accent)] rounded-lg bg-pd-border h-1 w-full cursor-pointer"
              >
              <div class="text-[10px] text-pd-text-disabled flex justify-between">
                <span>Small Size</span>
                <span>High Quality</span>
              </div>
            </div>
          </div>

          <button
            :disabled="pendingCount === 0 || isProcessing"
            class="text-sm tracking-widest font-bold py-3 rounded-sm flex gap-2 w-full cursor-pointer uppercase transition-all items-center justify-center" :class="[
              pendingCount > 0 && !isProcessing
                ? 'bg-pd-accent text-white hover:bg-pd-accent-hover'
                : 'bg-pd-bg-subtle text-pd-text-disabled cursor-not-allowed',
            ]"
            @click="processQueue"
          >
            <RefreshCw class="h-4 w-4" :class="[isProcessing ? 'animate-spin' : '']" />
            {{ isProcessing ? 'Processing...' : 'Start Batch Process' }}
          </button>
        </div>
      </section>

      <!-- Right Panel: Lists -->
      <section
        class="border border-pd-border rounded-sm bg-pd-bg/60 flex flex-col col-span-1 min-h-[600px] shadow-2xl shadow-black/10 overflow-hidden backdrop-blur-sm lg:col-span-8 xl:col-span-9"
      >
        <!-- Tabs -->
        <div class="border-b border-pd-border flex relative">
          <button
            class="text-xs tracking-wide font-bold px-6 py-3.5 flex gap-2 cursor-pointer uppercase transition-all items-center relative" :class="[
              activeTab === 'queue'
                ? 'bg-pd-bg-subtle/80 text-pd-text'
                : 'text-pd-text-muted hover:text-pd-text hover:bg-pd-bg-subtle/40',
            ]"
            @click="activeTab = 'queue'"
          >
            <Layers class="h-4 w-4" :class="{ 'text-pd-accent': activeTab === 'queue' }" :stroke-width="1.5" />
            Queue ({{ files.length }})
            <div v-if="activeTab === 'queue'" class="bg-pd-accent h-[2px] bottom-[-1px] left-0 right-0 absolute" />
          </button>
          <button
            class="text-xs tracking-wide font-bold px-6 py-3.5 border-l border-pd-border/50 flex gap-2 cursor-pointer uppercase transition-all items-center relative" :class="[
              activeTab === 'history'
                ? 'bg-pd-bg-subtle/80 text-pd-text'
                : 'text-pd-text-muted hover:text-pd-text hover:bg-pd-bg-subtle/40',
            ]"
            @click="activeTab = 'history'"
          >
            <History class="h-4 w-4" :class="{ 'text-pd-accent': activeTab === 'history' }" :stroke-width="1.5" />
            History ({{ history.length }})
            <div v-if="activeTab === 'history'" class="bg-pd-accent h-[2px] bottom-[-1px] left-0 right-0 absolute" />
          </button>
          <div class="flex-1" />
          <button
            v-if="activeTab === 'queue' && files.length > 0"
            class="text-xs text-pd-text-muted px-4 py-3 flex gap-2 cursor-pointer transition-colors items-center hover:text-pd-danger"
            @click="clearQueue"
          >
            <Trash2 class="h-3 w-3" /> Clear Queue
          </button>
          <button
            v-if="activeTab === 'history' && history.length > 0"
            class="text-xs text-pd-text-muted px-4 py-3 flex gap-2 cursor-pointer transition-colors items-center hover:text-pd-danger"
            @click="clearHistory"
          >
            <Trash2 class="h-3 w-3" /> Clear History
          </button>
        </div>

        <!-- Content -->
        <div class="custom-scrollbar p-6 flex flex-1 flex-col overflow-y-auto">
          <template v-if="activeTab === 'queue'">
            <div
              v-if="files.length === 0"
              class="text-pd-text-muted py-20 opacity-50 flex flex-1 flex-col h-full items-center justify-center"
            >
              <ImagePlus class="mb-4 h-12 w-12" :stroke-width="1" />
              <div class="text-center space-y-2">
                <p class="text-sm text-pd-text-secondary">
                  Queue is empty
                </p>
                <p class="text-[10px] text-pd-text-disabled tracking-[0.2em] mt-1 uppercase">
                  Drop or Paste assets to begin
                </p>
              </div>
            </div>

            <div v-else class="gap-4 grid grid-cols-1 xl:grid-cols-2">
              <motion.div
                v-for="file in reversedFiles"
                :key="file.id"
                :initial="{ opacity: 0, y: 10 }"
                :animate="{ opacity: 1, y: 0 }"
                class="group border border-pd-border bg-pd-bg-subtle/30 flex flex-col transition-colors overflow-hidden hover:bg-pd-bg-subtle/50"
              >
                <!-- Preview Area -->
                <div
                  class="bg-bg-angled border-b border-pd-border flex shrink-0 h-48 w-full items-center justify-center relative overflow-hidden"
                >
                  <img
                    v-if="file.previewUrl"
                    :src="file.previewUrl"
                    alt="preview"
                    class="h-full w-full object-contain"
                    loading="lazy"
                  >

                  <!-- Floating Actions -->
                  <div
                    class="opacity-0 flex gap-2 transition-opacity right-2 top-2 absolute group-hover:opacity-100"
                  >
                    <button
                      v-if="file.status === 'pending'"
                      class="text-pd-text-muted p-2 border border-pd-border bg-pd-bg/80 cursor-pointer transition-colors backdrop-blur-md hover:text-pd-accent"
                      title="Process"
                      @click="processSingleFile(file.id)"
                    >
                      <Play class="h-4 w-4" />
                    </button>
                    <button
                      v-if="file.status === 'done' && file.resultBlob"
                      class="text-pd-text-muted p-2 border border-pd-border bg-pd-bg/80 cursor-pointer transition-colors backdrop-blur-md hover:text-pd-accent"
                      title="Download"
                      @click="downloadFile(file.resultBlob!, file.file.name, file.format || configuration.format)"
                    >
                      <Download class="h-4 w-4" />
                    </button>
                    <button
                      class="text-pd-text-muted p-2 border border-pd-border bg-pd-bg/80 cursor-pointer transition-colors backdrop-blur-md hover:text-pd-danger"
                      title="Remove"
                      @click="removeFile(file.id)"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <!-- Info Bar -->
                <div class="p-3 space-y-3">
                  <div class="flex gap-4 items-start justify-between">
                    <div class="min-w-0">
                      <h4 class="text-sm text-pd-text font-bold mb-1 truncate">
                        {{ file.file.name }}
                      </h4>
                      <div class="flex gap-2 items-center">
                        <span class="text-[10px] text-pd-text-muted uppercase">
                          {{ formatBytes(file.originalSize) }}
                        </span>
                        <ArrowRight class="text-pd-text-disabled h-3 w-3" />
                        <span class="text-[10px] text-pd-accent font-bold uppercase">
                          {{ (file.format || configuration.format).toUpperCase() }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Status -->
                  <div>
                    <div v-if="file.status === 'processing'" class="bg-pd-border h-1 w-full overflow-hidden">
                      <div class="bg-pd-accent h-full w-full animate-[pulse_2s_ease-in-out_infinite]" />
                    </div>
                    <div
                      v-if="file.status === 'done'"
                      class="text-[10px] flex items-center justify-between"
                    >
                      <div class="text-pd-success flex gap-2 items-center">
                        <span class="rounded-full bg-pd-success h-1.5 w-1.5 animate-pulse" />
                        <span>COMPLETED</span>
                      </div>
                      <div class="flex gap-2 items-center">
                        <span class="text-pd-text-muted">{{ formatBytes(file.processedSize || 0) }}</span>
                        <span
                          v-if="file.processedSize"
                          :class="file.processedSize < file.originalSize ? 'text-pd-success' : 'text-pd-warning'"
                        >
                          ({{ Math.round(((file.processedSize - file.originalSize) / file.originalSize) * 100) }}%)
                        </span>
                      </div>
                    </div>
                    <div
                      v-if="file.status === 'error'"
                      class="text-[10px] text-pd-danger flex gap-2 uppercase items-center"
                    >
                      <X class="h-3 w-3" />
                      <span>{{ file.error }}</span>
                    </div>
                    <div
                      v-if="file.status === 'pending'"
                      class="text-[10px] text-pd-text-disabled flex gap-2 uppercase items-center"
                    >
                      <span class="rounded-full bg-pd-text-disabled h-1.5 w-1.5" />
                      <span>READY FOR PROCESSING</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </template>

          <template v-else>
            <div
              v-if="history.length === 0"
              class="text-pd-text-muted py-20 opacity-50 flex flex-1 flex-col h-full items-center justify-center"
            >
              <History class="mb-4 h-12 w-12" :stroke-width="1" />
              <p class="text-sm">
                No history available
              </p>
            </div>

            <div v-else class="gap-4 grid grid-cols-1 xl:grid-cols-2">
              <div
                v-for="record in history"
                :key="record.id"
                class="group border border-pd-border bg-pd-bg-subtle/10 opacity-80 flex flex-col transition-opacity overflow-hidden hover:opacity-100"
              >
                <!-- Preview Area -->
                <div
                  class="bg-bg-angled border-b border-pd-border flex shrink-0 h-48 w-full items-center justify-center relative overflow-hidden"
                >
                  <template v-if="record.savedFile">
                    <HistoryPreview :blob="record.savedFile" />
                  </template>
                  <div v-else class="text-pd-text-disabled flex flex-col gap-2 items-center">
                    <FileImage class="h-8 w-8" :stroke-width="1" />
                    <span class="text-[10px]">NO PREVIEW</span>
                  </div>

                  <div
                    class="opacity-0 flex gap-2 transition-opacity right-2 top-2 absolute group-hover:opacity-100"
                  >
                    <button
                      v-if="record.savedFile"
                      class="text-pd-text-muted p-2 border border-pd-border bg-pd-bg/80 cursor-pointer transition-colors backdrop-blur-md hover:text-pd-accent"
                      title="Download"
                      @click="downloadFile(record.savedFile!, record.originalName, record.format)"
                    >
                      <Download class="h-4 w-4" />
                    </button>
                    <button
                      class="text-pd-text-muted p-2 border border-pd-border bg-pd-bg/80 cursor-pointer transition-colors backdrop-blur-md hover:text-pd-danger"
                      title="Remove"
                      @click="removeHistory(record.id)"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <!-- Info Bar -->
                <div class="p-3 space-y-2">
                  <div class="flex gap-4 items-start justify-between">
                    <div class="min-w-0">
                      <h4 class="text-sm text-pd-text font-bold mb-0.5 truncate">
                        {{ record.originalName }}
                      </h4>
                      <span
                        class="text-[9px] text-pd-text-disabled tracking-tighter uppercase"
                      >
                        {{ new Date(record.timestamp).toLocaleString() }}
                      </span>
                    </div>
                  </div>

                  <div
                    class="text-[10px] pt-2 border-t border-pd-border/50 flex items-center justify-between"
                  >
                    <div class="flex gap-3 items-center">
                      <span class="text-pd-text-muted">{{ formatBytes(record.originalSize) }}</span>
                      <ArrowRight class="text-pd-text-disabled h-3 w-3" />
                      <span class="text-pd-accent font-bold">{{ formatBytes(record.processedSize) }}</span>
                    </div>
                    <span
                      class="text-[9px] text-pd-accent font-bold px-1.5 py-0.5 border border-pd-accent/20 bg-pd-accent-muted"
                    >
                      {{ record.format.toUpperCase() }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>
    </main>
  </div>
</template>
