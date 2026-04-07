<script setup lang="ts">
import type { ParsedData } from '@/components/DataParser/FileUploader.vue'
import {
  ArrowLeft,
  Binary,
  Code2,
  Database,
  Layout,
  RefreshCw,
  Terminal,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import CodePlayground from '@/components/DataParser/CodePlayground.vue'
import DataPreview from '@/components/DataParser/DataPreview.vue'
import FileUploader from '@/components/DataParser/FileUploader.vue'
import TypeDisplay from '@/components/DataParser/TypeDisplay.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { dataParserStorage } from '@/lib/storage'
import { generateMonacoTypes } from '@/utils/type-generator'

const parsedData = ref<ParsedData | null>(null)
const activeTab = ref<'preview' | 'types' | 'editor'>('preview')
const isLoading = ref(false)

// Monaco logic
const editorValue = ref('')
const extraLib = ref('')

// Persistence: debounced save for editor content
let editorSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(editorValue, (val) => {
  if (editorSaveTimer)
    clearTimeout(editorSaveTimer)
  editorSaveTimer = setTimeout(() => {
    dataParserStorage.saveEditorContent(val)
  }, 500)
})

function handleParsed(data: ParsedData) {
  parsedData.value = data
  activeTab.value = 'preview'

  // Prepare Monaco data
  const sampleData = Array.isArray(data.json) ? data.json : Object.values(data.json).flat()
  const isMultiSheet = !Array.isArray(data.json)

  editorValue.value = `// Data Instance${isMultiSheet ? ' (Merged Sheets)' : ''}
const jsonData = ${JSON.stringify(sampleData, null, 2)}

// Example Logic
function processData() {
  // Use 'jsonData' with full IntelliSense
  const result = jsonData.map(item => ({
    ...item,
    processed_at: new Date().toISOString()
  }));

  console.log('Processed', result.length, 'items');
  return result;
}

processData();`

  // Generate type definitions for Monaco
  extraLib.value = generateMonacoTypes(sampleData, data.fileName)

  // Persist data & editor content
  dataParserStorage.saveData({
    json: data.json,
    types: data.types,
    fileName: data.fileName,
    fileType: data.fileType,
    isMultiSheet: data.isMultiSheet,
    sheetNames: data.sheetNames,
  })
  dataParserStorage.saveEditorContent(editorValue.value)
  dataParserStorage.saveExtraLib(extraLib.value)
}

// Reset: clear all persisted state
const isResetting = ref(false)
async function handleReset() {
  isResetting.value = true
  await dataParserStorage.clear()
  parsedData.value = null
  editorValue.value = ''
  extraLib.value = ''
  activeTab.value = 'preview'
  setTimeout(() => {
    isResetting.value = false
  }, 400)
}

// Restore persisted state on mount
onMounted(async () => {
  updateViewportMode()
  const savedData = await dataParserStorage.loadData()
  if (savedData) {
    parsedData.value = {
      json: savedData.json,
      types: savedData.types,
      fileName: savedData.fileName,
      fileType: savedData.fileType,
      isMultiSheet: savedData.isMultiSheet,
      sheetNames: savedData.sheetNames,
    }
  }

  const savedEditor = await dataParserStorage.loadEditorContent()
  if (savedEditor) {
    editorValue.value = savedEditor
  }

  const savedExtraLib = await dataParserStorage.loadExtraLib()
  if (savedExtraLib) {
    extraLib.value = savedExtraLib
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', updateViewportMode)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', updateViewportMode)
  if (editorSaveTimer)
    clearTimeout(editorSaveTimer)
})

// Split pane logic
const leftWidth = ref(40)
const isDragging = ref(false)
const isDesktop = ref(false)

const leftPanelStyle = computed(() => (isDesktop.value
  ? {
      width: `${leftWidth.value}%`,
      flex: `0 0 ${leftWidth.value}%`,
    }
  : {}))
const rightPanelStyle = computed(() => (isDesktop.value
  ? {
      width: `${100 - leftWidth.value}%`,
      flex: `0 0 ${100 - leftWidth.value}%`,
    }
  : {}))

function onDividerMouseDown(e: MouseEvent) {
  if (!isDesktop.value)
    return
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

function updateViewportMode() {
  isDesktop.value = window.innerWidth >= 960
  if (!isDesktop.value)
    isDragging.value = false
}
</script>

<template>
  <div class="text-pd-text bg-pd-bg flex flex-col min-h-screen selection:text-pd-bg selection:bg-pd-accent md:h-screen">
    <!-- Header -->
    <header class="px-4 border-b border-pd-border bg-pd-bg/80 flex h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md md:px-6">
      <div class="flex gap-3 min-w-0 items-center md:gap-4">
        <router-link
          to="/"
          class="text-pd-text-muted flex gap-2 transition-colors items-center hover:text-pd-accent"
        >
          <ArrowLeft class="h-4 w-4" :stroke-width="1.5" />
          <span class="text-xs tracking-widest font-bold hidden uppercase md:inline">Back</span>
        </router-link>
        <div class="bg-pd-border h-5 w-px" />
        <div class="flex gap-2 items-center">
          <div class="p-1.5 border border-pd-accent/20 rounded-[2px] bg-pd-accent-muted">
            <Binary class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Data<span class="text-pd-text-muted">///Parser</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex shrink-0 gap-2 items-center md:gap-3">
        <!-- Reset Button -->
        <button
          v-if="parsedData"
          class="text-[10px] tracking-widest font-bold px-3 py-1.5 border border-pd-border rounded-sm flex gap-1.5 uppercase transition-all items-center hover:text-pd-danger hover:border-pd-danger/50"
          :class="isResetting ? 'opacity-50 pointer-events-none' : ''"
          @click="handleReset"
        >
          <RefreshCw class="h-3 w-3" :class="isResetting ? 'animate-spin' : ''" />
          Reset
        </button>
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main
      id="split-container"
      class="flex flex-1 min-h-0"
      :class="[
        isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto',
        { 'select-none': isDragging },
      ]"
    >
      <!-- Left Panel: Upload & Structure -->
      <div
        class="border-r border-pd-border bg-pd-bg-subtle/20 flex flex-col min-h-[50vh] min-w-0 overflow-hidden"
        :class="isDesktop ? 'flex-none border-b-0 min-h-0' : 'w-full border-b'"
        :style="leftPanelStyle"
      >
        <div class="custom-scrollbar p-4 flex flex-col gap-6 h-full overflow-y-auto md:p-6 md:gap-8">
          <section>
            <h2 class="text-lg text-pd-text tracking-tight font-bold mb-2 uppercase">
              Dataset Input
            </h2>
            <p class="text-xs text-pd-text-muted leading-relaxed tracking-widest mb-4 uppercase">
              Upload your Excel or CSV files to begin extraction and type generation.
            </p>
            <FileUploader @parsed="handleParsed" @loading="l => isLoading = l" />
          </section>

          <section v-if="parsedData" class="flex-1">
            <div class="p-4 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-4">
              <h3 class="text-[10px] text-pd-text-muted tracking-[0.2em] font-bold pb-2 border-b border-pd-border uppercase">
                Extraction Results
              </h3>
              <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
                <div class="p-4 border border-pd-border rounded-sm bg-pd-bg-subtle/30 flex flex-col gap-2 transition-colors hover:bg-pd-bg-subtle/50">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-pd-text-muted tracking-widest uppercase">Status</span>
                    <Database class="text-pd-success h-3 w-3" />
                  </div>
                  <span class="text-xs text-pd-success tracking-tight font-bold uppercase">Validated</span>
                </div>
                <div class="p-4 border border-pd-border rounded-sm bg-pd-bg-subtle/30 flex flex-col gap-2 transition-colors hover:bg-pd-bg-subtle/50">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-pd-text-muted tracking-widest uppercase">Format</span>
                    <Binary class="text-pd-accent h-3 w-3" />
                  </div>
                  <span class="text-xs text-pd-text tracking-tight font-bold uppercase">{{ parsedData.fileType }}</span>
                </div>
                <div class="p-4 border border-pd-border rounded-sm bg-pd-bg-subtle/30 flex flex-col gap-2 transition-colors hover:bg-pd-bg-subtle/50">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-pd-text-muted tracking-widest uppercase">Structure</span>
                    <Layout class="text-pd-text-muted h-3 w-3" />
                  </div>
                  <span class="text-xs text-pd-text tracking-tight font-bold uppercase">{{ parsedData.isMultiSheet ? 'Multi' : 'Single' }}</span>
                </div>
                <div v-if="parsedData.sheetNames" class="p-4 border border-pd-border rounded-sm bg-pd-bg-subtle/30 flex flex-col gap-2 transition-colors hover:bg-pd-bg-subtle/50">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-pd-text-muted tracking-widest uppercase">Sheets</span>
                    <Terminal class="text-pd-accent h-3 w-3" />
                  </div>
                  <span class="text-xs text-pd-text tracking-tight font-bold uppercase">{{ parsedData.sheetNames.length }}</span>
                </div>
              </div>
            </div>
          </section>

          <div v-if="!parsedData" class="opacity-20 flex flex-1 flex-col items-center justify-center">
            <Layout class="mb-4 h-24 w-24" :stroke-width="0.5" />
            <p class="text-xs tracking-[0.3em] uppercase">
              Awaiting Data
            </p>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div
        v-if="isDesktop"
        class="group bg-pd-border/40 shrink-0 w-1 cursor-col-resize transition-colors relative hover:bg-pd-accent/40"
        @mousedown="onDividerMouseDown"
      >
        <div class="bg-pd-border w-px transition-colors inset-y-0 left-1/2 absolute group-hover:bg-pd-accent/60 -translate-x-1/2" />
      </div>

      <!-- Right Panel: Tabs -->
      <div
        class="flex flex-1 flex-col min-h-[50vh] min-w-0 overflow-hidden"
        :class="isDesktop ? 'flex-none min-h-0' : 'w-full'"
        :style="rightPanelStyle"
      >
        <!-- Toolbar Tabs -->
        <div class="px-2 border-b border-pd-border bg-pd-bg-subtle/30 flex shrink-0 items-center overflow-x-auto">
          <button
            v-for="tab in [
              { id: 'preview', label: 'Preview', icon: Database },
              { id: 'types', label: 'Types', icon: Code2 },
              { id: 'editor', label: 'Playground', icon: Terminal },
            ]"
            :key="tab.id"
            class="text-[10px] tracking-widest font-bold px-3 py-3 flex gap-2 whitespace-nowrap uppercase transition-all items-center relative md:px-5"
            :class="[
              activeTab === tab.id ? 'text-pd-accent' : 'text-pd-text-muted hover:text-pd-text disabled:opacity-20 disabled:pointer-events-none',
            ]"
            :disabled="!parsedData"
            @click="activeTab = tab.id as any"
          >
            <component :is="tab.icon" class="h-3.5 w-3.5" />
            {{ tab.label }}
            <div v-if="activeTab === tab.id" class="bg-pd-accent h-0.5 bottom-0 left-0 right-0 absolute" />
          </button>
        </div>

        <!-- Viewport -->
        <div class="flex-1 min-h-[360px] relative overflow-hidden" :class="isDesktop ? 'min-h-0' : ''">
          <div v-if="!parsedData" class="bg-pd-bg-subtle/5 flex flex-col items-center inset-0 justify-center absolute">
            <Database class="text-pd-border/50 mb-4 h-16 w-16" :stroke-width="1" />
            <p class="text-[10px] text-pd-text-disabled tracking-[0.4em] uppercase">
              No active workspace
            </p>
          </div>

          <template v-else>
            <div v-show="activeTab === 'preview'" class="custom-scrollbar p-4 h-full overflow-auto md:p-8">
              <DataPreview
                :data="parsedData.json"
                :file-name="parsedData.fileName"
                :file-type="parsedData.fileType"
                :is-multi-sheet="parsedData.isMultiSheet"
                :sheet-names="parsedData.sheetNames"
              />
            </div>
            <div v-show="activeTab === 'types'" class="custom-scrollbar p-4 h-full overflow-auto md:p-8">
              <TypeDisplay :types="parsedData.types" />
            </div>
            <div v-show="activeTab === 'editor'" class="h-full relative overflow-hidden">
              <CodePlayground
                v-model="editorValue"
                :extra-lib="extraLib"
              />
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--pd-border);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--pd-accent-muted);
}
</style>
