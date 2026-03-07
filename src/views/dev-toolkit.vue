<script setup lang="ts">
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  ArrowLeft,
  Calendar,
  ClipboardCopy,
  ClipboardPaste,
  Clock,
  Code2,
  Diff,
  Palette,
  RefreshCw,
  RotateCcw,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

dayjs.extend(utc)

// ─── Tab System ───
type TabId = 'regex' | 'timestamp' | 'color' | 'diff'

const tabs = [
  { id: 'regex' as const, label: 'Regex', icon: Code2 },
  { id: 'timestamp' as const, label: 'Timestamp', icon: Clock },
  { id: 'color' as const, label: 'Color', icon: Palette },
  { id: 'diff' as const, label: 'Diff', icon: Diff },
]

const activeTab = ref<TabId>('regex')
const copySuccess = ref(false)
const errorMessage = ref('')

// ═══════════════════════════════════
// REGEX TAB
// ═══════════════════════════════════
const regexPattern = ref('(\\w+)@(\\w+\\.\\w+)')
const regexFlags = ref('gi')
const regexTestString = ref('Contact us at hello@example.com or support@pandora.dev')
const regexMatches = computed(() => {
  if (!regexPattern.value || !regexTestString.value)
    return []
  try {
    const re = new RegExp(regexPattern.value, regexFlags.value)
    const results: { match: string, index: number, groups: string[] }[] = []
    let m: RegExpExecArray | null
    const seen = new Set<number>()
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(regexTestString.value)) !== null) {
      if (seen.has(m.index))
        break
      seen.add(m.index)
      results.push({
        match: m[0]!,
        index: m.index,
        groups: m.slice(1),
      })
      if (!re.global)
        break
    }
    return results
  }
  catch {
    return []
  }
})

const regexHighlightedText = computed(() => {
  if (!regexPattern.value || !regexTestString.value)
    return regexTestString.value
  try {
    const re = new RegExp(regexPattern.value, regexFlags.value)
    return regexTestString.value.replace(re, match =>
      `<mark class="bg-pd-accent/20 text-pd-accent font-bold px-0.5 rounded-sm">${match}</mark>`)
  }
  catch {
    return regexTestString.value
  }
})

// ═══════════════════════════════════
// TIMESTAMP TAB
// ═══════════════════════════════════
const timestampInput = ref('')
const dateInput = ref('')
const timestampUnit = ref<'seconds' | 'milliseconds'>('seconds')
const timestampOutput = ref('')
const dateOutput = ref('')

const now = ref(dayjs())
let timer: any

onMounted(() => {
  timer = setInterval(() => {
    now.value = dayjs()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

function timestampToDate() {
  errorMessage.value = ''
  if (!timestampInput.value) {
    timestampOutput.value = ''
    return
  }
  try {
    const ts = Number(timestampInput.value)
    if (Number.isNaN(ts)) {
      timestampOutput.value = 'Invalid Timestamp'
      return
    }
    const ms = timestampUnit.value === 'seconds' ? ts * 1000 : ts
    const d = dayjs(ms)
    if (!d.isValid()) {
      timestampOutput.value = 'Invalid Date'
      return
    }
    timestampOutput.value = [
      `ISO 8601:  ${d.toISOString()}`,
      `Local:     ${d.format('YYYY-MM-DD HH:mm:ss')}`,
      `UTC:       ${(d as any).utc().format()}`,
      `Y-M-D:     ${d.format('YYYY-MM-DD')}  W: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day()]}`,
      `H:m:s:     ${d.format('HH:mm:ss')}`,
    ].join('\n')
  }
  catch (e: any) {
    timestampOutput.value = `Error: ${e.message}`
  }
}

function dateToTimestamp() {
  errorMessage.value = ''
  if (!dateInput.value) {
    dateOutput.value = ''
    return
  }
  try {
    const d = dayjs(dateInput.value)
    if (!d.isValid()) {
      dateOutput.value = 'Unable to parse date format'
      return
    }
    const ms = d.valueOf()
    const ts = timestampUnit.value === 'seconds' ? Math.floor(ms / 1000) : ms
    dateOutput.value = [
      `Timestamp (${timestampUnit.value}): ${ts}`,
      `ISO 8601: ${d.toISOString()}`,
      `Local:     ${d.format('YYYY-MM-DD HH:mm:ss')}`,
    ].join('\n')
  }
  catch (e: any) {
    dateOutput.value = `Error: ${e.message}`
  }
}

function fillNow() {
  const ms = dayjs().valueOf()
  timestampInput.value = timestampUnit.value === 'seconds'
    ? Math.floor(ms / 1000).toString()
    : ms.toString()
  dateInput.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
}

// Auto-conversion watchers
watch([timestampInput, timestampUnit], () => timestampToDate())
watch([dateInput, timestampUnit], () => dateToTimestamp())

onMounted(() => {
  fillNow() // Initial fill
  timer = setInterval(() => {
    now.value = dayjs()
  }, 1000)
})

// ═══════════════════════════════════
// COLOR TAB
// ═══════════════════════════════════
const colorHex = ref('#3B82F6')
const colorR = ref(59)
const colorG = ref(130)
const colorB = ref(246)
const colorH = ref(217)
const colorS = ref(91)
const colorL = ref(60)

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result)
    return null
  return [
    Number.parseInt(result[1]!, 16),
    Number.parseInt(result[2]!, 16),
    Number.parseInt(result[3]!, 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360
  s /= 100
  l /= 100
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0)
        t += 1
      if (t > 1)
        t -= 1
      if (t < 1 / 6)
        return p + (q - p) * 6 * t
      if (t < 1 / 2)
        return q
      if (t < 2 / 3)
        return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function updateFromHex() {
  const rgb = hexToRgb(colorHex.value)
  if (!rgb) {
    return
  }
  ;[colorR.value, colorG.value, colorB.value] = rgb
  ;[colorH.value, colorS.value, colorL.value] = rgbToHsl(...rgb)
}

function parseAndPasteColor(text: string) {
  const trimmed = text.trim()

  // 1. HEX
  const hexMatch = /^#?([a-f\d]{3,8})$/i.exec(trimmed)
  if (hexMatch) {
    let hex = hexMatch[1]!
    if (!hex.startsWith('#'))
      hex = `#${hex}`
    // Normalize 3-digit hex
    if (hex.length === 4)
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`

    if (hex.length === 7 || hex.length === 9) {
      colorHex.value = hex.slice(0, 7)
      updateFromHex()
      return true
    }
  }

  // 2. RGB/RGBA
  const rgbMatch = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(trimmed)
  if (rgbMatch) {
    colorR.value = Number.parseInt(rgbMatch[1]!, 10)
    colorG.value = Number.parseInt(rgbMatch[2]!, 10)
    colorB.value = Number.parseInt(rgbMatch[3]!, 10)
    updateFromRgb()
    return true
  }

  // 3. HSL
  const hslMatch = /hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/i.exec(trimmed)
  if (hslMatch) {
    colorH.value = Number.parseInt(hslMatch[1]!, 10)
    colorS.value = Number.parseInt(hslMatch[2]!, 10)
    colorL.value = Number.parseInt(hslMatch[3]!, 10)
    updateFromHsl()
    return true
  }

  return false
}

function updateFromRgb() {
  colorHex.value = rgbToHex(colorR.value, colorG.value, colorB.value)
  ;[colorH.value, colorS.value, colorL.value] = rgbToHsl(colorR.value, colorG.value, colorB.value)
}

function updateFromHsl() {
  const rgb = hslToRgb(colorH.value, colorS.value, colorL.value)
  ;[colorR.value, colorG.value, colorB.value] = rgb
  colorHex.value = rgbToHex(...rgb)
}

const colorFormats = computed(() => [
  { label: 'HEX', value: colorHex.value.toUpperCase() },
  { label: 'RGB', value: `rgb(${colorR.value}, ${colorG.value}, ${colorB.value})` },
  { label: 'HSL', value: `hsl(${colorH.value}, ${colorS.value}%, ${colorL.value}%)` },
  { label: 'RGBA', value: `rgba(${colorR.value}, ${colorG.value}, ${colorB.value}, 1)` },
])

// ═══════════════════════════════════
// DIFF TAB
// ═══════════════════════════════════
const diffTextA = ref('Hello World\nThis is a test\nLine three\nLine four')
const diffTextB = ref('Hello World\nThis is modified\nLine three\nLine five\nNew line')

interface DiffLine {
  type: 'same' | 'add' | 'remove'
  lineA?: number
  lineB?: number
  content: string
}

const diffResult = computed((): DiffLine[] => {
  const linesA = diffTextA.value.split('\n')
  const linesB = diffTextB.value.split('\n')
  const result: DiffLine[] = []

  // Simple LCS-based diff
  const m = linesA.length
  const n = linesB.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      }
      else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  // Backtrack
  let i = m
  let j = n
  const stack: DiffLine[] = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({ type: 'same', lineA: i, lineB: j, content: linesA[i - 1]! })
      i--
      j--
    }
    else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({ type: 'add', lineB: j, content: linesB[j - 1]! })
      j--
    }
    else {
      stack.push({ type: 'remove', lineA: i, content: linesA[i - 1]! })
      i--
    }
  }

  stack.reverse()
  result.push(...stack)
  return result
})

const diffStats = computed(() => {
  const adds = diffResult.value.filter(d => d.type === 'add').length
  const removes = diffResult.value.filter(d => d.type === 'remove').length
  const same = diffResult.value.filter(d => d.type === 'same').length
  return { adds, removes, same }
})

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 1500)
  }
  catch {
    // Fallback
  }
}

async function pasteToInput(target: 'regex' | 'timestamp' | 'date' | 'color' | 'diffA' | 'diffB') {
  try {
    const text = await navigator.clipboard.readText()
    if (!text)
      return

    switch (target) {
      case 'regex':
        regexTestString.value = text
        break
      case 'timestamp':
        timestampInput.value = text
        timestampToDate()
        break
      case 'date':
        dateInput.value = text
        dateToTimestamp()
        break
      case 'color':
        if (!parseAndPasteColor(text)) {
          errorMessage.value = '无法识别的颜色格式'
          setTimeout(() => {
            errorMessage.value = ''
          }, 3000)
        }
        break
      case 'diffA':
        diffTextA.value = text
        break
      case 'diffB':
        diffTextB.value = text
        break
    }
  }
  catch (e: any) {
    errorMessage.value = `无法读取剪贴板: ${e.message}`
  }
}

function clearAll() {
  errorMessage.value = ''
  switch (activeTab.value) {
    case 'regex':
      regexPattern.value = ''
      regexFlags.value = 'g'
      regexTestString.value = ''
      break
    case 'timestamp':
      timestampInput.value = ''
      dateInput.value = ''
      timestampOutput.value = ''
      dateOutput.value = ''
      break
    case 'color':
      colorHex.value = '#3B82F6'
      updateFromHex()
      break
    case 'diff':
      diffTextA.value = ''
      diffTextB.value = ''
      break
  }
}

function switchTab(tabId: TabId) {
  activeTab.value = tabId
  errorMessage.value = ''
}
</script>

<template>
  <div class="text-pd-text bg-pd-bg flex flex-col h-screen overflow-hidden selection:text-pd-bg selection:bg-pd-accent">
    <!-- Header -->
    <header class="px-6 border-b border-pd-border bg-pd-bg/80 flex shrink-0 h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md">
      <div class="flex gap-4 items-center">
        <router-link
          to="/"
          class="text-pd-text-muted flex gap-2 transition-colors items-center hover:text-pd-accent"
        >
          <ArrowLeft
            class="h-4 w-4"
            :stroke-width="1.5"
          />
          <span class="text-xs tracking-widest font-bold uppercase">Back</span>
        </router-link>
        <div class="bg-pd-border h-5 w-px" />
        <div class="flex gap-2 items-center">
          <div class="p-1.5 border border-pd-accent/20 rounded-[2px] bg-pd-accent-muted">
            <Code2
              class="text-pd-accent h-4 w-4"
              :stroke-width="1.5"
            />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Dev<span class="text-pd-text-muted">///Toolkit</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
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
    <main class="flex flex-1 flex-col overflow-hidden">
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
          <component
            :is="tab.icon"
            class="h-3.5 w-3.5"
          />
          {{ tab.label }}
          <div
            v-if="activeTab === tab.id"
            class="bg-pd-accent h-0.5 bottom-0 left-0 right-0 absolute"
          />
        </button>
      </div>

      <!-- ═══ REGEX TAB ═══ -->
      <div
        v-if="activeTab === 'regex'"
        class="flex flex-1 flex-col overflow-hidden"
      >
        <!-- Pattern Input -->
        <div class="px-4 py-3 border-b border-pd-border bg-pd-bg-subtle/20 flex shrink-0 gap-3 items-center">
          <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">/</span>
          <input
            v-model="regexPattern"
            class="text-sm text-pd-text font-mono outline-none bg-transparent flex-1 placeholder-pd-text-disabled"
            placeholder="正则表达式..."
            spellcheck="false"
          >
          <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">/</span>
          <input
            v-model="regexFlags"
            class="text-sm text-pd-accent font-mono text-center outline-none bg-transparent w-12"
            placeholder="gi"
            spellcheck="false"
          >
          <div class="text-[9px] text-pd-text-muted font-bold px-2 py-1 border border-pd-border rounded-sm bg-pd-bg-subtle/50">
            {{ regexMatches.length }} MATCHES
          </div>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <!-- Test String -->
          <div class="border-r border-pd-border flex flex-1 flex-col min-w-0">
            <div class="px-4 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 shrink-0">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
                TEST STRING
              </span>
              <button
                class="text-[9px] text-pd-accent tracking-widest font-bold ml-auto px-2 py-0.5 border border-pd-border rounded-sm flex gap-1 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                @click="pasteToInput('regex')"
              >
                <ClipboardPaste class="h-3 w-3" />
                Paste
              </button>
            </div>
            <textarea
              v-model="regexTestString"
              class="text-sm text-pd-text leading-relaxed font-mono p-4 outline-none bg-pd-bg flex-1 resize-none placeholder-pd-text-disabled"
              placeholder="粘贴要测试的文本..."
              spellcheck="false"
            />
          </div>

          <!-- Results -->
          <div class="flex flex-1 flex-col min-w-0">
            <div class="px-4 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 shrink-0">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
                MATCH RESULTS
              </span>
            </div>
            <div class="custom-scrollbar p-4 flex-1 overflow-y-auto">
              <!-- Highlighted Preview -->
              <div class="mb-4 p-4 border border-pd-border rounded-sm bg-pd-bg-subtle/30">
                <p class="text-[9px] text-pd-text-muted tracking-widest font-bold mb-2 uppercase">
                  Preview
                </p>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div
                  class="text-sm text-pd-text leading-relaxed font-mono"
                  v-html="regexHighlightedText"
                />
              </div>

              <!-- Match List -->
              <div
                v-for="(m, idx) in regexMatches"
                :key="idx"
                class="mb-2 p-3 border border-pd-border rounded-sm bg-pd-bg"
              >
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-[9px] text-pd-accent tracking-widest font-bold uppercase">
                    MATCH {{ idx + 1 }}
                  </span>
                  <span class="text-[9px] text-pd-text-muted">
                    index: {{ m.index }}
                  </span>
                </div>
                <code class="text-sm text-pd-text font-bold block">
                  {{ m.match }}
                </code>
                <div
                  v-if="m.groups.length"
                  class="mt-2 flex flex-wrap gap-2"
                >
                  <span
                    v-for="(g, gi) in m.groups"
                    :key="gi"
                    class="text-[10px] text-pd-text-secondary font-bold px-2 py-0.5 border border-pd-border rounded-sm bg-pd-bg-subtle/50"
                  >
                    ${{ gi + 1 }}: {{ g }}
                  </span>
                </div>
              </div>

              <div
                v-if="regexMatches.length === 0 && regexPattern"
                class="py-12 opacity-30 flex flex-col items-center justify-center"
              >
                <Code2
                  class="mb-3 h-12 w-12"
                  :stroke-width="0.5"
                />
                <p class="text-xs tracking-[0.3em] uppercase">
                  No Matches
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ TIMESTAMP TAB ═══ -->
      <div
        v-if="activeTab === 'timestamp'"
        class="custom-scrollbar p-10 flex-1 overflow-y-auto"
      >
        <div class="mx-auto max-w-4xl space-y-12">
          <!-- Current Info Banner -->
          <div class="gap-8 grid grid-cols-1 md:grid-cols-3">
            <div class="p-6 border border-pd-border rounded-sm bg-pd-bg-subtle/10 flex flex-col gap-3 shadow-sm">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">Now (Timestamp)</span>
              <code class="text-xl text-pd-accent font-bold">{{ timestampUnit === 'seconds' ? Math.floor(now.valueOf() / 1000) : now.valueOf() }}</code>
            </div>
            <div class="p-6 border border-pd-border rounded-sm bg-pd-bg-subtle/10 flex flex-col gap-3 col-span-2 shadow-sm">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">Current Date (Local)</span>
              <code class="text-xl text-pd-text font-bold">{{ now.format('YYYY-MM-DD HH:mm:ss') }}</code>
            </div>
          </div>

          <!-- Unit Selector & Global Actions -->
          <div class="my-4 px-2 flex flex-wrap gap-12 items-center">
            <div class="flex gap-4 items-center">
              <span class="text-[10px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">UNIT</span>
              <div class="flex gap-2">
                <button
                  v-for="unit in (['seconds', 'milliseconds'] as const)"
                  :key="unit"
                  class="text-[11px] tracking-widest font-bold px-4 py-2 border rounded-sm uppercase transition-all"
                  :class="timestampUnit === unit
                    ? 'border-pd-accent/40 bg-pd-accent-muted text-pd-accent'
                    : 'border-pd-border text-pd-text-muted hover:border-pd-border-hover hover:text-pd-text'"
                  @click="timestampUnit = unit"
                >
                  {{ unit }}
                </button>
              </div>
            </div>

            <div class="bg-pd-border/60 h-4 w-px" />

            <button
              class="text-[11px] text-pd-text-muted tracking-widest font-bold px-4 py-2 border border-pd-border rounded-sm flex gap-2 uppercase transition-all items-center hover:text-pd-accent hover:border-pd-accent/50"
              @click="fillNow"
            >
              <RefreshCw class="h-4 w-4" />
              Reset to Now
            </button>
          </div>

          <div class="gap-12 grid grid-cols-1">
            <!-- Timestamp → Date -->
            <div class="p-8 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-8 shadow-sm">
              <div class="flex items-center justify-between">
                <div class="flex gap-3 items-center">
                  <div class="rounded-full bg-pd-accent h-1.5 w-1.5" />
                  <h3 class="text-[11px] text-pd-text tracking-[0.2em] font-bold uppercase">
                    Timestamp → Date
                  </h3>
                </div>
                <button
                  class="text-[10px] text-pd-accent tracking-widest font-bold px-3 py-1.5 border border-pd-border rounded-sm flex gap-2 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                  @click="pasteToInput('timestamp')"
                >
                  <ClipboardPaste class="h-4 w-4" />
                  Paste
                </button>
              </div>

              <div class="relative">
                <input
                  v-model="timestampInput"
                  class="text-base text-pd-text font-mono p-5 pr-12 outline-none border-b border-pd-border bg-transparent w-full transition-colors focus:border-pd-accent"
                  placeholder="Enter timestamp (e.g. 1709827200)"
                >
                <Clock class="text-pd-text-muted h-5 w-5 right-4 top-1/2 absolute -translate-y-1/2" />
              </div>

              <div class="p-6 border border-pd-border rounded-sm bg-pd-bg-subtle/10 flex min-h-32 items-center justify-center">
                <pre
                  v-if="timestampOutput"
                  class="text-sm text-pd-text leading-relaxed font-mono w-full"
                >{{ timestampOutput }}</pre>
                <div v-else class="text-xs text-pd-text-disabled tracking-widest uppercase italic">
                  Waiting for input...
                </div>
              </div>
            </div>

            <!-- Date → Timestamp -->
            <div class="p-8 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-8 shadow-sm">
              <div class="flex items-center justify-between">
                <div class="flex gap-3 items-center">
                  <div class="rounded-full bg-pd-secondary h-1.5 w-1.5" />
                  <h3 class="text-[11px] text-pd-text tracking-[0.2em] font-bold uppercase">
                    Date → Timestamp
                  </h3>
                </div>
                <button
                  class="text-[10px] text-pd-accent tracking-widest font-bold px-3 py-1.5 border border-pd-border rounded-sm flex gap-2 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                  @click="pasteToInput('date')"
                >
                  <ClipboardPaste class="h-4 w-4" />
                  Paste
                </button>
              </div>

              <div class="relative">
                <input
                  v-model="dateInput"
                  class="text-base text-pd-text font-mono p-5 pr-12 outline-none border-b border-pd-border bg-transparent w-full transition-colors focus:border-pd-accent"
                  placeholder="Enter date string (e.g. 2024-03-07 15:30:00 or ISO)"
                >
                <Calendar class="text-pd-text-muted h-5 w-5 right-4 top-1/2 absolute -translate-y-1/2" />
              </div>

              <div class="p-6 border border-pd-border rounded-sm bg-pd-bg-subtle/10 flex min-h-32 items-center justify-center">
                <pre
                  v-if="dateOutput"
                  class="text-sm text-pd-text leading-relaxed font-mono w-full"
                >{{ dateOutput }}</pre>
                <div v-else class="text-xs text-pd-text-disabled tracking-widest uppercase italic">
                  Waiting for input...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ COLOR TAB ═══ -->
      <div
        v-if="activeTab === 'color'"
        class="custom-scrollbar p-8 flex-1 overflow-y-auto"
      >
        <div class="mx-auto max-w-4xl">
          <!-- Color Preview -->
          <div class="mb-4 flex gap-4 items-start">
            <div
              class="border border-pd-border rounded-sm shrink-0 h-40 w-40 shadow-xl"
              :style="{ backgroundColor: colorHex }"
            />
            <div class="flex flex-1 flex-col gap-4">
              <!-- HEX -->
              <div class="p-4 border border-pd-border rounded-sm bg-pd-bg">
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
                    HEX
                  </label>
                  <button
                    class="text-[9px] text-pd-accent tracking-widest font-bold px-2 py-0.5 border border-pd-border rounded-sm flex gap-1 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                    @click="pasteToInput('color')"
                  >
                    <ClipboardPaste class="h-3 w-3" />
                    Paste
                  </button>
                </div>
                <div class="flex gap-2 items-center">
                  <input
                    v-model="colorHex"
                    class="text-sm text-pd-text font-bold font-mono outline-none bg-transparent flex-1"
                    maxlength="7"
                    @input="updateFromHex"
                  >
                  <input
                    type="color"
                    :value="colorHex"
                    class="rounded-sm border-none h-8 w-8 cursor-pointer"
                    @input="(e) => { colorHex = (e.target as HTMLInputElement).value; updateFromHex() }"
                  >
                </div>
              </div>

              <!-- RGB -->
              <div class="p-4 border border-pd-border rounded-sm bg-pd-bg">
                <label class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold mb-2 block uppercase">
                  RGB
                </label>
                <div class="flex gap-3 items-center">
                  <div
                    v-for="(ch, ci) in ([
                      { label: 'R', model: colorR, color: 'text-red-400' },
                      { label: 'G', model: colorG, color: 'text-green-400' },
                      { label: 'B', model: colorB, color: 'text-blue-400' },
                    ] as const)"
                    :key="ci"
                    class="flex gap-1.5 items-center"
                  >
                    <span :class="ch.color" class="text-[10px] font-bold">
                      {{ ch.label }}
                    </span>
                    <input
                      :value="ch.model"
                      type="number"
                      min="0"
                      max="255"
                      class="text-xs text-pd-text font-mono p-1.5 text-center outline-none border border-pd-border rounded-sm bg-pd-bg-subtle/30 w-16"
                      @input="(e) => {
                        const v = Number((e.target as HTMLInputElement).value)
                        if (ch.label === 'R') colorR = v
                        else if (ch.label === 'G') colorG = v
                        else colorB = v
                        updateFromRgb()
                      }"
                    >
                  </div>
                </div>
              </div>

              <!-- HSL -->
              <div class="p-4 border border-pd-border rounded-sm bg-pd-bg">
                <label class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold mb-2 block uppercase">
                  HSL
                </label>
                <div class="flex gap-3 items-center">
                  <div class="flex gap-1.5 items-center">
                    <span class="text-[10px] text-pd-text-muted font-bold">H</span>
                    <input
                      v-model.number="colorH"
                      type="number"
                      min="0"
                      max="360"
                      class="text-xs text-pd-text font-mono p-1.5 text-center outline-none border border-pd-border rounded-sm bg-pd-bg-subtle/30 w-16"
                      @input="updateFromHsl"
                    >
                  </div>
                  <div class="flex gap-1.5 items-center">
                    <span class="text-[10px] text-pd-text-muted font-bold">S</span>
                    <input
                      v-model.number="colorS"
                      type="number"
                      min="0"
                      max="100"
                      class="text-xs text-pd-text font-mono p-1.5 text-center outline-none border border-pd-border rounded-sm bg-pd-bg-subtle/30 w-16"
                      @input="updateFromHsl"
                    >
                  </div>
                  <div class="flex gap-1.5 items-center">
                    <span class="text-[10px] text-pd-text-muted font-bold">L</span>
                    <input
                      v-model.number="colorL"
                      type="number"
                      min="0"
                      max="100"
                      class="text-xs text-pd-text font-mono p-1.5 text-center outline-none border border-pd-border rounded-sm bg-pd-bg-subtle/30 w-16"
                      @input="updateFromHsl"
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Copy Formats -->
          <div class="gap-3 grid grid-cols-2">
            <button
              v-for="fmt in colorFormats"
              :key="fmt.label"
              class="p-3 text-left border border-pd-border rounded-sm bg-pd-bg flex transition-all items-center justify-between hover:border-pd-accent/30 hover:bg-pd-bg-subtle/30 active:scale-[0.98]"
              @click="copyText(fmt.value)"
            >
              <div>
                <p class="text-[9px] text-pd-text-muted tracking-widest font-bold uppercase">
                  {{ fmt.label }}
                </p>
                <p class="text-xs text-pd-text font-bold font-mono mt-1">
                  {{ fmt.value }}
                </p>
              </div>
              <ClipboardCopy class="text-pd-text-muted h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ DIFF TAB ═══ -->
      <div
        v-if="activeTab === 'diff'"
        class="flex flex-1 flex-col overflow-hidden"
      >
        <!-- Stats Bar -->
        <div class="px-4 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 flex shrink-0 gap-4 items-center">
          <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
            DIFF STATS
          </span>
          <span class="text-[10px] text-pd-success font-bold">
            +{{ diffStats.adds }}
          </span>
          <span class="text-[10px] text-pd-danger font-bold">
            -{{ diffStats.removes }}
          </span>
          <span class="text-[10px] text-pd-text-muted font-bold">
            ={{ diffStats.same }}
          </span>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <!-- Left: Text A -->
          <div class="border-r border-pd-border flex flex-1 flex-col min-w-0">
            <div class="px-4 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 shrink-0">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
                ORIGINAL (A)
              </span>
              <button
                class="text-[9px] text-pd-accent tracking-widest font-bold ml-auto px-2 py-0.5 border border-pd-border rounded-sm flex gap-1 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                @click="pasteToInput('diffA')"
              >
                <ClipboardPaste class="h-3 w-3" />
                Paste
              </button>
            </div>
            <textarea
              v-model="diffTextA"
              class="text-sm text-pd-text leading-relaxed font-mono p-4 outline-none bg-pd-bg flex-1 resize-none placeholder-pd-text-disabled"
              placeholder="粘贴原始文本..."
              spellcheck="false"
            />
          </div>

          <!-- Center: Diff Result -->
          <div class="flex flex-1 flex-col min-w-0">
            <div class="px-4 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 shrink-0">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
                DIFF RESULT
              </span>
            </div>
            <div class="custom-scrollbar text-sm font-mono bg-pd-bg flex-1 overflow-y-auto">
              <div
                v-for="(line, idx) in diffResult"
                :key="idx"
                class="border-b border-pd-border/30 flex items-stretch"
                :class="{
                  'bg-pd-success-muted/30': line.type === 'add',
                  'bg-pd-danger-muted/30': line.type === 'remove',
                }"
              >
                <div class="text-[10px] text-pd-text-disabled py-1 text-center border-r border-pd-border/20 shrink-0 w-8 select-none">
                  {{ line.lineA || '' }}
                </div>
                <div class="text-[10px] text-pd-text-disabled py-1 text-center border-r border-pd-border/20 shrink-0 w-8 select-none">
                  {{ line.lineB || '' }}
                </div>
                <div
                  class="font-bold py-1 text-center shrink-0 w-5 select-none"
                  :class="{
                    'text-pd-success': line.type === 'add',
                    'text-pd-danger': line.type === 'remove',
                    'text-pd-text-disabled': line.type === 'same',
                  }"
                >
                  {{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}
                </div>
                <div
                  class="px-2 py-1 flex-1 whitespace-pre-wrap break-all"
                  :class="{
                    'text-pd-success': line.type === 'add',
                    'text-pd-danger': line.type === 'remove',
                    'text-pd-text': line.type === 'same',
                  }"
                >
                  {{ line.content }}
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Text B -->
          <div class="border-l border-pd-border flex flex-1 flex-col min-w-0">
            <div class="px-4 py-2.5 border-b border-pd-border bg-pd-bg-subtle/20 shrink-0">
              <span class="text-[9px] text-pd-text-muted tracking-[0.2em] font-bold uppercase">
                MODIFIED (B)
              </span>
              <button
                class="text-[9px] text-pd-accent tracking-widest font-bold ml-auto px-2 py-0.5 border border-pd-border rounded-sm flex gap-1 uppercase transition-all items-center hover:border-pd-accent/50 hover:bg-pd-accent-muted"
                @click="pasteToInput('diffB')"
              >
                <ClipboardPaste class="h-3 w-3" />
                Paste
              </button>
            </div>
            <textarea
              v-model="diffTextB"
              class="text-sm text-pd-text leading-relaxed font-mono p-4 outline-none bg-pd-bg flex-1 resize-none placeholder-pd-text-disabled"
              placeholder="粘贴修改后的文本..."
              spellcheck="false"
            />
          </div>
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
      <div class="px-4 py-2 border-t border-pd-border bg-pd-bg-subtle/20 flex shrink-0 items-center justify-between">
        <span class="text-[9px] text-pd-text-muted tracking-widest uppercase">
          Mode: {{ activeTab.toUpperCase() }}
        </span>
        <span class="text-[9px] text-pd-text-disabled tracking-widest uppercase">
          Browser-side only
        </span>
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
