<script setup lang="ts">
import type { PDFWorkerAPI } from '@/lib/pdf.worker'
import type { ProcessingRecord } from '@/lib/storage'
import * as Comlink from 'comlink'
import JSZip from 'jszip'
import {
  ArrowLeft,
  Download,
  Eye,
  FileImage,
  FileStack,
  FileText,
  History as HistoryIcon,
  Layers,
  Loader2,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-vue-next'
import { motion } from 'motion-v'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import HistoryPreview from '@/components/HistoryPreview.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import PDFWorker from '@/lib/pdf.worker?worker'
import { pdfRecordStorage } from '@/lib/storage'
import { downloadFile, formatBytes } from '@/utils'

interface PageItem {
  pageNumber: number
  status: 'pending' | 'processing' | 'done' | 'error'
  resultBlob?: Blob
  previewUrl?: string
}

interface PDFFileItem {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  pages: PageItem[]
  mergedBlob?: Blob
  mergedPreviewUrl?: string
  progress: number
}

const pdfFiles = ref<PDFFileItem[]>([])
const isProcessing = ref(false)
const globalProgress = ref(0)
const config = ref({
  scale: 2,
  format: 'png' as 'png' | 'jpeg',
  mode: 'pages' as 'pages' | 'merge',
})

const activeTab = ref<'queue' | 'history'>('queue')
const history = ref<ProcessingRecord[]>([])

const previewUrl = ref<string | null>(null)
const isPreviewOpen = ref(false)

function openPreview(url: string) {
  previewUrl.value = url
  isPreviewOpen.value = true
}

function createUrl(blob: Blob) {
  return URL.createObjectURL(blob)
}

function closePreview() {
  isPreviewOpen.value = false
  previewUrl.value = null
}

// Worker setup
let worker: Worker | null = null
let workerApi: Comlink.Remote<PDFWorkerAPI> | null = null

async function loadHistory() {
  history.value = await pdfRecordStorage.getRecords()
}

onMounted(() => {
  worker = new PDFWorker()
  workerApi = Comlink.wrap<PDFWorkerAPI>(worker)
  loadHistory()
})

onUnmounted(() => {
  worker?.terminate()
  cleanupPreviews()
})

function cleanupPreviews() {
  pdfFiles.value.forEach((file) => {
    file.pages.forEach((page) => {
      if (page.previewUrl)
        URL.revokeObjectURL(page.previewUrl)
    })
    if (file.mergedPreviewUrl) {
      URL.revokeObjectURL(file.mergedPreviewUrl)
    }
  })
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    const files = Array.from(input.files).filter(f => f.type === 'application/pdf')
    for (const file of files) {
      await addFile(file)
    }
  }
  input.value = ''
}

async function addFile(file: File) {
  if (!workerApi)
    return

  const id = crypto.randomUUID()
  const pageCount = await workerApi.getPageCount(file)

  pdfFiles.value.push({
    id,
    file,
    status: 'pending',
    pages: Array.from({ length: pageCount }, (_, i) => ({
      pageNumber: i + 1,
      status: 'pending',
    })),
    progress: 0,
  })
}

function removeFile(id: string) {
  const file = pdfFiles.value.find(f => f.id === id)
  if (file) {
    file.pages.forEach((p) => {
      if (p.previewUrl)
        URL.revokeObjectURL(p.previewUrl)
    })
    if (file.mergedPreviewUrl) {
      URL.revokeObjectURL(file.mergedPreviewUrl)
    }
  }
  pdfFiles.value = pdfFiles.value.filter(f => f.id !== id)
}

function clearQueue() {
  cleanupPreviews()
  pdfFiles.value = []
}

async function clearHistory() {
  await pdfRecordStorage.clearRecords()
  await loadHistory()
}

async function removeHistory(id: string) {
  await pdfRecordStorage.deleteRecord(id)
  await loadHistory()
}

async function processAll() {
  if (isProcessing.value || !workerApi || pdfFiles.value.length === 0)
    return

  isProcessing.value = true
  globalProgress.value = 0

  const pendingFiles = pdfFiles.value.filter(f => f.status !== 'done')
  let totalProcessed = 0
  const totalItems = config.value.mode === 'pages'
    ? pendingFiles.reduce((acc, f) => acc + f.pages.length, 0)
    : pendingFiles.length

  for (const fileItem of pendingFiles) {
    fileItem.status = 'processing'
    fileItem.progress = 0

    try {
      if (config.value.mode === 'merge') {
        const blob = await workerApi.renderAllPagesToLongImage(
          fileItem.file,
          config.value.scale,
          config.value.format,
        )
        fileItem.mergedBlob = blob
        fileItem.mergedPreviewUrl = URL.createObjectURL(blob)
        fileItem.status = 'done'
        fileItem.progress = 100

        // Save history record
        const record: ProcessingRecord = {
          id: fileItem.id,
          originalName: fileItem.file.name,
          timestamp: Date.now(),
          format: config.value.format,
          originalSize: fileItem.file.size,
          processedSize: blob.size,
          scale: config.value.scale,
          savedFile: blob,
          pagesCount: fileItem.pages.length,
        }
        await pdfRecordStorage.saveRecord(record)

        totalProcessed++
        globalProgress.value = Math.round((totalProcessed / totalItems) * 100)
      }
      else {
        let pageCount = 0
        const pageBlobs: Blob[] = []
        for (const page of fileItem.pages) {
          if (!workerApi)
            break
          page.status = 'processing'
          try {
            const blob = await workerApi.renderPageToImage(
              fileItem.file,
              page.pageNumber,
              config.value.scale,
              config.value.format,
            )
            page.resultBlob = blob
            page.previewUrl = URL.createObjectURL(blob)
            page.status = 'done'
            pageBlobs.push(blob)
          }
          catch (e) {
            console.error(e)
            page.status = 'error'
          }
          pageCount++
          fileItem.progress = Math.round((pageCount / fileItem.pages.length) * 100)
          totalProcessed++
          globalProgress.value = Math.round((totalProcessed / totalItems) * 100)
        }
        fileItem.status = 'done'

        // Save history record for multi-page (we store the first page as preview)
        if (pageBlobs.length > 0) {
          const record: ProcessingRecord = {
            id: fileItem.id,
            originalName: fileItem.file.name,
            timestamp: Date.now(),
            format: 'zip',
            originalSize: fileItem.file.size,
            processedSize: pageBlobs.reduce((acc, b) => acc + b.size, 0),
            scale: config.value.scale,
            savedFile: pageBlobs[0], // Store first page for preview
            pagesCount: fileItem.pages.length,
          }
          await pdfRecordStorage.saveRecord(record)
        }
      }
    }
    catch (error) {
      console.error('Failed to process file:', fileItem.file.name, error)
      fileItem.status = 'error'
    }
  }

  isProcessing.value = false
  await loadHistory()
}

async function downloadZip() {
  const zip = new JSZip()

  pdfFiles.value.filter(f => f.status === 'done').forEach((file) => {
    const baseName = file.file.name.replace('.pdf', '')
    if (config.value.mode === 'merge' && file.mergedBlob) {
      zip.file(`${baseName}.${config.value.format}`, file.mergedBlob)
    }
    else {
      const folder = zip.folder(baseName)
      file.pages.forEach((page) => {
        if (page.resultBlob) {
          folder?.file(`page-${page.pageNumber}.${config.value.format}`, page.resultBlob)
        }
      })
    }
  })

  const content = await zip.generateAsync({ type: 'blob' })
  downloadFile(content, 'pandora-pdf-export', 'zip' as any)
}

const doneCount = computed(() => {
  if (config.value.mode === 'merge') {
    return pdfFiles.value.filter(f => f.status === 'done').length
  }
  return pdfFiles.value.reduce((acc, f) => acc + f.pages.filter(p => p.status === 'done').length, 0)
})

const hasFiles = computed(() => pdfFiles.value.length > 0)
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col min-h-screen selection:text-pd-accent selection:bg-pd-accent-muted md:h-screen"
  >
    <!-- Header -->
    <header
      class="px-4 border-b border-pd-border bg-pd-bg/80 flex shrink-0 h-14 shadow-sm items-center top-0 justify-between sticky z-50 backdrop-blur-md md:px-6"
    >
      <div class="flex gap-3 min-w-0 items-center md:gap-4">
        <router-link to="/" class="text-pd-text-muted flex gap-2 transition-colors items-center hover:text-pd-accent">
          <ArrowLeft class="h-4 w-4" :stroke-width="1.5" />
          <span class="text-xs tracking-widest hidden uppercase md:inline">Back</span>
        </router-link>
        <div class="bg-pd-border h-5 w-px" />
        <div class="flex gap-2 items-center">
          <div class="p-1.5 border border-pd-accent/20 rounded-[2px] bg-pd-accent-muted">
            <FileImage class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Pandora<span class="text-pd-text-muted">///PDF_BATCH</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <div class="gap-2 hidden items-center lg:flex">
          <span class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">Mode</span>
          <span class="text-xs text-pd-accent">MULTI_THREAD_PDF</span>
        </div>
        <div class="mx-2 bg-pd-border h-4 w-px" />
        <ThemeToggle />
      </div>
    </header>

    <main
      class="bg-bg-angled p-4 flex-1 gap-6 grid grid-cols-1 min-h-0 lg:p-8 sm:p-6 lg:gap-8 lg:grid-cols-12 lg:overflow-hidden"
    >
      <!-- Left Panel -->
      <section class="custom-scrollbar pr-2 flex flex-col gap-6 col-span-1 overflow-y-auto lg:col-span-4 xl:col-span-3">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg text-pd-text tracking-tight font-bold flex gap-2 uppercase items-center">
            PDF Toolkit
          </h2>
          <p class="text-[11px] text-pd-text-secondary leading-relaxed">
            High-performance PDF browser processing. Batch convert multiple files with ease.
          </p>
        </div>

        <div class="p-6 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-6 shadow-black/5 shadow-xl">
          <div class="pb-4 border-b border-pd-border flex gap-2 items-center">
            <Settings class="text-pd-accent h-4 w-4" />
            <span class="text-xs tracking-widest font-bold uppercase">Settings</span>
          </div>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label class="text-xs text-pd-text-muted uppercase">Process Mode</label>
              <div class="flex gap-1">
                <button
                  class="text-[10px] text-pd-text-muted font-bold py-1.5 border border-pd-border rounded-sm flex-1 uppercase transition-all hover:border-pd-accent/50"
                  :class="config.mode === 'pages' ? 'bg-pd-accent border-pd-accent text-white' : ''"
                  @click="config.mode = 'pages'"
                >
                  Split
                </button>
                <button
                  class="text-[10px] text-pd-text-muted font-bold py-1.5 border border-pd-border rounded-sm flex-1 uppercase transition-all hover:border-pd-accent/50"
                  :class="config.mode === 'merge' ? 'bg-pd-accent border-pd-accent text-white' : ''"
                  @click="config.mode = 'merge'"
                >
                  Merge
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-xs text-pd-text-muted uppercase">Scale</label>
              <select
                v-model.number="config.scale"
                class="text-sm px-3 py-2 appearance-none border border-pd-border rounded-sm bg-pd-bg-subtle w-full focus:outline-none"
              >
                <option :value="1">
                  1.0x
                </option>
                <option :value="2">
                  2.0x
                </option>
                <option :value="3">
                  3.0x
                </option>
              </select>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-xs text-pd-text-muted uppercase">Format</label>
              <div class="flex gap-2">
                <button
                  v-for="fmt in (['png', 'jpeg'] as const)" :key="fmt"
                  class="text-[10px] text-pd-text-muted font-bold py-1.5 border border-pd-border rounded-sm flex-1 uppercase transition-all hover:border-pd-accent/50"
                  :class="config.format === fmt ? 'bg-pd-accent border-pd-accent text-white' : ''"
                  @click="config.format = fmt"
                >
                  {{ fmt }}
                </button>
              </div>
            </div>
          </div>

          <button
            :disabled="!hasFiles || isProcessing"
            class="text-sm tracking-widest font-bold py-3 rounded-sm flex gap-2 w-full uppercase transition-all items-center justify-center"
            :class="hasFiles && !isProcessing ? 'bg-pd-accent text-white hover:bg-pd-accent-hover cursor-pointer' : 'bg-pd-bg-subtle text-pd-text-disabled cursor-not-allowed'"
            @click="processAll"
          >
            <Loader2 v-if="isProcessing" class="h-4 w-4 animate-spin" />
            <FileStack v-else class="h-4 w-4" />
            {{ isProcessing ? `Processing ${globalProgress}%` : 'Process Batch' }}
          </button>

          <button
            v-if="doneCount > 0"
            class="text-sm text-pd-success tracking-widest py-3 border border-pd-success rounded-sm flex gap-2 w-full cursor-pointer uppercase transition-all items-center justify-center hover:bg-pd-success/5"
            @click="downloadZip"
          >
            <Download class="h-4 w-4" />
            Zip Download
          </button>
        </div>

        <!-- Queue Section -->
        <div class="flex flex-col gap-3">
          <div class="px-1 flex items-center justify-between">
            <span class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">Files</span>
            <button
              class="text-[10px] text-pd-accent flex gap-1 uppercase items-center hover:underline"
              @click="() => ($refs.fileInput as HTMLInputElement).click()"
            >
              <Plus class="h-3 w-3" /> Add PDF
            </button>
            <input
              ref="fileInput" type="file" multiple accept="application/pdf" class="hidden"
              @change="handleFileSelect"
            >
          </div>

          <div
            v-if="pdfFiles.length === 0"
            class="text-pd-text-disabled border-2 border-pd-border/50 rounded-sm border-dashed bg-pd-bg-subtle/30 flex flex-col h-32 items-center justify-center"
          >
            <FileText class="mb-1 opacity-20 h-8" />
            <span class="text-[9px] uppercase">Ready to receive</span>
          </div>

          <div v-else class="flex flex-col gap-2">
            <div
              v-for="file in pdfFiles" :key="file.id"
              class="p-3 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-2"
            >
              <div class="flex items-start justify-between">
                <div class="min-w-0">
                  <p class="text-[11px] tracking-tighter font-bold truncate uppercase">
                    {{ file.file.name }}
                  </p>
                  <p class="text-[9px] text-pd-text-muted mt-0.5">
                    {{ formatBytes(file.file.size) }} • {{
                      file.pages.length }}P
                  </p>
                </div>
                <button
                  class="text-pd-text-muted p-1 transition-colors hover:text-pd-danger"
                  @click="removeFile(file.id)"
                >
                  <X class="h-3 w-3" />
                </button>
              </div>
              <div v-if="file.status === 'processing'" class="bg-pd-border h-1 w-full overflow-hidden">
                <div class="bg-pd-accent h-full transition-all duration-300" :style="{ width: `${file.progress}%` }" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Panel -->
      <section
        class="border border-pd-border rounded-sm bg-pd-bg/60 flex flex-col col-span-1 shadow-2xl backdrop-blur-sm lg:col-span-8 xl:col-span-9 lg:min-h-[600px] lg:overflow-hidden"
      >
        <div class="border-b border-pd-border flex relative">
          <button
            class="text-xs tracking-wide font-bold px-6 py-3.5 flex gap-2 cursor-pointer uppercase transition-all items-center relative"
            :class="activeTab === 'queue' ? 'bg-pd-bg-subtle/80 text-pd-text' : 'text-pd-text-muted hover:text-pd-text hover:bg-pd-bg-subtle/40'"
            @click="activeTab = 'queue'"
          >
            <Layers class="h-4 w-4" :class="{ 'text-pd-accent': activeTab === 'queue' }" />
            Workspace ({{ pdfFiles.length }})
            <div v-if="activeTab === 'queue'" class="bg-pd-accent h-[2px] bottom-[-1px] left-0 right-0 absolute" />
          </button>
          <button
            class="text-xs tracking-wide font-bold px-6 py-3.5 border-l border-pd-border/50 flex gap-2 cursor-pointer uppercase transition-all items-center relative"
            :class="activeTab === 'history' ? 'bg-pd-bg-subtle/80 text-pd-text' : 'text-pd-text-muted hover:text-pd-text hover:bg-pd-bg-subtle/40'"
            @click="activeTab = 'history'"
          >
            <HistoryIcon class="h-4 w-4" :class="{ 'text-pd-accent': activeTab === 'history' }" />
            History ({{ history.length }})
            <div v-if="activeTab === 'history'" class="bg-pd-accent h-[2px] bottom-[-1px] left-0 right-0 absolute" />
          </button>
          <div class="flex-1" />
          <button
            v-if="activeTab === 'queue' && pdfFiles.length > 0"
            class="text-xs text-pd-text-muted px-4 py-3 flex gap-2 cursor-pointer transition-colors items-center hover:text-pd-danger"
            @click="clearQueue"
          >
            <Trash2 class="h-3 w-3" /> Clear
          </button>
          <button
            v-if="activeTab === 'history' && history.length > 0"
            class="text-xs text-pd-text-muted px-4 py-3 flex gap-1 cursor-pointer transition-colors items-center hover:text-pd-danger"
            @click="clearHistory"
          >
            <Trash2 class="h-3 w-3" /> Flush
          </button>
        </div>

        <div class="custom-scrollbar p-6 flex flex-1 flex-col overflow-y-auto">
          <template v-if="activeTab === 'queue'">
            <div
              v-if="pdfFiles.length === 0"
              class="text-pd-text-muted py-20 opacity-30 flex flex-col h-full items-center justify-center"
            >
              <FileImage class="mb-4 h-16 w-16" :stroke-width="1" />
              <p class="text-xs tracking-widest uppercase">
                Workspace Empty
              </p>
            </div>

            <div v-else class="flex flex-col gap-10">
              <div v-for="file in pdfFiles" :key="file.id" class="flex flex-col gap-4">
                <div class="pb-2 border-b border-pd-border flex items-center justify-between">
                  <div class="flex gap-2 items-center">
                    <FileText class="text-pd-accent h-4 w-4" />
                    <span class="text-[10px] tracking-widest font-bold max-w-sm truncate uppercase">{{ file.file.name
                    }}</span>
                  </div>
                  <span class="text-[9px] text-pd-text-muted tracking-tighter uppercase">{{ file.status }}</span>
                </div>

                <div v-if="config.mode === 'merge'" class="flex justify-center">
                  <div
                    v-if="file.mergedPreviewUrl"
                    class="group border border-pd-border bg-pd-bg-subtle/30 max-w-2xl shadow-lg relative overflow-hidden"
                  >
                    <img :src="file.mergedPreviewUrl" class="h-auto max-w-full" alt="Merged">
                    <div
                      class="bg-black/40 opacity-0 flex gap-4 transition-opacity items-center inset-0 justify-center absolute group-hover:opacity-100"
                    >
                      <button
                        class="text-white p-3 rounded-full bg-pd-accent cursor-pointer shadow-xl transition-transform hover:scale-110"
                        @click="openPreview(file.mergedPreviewUrl!)"
                      >
                        <Eye class="h-5 w-5" />
                      </button>
                      <button
                        class="text-white p-3 border border-white/20 rounded-full bg-white/10 cursor-pointer transition-transform backdrop-blur-md hover:scale-110"
                        @click="downloadFile(file.mergedBlob!, file.file.name, config.format)"
                      >
                        <Download class="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div
                    v-else-if="file.status === 'processing'"
                    class="opacity-40 flex h-32 items-center justify-center"
                  >
                    <Loader2 class="text-pd-accent h-8 w-8 animate-spin" />
                  </div>
                </div>

                <div v-else class="gap-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  <motion.div
                    v-for="page in file.pages" :key="page.pageNumber" :initial="{ opacity: 0, scale: 0.95 }"
                    :animate="{ opacity: 1, scale: 1 }"
                    class="group border border-pd-border bg-pd-bg-subtle/30 flex flex-col aspect-[1/1.4] relative overflow-hidden"
                  >
                    <div class="p-2 flex flex-1 items-center justify-center">
                      <img
                        v-if="page.previewUrl" :src="page.previewUrl"
                        class="max-h-full max-w-full shadow-lg object-contain" loading="lazy"
                      >
                      <Loader2 v-else-if="page.status === 'processing'" class="text-pd-accent h-6 w-6 animate-spin" />
                      <div v-else class="text-[9px] opacity-20 uppercase">
                        Page {{ page.pageNumber }}
                      </div>
                    </div>
                    <div
                      class="bg-black/50 opacity-0 flex gap-2 transition-opacity items-center inset-0 justify-center absolute group-hover:opacity-100"
                    >
                      <button
                        v-if="page.previewUrl"
                        class="text-white p-2 rounded-full bg-pd-accent cursor-pointer transition-transform hover:scale-110"
                        @click="openPreview(page.previewUrl)"
                      >
                        <Eye class="h-4 w-4" />
                      </button>
                      <button
                        v-if="page.resultBlob"
                        class="text-white p-2 border border-white/20 rounded-full bg-white/10 cursor-pointer transition-transform backdrop-blur-md hover:scale-110"
                        @click="downloadFile(page.resultBlob, `page-${page.pageNumber}`, config.format)"
                      >
                        <Download class="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              v-if="history.length === 0"
              class="text-pd-text-muted py-20 opacity-30 flex flex-col h-full items-center justify-center"
            >
              <HistoryIcon class="mb-4 h-16 w-16" :stroke-width="1" />
              <p class="text-xs tracking-widest uppercase">
                No history yet
              </p>
            </div>

            <div v-else class="flex flex-col gap-3">
              <div
                v-for="record in history" :key="record.id"
                class="group border border-pd-border bg-pd-bg-subtle/10 flex h-24 transition-all relative overflow-hidden hover:border-pd-accent/30 hover:bg-pd-bg-subtle/20"
              >
                <!-- Compact Preview -->
                <div
                  class="bg-bg-angled border-r border-pd-border flex shrink-0 w-24 shadow-inner items-center justify-center relative overflow-hidden"
                >
                  <HistoryPreview v-if="record.savedFile" :blob="record.savedFile" />
                  <div v-else class="opacity-10">
                    <FileImage class="h-6 w-6" />
                  </div>

                  <div
                    class="bg-black/60 opacity-0 flex gap-2 transition-opacity items-center inset-0 justify-center absolute group-hover:opacity-100"
                  >
                    <button
                      v-if="record.savedFile"
                      class="text-white p-1.5 rounded-sm bg-pd-accent cursor-pointer transition-transform hover:scale-110"
                      @click="openPreview(createUrl(record.savedFile))"
                    >
                      <Eye class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Content -->
                <div class="p-3 flex flex-1 flex-col min-w-0 justify-between">
                  <div class="flex gap-4 items-start justify-between">
                    <div class="min-w-0">
                      <h4 class="text-xs tracking-tight font-bold truncate uppercase">
                        {{ record.originalName }}
                      </h4>
                      <p class="text-[9px] text-pd-text-muted tracking-tighter mt-0.5 uppercase">
                        {{ new Date(record.timestamp).toLocaleString() }}
                      </p>
                    </div>

                    <button
                      class="text-pd-text-muted p-1 opacity-0 transition-all hover:text-pd-danger group-hover:opacity-100"
                      @click="removeHistory(record.id)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div class="flex gap-6 items-center">
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Scale</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ record.scale }}x</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Pages</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ record.pagesCount }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Size</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ formatBytes(record.processedSize) }}</span>
                    </div>
                    <div class="flex-1" />
                    <span
                      class="text-[8px] text-pd-accent tracking-widest font-bold px-1.5 py-0.5 border border-pd-accent/20 rounded-sm bg-pd-accent-muted uppercase"
                    >
                      {{ record.format }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>
    </main>

    <!-- Preview Modal -->
    <transition
      enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isPreviewOpen"
        class="p-4 bg-black/95 flex items-center inset-0 justify-center fixed z-[100] backdrop-blur-md md:p-12"
        @click="closePreview"
      >
        <button
          class="text-white/40 p-3 transition-colors right-8 top-8 absolute z-50 hover:text-white"
          @click="closePreview"
        >
          <X class="h-8 w-8" />
        </button>
        <div class="flex h-full max-w-full shadow-2xl items-center justify-center relative" @click.stop>
          <img
            v-if="previewUrl" :src="previewUrl" class="border border-white/10 max-h-full max-w-full object-contain"
            alt="Preview"
          >
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--pd-border);
  border-radius: 10px;
}
</style>
