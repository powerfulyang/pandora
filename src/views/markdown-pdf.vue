<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  Printer,
  Type,
} from 'lucide-vue-next'
import { marked } from 'marked'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { markdownPdfStorage } from '@/lib/storage'

// ── State ────────────────────────────────────────────────────
const rawInput = ref('')
const copied = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)
const showEditor = ref(true)

// ── Split-pane ────────────────────────────────────────────────
const leftWidth = ref(50)
const isDragging = ref(false)

function onDividerMouseDown(e: MouseEvent) {
  isDragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value)
    return
  const container = document.getElementById('md-split-container')
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

// ── Markdown ──────────────────────────────────────────────────
// Configure marked for resume-style (no code, no GFM extras)
marked.setOptions({
  gfm: true,
  breaks: true,
})

const renderedHTML = computed(() => {
  if (!rawInput.value.trim())
    return ''
  return marked.parse(rawInput.value) as string
})

const lineCount = computed(() => rawInput.value.split('\n').length)
const lines = computed(() => Array.from({ length: lineCount.value }, (_, i) => i + 1))

const charCount = computed(() => rawInput.value.length)
const wordCount = computed(() => {
  const text = rawInput.value.trim()
  if (!text)
    return 0
  // Count CJK characters individually + non-CJK words
  const cjk = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g)
  const nonCjk = text
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return (cjk?.length || 0) + nonCjk.length
})

// ── Sample Resume ─────────────────────────────────────────────
const SAMPLE_RESUME = `# 张三

> 前端工程师 · 5年经验 · 深圳

**联系方式：** zhangsan@email.com · 138-0000-0000 · [GitHub](https://github.com) · [个人博客](https://blog.example.com)

---

## 个人简介

热爱技术、注重产品体验的前端工程师，擅长使用 Vue/React 构建高性能 Web 应用。有丰富的跨端开发经验，熟悉小程序和 Hybrid App 开发。追求极致的用户体验和代码质量。

---

## 工作经历

### 高级前端工程师 · 某科技有限公司
*2022.06 - 至今*

- 负责公司核心产品前端架构设计与技术选型，主导从 Vue 2 到 Vue 3 的迁移
- 搭建前端基础设施，包括组件库、CLI 工具链、CI/CD 流程
- 优化首屏加载性能，LCP 从 3.2s 降至 1.1s，CLS 优化至 0.05 以下
- 推动 TypeScript 全面落地，代码质量评分提升 40%

### 前端工程师 · 某互联网公司
*2020.03 - 2022.05*

- 参与电商平台前端开发，独立负责商品详情页、购物车等核心模块
- 基于 WebSocket 实现实时消息推送系统，日均处理 50 万条消息
- 封装通用业务组件库，覆盖 80% 高频业务场景，提升团队开发效率 30%

---

## 项目经历

### AI 智能生涯规划系统
*2023.09 - 2024.03*

基于大语言模型的智能规划平台，集成语音交互与数字人技术。

- 使用自研音频处理模块实现实时语音交互，解决 WebView 环境下的回声消除问题
- 基于 GSAP 动画库实现 AI 助手状态流转，Canvas 绘制实时音频波形
- 多轮对话引擎驱动数字人动作反馈，提升在线咨询的沉浸感

### 企业级低代码平台
*2022.08 - 2023.08*

面向运营人员的可视化页面搭建工具，支持拖拽编排与实时预览。

- 设计插件化架构，支持自定义组件注册和动态加载
- 实现画布渲染引擎，支持自由布局、栅格布局和流式布局三种模式
- 集成版本控制与协同编辑，基于 CRDT 算法解决冲突

---

## 技能清单

| 类别 | 技能 |
| --- | --- |
| **语言** | TypeScript · JavaScript · HTML5 · CSS3 |
| **框架** | Vue 3 · React · Next.js · Nuxt |
| **工程化** | Vite · Webpack · Monorepo · CI/CD |
| **跨端** | 小程序 · React Native · Electron |
| **AI 工具** | Cursor · Claude Code · Dify |
| **其他** | Node.js · Docker · PostgreSQL · Redis |

---

## 教育背景

### 计算机科学与技术 · 本科
*某大学 · 2016 - 2020*

- GPA 3.8/4.0，获校级一等奖学金
- ACM/ICPC 区域赛铜牌
`

function handleLoadSample() {
  rawInput.value = SAMPLE_RESUME
}

function handleClear() {
  rawInput.value = ''
  nextTick(() => textareaRef.value?.focus())
}

async function handlePasteFromClipboard() {
  const text = await navigator.clipboard.readText()
  if (text)
    rawInput.value = text
}

async function handleCopy() {
  if (!rawInput.value)
    return
  await navigator.clipboard.writeText(rawInput.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

// ── Print / Export PDF ────────────────────────────────────────
function handlePrint() {
  if (!previewRef.value)
    return

  // Save original title
  const originalTitle = document.title
  document.title = 'Resume - PDF Export'

  // Add print mode class to body for print-specific styles
  document.body.classList.add('print-mode')

  // Trigger print
  window.print()

  // Restore after print dialog closes
  setTimeout(() => {
    document.title = originalTitle
    document.body.classList.remove('print-mode')
  }, 100)
}

function toggleEditorView() {
  showEditor.value = !showEditor.value
}

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

// ── Watch input for storage persistence ──────────────────

onMounted(async () => {
  const saved = await markdownPdfStorage.loadContent()
  if (saved) {
    rawInput.value = saved
  }
})

watch(rawInput, (val) => {
  markdownPdfStorage.saveContent(val)
})
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col h-screen overflow-hidden selection:text-pd-bg selection:bg-pd-accent print:h-auto print:overflow-visible"
  >
    <!-- Header -->
    <header
      class="px-6 border-b border-pd-border bg-pd-bg/80 flex h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md print:hidden"
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
            <FileText class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            MD<span class="text-pd-text-muted">///PDF</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <template v-if="rawInput.trim()">
          <span class="hidden md:inline">
            {{ wordCount }} 字 · {{ lineCount }} 行 · {{ charCount }} 字符
          </span>
          <div class="mx-1 bg-pd-border h-3 w-px hidden md:block" />
        </template>

        <!-- Toggle editor visibility (mobile / focus) -->
        <button
          class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] gap-1 hidden cursor-pointer uppercase transition-all items-center hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 md:flex"
          :title="showEditor ? 'Focus preview' : 'Edit mode'"
          @click="toggleEditorView"
        >
          <component :is="showEditor ? EyeOff : Eye" class="h-3 w-3" :stroke-width="1.5" />
          {{ showEditor ? 'Focus' : 'Edit' }}
        </button>

        <!-- Export PDF (via Browser Print) -->
        <button
          :disabled="!rawInput.trim()"
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

    <!-- Main Content -->
    <main
      id="md-split-container"
      class="flex flex-1 overflow-hidden print:overflow-visible"
      :class="{ 'select-none': isDragging }"
    >
      <!-- Left Panel: Editor -->
      <div
        v-show="showEditor"
        class="border-r border-pd-border flex flex-col min-h-0 min-w-0 overflow-hidden print:hidden"
        :style="{ width: showEditor ? `${leftWidth}%` : '0%' }"
      >
        <!-- Editor Toolbar -->
        <div
          class="px-4 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex items-center justify-between"
        >
          <div class="flex gap-1 items-center">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              MARKDOWN
            </span>
            <span class="text-[10px] text-pd-text-disabled">
              {{ lineCount }} lines
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <button
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5"
              title="Load sample resume"
              @click="handleLoadSample"
            >
              <Type class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
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
              :disabled="!rawInput"
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] cursor-pointer uppercase transition-all hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Copy markdown"
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
              title="Clear input"
              @click="handleClear"
            >
              <Eraser class="mr-1 h-3 w-3 inline" :stroke-width="1.5" />
              Clear
            </button>
          </div>
        </div>

        <!-- Textarea with Gutter -->
        <div class="flex flex-1 relative overflow-hidden">
          <!-- Gutter -->
          <div
            ref="gutterRef"
            class="px-2 py-4 text-right border-r border-pd-border bg-pd-bg-subtle/50 flex flex-col w-12 select-none overflow-hidden"
          >
            <div
              v-for="line in lines"
              :key="line"
              class="text-[11px] text-pd-text-disabled leading-6 h-6"
            >
              {{ line }}
            </div>
          </div>

          <!-- Textarea -->
          <div class="flex-1 relative">
            <textarea
              ref="textareaRef"
              v-model="rawInput"
              placeholder="输入 Markdown 内容...

支持标题、列表、表格、加粗、链接等简历常用元素。
点击「Sample」加载示例简历。"
              class="custom-scrollbar text-[13px] text-pd-text leading-6 p-4 bg-transparent h-full w-full resize-none placeholder:text-pd-text-disabled/50 focus:outline-none"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
              @scroll="syncScroll"
            />

            <!-- Empty State -->
            <div
              v-if="!rawInput"
              class="flex flex-col pointer-events-none items-center inset-0 justify-center absolute"
            >
              <FileText class="text-pd-border mb-4 h-16 w-16" :stroke-width="0.5" />
              <p class="text-xs text-pd-text-disabled tracking-widest mb-1 uppercase">
                No content
              </p>
              <p class="text-[10px] text-pd-text-disabled">
                Type Markdown or click "Sample" to start
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div
        v-show="showEditor"
        class="group bg-pd-border/40 shrink-0 w-1 cursor-col-resize transition-colors relative hover:bg-pd-accent/40 print:hidden"
        title="Drag to resize"
        @mousedown="onDividerMouseDown"
      >
        <div
          class="bg-pd-border w-px transition-colors inset-y-0 left-1/2 absolute group-hover:bg-pd-accent/60 -translate-x-1/2"
        />
      </div>

      <!-- Right Panel: Preview -->
      <div
        class="flex flex-col min-h-0 min-w-0 overflow-hidden print:w-full print:overflow-visible"
        :style="{ width: showEditor ? `${100 - leftWidth}%` : '100%' }"
      >
        <!-- Preview Toolbar -->
        <div
          class="px-4 py-2 border-b border-pd-border bg-pd-bg-subtle/30 flex items-center justify-between print:hidden"
        >
          <div class="flex gap-1 items-center">
            <span class="text-[10px] text-pd-text-muted tracking-widest mr-2 uppercase">
              PREVIEW
            </span>
            <span v-if="rawInput.trim()" class="text-[10px] text-pd-success flex gap-1 items-center">
              <span class="rounded-full bg-pd-success h-1.5 w-1.5 animate-pulse" />
              LIVE
            </span>
          </div>

          <div class="flex gap-1 items-center">
            <button
              :disabled="!rawInput.trim()"
              class="text-[10px] text-pd-text-muted tracking-wider px-2.5 py-1 border border-transparent rounded-[2px] flex gap-1 cursor-pointer uppercase transition-all items-center hover:text-pd-accent hover:border-pd-accent/20 hover:bg-pd-accent/5 disabled:opacity-30 disabled:pointer-events-none"
              title="Export PDF via Browser Print"
              @click="handlePrint"
            >
              <Download class="h-3 w-3" :stroke-width="1.5" />
              PDF
            </button>
          </div>
        </div>

        <!-- Rendered Preview -->
        <div
          class="custom-scrollbar bg-pd-bg-inset flex-1 min-h-0 w-full relative overflow-auto print:bg-white print:overflow-visible"
        >
          <template v-if="renderedHTML">
            <div class="mx-auto px-6 py-8 max-w-[850px] print:m-0 print:p-0 md:px-10 md:py-12 print:max-w-none">
              <!-- Resume Paper Card -->
              <div
                ref="previewRef"
                class="md-resume-preview p-8 border border-pd-border/40 rounded-sm bg-pd-bg shadow-sm overflow-hidden md:p-14 print:p-0 print:border-none print:bg-white print:shadow-none"
                v-html="renderedHTML"
              />
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col h-full items-center justify-center">
              <div
                class="p-8 border border-pd-border rounded-[2px] border-dashed opacity-60 flex flex-col gap-4 items-center"
              >
                <FileText class="text-pd-text-disabled h-10 w-10" :stroke-width="0.8" />
                <span class="text-[10px] text-pd-text-disabled tracking-widest uppercase">
                  Awaiting markdown input
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- Stats Footer -->
        <div
          v-if="rawInput.trim()"
          class="text-[10px] text-pd-text-muted px-4 py-2 border-t border-pd-border bg-pd-bg-subtle/30 flex gap-4 items-center print:hidden"
        >
          <span>
            WORDS: <span class="text-pd-text">{{ wordCount }}</span>
          </span>
          <span>
            LINES: <span class="text-pd-text">{{ lineCount }}</span>
          </span>
          <span>
            CHARS: <span class="text-pd-text">{{ charCount }}</span>
          </span>
          <span class="text-pd-text-disabled ml-auto">
            EXPORT VIA PRINT → PDF
          </span>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* SSG / Print Layout - Modern Resume Design */

.md-resume-preview {
  /* Typography System - Inter + Noto Sans SC */
  font-family:
    'Inter',
    'Noto Sans SC',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--pd-text);
  font-feature-settings:
    'kern' 1,
    'liga' 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Paper-like spacing */
  max-width: 100%;
}

/* ── Header / Name Section ─────────────────────── */
.md-resume-preview h1 {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--pd-text);
  margin-bottom: 4px;
  line-height: 1.2;
}

/* Tagline immediately after name */
.md-resume-preview h1 + blockquote {
  margin: 0 0 24px 0;
  padding: 0;
  border: none;
  background: transparent;
}

.md-resume-preview h1 + blockquote p {
  font-size: 16px;
  font-weight: 500;
  color: var(--pd-text-muted);
  letter-spacing: 0.05em;
  margin: 0;
}

/* ── Section Dividers with Underline ───────────── */
.md-resume-preview h2 {
  position: relative;
  font-size: 16px;
  font-weight: 700;
  color: var(--pd-accent);
  margin-top: 32px;
  margin-bottom: 16px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--pd-accent);
  display: flex;
  align-items: center;
}

/* ── Experience/Project Headers ───────────────── */
.md-resume-preview h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--pd-text);
  margin-top: 20px;
  margin-bottom: 6px;
  line-height: 1.4;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
}

/* Date/role styling */
.md-resume-preview h3 em,
.md-resume-preview h3 i {
  font-style: normal;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--pd-text-muted);
  margin-left: 8px;
}

/* ── Subsections ──────────────────────────────── */
.md-resume-preview h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--pd-text-secondary);
  margin-top: 14px;
  margin-bottom: 6px;
}

/* ── Contact Info Block ───────────────────────── */
.md-resume-preview p strong:first-child {
  color: var(--pd-accent);
  font-weight: 700;
}

/* Contact links row */
.md-resume-preview p a[href^='mailto'],
.md-resume-preview p a[href^='tel'],
.md-resume-preview p a[href^='http'] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ── Paragraphs ────────────────────────────────── */
.md-resume-preview p {
  margin-bottom: 10px;
  color: var(--pd-text-secondary);
}

/* ── Lists ────────────────── */
.md-resume-preview ul,
.md-resume-preview ol {
  padding-left: 1.25rem;
  margin-bottom: 16px;
}

.md-resume-preview li {
  margin-bottom: 6px;
  color: var(--pd-text-secondary);
  list-style-type: disc;
}

.md-resume-preview li::marker {
  color: var(--pd-accent);
}

/* ── Skills Table ─────────────────────────────── */
.md-resume-preview table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
}

.md-resume-preview th {
  text-align: left;
  font-weight: 700;
  padding: 10px 12px;
  background: var(--pd-bg-subtle);
  border-bottom: 2px solid var(--pd-border);
}

.md-resume-preview td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--pd-border);
  vertical-align: top;
}

.md-resume-preview td:first-child {
  font-weight: 700;
  width: 25%;
  color: var(--pd-text);
}

/* ── Links ────────────────────────────────────── */
.md-resume-preview a {
  color: var(--pd-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--pd-accent-muted);
}

.md-resume-preview a:hover {
  text-decoration-color: var(--pd-accent);
}

/* ── Horizontal Rule ───────────────────────────── */
.md-resume-preview hr {
  border: none;
  height: 1px;
  background-color: var(--pd-border);
  margin: 24px 0;
  opacity: 0.4;
}

/* ── Inline Code ──────────────────────────────── */
.md-resume-preview code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  background: var(--pd-bg-subtle);
  color: var(--pd-accent);
}

/* ── Print Styles ─────────────────────────────── */
@media print {
  @page {
    margin: 15mm;
    size: A4;
  }

  html,
  body {
    background: white !important;
    color: black !important;
    height: auto !important;
    overflow: visible !important;
  }

  .md-resume-preview {
    color: #111 !important;
    background: white !important;
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 11pt;
    line-height: 1.5;
  }

  /* Force parent containers to full width */
  #md-split-container {
    display: block !important;
  }

  #md-split-container > div:last-child {
    width: 100% !important;
    max-width: none !important;
  }

  /* Ensure colors and backgrounds print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Typography for high-quality print */
  .md-resume-preview h1 {
    color: #000 !important;
    font-size: 24pt;
  }
  .md-resume-preview h2 {
    color: #000 !important;
    border-bottom: 1.5pt solid #000 !important;
    font-size: 14pt;
    margin-top: 20pt;
    padding-bottom: 4pt;
  }
  .md-resume-preview h3 {
    color: #000 !important;
    font-size: 12pt;
    margin-top: 12pt;
  }
  .md-resume-preview a {
    color: #000 !important;
    text-decoration: none !important;
  }

  /* Page breaks */
  h2,
  h3 {
    page-break-after: avoid;
    break-after: avoid;
  }
  ul,
  ol,
  table {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  li {
    page-break-inside: avoid;
  }
}
</style>
