<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import {
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
  Eraser,
  ExternalLink,
  Layers,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-vue-next'
import { marked } from 'marked'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { request } from '@/http-client'

const STORAGE_KEY = 'resume-builder-markdown-v1'
const RECORD_ID_KEY = 'resume-builder-record-id'

const DEFAULT_MARKDOWN = `# 张三

> 高级前端工程师 · 5年经验

- 📍 深圳
- 📧 zhangsan@email.com
- 📱 138-0000-0000
- 🌐 blog.example.com
- 🐙 github.com/zhangsan

## 个人简介

热爱技术、注重产品体验的前端工程师，擅长使用 Vue/React 构建高性能 Web 应用，关注工程质量与业务价值。

## 工作经历

### 高级前端工程师 · 某科技有限公司
**2022.06 - 至今**

- 主导前端架构升级，完成 Vue 2 到 Vue 3 的迁移
- 建设组件库、CLI 与 CI/CD 流程，提升团队交付效率
- 优化核心页面性能，LCP 从 3.2s 降至 1.1s

### 前端工程师 · 某互联网公司
**2020.03 - 2022.05**

- 独立负责电商核心模块开发
- 封装业务组件，覆盖高频场景并降低重复开发

## 项目经历

### AI 智能生涯规划系统
**2023.09 - 2024.03**

- 基于大模型构建智能规划平台，支持语音交互
- 实现数字人状态动画和音频波形可视化

## 技能清单

- **前端框架：** Vue 3、React、Next.js
- **语言：** TypeScript、JavaScript、HTML5、CSS3
- **工程化：** Vite、Webpack、Monorepo、CI/CD
- **其他：** Node.js、Docker、PostgreSQL、Redis

## 教育背景

### 某大学 · 计算机科学与技术（本科）
**2016 - 2020**

- GPA 3.8/4.0，获校级一等奖学金
- ACM/ICPC 区域赛铜牌
`

// ── Split-pane ────────────────────────────────────────────────
const leftWidth = ref(42)
const isDragging = ref(false)
const isDesktop = ref(false)

const leftPanelStyle = computed(() => (isDesktop.value
  ? { width: `${leftWidth.value}%`, flex: `0 0 ${leftWidth.value}%` }
  : {}))
const rightPanelStyle = computed(() => (isDesktop.value
  ? { width: `${100 - leftWidth.value}%`, flex: `0 0 ${100 - leftWidth.value}%` }
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
  const container = document.getElementById('resume-split-container')
  if (!container)
    return
  const rect = container.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  leftWidth.value = Math.min(Math.max(pct, 25), 65)
}

function onMouseUp() {
  isDragging.value = false
}

function updateViewportMode() {
  isDesktop.value = window.innerWidth >= 960
  if (!isDesktop.value)
    isDragging.value = false
}

onMounted(() => {
  updateViewportMode()
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', updateViewportMode)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', updateViewportMode)
})

// ── Markdown editor state ─────────────────────────────────────
const markdownInput = ref('')
const previewRef = ref<HTMLDivElement | null>(null)
const saved = ref(false)

function loadSample() {
  markdownInput.value = DEFAULT_MARKDOWN
}

function clearAll() {
  markdownInput.value = ''
}

const hasData = computed(() => markdownInput.value.trim().length > 0)

const completeness = computed(() => {
  const text = markdownInput.value
  if (!text.trim())
    return 0

  const checks = [
    /^#\s+/m.test(text),
    /##\s*个人简介/.test(text),
    /##\s*工作经历/.test(text),
    /##\s*项目经历/.test(text),
    /##\s*技能/.test(text),
    /##\s*教育/.test(text),
  ]

  const score = checks.filter(Boolean).length
  return Math.round((score / checks.length) * 100)
})

function sanitizeHtml(input: string): string {
  return input
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, '')
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

const renderedMarkdown = computed(() => {
  const raw = marked.parse(markdownInput.value, {
    gfm: true,
    breaks: true,
  })
  return sanitizeHtml(typeof raw === 'string' ? raw : '')
})

function handlePrint() {
  if (!previewRef.value)
    return
  const originalTitle = document.title
  document.title = 'Resume - Markdown Preview'
  document.body.classList.add('resume-print-mode')
  window.print()
  setTimeout(() => {
    document.title = originalTitle
    document.body.classList.remove('resume-print-mode')
  }, 100)
}

// ── Cloud Sync Logic ──────────────────────────────────────────
const recordId = ref('')
const syncBaseUrl = ref('https://api.littleeleven.com/api/records')
const isSyncing = ref(false)
const syncError = ref('')
const showSyncSettings = ref(false)

const RECORD_BASE_URL_KEY = 'resume-builder-base-url'

async function fetchCloudData() {
  if (!recordId.value)
    return
  isSyncing.value = true
  syncError.value = ''
  try {
    const url = syncBaseUrl.value.endsWith('/') ? syncBaseUrl.value : `${syncBaseUrl.value}/`
    const res = await request<{ data?: { markdown?: string } }>(
      `${url}${recordId.value}`,
      { method: 'GET', notifyErrorMessage: false },
    )
    if (res?.data?.markdown) {
      markdownInput.value = res.data.markdown
    }
  }
  catch (e: any) {
    syncError.value = `Fetch failed: ${e.message}`
    console.error('Fetch error:', e)
  }
  finally {
    isSyncing.value = false
  }
}

const debouncedSaveCloud = useDebounceFn(async (val: string) => {
  if (!recordId.value)
    return
  isSyncing.value = true
  syncError.value = ''
  try {
    const url = syncBaseUrl.value.endsWith('/') ? syncBaseUrl.value : `${syncBaseUrl.value}/`
    await request(`${url}${recordId.value}`, {
      method: 'POST',
      data: { data: { markdown: val } },
      notifyErrorMessage: false,
    })
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 1200)
  }
  catch (e: any) {
    syncError.value = `Save failed: ${e.message}`
    console.error('Save error:', e)
  }
  finally {
    isSyncing.value = false
  }
}, 1200)

function onRecordIdChange() {
  localStorage.setItem(RECORD_ID_KEY, recordId.value)
  if (recordId.value) {
    fetchCloudData()
  }
}

function generateRecordId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    recordId.value = crypto.randomUUID()
    onRecordIdChange()
  }
}

function openFullUrl() {
  if (!recordId.value)
    return
  const url = syncBaseUrl.value.endsWith('/') ? syncBaseUrl.value : `${syncBaseUrl.value}/`
  window.open(`${url}${recordId.value}`, '_blank')
}

function onBaseUrlChange() {
  localStorage.setItem(RECORD_BASE_URL_KEY, syncBaseUrl.value)
}

onMounted(async () => {
  const cachedId = localStorage.getItem(RECORD_ID_KEY)
  const cachedBase = localStorage.getItem(RECORD_BASE_URL_KEY)
  if (cachedBase) {
    syncBaseUrl.value = cachedBase
  }
  if (cachedId) {
    recordId.value = cachedId
    await fetchCloudData()
  }

  // If cloud fetch didn't happen or didn't set content, load local
  if (!markdownInput.value) {
    const cached = localStorage.getItem(STORAGE_KEY)
    markdownInput.value = cached ?? DEFAULT_MARKDOWN
  }
})

watch(markdownInput, (val) => {
  localStorage.setItem(STORAGE_KEY, val)
  if (recordId.value) {
    debouncedSaveCloud(val)
  }
  else {
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 1200)
  }
})
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col min-h-screen selection:text-pd-bg selection:bg-pd-accent md:h-screen print:h-auto print:overflow-visible"
  >
    <header
      class="px-6 border-b border-pd-border bg-pd-bg/80 flex h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md print:hidden"
    >
      <div class="flex gap-4 items-center">
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
            <Pencil class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Resume<span class="text-pd-text-muted">///Markdown</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 flex-items-center">
        <!-- Cloud Sync Controls -->
        <div class="hidden flex-items-center relative lg:flex">
          <button
            class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1.5 border border-pd-border rounded-[2px] bg-pd-bg-subtle/50 flex gap-1.5 cursor-pointer uppercase transition-all flex-items-center hover:text-pd-accent hover:bg-pd-bg-muted"
            :class="{ 'bg-pd-accent/5 border-pd-accent/20 text-pd-accent': recordId }"
            title="Cloud Sync Settings"
            @click="showSyncSettings = !showSyncSettings"
          >
            <component :is="recordId ? Cloud : CloudOff" class="h-3 w-3" />
            <span class="hidden lg:inline">{{ recordId ? 'Synced' : 'Local Only' }}</span>
            <Loader2 v-if="isSyncing" class="h-3 w-3 animate-spin" />
          </button>

          <Transition name="fade">
            <div
              v-if="showSyncSettings"
              class="p-5 border border-pd-border rounded-sm bg-pd-bg w-80 shadow-2xl right-0 top-12 absolute z-[60] backdrop-blur-md"
            >
              <div class="mb-4 pb-3 border-b border-pd-border flex flex-items-center justify-between">
                <h4 class="text-[10px] tracking-widest font-bold uppercase">
                  Cloud Sync Settings
                </h4>
                <div v-if="isSyncing" class="flex gap-1.5 flex-items-center">
                  <Loader2 class="text-pd-accent h-3 w-3 animate-spin" />
                  <span class="text-[8px] text-pd-accent font-bold uppercase transition-all">Syncing...</span>
                </div>
              </div>

              <div class="flex flex-col gap-4">
                <div>
                  <label class="text-[10px] text-pd-text-muted tracking-wider font-bold mb-1.5 block uppercase">API Base URL</label>
                  <input
                    v-model="syncBaseUrl"
                    type="text"
                    class="text-xs px-3 py-2 outline-none border border-pd-border rounded-sm bg-pd-bg-inset w-full transition-colors focus:border-pd-accent"
                    placeholder="https://api.example.com/api/records"
                    @change="onBaseUrlChange"
                  >
                </div>

                <div>
                  <label class="text-[10px] text-pd-text-muted tracking-wider font-bold mb-1.5 block uppercase">Record ID / UUID</label>
                  <div class="flex gap-1.5">
                    <input
                      v-model="recordId"
                      type="text"
                      class="text-xs px-3 py-2 outline-none border border-pd-border rounded-sm bg-pd-bg-inset flex-1 min-w-0 transition-colors focus:border-pd-accent"
                      placeholder="Enter a UUID to search or sync..."
                      @change="onRecordIdChange"
                    >
                    <button
                      class="p-2 border border-pd-border rounded-sm shrink-0 transition-colors hover:text-pd-accent hover:bg-pd-bg-muted"
                      title="Generate Random ID"
                      @click="generateRecordId"
                    >
                      <Wand2 class="h-3.5 w-3.5" />
                    </button>
                    <button
                      class="p-2 border border-pd-border rounded-sm shrink-0 transition-colors hover:text-pd-accent hover:bg-pd-bg-muted"
                      title="Force Refresh"
                      @click="fetchCloudData"
                    >
                      <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isSyncing }" />
                    </button>
                    <button
                      class="p-2 border border-pd-border rounded-sm shrink-0 transition-colors hover:text-pd-accent hover:bg-pd-bg-muted"
                      title="Open Record in New Window"
                      @click="openFullUrl"
                    >
                      <ExternalLink class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div class="p-3 border border-pd-border/50 rounded-sm bg-pd-bg-muted/30">
                  <p class="text-[10px] text-pd-text-muted leading-relaxed">
                    Persistence is handled by the anonymous API. Enter any unique ID to synchronize your resume across devices.
                  </p>
                </div>

                <div v-if="syncError" class="p-2.5 border border-pd-danger/20 rounded-sm bg-pd-danger/5">
                  <p class="text-[9px] text-pd-danger leading-normal font-medium">
                    {{ syncError }}
                  </p>
                </div>

                <div class="pt-1 flex gap-2 justify-end">
                  <button
                    class="text-[10px] text-pd-text-muted tracking-widest font-bold px-4 py-2 border border-pd-border rounded-sm bg-transparent cursor-pointer uppercase transition-all hover:text-pd-accent hover:bg-pd-bg-muted"
                    @click="showSyncSettings = false"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <div v-if="hasData" class="flex gap-2 hidden flex-items-center lg:flex">
          <div class="rounded-full bg-pd-bg-muted h-1.5 w-20 overflow-hidden">
            <div
              class="rounded-full h-full transition-all duration-500"
              :class="completeness === 100 ? 'bg-pd-success' : 'bg-pd-accent'"
              :style="{ width: `${completeness}%` }"
            />
          </div>
          <span class="text-[10px] tracking-wider uppercase">{{ completeness }}%</span>
        </div>

        <div v-if="hasData" class="mx-0.5 bg-pd-border h-3 w-px hidden lg:block" />

        <Transition name="fade">
          <span
            v-if="saved"
            class="text-[10px] text-pd-success tracking-wider flex gap-1 items-center"
          >
            <Check class="h-3 w-3" />
            SAVED
          </span>
        </Transition>

        <button
          :disabled="!hasData"
          class="text-[10px] text-pd-text-inverted tracking-wider px-3 py-1.5 border border-pd-accent rounded-[2px] bg-pd-accent flex gap-1.5 cursor-pointer uppercase shadow-sm transition-all transition-shadow items-center hover:bg-pd-accent-hover disabled:opacity-30 disabled:pointer-events-none hover:shadow-md"
          title="Export PDF via Browser Print"
          @click="handlePrint"
        >
          <Printer class="h-3 w-3" :stroke-width="1.5" />
          Export PDF
        </button>

        <div class="mx-0.5 bg-pd-border h-3 w-px" />
        <ThemeToggle />
      </div>
    </header>

    <main
      id="resume-split-container"
      class="flex flex-1 min-h-0 print:overflow-visible"
      :class="[
        isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto',
        { 'select-none': isDragging },
      ]"
    >
      <div
        class="border-r border-pd-border flex flex-col min-h-[50vh] min-w-0 overflow-hidden print:hidden"
        :class="isDesktop ? 'flex-none border-b-0 min-h-0' : 'w-full border-b'"
        :style="leftPanelStyle"
      >
        <div class="px-3 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex flex-wrap gap-2 items-center justify-between md:px-4">
          <div class="flex gap-2 items-center">
            <Layers class="text-pd-text-muted h-3.5 w-3.5" :stroke-width="1.5" />
            <span class="text-[10px] text-pd-text-muted tracking-widest uppercase">
              Markdown 编辑器
            </span>
          </div>

          <div class="flex flex-wrap gap-1 items-center justify-end">
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="加载示例 Markdown"
              @click="loadSample"
            >
              <Sparkles class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              示例
            </button>
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-danger hover:border-pd-danger/20 hover:bg-pd-danger/5"
              title="清空 Markdown"
              @click="clearAll"
            >
              <Eraser class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              清空
            </button>
          </div>
        </div>

        <div class="p-4 flex-1 min-h-0">
          <textarea
            v-model="markdownInput"
            class="markdown-editor"
            placeholder="# 在这里编写你的简历 Markdown..."
          />
        </div>
      </div>

      <div
        v-if="isDesktop"
        class="group bg-pd-border/40 shrink-0 w-1 cursor-col-resize transition-colors relative hover:bg-pd-accent/40 print:hidden"
        title="拖拽调整"
        @mousedown="onDividerMouseDown"
      >
        <div
          class="bg-pd-border w-px transition-colors inset-y-0 left-1/2 absolute group-hover:bg-pd-accent/60 -translate-x-1/2"
        />
      </div>

      <div
        class="flex flex-1 flex-col min-h-[50vh] min-w-0 overflow-hidden print:w-full print:overflow-visible"
        :class="isDesktop ? 'flex-none min-h-0' : 'w-full'"
        :style="rightPanelStyle"
      >
        <div class="custom-scrollbar bg-pd-bg-inset flex-1 min-h-0 w-full relative overflow-auto print:bg-white print:overflow-visible">
          <template v-if="hasData">
            <div class="mx-auto px-6 py-8 max-w-[950px] print:m-0 print:p-0 md:px-10 md:py-12 print:max-w-none">
              <div
                ref="previewRef"
                class="resume-preview border border-pd-border/40 rounded-sm bg-white shadow-sm overflow-hidden print:border-none print:shadow-none"
              >
                <article class="markdown-preview" v-html="renderedMarkdown" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="flex flex-col h-full items-center justify-center">
              <div class="p-10 border border-pd-border rounded-[2px] border-dashed opacity-50 flex flex-col gap-5 items-center">
                <Pencil class="text-pd-text-disabled h-12 w-12" :stroke-width="0.6" />
                <div class="text-center">
                  <p class="text-[11px] text-pd-text-disabled tracking-widest mb-2 uppercase">
                    尚无 Markdown 内容
                  </p>
                  <p class="text-[10px] text-pd-text-disabled/60">
                    在左侧输入 Markdown，右侧自动渲染
                  </p>
                </div>
                <button
                  class="text-[10px] text-pd-accent tracking-wider px-4 py-2 border border-pd-accent/30 rounded-[2px] flex gap-1.5 cursor-pointer uppercase transition-all items-center hover:bg-pd-accent-muted"
                  @click="loadSample"
                >
                  <Sparkles class="h-3 w-3" :stroke-width="1.5" />
                  加载示例
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
.markdown-editor {
  width: 100%;
  height: 100%;
  min-height: 240px;
  resize: none;
  border: 1px solid var(--pd-border);
  border-radius: 4px;
  background: var(--pd-bg);
  color: var(--pd-text);
  padding: 14px;
  font-family: Kaiti;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.markdown-editor:focus {
  border-color: var(--pd-accent);
  box-shadow: 0 0 0 2px var(--pd-accent-muted);
}

.resume-preview {
  width: 100%;
  box-sizing: border-box;
  border-radius: 0;
  background: #fff;
}

.markdown-preview {
  --rv-ink: #1f2937;
  --rv-subtle: #374151;
  --rv-muted: #4b5563;
  --rv-line: #aab0ba;
  --rv-soft: #f3f4f6;
  --rv-red: #b1123a;
  --rv-head-bg: #f6eef1;
  color: var(--rv-ink);
  background: #fff;
  min-height: 980px;
  padding: 24px 30px 28px;
  font-family: Kaiti;
  line-height: 1.52;
  font-size: 12px;
  letter-spacing: 0.005em;
}

.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4 {
  margin-top: 0.95em;
  margin-bottom: 0.38em;
  line-height: 1.35;
  color: var(--rv-ink);
}

.markdown-preview h1 {
  margin-top: 0;
  font-size: 1.52rem;
  font-weight: 700;
  letter-spacing: 0;
  border-bottom: none;
  padding-bottom: 0;
  color: var(--rv-ink);
}

.markdown-preview h2 {
  font-size: 1.06rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  text-transform: none;
  color: var(--rv-red);
  text-align: left;
  border: none;
  padding: 3px 10px 4px;
  margin-top: 0.76em;
  margin-bottom: 0.2em;
  background: var(--rv-head-bg);
  border-left: 5px solid var(--rv-red);
}

.markdown-preview h3 {
  font-size: 0.9rem;
  font-weight: 650;
  color: #111827;
}

.markdown-preview h2 + h3,
.markdown-preview h2 + p + h3 {
  margin-top: 0.36em;
}

.markdown-preview p {
  margin: 0.2em 0;
  color: var(--rv-subtle);
}

.markdown-preview blockquote {
  margin: 0.14em 0 0.44em;
  border-left: none;
  border-radius: 0;
  background: transparent;
  padding: 0;
  color: #4b5563;
  font-weight: 400;
}

.markdown-preview ul,
.markdown-preview ol {
  margin: 0.12em 0 0.42em;
  padding-left: 1.2em;
}

.markdown-preview li {
  margin: 0.08em 0;
  color: var(--rv-subtle);
  line-height: 1.45;
}

.markdown-preview h3 + p > strong:only-child {
  display: inline-block;
  margin: -1.56em 0 0.16em;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #374151;
  border: none;
  font-size: 0.8rem;
  font-weight: 500;
  float: right;
}

.markdown-preview h3 + p {
  margin-top: 0.1em;
  margin-bottom: 0.1em;
  color: #1f2937;
  font-size: 0.86rem;
}

.markdown-preview h3 + p + p {
  margin-top: -0.14em;
  margin-bottom: 0.14em;
  text-align: right;
  color: #374151;
  font-size: 0.86rem;
}

.markdown-preview h3 + ul {
  margin-top: 0.12em;
}

.markdown-preview strong {
  color: var(--rv-ink);
}

.markdown-preview a {
  color: #1f2937;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: rgba(31, 41, 55, 0.28);
}

.markdown-preview code {
  background: var(--rv-soft);
  border: 1px solid #d1d5db;
  border-radius: 3px;
  padding: 0 4px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.86em;
  color: #1f2937;
}

.markdown-preview pre {
  background: #111827;
  color: #e2e8f0;
  border-radius: 5px;
  padding: 10px;
  overflow: auto;
  margin: 0.5em 0;
}

.markdown-preview pre code {
  background: transparent;
  border: none;
  color: inherit;
  padding: 0;
}

.markdown-preview hr {
  border: none;
  border-top: 1px solid var(--rv-line);
  margin: 0.46em 0;
}

.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.24em 0 0.4em;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--rv-line);
}

.markdown-preview th,
.markdown-preview td {
  border-bottom: 1px solid var(--rv-line);
  padding: 4px 6px;
  text-align: left;
}

.markdown-preview th {
  background: #fafafa;
  font-size: 10px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  color: #4b5563;
}

.markdown-preview tr:last-child td {
  border-bottom: none;
}

/* First metadata list after title becomes contact chips */
.markdown-preview > h1 ~ ul:first-of-type {
  list-style: none;
  padding: 0;
  margin: 0.08em 0 0.36em;
  display: block;
}

.markdown-preview > h1 ~ ul:first-of-type > li {
  margin: 0.02em 0;
  padding: 0;
  border-radius: 0;
  font-size: 0.8rem;
  color: #1f2937;
  background: transparent;
  border: none;
}

.markdown-preview > h1 + blockquote {
  font-size: 0.9rem;
  margin-top: 0.18em;
  margin-bottom: 0.22em;
  font-weight: 600;
  color: #1f2937;
}

.markdown-preview > h1 ~ ul:first-of-type + h2 {
  margin-top: 0.56em;
}

.markdown-preview h2 + p {
  margin-top: 0.1em;
  margin-bottom: 0.2em;
  font-size: 0.84rem;
  color: #1f2937;
}

.markdown-preview h3 + p + p + ul {
  clear: both;
}

.markdown-preview h3 + p + ul {
  clear: both;
}

.markdown-preview h2:last-of-type {
  margin-top: 0.66em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media screen and (max-width: 900px) {
  .markdown-preview {
    min-height: auto;
    padding: 16px 12px;
    font-size: 11px;
  }

  .markdown-preview h1 {
    font-size: 1.2rem;
  }

  .markdown-preview h2 {
    font-size: 0.92rem;
  }

  .markdown-preview > h1 ~ ul:first-of-type > li {
    font-size: 0.78rem;
  }

  .markdown-preview h3 + p > strong:only-child {
    float: none;
    display: block;
    margin: 0.06em 0 0.12em;
    font-size: 0.76rem;
  }

  .markdown-preview h3 {
    font-size: 0.84rem;
  }
}

@media print {
  @page {
    margin: 8mm;
    size: A4;
  }

  html,
  body {
    background: white !important;
    color: black !important;
    height: auto !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  header,
  #resume-split-container > div:first-child {
    display: none !important;
  }

  #resume-split-container {
    display: block !important;
  }

  #resume-split-container > div:last-child {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
  }

  .resume-preview,
  .markdown-preview {
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    min-height: auto !important;
  }

  .resume-preview {
    background: white !important;
  }

  .markdown-preview {
    background: white !important;
  }

  .markdown-preview h2 {
    background: var(--rv-head-bg) !important;
    border-left: 5px solid var(--rv-red) !important;
  }

  .markdown-preview h3 + p > strong:only-child {
    float: right !important;
    display: inline-block !important;
    margin: -1.56em 0 0.16em !important;
    font-size: 0.8rem !important;
  }

  .markdown-preview h3 + p + p {
    text-align: right !important;
    margin-top: -0.14em !important;
    margin-bottom: 0.14em !important;
    font-size: 0.86rem !important;
  }

  .markdown-preview h3 + p + ul,
  .markdown-preview h3 + p + p + ul {
    clear: both !important;
  }

  .markdown-preview code {
    background: var(--rv-soft) !important;
  }

  .markdown-preview pre {
    background: #111827 !important;
    color: #e5e7eb !important;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
