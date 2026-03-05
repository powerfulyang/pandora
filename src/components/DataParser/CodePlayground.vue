<script setup lang="ts">
import type * as MonacoType from 'monaco-editor'
import type { RunnerLog } from './runners/code-runner.worker'
import * as Comlink from 'comlink'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Copy, Loader2, Play, Trash2, X } from 'lucide-vue-next'
import { nextTick, ref, watch } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import MonacoEditor from '@/components/MonacoEditor.vue'
import { useTheme } from '@/composables/useTheme'
import { transpileTypeScript } from '@/utils/transpiler'
import CodeRunnerWorker from './runners/code-runner.worker?worker'
import 'vue-json-pretty/lib/styles.css'

const props = defineProps<{
  modelValue: string
  extraLib?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { resolvedTheme } = useTheme()

// Output state
interface OutputEntry {
  id: number
  type: 'log' | 'warn' | 'error' | 'info' | 'result' | 'table'
  args: any[]
  timestamp: number
}

const output = ref<OutputEntry[]>([])
const isRunning = ref(false)
const executionTime = ref<number | null>(null)
const outputPanelHeight = ref(200)
const isOutputCollapsed = ref(false)
const outputEl = ref<HTMLElement | null>(null)
let entryId = 0

// Resizing output panel
const isResizingOutput = ref(false)
let resizeStartY = 0
let resizeStartHeight = 0

function onOutputResizeStart(e: MouseEvent) {
  isResizingOutput.value = true
  resizeStartY = e.clientY
  resizeStartHeight = outputPanelHeight.value
  e.preventDefault()

  const onMove = (ev: MouseEvent) => {
    const delta = resizeStartY - ev.clientY
    outputPanelHeight.value = Math.min(Math.max(resizeStartHeight + delta, 80), 600)
  }
  const onUp = () => {
    isResizingOutput.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// Code execution
async function runCode() {
  if (isRunning.value)
    return

  isRunning.value = true
  output.value = []
  executionTime.value = null
  isOutputCollapsed.value = false

  const start = performance.now()

  const logHandler = Comlink.proxy((log: RunnerLog) => {
    output.value.push({
      id: entryId++,
      type: log.type,
      args: log.args,
      timestamp: Date.now(),
    })
  })

  let worker: Worker | null = null
  try {
    // 1. Transpile TS to JS using esbuild-wasm
    const jsCode = await transpileTypeScript(props.modelValue)

    // 2. Execute in Worker
    worker = new CodeRunnerWorker()
    const runner = Comlink.wrap<any>(worker)

    const result = await runner.execute(jsCode, logHandler)

    if (result !== undefined) {
      output.value.push({
        id: entryId++,
        type: 'result',
        args: [serializeArg(result)],
        timestamp: Date.now(),
      })
    }
  }
  catch (error: any) {
    output.value.push({
      id: entryId++,
      type: 'error',
      args: [error.message || String(error)],
      timestamp: Date.now(),
    })
  }
  finally {
    executionTime.value = Math.round((performance.now() - start) * 100) / 100
    isRunning.value = false
    if (worker) {
      worker.terminate()
    }
    (logHandler as any)[Comlink.releaseProxy]()
  }
}

// Auto-scroll output
watch(() => output.value.length, async () => {
  if (isOutputCollapsed.value)
    return
  await nextTick()
  if (outputEl.value) {
    outputEl.value.scrollTo({
      top: outputEl.value.scrollHeight,
      behavior: 'smooth',
    })
  }
})

function serializeArg(value: any): any {
  if (value === undefined)
    return 'undefined'
  if (value === null)
    return null
  if (typeof value === 'function')
    return `[Function: ${value.name || 'anonymous'}]`
  if (typeof value === 'symbol')
    return String(value)

  try {
    // Check for circular references
    JSON.stringify(value)
    return value
  }
  catch {
    return String(value)
  }
}

function formatValue(value: any): string {
  if (value === null)
    return 'null'
  if (value === 'undefined')
    return 'undefined'
  if (typeof value === 'string')
    return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function isExpandable(value: any): boolean {
  return typeof value === 'object' && value !== null
}

function clearOutput() {
  output.value = []
  executionTime.value = null
}

// Copy output
const copied = ref(false)
function copyOutput() {
  const text = output.value
    .map(e => `[${e.type.toUpperCase()}] ${e.args.map(formatValue).join(' ')}`)
    .join('\n')
  navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

// Keyboard shortcut
function handleKeyDown(e: KeyboardEvent) {
  // Ctrl/Cmd + Enter to run
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    runCode()
  }
}

// v-model proxy
watch(() => props.modelValue, () => {})

function onEditorUpdate(val: string) {
  emit('update:modelValue', val)
}

function onEditorMount(editor: MonacoType.editor.IStandaloneCodeEditor, monaco: typeof MonacoType) {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    runCode()
  })
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" @keydown="handleKeyDown">
    <!-- Toolbar -->
    <div class="px-3 py-1.5 border-b border-pd-border bg-pd-bg-subtle/30 flex shrink-0 gap-2 items-center justify-between">
      <div class="flex gap-2 items-center">
        <button
          class="text-[10px] tracking-widest font-bold px-4 py-1.5 rounded-sm flex gap-2 uppercase transition-all items-center"
          :class="isRunning
            ? 'bg-pd-text-muted/20 text-pd-text-muted cursor-not-allowed'
            : 'bg-pd-success/90 text-pd-bg shadow-sm hover:bg-pd-success'"
          :disabled="isRunning"
          @click="runCode"
        >
          <Loader2 v-if="isRunning" class="h-3.5 w-3.5 animate-spin" />
          <Play v-else class="h-3.5 w-3.5" />
          {{ isRunning ? 'Running...' : 'Run' }}
        </button>
        <span class="text-[9px] text-pd-text-muted tracking-wider">
          <kbd class="font-mono px-1.5 py-0.5 border border-pd-border rounded-[2px] bg-pd-bg-subtle/50">Ctrl</kbd>
          +
          <kbd class="font-mono px-1.5 py-0.5 border border-pd-border rounded-[2px] bg-pd-bg-subtle/50">Enter</kbd>
        </span>
      </div>

      <div class="flex gap-1 items-center">
        <div v-if="executionTime !== null" class="text-[9px] text-pd-text-muted tracking-wider mr-2 flex gap-1 items-center">
          <Clock class="h-3 w-3" />
          {{ executionTime }}ms
        </div>
      </div>
    </div>

    <!-- Editor Area -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <MonacoEditor
        :model-value="modelValue"
        :extra-lib="extraLib"
        language="typescript"
        :theme="resolvedTheme === 'dark' ? 'vs-dark' : 'vs'"
        auto-scroll
        @update:model-value="onEditorUpdate"
        @mount="onEditorMount"
      />
    </div>

    <!-- Output Resize Handle -->
    <div
      class="group bg-pd-border/40 shrink-0 h-1 cursor-row-resize transition-colors relative hover:bg-pd-accent/40"
      @mousedown="onOutputResizeStart"
    >
      <div class="bg-pd-border h-px transition-colors inset-x-0 top-1/2 absolute group-hover:bg-pd-accent/60 -translate-y-1/2" />
    </div>

    <!-- Output Panel -->
    <div
      class="border-t border-pd-border bg-pd-bg flex shrink-0 flex-col overflow-hidden"
      :style="{ height: isOutputCollapsed ? 'auto' : `${outputPanelHeight}px` }"
    >
      <!-- Output Header -->
      <div class="px-3 py-1.5 border-b border-pd-border bg-pd-bg-subtle/20 flex shrink-0 items-center justify-between">
        <button
          class="text-[10px] text-pd-text-muted tracking-widest font-bold flex gap-1.5 uppercase transition-colors items-center hover:text-pd-text"
          @click="isOutputCollapsed = !isOutputCollapsed"
        >
          <component :is="isOutputCollapsed ? ChevronUp : ChevronDown" class="h-3 w-3" />
          Console Output
          <span v-if="output.length > 0" class="text-[9px] text-pd-accent px-1.5 py-0.5 rounded-full bg-pd-accent/15">
            {{ output.length }}
          </span>
        </button>

        <div class="flex gap-1 items-center">
          <button
            v-if="output.length > 0"
            class="text-pd-text-muted p-1 rounded-sm transition-colors hover:text-pd-text hover:bg-pd-bg-subtle/50"
            :title="copied ? 'Copied!' : 'Copy Output'"
            @click="copyOutput"
          >
            <component :is="copied ? Check : Copy" class="h-3 w-3" />
          </button>
          <button
            v-if="output.length > 0"
            class="text-pd-text-muted p-1 rounded-sm transition-colors hover:text-pd-danger hover:bg-pd-bg-subtle/50"
            title="Clear Output"
            @click="clearOutput"
          >
            <Trash2 class="h-3 w-3" />
          </button>
        </div>
      </div>

      <!-- Output Content -->
      <div
        v-if="!isOutputCollapsed"
        ref="outputEl"
        class="custom-scrollbar text-xs font-mono p-3 flex-1 overflow-auto space-y-0.5"
      >
        <!-- Empty State -->
        <div v-if="output.length === 0" class="text-[10px] text-pd-text-disabled tracking-widest flex flex-col gap-2 h-full uppercase items-center justify-center">
          <Play class="opacity-30 h-6 w-6" />
          <span>Run code to see output</span>
        </div>

        <!-- Output Entries -->
        <div
          v-for="entry in output"
          :key="entry.id"
          class="px-3 py-1.5 rounded-sm flex gap-3 transition-colors items-start"
          :class="{
            'bg-pd-bg-subtle/30 text-pd-text': entry.type === 'log' || entry.type === 'table',
            'bg-amber-500/8 text-amber-400 dark:text-amber-300': entry.type === 'warn',
            'bg-pd-danger/8 text-pd-danger': entry.type === 'error',
            'bg-blue-500/8 text-blue-400 dark:text-blue-300': entry.type === 'info',
            'bg-pd-success/8 text-pd-success border-l-2 border-pd-success/40': entry.type === 'result',
          }"
        >
          <!-- Type Badge -->
          <span
            class="text-[9px] tracking-wider font-bold mt-0.5 px-1.5 py-0.5 rounded-[2px] shrink-0 uppercase"
            :class="{
              'bg-pd-text-muted/15 text-pd-text-muted': entry.type === 'log',
              'bg-amber-500/15 text-amber-500': entry.type === 'warn',
              'bg-pd-danger/15 text-pd-danger': entry.type === 'error',
              'bg-blue-500/15 text-blue-500': entry.type === 'info',
              'bg-pd-success/15 text-pd-success': entry.type === 'result',
              'bg-pd-accent/15 text-pd-accent': entry.type === 'table',
            }"
          >
            <AlertTriangle v-if="entry.type === 'warn'" class="h-3 w-3 inline" />
            <X v-else-if="entry.type === 'error'" class="h-3 w-3 inline" />
            <template v-else>{{ entry.type === 'result' ? '⇐' : '›' }}</template>
          </span>

          <!-- Content -->
          <div class="flex-1 min-w-0 overflow-x-auto">
            <template v-for="(arg, i) in entry.args" :key="i">
              <!-- JSON View for objects/arrays -->
              <div v-if="isExpandable(arg) && entry.type !== 'table'" class="my-1 border border-pd-border/30 rounded-sm bg-pd-bg-subtle/20 overflow-hidden">
                <VueJsonPretty
                  :data="arg"
                  :deep="1"
                  :show-length="true"
                  :theme="resolvedTheme === 'dark' ? 'dark' : 'light'"
                  class="text-[11px] p-2"
                />
              </div>

              <!-- Table display for arrays/objects (when type is table) -->
              <div v-else-if="entry.type === 'table' && isExpandable(arg)" class="overflow-x-auto">
                <table class="text-[11px] text-left min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th
                        v-for="key in Object.keys(Array.isArray(arg) ? (arg[0] || {}) : arg)"
                        :key="key"
                        class="text-pd-text-muted px-2 py-1 border-b border-pd-border whitespace-nowrap"
                      >
                        {{ key }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-if="Array.isArray(arg)">
                      <tr v-for="(row, ri) in arg.slice(0, 50)" :key="ri">
                        <td
                          v-for="key in Object.keys(arg[0] || {})"
                          :key="key"
                          class="px-2 py-0.5 border-b border-pd-border/30 whitespace-nowrap"
                        >
                          {{ formatValue(row[key]) }}
                        </td>
                      </tr>
                    </template>
                    <template v-else>
                      <tr>
                        <td
                          v-for="key in Object.keys(arg)"
                          :key="key"
                          class="px-2 py-0.5 border-b border-pd-border/30 whitespace-nowrap"
                        >
                          {{ formatValue(arg[key]) }}
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>

              <!-- Primitive values -->
              <span v-else class="leading-6 whitespace-pre-wrap break-all">
                {{ formatValue(arg) }}
                <template v-if="i < entry.args.length - 1">{{ ' ' }}</template>
              </span>
            </template>
          </div>
        </div>
      </div>
    </div>
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
