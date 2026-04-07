<script setup lang="ts">
import md5 from 'js-md5'
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  FileKey,
  FileUp,
  Hash,
  Key,
  Link,
  RotateCcw,
  Type,
  Upload,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

// ─── Tab System ───
type TabId = 'base64' | 'url' | 'hash' | 'jwt' | 'unicode'

const tabs = [
  { id: 'base64' as const, label: 'Base64', icon: FileKey },
  { id: 'url' as const, label: 'URL', icon: Link },
  { id: 'hash' as const, label: 'Hash', icon: Hash },
  { id: 'jwt' as const, label: 'JWT', icon: Key },
  { id: 'unicode' as const, label: 'Unicode', icon: Type },
]

const activeTab = ref<TabId>('base64')
const input = ref('')
const output = ref('')
const copySuccess = ref(false)
const isFileMode = ref(false)
const fileName = ref('')
const errorMessage = ref('')

// ─── Hash Specific ───
type HashAlgo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
const hashAlgo = ref<HashAlgo>('SHA-256')
const hashAlgos: HashAlgo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

// ─── Computed ───
const inputLabel = computed(() => {
  switch (activeTab.value) {
    case 'base64': return isFileMode.value ? 'FILE INPUT' : 'TEXT / BASE64'
    case 'url': return 'URL STRING'
    case 'hash': return 'TEXT TO HASH'
    case 'jwt': return 'JWT TOKEN'
    case 'unicode': return 'TEXT / UNICODE ESCAPE'
    default: return 'INPUT'
  }
})

const outputLabel = computed(() => {
  switch (activeTab.value) {
    case 'base64': return 'RESULT'
    case 'url': return 'RESULT'
    case 'hash': return `${hashAlgo.value} HASH`
    case 'jwt': return 'DECODED PAYLOAD'
    case 'unicode': return 'RESULT'
    default: return 'OUTPUT'
  }
})

const showSwapButton = computed(() => ['base64', 'url', 'unicode'].includes(activeTab.value))
const showEncodeDecodeButtons = computed(() => ['base64', 'url', 'unicode'].includes(activeTab.value))
const isHashTab = computed(() => activeTab.value === 'hash')
const isJwtTab = computed(() => activeTab.value === 'jwt')
const isBase64Tab = computed(() => activeTab.value === 'base64')

// ─── Stats ───
const inputByteCount = computed(() => new TextEncoder().encode(input.value).length)
const outputByteCount = computed(() => new TextEncoder().encode(output.value).length)

// ─── Core Logic ───
function encode() {
  errorMessage.value = ''
  try {
    switch (activeTab.value) {
      case 'base64':
        output.value = btoa(unescape(encodeURIComponent(input.value)))
        break
      case 'url':
        output.value = encodeURIComponent(input.value)
        break
      case 'unicode':
        output.value = Array.from(input.value)
          .map(char => `\\u${char.codePointAt(0)!.toString(16).padStart(4, '0')}`)
          .join('')
        break
    }
  }
  catch (e: any) {
    errorMessage.value = `编码错误: ${e.message}`
  }
}

function decode() {
  errorMessage.value = ''
  try {
    switch (activeTab.value) {
      case 'base64':
        output.value = decodeURIComponent(escape(atob(input.value.trim())))
        break
      case 'url':
        output.value = decodeURIComponent(input.value)
        break
      case 'unicode':
        output.value = input.value.replace(
          /\\u([0-9a-fA-F]{4,6})/g,
          (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)),
        )
        break
    }
  }
  catch (e: any) {
    errorMessage.value = `解码错误: ${e.message}`
  }
}

async function computeHash() {
  errorMessage.value = ''
  try {
    if (hashAlgo.value === 'MD5') {
      output.value = md5.md5(input.value)
    }
    else {
      const encoder = new TextEncoder()
      const data = encoder.encode(input.value)
      const hashBuffer = await crypto.subtle.digest(hashAlgo.value, data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      output.value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
  }
  catch (e: any) {
    errorMessage.value = `哈希错误: ${e.message}`
  }
}

function decodeJwt() {
  errorMessage.value = ''
  try {
    const token = input.value.trim()
    const parts = token.split('.')
    if (parts.length !== 3) {
      errorMessage.value = '无效的 JWT 格式（需要 3 个部分: header.payload.signature）'
      return
    }

    const decodeBase64Url = (str: string) => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      return decodeURIComponent(escape(atob(padded)))
    }

    const header = JSON.parse(decodeBase64Url(parts[0]!))
    const payload = JSON.parse(decodeBase64Url(parts[1]!))

    output.value = JSON.stringify(
      {
        '--- HEADER ---': header,
        '--- PAYLOAD ---': payload,
        '--- SIGNATURE ---': parts[2],
      },
      null,
      2,
    )
  }
  catch (e: any) {
    errorMessage.value = `JWT 解析错误: ${e.message}`
  }
}

function swapInputOutput() {
  const temp = input.value
  input.value = output.value
  output.value = temp
}

function clearAll() {
  input.value = ''
  output.value = ''
  errorMessage.value = ''
  fileName.value = ''
  isFileMode.value = false
}

async function copyOutput() {
  if (!output.value)
    return
  try {
    await navigator.clipboard.writeText(output.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 1500)
  }
  catch {
    // Fallback copy
    const textarea = document.createElement('textarea')
    textarea.value = output.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 1500)
  }
}

async function pasteToInput() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      input.value = text
      // Auto-trigger actions based on tab
      if (isHashTab.value)
        computeHash()
      else if (isJwtTab.value)
        decodeJwt()
      else if (activeTab.value === 'url')
        encode()
      else if (activeTab.value === 'unicode')
        encode()
      else if (activeTab.value === 'base64')
        encode()
    }
  }
  catch (e: any) {
    errorMessage.value = `无法读取剪贴板: ${e.message}`
  }
}

async function pasteToOutput() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      output.value = text
      // Auto-trigger reverse actions (decode) if applicable
      if (['base64', 'url', 'unicode'].includes(activeTab.value)) {
        const originalOutput = text
        input.value = originalOutput
        decode()
        const decodedResult = output.value
        input.value = decodedResult
        output.value = originalOutput
      }
    }
  }
  catch (e: any) {
    errorMessage.value = `无法读取剪贴板: ${e.message}`
  }
}

// ─── File Upload (Base64) ───
const isDragOver = ref(false)
const isDesktop = ref(false)

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return
  processFile(file)
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file)
    processFile(file)
}

function processFile(file: File) {
  fileName.value = file.name
  isFileMode.value = true
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    // Remove data URL prefix if present
    const base64 = result.includes(',') ? result.split(',')[1]! : result
    input.value = `data:${file.type};base64,${base64}`
    output.value = base64
  }
  reader.readAsDataURL(file)
}

// ─── Tab Switch ───
function switchTab(tabId: TabId) {
  activeTab.value = tabId
  clearAll()
}

function updateViewportMode() {
  isDesktop.value = window.innerWidth >= 960
}

// ─── Lifecycle ───
onMounted(() => {
  updateViewportMode()
  window.addEventListener('resize', updateViewportMode)
  // Pre-populate with example
  input.value = 'Hello, 世界! 🌍'
  encode()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportMode)
})
</script>

<template>
  <div class="text-pd-text bg-pd-bg flex flex-col min-h-screen selection:text-pd-bg selection:bg-pd-accent md:h-screen">
    <!-- Header -->
    <header class="px-4 border-b border-pd-border bg-pd-bg/80 flex shrink-0 h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md md:px-6">
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
            <FileKey class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Text<span class="text-pd-text-muted">///Codec</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex shrink-0 gap-2 items-center md:gap-3">
        <button
          class="text-[10px] tracking-widest font-bold px-3 py-1.5 border border-pd-border rounded-sm flex gap-1.5 uppercase transition-all items-center hover:text-pd-danger hover:border-pd-danger/50"
          @click="clearAll"
        >
          <RotateCcw class="h-3 w-3" />
          Reset
        </button>
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex flex-1 flex-col min-h-0" :class="isDesktop ? 'overflow-hidden' : ''">
      <!-- Tab Bar -->
      <div class="px-2 border-b border-pd-border bg-pd-bg-subtle/30 flex shrink-0 items-center overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="text-[10px] tracking-widest font-bold px-5 py-3 flex gap-2 whitespace-nowrap uppercase transition-all items-center relative"
          :class="[
            activeTab === tab.id
              ? 'text-pd-accent'
              : 'text-pd-text-muted hover:text-pd-text',
          ]"
          @click="switchTab(tab.id)"
        >
          <component :is="tab.icon" class="h-3.5 w-3.5" />
          {{ tab.label }}
          <div v-if="activeTab === tab.id" class="bg-pd-accent h-0.5 bottom-0 left-0 right-0 absolute" />
        </button>
      </div>

      <!-- Content Area -->
      <div
        class="flex flex-1 gap-0 min-h-0"
        :class="isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto'"
      >
        <!-- Left Panel: Input -->
        <div
          class="border-r border-pd-border flex flex-1 flex-col min-h-[50vh] min-w-0"
          :class="isDesktop ? 'border-b-0 min-h-0' : 'border-b'"
        >
          <!-- Input Header -->
          <div class="px-3 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 flex shrink-0 flex-wrap gap-2 items-center justify-between md:px-4">
            <div class="flex gap-3 items-center">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase transition-all">{{ inputLabel }}</span>
              <span class="text-[9px] text-pd-border font-bold">{{ inputByteCount }} bytes</span>
            </div>

            <div class="flex flex-wrap gap-2 items-center justify-end">
              <!-- Paste Button -->
              <button
                class="text-[9px] text-pd-accent tracking-widest font-bold px-2.5 py-1 border border-pd-border rounded-sm flex gap-1.5 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                title="Paste from clipboard"
                @click="pasteToInput"
              >
                <ClipboardPaste class="h-3 w-3" />
                Paste
              </button>

              <!-- File upload toggle (Base64 only) -->
              <button
                v-if="isBase64Tab"
                class="text-[9px] tracking-widest font-bold px-2.5 py-1 border rounded-sm flex gap-1.5 uppercase transition-all items-center"
                :class="isFileMode
                  ? 'border-pd-accent/30 text-pd-accent bg-pd-accent-muted'
                  : 'border-pd-border text-pd-text-muted hover:text-pd-text hover:border-pd-border-hover'"
                @click="isFileMode = !isFileMode; if (!isFileMode) { fileName = ''; }"
              >
                <Upload class="h-3 w-3" />
                File
              </button>
            </div>
          </div>

          <!-- File Drop Zone (Base64 file mode) -->
          <div
            v-if="isBase64Tab && isFileMode"
            class="p-4 flex flex-1 flex-col gap-4 cursor-pointer transition-colors items-center justify-center relative md:p-6"
            :class="isDragOver ? 'bg-pd-accent/5' : 'bg-pd-bg'"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop="handleDrop"
            @click="($refs.fileInput as HTMLInputElement)?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              @change="handleFileUpload"
            >
            <div
              class="p-8 border-2 rounded-sm border-dashed flex flex-col gap-3 max-w-sm w-full transition-colors items-center"
              :class="isDragOver ? 'border-pd-accent/50' : 'border-pd-border'"
            >
              <FileUp class="text-pd-text-muted h-10 w-10" :stroke-width="1" />
              <p v-if="!fileName" class="text-xs text-pd-text-muted text-center">
                拖拽文件到此处或点击选择文件
              </p>
              <div v-else class="text-center">
                <p class="text-xs text-pd-accent font-bold max-w-[200px] truncate">
                  {{ fileName }}
                </p>
                <p class="text-[10px] text-pd-text-muted mt-1">
                  文件已加载
                </p>
              </div>
            </div>
          </div>

          <!-- Text Input -->
          <textarea
            v-if="!(isBase64Tab && isFileMode)"
            v-model="input"
            class="text-sm text-pd-text leading-relaxed font-mono p-4 outline-none bg-pd-bg flex-1 min-h-[320px] resize-none placeholder-pd-text-disabled"
            :class="isDesktop ? 'min-h-0' : ''"
            :placeholder="activeTab === 'jwt' ? 'eyJhbGciOiJIUzI1NiIs...' : '输入文本...'"
            spellcheck="false"
          />
        </div>

        <!-- Center Action Bar -->
        <div
          class="px-2 py-2 bg-pd-bg-subtle/10 flex shrink-0 gap-2 items-center justify-center overflow-x-auto"
          :class="isDesktop ? 'flex-col border-r border-pd-border' : 'flex-row border-b border-pd-border'"
        >
          <!-- Encode -->
          <button
            v-if="showEncodeDecodeButtons"
            class="text-[8px] tracking-widest font-bold px-2 py-2 border border-pd-border rounded-sm uppercase transition-all hover:text-pd-accent hover:border-pd-accent/50 active:scale-95"
            title="编码"
            @click="encode"
          >
            Enc→
          </button>

          <!-- Decode -->
          <button
            v-if="showEncodeDecodeButtons"
            class="text-[8px] tracking-widest font-bold px-2 py-2 border border-pd-border rounded-sm uppercase transition-all hover:text-pd-accent hover:border-pd-accent/50 active:scale-95"
            title="解码"
            @click="decode"
          >
            ←Dec
          </button>

          <!-- Hash Button -->
          <div v-if="isHashTab" class="flex gap-2 items-center" :class="isDesktop ? 'flex-col' : 'flex-row'">
            <select
              v-model="hashAlgo"
              class="text-[9px] text-pd-text tracking-widest font-bold px-2 py-1.5 outline-none border border-pd-border rounded-sm bg-pd-bg cursor-pointer uppercase transition-colors hover:border-pd-accent/50"
            >
              <option v-for="algo in hashAlgos" :key="algo" :value="algo">
                {{ algo }}
              </option>
            </select>
            <button
              class="text-[8px] text-pd-accent tracking-widest font-bold px-2 py-2 border border-pd-accent/30 rounded-sm bg-pd-accent-muted uppercase transition-all hover:text-white hover:bg-pd-accent active:scale-95"
              @click="computeHash"
            >
              <Hash class="h-3.5 w-3.5" />
            </button>
          </div>

          <!-- JWT Decode Button -->
          <button
            v-if="isJwtTab"
            class="text-[8px] text-pd-accent tracking-widest font-bold px-2 py-2 border border-pd-accent/30 rounded-sm bg-pd-accent-muted uppercase transition-all hover:text-white hover:bg-pd-accent active:scale-95"
            title="解析 JWT"
            @click="decodeJwt"
          >
            <Key class="h-3.5 w-3.5" />
          </button>

          <!-- Swap -->
          <button
            v-if="showSwapButton"
            class="text-pd-text-muted p-2 border border-pd-border rounded-sm transition-all hover:text-pd-accent hover:border-pd-accent/50 active:scale-95"
            title="交换输入输出"
            @click="swapInputOutput"
          >
            <ArrowLeftRight class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- Right Panel: Output -->
        <div class="flex flex-1 flex-col min-h-[50vh] min-w-0" :class="isDesktop ? 'min-h-0' : ''">
          <!-- Output Header -->
          <div class="px-3 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 flex shrink-0 flex-wrap gap-2 items-center justify-between md:px-4">
            <div class="flex gap-3 items-center">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">{{ outputLabel }}</span>
              <span class="text-[9px] text-pd-border font-bold">{{ outputByteCount }} bytes</span>
            </div>

            <div class="flex flex-wrap gap-2 items-center justify-end">
              <!-- Paste Button -->
              <button
                v-if="showSwapButton"
                class="text-[9px] text-pd-accent tracking-widest font-bold px-2.5 py-1 border border-pd-border rounded-sm flex gap-1.5 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                title="Paste from clipboard"
                @click="pasteToOutput"
              >
                <ClipboardPaste class="h-3 w-3" />
                Paste
              </button>

              <!-- Copy Button -->
              <button
                class="text-[9px] tracking-widest font-bold px-2.5 py-1 border rounded-sm flex gap-1.5 uppercase transition-all items-center"
                :class="copySuccess
                  ? 'border-pd-success/30 text-pd-success bg-pd-success-muted'
                  : 'border-pd-border text-pd-text-muted hover:text-pd-accent hover:border-pd-accent/30'"
                @click="copyOutput"
              >
                <component :is="copySuccess ? Check : ClipboardCopy" class="h-3 w-3" />
                {{ copySuccess ? 'Done' : 'Copy' }}
              </button>
            </div>
          </div>

          <!-- Output Content -->
          <textarea
            v-model="output"
            class="text-sm text-pd-text leading-relaxed font-mono p-4 outline-none bg-pd-bg flex-1 min-h-[320px] resize-none placeholder-pd-text-disabled"
            :class="isDesktop ? 'min-h-0' : ''"
            placeholder="输出结果..."
            readonly
            spellcheck="false"
          />
        </div>
      </div>

      <!-- Error Bar -->
      <div
        v-if="errorMessage"
        class="px-4 py-2 border-t border-pd-danger/20 bg-pd-danger-muted flex shrink-0 gap-2 items-center"
      >
        <span class="text-xs text-pd-danger font-bold">{{ errorMessage }}</span>
        <button
          class="text-[9px] text-pd-danger/70 ml-auto hover:text-pd-danger"
          @click="errorMessage = ''"
        >
          ✕
        </button>
      </div>

      <!-- Status Bar -->
      <div class="px-3 py-2 border-t border-pd-border bg-pd-bg-subtle/20 flex shrink-0 flex-wrap gap-2 items-center justify-between md:px-4">
        <div class="flex flex-wrap gap-4 items-center">
          <span class="text-[9px] text-pd-text-muted tracking-widest uppercase">
            Mode: {{ activeTab.toUpperCase() }}
          </span>
          <span v-if="isHashTab" class="text-[9px] text-pd-accent tracking-widest uppercase">
            Algo: {{ hashAlgo }}
          </span>
        </div>
        <div class="flex flex-wrap gap-4 items-center">
          <span class="text-[9px] text-pd-text-disabled tracking-widest uppercase">
            Browser-side only
          </span>
        </div>
      </div>
    </main>
  </div>
</template>
