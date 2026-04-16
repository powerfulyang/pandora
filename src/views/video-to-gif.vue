<script setup lang="ts">
import type { ProcessingRecord } from '@/lib/storage'
import {
  ArrowLeft,
  Download,
  Film,
  History,
  Loader2,
  Palette,
  RefreshCw,
  Scissors,
  Settings,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-vue-next'
import workerUrl from 'modern-gif/worker?url'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import HistoryPreview from '@/components/HistoryPreview.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { videoGifRecordStorage } from '@/lib/storage'
import { downloadFile, formatBytes } from '@/utils'

interface VideoSource {
  id: string
  file: File
  url: string
  duration: number
  width: number
  height: number
}

const MAX_CLIP_DURATION = 8
const MAX_FRAME_COUNT = 160
const MAX_OUTPUT_WIDTH = 720

const fileInputRef = ref<HTMLInputElement | null>(null)
const sourceVideo = ref<VideoSource | null>(null)
const gifBlob = ref<Blob | null>(null)
const gifUrl = ref<string | null>(null)
const history = ref<ProcessingRecord[]>([])
const activeTab = ref<'workspace' | 'history'>('workspace')
const isDragging = ref(false)
const isLoadingMetadata = ref(false)
const isConverting = ref(false)
const progress = ref(0)
const statusText = ref('Awaiting video input')
const errorMessage = ref('')

const config = reactive({
  startTime: 0,
  endTime: 0,
  fps: 10,
  width: 480,
  maxColors: 128,
})

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10
}

function revokeUrl(url: string | null | undefined) {
  if (url)
    URL.revokeObjectURL(url)
}

function destroyDetachedVideo(video: HTMLVideoElement | null) {
  if (!video)
    return
  video.pause()
  video.removeAttribute('src')
  video.load()
}

function isAcceptedVideoFile(file: File) {
  return file.type.startsWith('video/')
    || /\.(?:mp4|mov|m4v|webm|ogv|ogg)$/i.test(file.name)
}

function formatSeconds(value?: number | null) {
  if (value === null || value === undefined)
    return '--'
  return `${value.toFixed(1)}s`
}

function getRecommendedWidth(sourceWidth: number) {
  const limit = Math.min(sourceWidth, MAX_OUTPUT_WIDTH)
  const presets = [240, 360, 480, 640, 720].filter(value => value <= limit)
  const lastPreset = presets[presets.length - 1]
  return lastPreset ?? limit
}

function resetOutput() {
  revokeUrl(gifUrl.value)
  gifUrl.value = null
  gifBlob.value = null
  progress.value = 0
}

function resetWorkspace() {
  resetOutput()
  revokeUrl(sourceVideo.value?.url)
  sourceVideo.value = null
  errorMessage.value = ''
  statusText.value = 'Awaiting video input'
  config.startTime = 0
  config.endTime = 0
  config.fps = 10
  config.width = 480
  config.maxColors = 128
}

async function loadHistory() {
  history.value = await videoGifRecordStorage.getRecords()
}

const maxOutputWidth = computed(() => {
  const rawWidth = sourceVideo.value?.width ?? 480
  return Math.max(1, Math.min(rawWidth, MAX_OUTPUT_WIDTH))
})

const widthPresets = computed(() => {
  const presets = [240, 360, 480, 640, 720]
    .filter(value => value <= maxOutputWidth.value)
  const values = [...new Set([...presets, config.width].filter(value => value > 0))]
  return values.sort((a, b) => a - b)
})

const clipDuration = computed(() => {
  if (!sourceVideo.value)
    return 0
  return Math.max(0, Number((config.endTime - config.startTime).toFixed(2)))
})

const estimatedFrameCount = computed(() => {
  if (!sourceVideo.value)
    return 0
  return Math.max(1, Math.round(clipDuration.value * config.fps))
})

const estimatedHeight = computed(() => {
  if (!sourceVideo.value)
    return 0
  return Math.max(1, Math.round((config.width / sourceVideo.value.width) * sourceVideo.value.height))
})

const clipTooLong = computed(() => clipDuration.value > MAX_CLIP_DURATION)
const tooManyFrames = computed(() => estimatedFrameCount.value > MAX_FRAME_COUNT)

const outputDelta = computed(() => {
  if (!sourceVideo.value || !gifBlob.value || sourceVideo.value.file.size === 0)
    return null
  return Math.round(((gifBlob.value.size - sourceVideo.value.file.size) / sourceVideo.value.file.size) * 100)
})

const canConvert = computed(() => {
  return Boolean(sourceVideo.value)
    && !isLoadingMetadata.value
    && !isConverting.value
    && clipDuration.value > 0
    && !clipTooLong.value
    && !tooManyFrames.value
})

function normalizeConfig() {
  if (!sourceVideo.value)
    return

  const duration = sourceVideo.value.duration
  const safeMinWidth = Math.min(160, maxOutputWidth.value)
  const maxStart = Math.max(0, duration - 0.1)

  config.startTime = clamp(roundToTenths(config.startTime), 0, maxStart)
  config.endTime = clamp(roundToTenths(config.endTime), Math.min(duration, config.startTime + 0.1), duration)
  if (config.endTime - config.startTime > MAX_CLIP_DURATION)
    config.endTime = roundToTenths(Math.min(duration, config.startTime + MAX_CLIP_DURATION))

  config.fps = clamp(Math.round(config.fps), 4, 20)
  config.width = clamp(Math.round(config.width), safeMinWidth, maxOutputWidth.value)
  config.maxColors = clamp(Math.round(config.maxColors), 32, 255)
}

async function nextPaint() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

async function waitForVideoFrame(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    await nextPaint()
    return
  }

  await new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    function cleanup() {
      video.removeEventListener('loadeddata', handleReady)
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('error', handleError)
      if (timeoutId)
        clearTimeout(timeoutId)
    }

    function handleReady() {
      cleanup()
      resolve()
    }

    function handleError() {
      cleanup()
      reject(new Error('Video frame data is unavailable.'))
    }

    timeoutId = setTimeout(() => {
      cleanup()
      resolve()
    }, 1000)

    video.addEventListener('loadeddata', handleReady, { once: true })
    video.addEventListener('canplay', handleReady, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })

  await nextPaint()
}

async function readVideoMetadata(file: File): Promise<VideoSource> {
  const url = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    function cleanup() {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('error', handleError)
    }

    function handleLoadedMetadata() {
      cleanup()

      if (!Number.isFinite(video.duration) || !video.videoWidth || !video.videoHeight) {
        destroyDetachedVideo(video)
        revokeUrl(url)
        reject(new Error('Failed to read video metadata. Try another file.'))
        return
      }

      const payload: VideoSource = {
        id: crypto.randomUUID(),
        file,
        url,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      }

      destroyDetachedVideo(video)
      resolve(payload)
    }

    function handleError() {
      cleanup()
      destroyDetachedVideo(video)
      revokeUrl(url)
      reject(new Error('This browser cannot decode the selected video.'))
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
    video.addEventListener('error', handleError, { once: true })
    video.src = url
    video.load()
  })
}

async function createPlaybackVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    function cleanup() {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('error', handleError)
    }

    function handleLoadedData() {
      cleanup()
      resolve(video)
    }

    function handleError() {
      cleanup()
      destroyDetachedVideo(video)
      reject(new Error('Failed to decode video frames for this file.'))
    }

    video.addEventListener('loadeddata', handleLoadedData, { once: true })
    video.addEventListener('error', handleError, { once: true })
    video.src = url
    video.load()
  })
}

async function seekVideo(video: HTMLVideoElement, targetTime: number) {
  const safeEnd = Number.isFinite(video.duration)
    ? Math.max(0, video.duration - 0.05)
    : targetTime
  const nextTime = clamp(targetTime, 0, safeEnd)

  if (Math.abs(video.currentTime - nextTime) < 0.01)
    return

  await new Promise<void>((resolve, reject) => {
    function cleanup() {
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
    }

    function handleSeeked() {
      cleanup()
      resolve()
    }

    function handleError() {
      cleanup()
      reject(new Error('Seeking failed while extracting frames.'))
    }

    video.addEventListener('seeked', handleSeeked, { once: true })
    video.addEventListener('error', handleError, { once: true })
    video.currentTime = nextTime
  })
}

async function loadSelectedFile(file: File) {
  if (!isAcceptedVideoFile(file)) {
    errorMessage.value = 'Please choose a browser-playable video file.'
    return
  }

  isLoadingMetadata.value = true
  errorMessage.value = ''

  try {
    const nextSource = await readVideoMetadata(file)
    const previousUrl = sourceVideo.value?.url
    sourceVideo.value = nextSource
    revokeUrl(previousUrl)

    resetOutput()
    config.startTime = 0
    config.endTime = roundToTenths(Math.min(nextSource.duration, 5))
    config.fps = 10
    config.width = getRecommendedWidth(nextSource.width)
    config.maxColors = 128
    normalizeConfig()

    statusText.value = 'Video ready for conversion'
    activeTab.value = 'workspace'
  }
  catch (error) {
    console.error('loadSelectedFile failed', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load video.'
  }
  finally {
    isLoadingMetadata.value = false
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file)
    void loadSelectedFile(file)
  input.value = ''
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file)
    void loadSelectedFile(file)
}

async function convertToGif() {
  if (!sourceVideo.value)
    return

  normalizeConfig()
  errorMessage.value = ''
  resetOutput()

  if (clipTooLong.value) {
    errorMessage.value = `Clip length must stay within ${MAX_CLIP_DURATION} seconds.`
    return
  }

  if (tooManyFrames.value) {
    errorMessage.value = `Current settings would extract ${estimatedFrameCount.value} frames. Reduce FPS or shorten the clip.`
    return
  }

  isConverting.value = true
  statusText.value = 'Preparing timeline'

  let playbackVideo: HTMLVideoElement | null = null

  try {
    const { Encoder } = await import('modern-gif')
    playbackVideo = await createPlaybackVideo(sourceVideo.value.url)

    const width = config.width
    const height = estimatedHeight.value
    const totalFrames = estimatedFrameCount.value
    const frameDelay = Math.max(50, Math.round(1000 / config.fps))
    const encoder = new Encoder({
      width,
      height,
      workerUrl,
      maxColors: config.maxColors,
      looped: true,
      loopCount: 0,
    })

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context)
      throw new Error('Failed to initialize the canvas encoder.')

    progress.value = 4
    await nextPaint()

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      statusText.value = `Extracting frames ${frameIndex + 1}/${totalFrames}`
      const frameTime = Math.min(
        config.startTime + frameIndex / config.fps,
        Math.max(config.startTime, config.endTime - 0.001),
      )

      await seekVideo(playbackVideo, frameTime)
      await waitForVideoFrame(playbackVideo)
      context.clearRect(0, 0, width, height)
      context.drawImage(playbackVideo, 0, 0, width, height)
      const imageData = context.getImageData(0, 0, width, height)

      await encoder.encode({
        data: imageData.data,
        width,
        height,
        delay: frameDelay,
      })

      progress.value = Math.max(5, Math.round(((frameIndex + 1) / totalFrames) * 82))
      if ((frameIndex + 1) % 3 === 0)
        await nextPaint()
    }

    statusText.value = 'Encoding GIF'
    progress.value = 90

    const blob = await encoder.flush('blob')
    gifBlob.value = blob
    gifUrl.value = URL.createObjectURL(blob)
    progress.value = 100
    statusText.value = 'GIF ready'

    await videoGifRecordStorage.saveRecord({
      id: crypto.randomUUID(),
      originalName: sourceVideo.value.file.name,
      timestamp: Date.now(),
      format: 'gif',
      originalSize: sourceVideo.value.file.size,
      processedSize: blob.size,
      savedFile: blob,
      duration: clipDuration.value,
      fps: config.fps,
      framesCount: totalFrames,
      width,
      height,
    })

    await loadHistory()
  }
  catch (error) {
    console.error('convertToGif failed', error)
    errorMessage.value = error instanceof Error ? error.message : 'GIF export failed.'
    progress.value = 0
    statusText.value = 'Conversion failed'
  }
  finally {
    isConverting.value = false
    destroyDetachedVideo(playbackVideo)
  }
}

async function clearHistory() {
  await videoGifRecordStorage.clearRecords()
  await loadHistory()
}

async function removeHistory(id: string) {
  await videoGifRecordStorage.deleteRecord(id)
  await loadHistory()
}

function downloadCurrentGif() {
  if (!gifBlob.value || !sourceVideo.value)
    return
  downloadFile(gifBlob.value, sourceVideo.value.file.name, 'gif')
}

function downloadHistoryItem(record: ProcessingRecord) {
  if (!record.savedFile)
    return
  downloadFile(record.savedFile, record.originalName, 'gif')
}

watch(
  () => [config.startTime, config.endTime, config.fps, config.width, config.maxColors, sourceVideo.value?.id],
  () => {
    if (isConverting.value) {
      normalizeConfig()
      return
    }

    normalizeConfig()
    if (!sourceVideo.value) {
      statusText.value = 'Awaiting video input'
      return
    }

    statusText.value = gifBlob.value
      ? 'Settings changed, reconvert to refresh output'
      : 'Video ready for conversion'
  },
)

onMounted(() => {
  loadHistory()
})

onUnmounted(() => {
  revokeUrl(gifUrl.value)
  revokeUrl(sourceVideo.value?.url)
})
</script>

<template>
  <div
    class="text-pd-text bg-pd-bg flex flex-col min-h-screen selection:text-pd-accent selection:bg-pd-accent-muted md:h-screen"
  >
    <header
      class="px-4 border-b border-pd-border bg-pd-bg/80 flex shrink-0 h-14 items-center top-0 justify-between sticky z-50 backdrop-blur-md md:px-6"
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
            <Film class="text-pd-accent h-4 w-4" :stroke-width="1.5" />
          </div>
          <span class="text-sm tracking-widest font-bold uppercase">
            Pandora<span class="text-pd-text-muted">///VIDEO_GIF</span>
          </span>
        </div>
      </div>

      <div class="text-xs text-pd-text-muted flex gap-3 items-center">
        <div class="gap-2 hidden items-center lg:flex">
          <span class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
            Mode
          </span>
          <span class="text-xs text-pd-accent">LOCAL_TIMELINE_ENCODER</span>
        </div>
        <div class="mx-2 bg-pd-border h-4 w-px" />
        <ThemeToggle />
      </div>
    </header>

    <main
      class="bg-bg-angled p-4 flex-1 gap-6 grid grid-cols-1 min-h-0 lg:p-8 sm:p-6 lg:gap-8 lg:grid-cols-12 lg:overflow-hidden"
    >
      <section class="custom-scrollbar pr-2 flex flex-col gap-6 col-span-1 lg:col-span-4 xl:col-span-3 lg:overflow-y-auto">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg text-pd-text tracking-tight font-bold flex gap-2 uppercase items-center">
            Video to GIF
          </h2>
          <p class="text-[11px] text-pd-text-secondary leading-relaxed max-w-sm">
            Trim a short segment, control FPS and palette size, then export an animated GIF entirely in your browser.
          </p>
        </div>

        <div
          class="group border-2 rounded-sm border-dashed flex flex-col gap-4 min-h-[200px] transition-all duration-200 items-center justify-center relative overflow-hidden md:h-64"
          :class="[
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
            accept="video/*,.mp4,.mov,.m4v,.webm,.ogv,.ogg"
            class="opacity-0 h-full w-full cursor-pointer inset-0 absolute z-10"
            @change="handleFileSelect"
          >

          <div class="p-4 border border-pd-border rounded-full bg-pd-bg shadow-sm transition-transform group-hover:scale-110">
            <Upload
              class="text-pd-text-muted h-6 w-6 transition-colors group-hover:text-pd-accent"
              :stroke-width="1.5"
            />
          </div>

          <div class="px-4 text-center flex flex-col gap-3 items-center">
            <div class="flex flex-col gap-1">
              <p class="text-xs text-pd-text-secondary tracking-widest font-bold uppercase">
                Timeline Input
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
              <span class="text-pd-accent">{{ sourceVideo ? 'Replace Clip' : 'Load Video' }}</span>
            </div>
            <p class="text-[9px] text-pd-text-disabled tracking-tighter uppercase">
              Input: Browser-playable MP4 / WebM / MOV
            </p>
          </div>
        </div>

        <div
          v-if="sourceVideo"
          class="p-5 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-4 shadow-black/5 shadow-xl"
        >
          <div class="flex gap-4 items-start justify-between">
            <div class="min-w-0">
              <p class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
                Source Clip
              </p>
              <h3 class="text-sm text-pd-text font-bold mt-2 truncate">
                {{ sourceVideo.file.name }}
              </h3>
            </div>
            <button
              class="text-pd-text-muted p-1 cursor-pointer transition-colors hover:text-pd-danger"
              title="Remove"
              @click="resetWorkspace"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="gap-3 grid grid-cols-2">
            <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
              <p class="text-[9px] text-pd-text-disabled uppercase">
                Resolution
              </p>
              <p class="text-xs text-pd-text font-bold mt-1">
                {{ sourceVideo.width }} × {{ sourceVideo.height }}
              </p>
            </div>
            <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
              <p class="text-[9px] text-pd-text-disabled uppercase">
                Duration
              </p>
              <p class="text-xs text-pd-text font-bold mt-1">
                {{ formatSeconds(sourceVideo.duration) }}
              </p>
            </div>
            <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
              <p class="text-[9px] text-pd-text-disabled uppercase">
                File Size
              </p>
              <p class="text-xs text-pd-text font-bold mt-1">
                {{ formatBytes(sourceVideo.file.size) }}
              </p>
            </div>
            <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
              <p class="text-[9px] text-pd-text-disabled uppercase">
                Status
              </p>
              <p class="text-xs text-pd-accent font-bold mt-1 uppercase">
                {{ isLoadingMetadata ? 'Analyzing' : 'Ready' }}
              </p>
            </div>
          </div>
        </div>

        <div
          class="p-6 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-6 shadow-black/5 shadow-xl"
          :class="{ 'opacity-60': !sourceVideo }"
        >
          <div class="pb-4 border-b border-pd-border flex gap-2 items-center">
            <Settings class="text-pd-accent h-4 w-4" />
            <span class="text-xs tracking-widest font-bold uppercase">Settings</span>
          </div>
          <div class="flex flex-col gap-5">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-pd-text-muted uppercase">Clip Window</label>
                <span class="text-[10px] text-pd-text-disabled uppercase">
                  Max {{ MAX_CLIP_DURATION }}s
                </span>
              </div>
              <div class="gap-3 grid grid-cols-2">
                <label class="flex flex-col gap-2">
                  <span class="text-[10px] text-pd-text-disabled uppercase">Start</span>
                  <input
                    v-model.number="config.startTime"
                    type="number"
                    min="0"
                    :max="sourceVideo?.duration ?? 0"
                    step="0.1"
                    :disabled="!sourceVideo"
                    class="text-sm px-3 py-2 border border-pd-border rounded-sm bg-pd-bg-subtle w-full focus:outline-none focus:border-pd-accent"
                  >
                </label>
                <label class="flex flex-col gap-2">
                  <span class="text-[10px] text-pd-text-disabled uppercase">End</span>
                  <input
                    v-model.number="config.endTime"
                    type="number"
                    min="0.1"
                    :max="sourceVideo?.duration ?? 0"
                    step="0.1"
                    :disabled="!sourceVideo"
                    class="text-sm px-3 py-2 border border-pd-border rounded-sm bg-pd-bg-subtle w-full focus:outline-none focus:border-pd-accent"
                  >
                </label>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-pd-text-muted uppercase">Output Width</label>
                <span class="text-xs text-pd-accent">{{ config.width }}px</span>
              </div>
              <div class="gap-2 grid grid-cols-3">
                <button
                  v-for="width in widthPresets"
                  :key="width"
                  class="text-[10px] text-pd-text-muted font-bold py-2 border border-pd-border rounded-sm uppercase transition-all hover:border-pd-accent/50"
                  :class="config.width === width ? 'bg-pd-accent border-pd-accent text-white' : ''"
                  :disabled="!sourceVideo"
                  @click="config.width = width"
                >
                  {{ width }}px
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-pd-text-muted uppercase">FPS</label>
                <span class="text-xs text-pd-accent">{{ config.fps }}</span>
              </div>
              <input
                v-model.number="config.fps"
                type="range"
                min="4"
                max="20"
                step="1"
                :disabled="!sourceVideo"
                class="appearance-none accent-[var(--pd-accent)] rounded-lg bg-pd-border h-1 w-full cursor-pointer"
              >
              <div class="text-[10px] text-pd-text-disabled flex justify-between">
                <span>Lighter</span>
                <span>Smoother</span>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-pd-text-muted uppercase">Palette Size</label>
                <span class="text-xs text-pd-accent">{{ config.maxColors }} colors</span>
              </div>
              <input
                v-model.number="config.maxColors"
                type="range"
                min="32"
                max="255"
                step="1"
                :disabled="!sourceVideo"
                class="appearance-none accent-[var(--pd-accent)] rounded-lg bg-pd-border h-1 w-full cursor-pointer"
              >
              <div class="text-[10px] text-pd-text-disabled flex justify-between">
                <span>Smaller</span>
                <span>Richer</span>
              </div>
            </div>

            <div class="gap-3 grid grid-cols-2">
              <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                <div class="text-[9px] text-pd-text-disabled flex gap-1 uppercase items-center">
                  <Scissors class="h-3 w-3" />
                  Clip
                </div>
                <p class="text-sm text-pd-text font-bold mt-1">
                  {{ formatSeconds(clipDuration) }}
                </p>
              </div>
              <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                <div class="text-[9px] text-pd-text-disabled flex gap-1 uppercase items-center">
                  <Video class="h-3 w-3" />
                  Frames
                </div>
                <p class="text-sm text-pd-text font-bold mt-1">
                  {{ estimatedFrameCount || '--' }}
                </p>
              </div>
              <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                <div class="text-[9px] text-pd-text-disabled flex gap-1 uppercase items-center">
                  <RefreshCw class="h-3 w-3" />
                  Output
                </div>
                <p class="text-sm text-pd-text font-bold mt-1">
                  {{ config.width }} × {{ estimatedHeight || '--' }}
                </p>
              </div>
              <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                <div class="text-[9px] text-pd-text-disabled flex gap-1 uppercase items-center">
                  <Palette class="h-3 w-3" />
                  Codec
                </div>
                <p class="text-sm text-pd-text font-bold mt-1 uppercase">
                  GIF
                </p>
              </div>
            </div>

            <div
              v-if="clipTooLong || tooManyFrames"
              class="text-[10px] text-pd-warning px-3 py-2 border border-pd-warning/30 bg-pd-warning-muted uppercase"
            >
              <span v-if="clipTooLong">
                Clip is longer than {{ MAX_CLIP_DURATION }} seconds. Shorten the range before export.
              </span>
              <span v-else>
                Current settings would extract {{ estimatedFrameCount }} frames. Lower FPS or shorten the clip.
              </span>
            </div>
          </div>

          <button
            :disabled="!canConvert"
            class="text-sm tracking-widest font-bold py-3 rounded-sm flex gap-2 w-full uppercase transition-all items-center justify-center"
            :class="canConvert ? 'bg-pd-accent text-white hover:bg-pd-accent-hover cursor-pointer' : 'bg-pd-bg-subtle text-pd-text-disabled cursor-not-allowed'"
            @click="convertToGif"
          >
            <Loader2 v-if="isConverting || isLoadingMetadata" class="h-4 w-4 animate-spin" />
            <Film v-else class="h-4 w-4" />
            {{ isConverting ? 'Encoding GIF...' : isLoadingMetadata ? 'Analyzing Video...' : 'Convert to GIF' }}
          </button>

          <button
            v-if="gifBlob"
            class="text-sm text-pd-success tracking-widest py-3 border border-pd-success rounded-sm flex gap-2 w-full cursor-pointer uppercase transition-all items-center justify-center hover:bg-pd-success/5"
            @click="downloadCurrentGif"
          >
            <Download class="h-4 w-4" />
            Download GIF
          </button>
        </div>
      </section>

      <section
        class="border border-pd-border rounded-sm bg-pd-bg/60 flex flex-col col-span-1 shadow-2xl shadow-black/10 backdrop-blur-sm lg:col-span-8 xl:col-span-9 lg:min-h-[600px] lg:overflow-hidden"
      >
        <div class="border-b border-pd-border flex relative">
          <button
            class="text-xs tracking-wide font-bold px-6 py-3.5 flex gap-2 cursor-pointer uppercase transition-all items-center relative"
            :class="activeTab === 'workspace'
              ? 'bg-pd-bg-subtle/80 text-pd-text'
              : 'text-pd-text-muted hover:text-pd-text hover:bg-pd-bg-subtle/40'"
            @click="activeTab = 'workspace'"
          >
            <Video class="h-4 w-4" :class="{ 'text-pd-accent': activeTab === 'workspace' }" />
            Workspace
            <div v-if="activeTab === 'workspace'" class="bg-pd-accent h-[2px] bottom-[-1px] left-0 right-0 absolute" />
          </button>
          <button
            class="text-xs tracking-wide font-bold px-6 py-3.5 border-l border-pd-border/50 flex gap-2 cursor-pointer uppercase transition-all items-center relative"
            :class="activeTab === 'history'
              ? 'bg-pd-bg-subtle/80 text-pd-text'
              : 'text-pd-text-muted hover:text-pd-text hover:bg-pd-bg-subtle/40'"
            @click="activeTab = 'history'"
          >
            <History class="h-4 w-4" :class="{ 'text-pd-accent': activeTab === 'history' }" />
            History ({{ history.length }})
            <div v-if="activeTab === 'history'" class="bg-pd-accent h-[2px] bottom-[-1px] left-0 right-0 absolute" />
          </button>
          <div class="flex-1" />
          <button
            v-if="activeTab === 'history' && history.length > 0"
            class="text-xs text-pd-text-muted px-4 py-3 flex gap-2 cursor-pointer transition-colors items-center hover:text-pd-danger"
            @click="clearHistory"
          >
            <Trash2 class="h-3 w-3" />
            Clear
          </button>
        </div>
        <div class="custom-scrollbar p-6 flex flex-1 flex-col lg:overflow-y-auto">
          <template v-if="activeTab === 'workspace'">
            <div
              v-if="!sourceVideo"
              class="text-pd-text-muted py-20 opacity-40 flex flex-1 flex-col h-full items-center justify-center"
            >
              <Film class="mb-4 h-14 w-14" :stroke-width="1" />
              <div class="text-center flex flex-col gap-2">
                <p class="text-sm text-pd-text-secondary">
                  No clip loaded
                </p>
                <p class="text-[10px] text-pd-text-disabled tracking-[0.2em] uppercase">
                  Load a short video to start extracting frames
                </p>
              </div>
            </div>

            <div v-else class="flex flex-col gap-6">
              <div class="p-5 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-4">
                <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div class="min-w-0">
                    <p class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
                      Export Status
                    </p>
                    <p class="text-lg text-pd-text font-bold mt-1">
                      {{ statusText }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] text-pd-text-disabled uppercase">
                      Progress
                    </p>
                    <p class="text-sm text-pd-accent font-bold mt-1">
                      {{ progress }}%
                    </p>
                  </div>
                </div>

                <div class="bg-pd-border h-1 w-full overflow-hidden">
                  <div
                    class="bg-pd-accent h-full transition-all duration-300"
                    :style="{ width: `${progress}%` }"
                  />
                </div>

                <p v-if="errorMessage" class="text-[11px] text-pd-danger">
                  {{ errorMessage }}
                </p>

                <div class="gap-3 grid grid-cols-2 xl:grid-cols-4">
                  <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                    <p class="text-[9px] text-pd-text-disabled uppercase">
                      Clip
                    </p>
                    <p class="text-sm text-pd-text font-bold mt-1">
                      {{ formatSeconds(clipDuration) }}
                    </p>
                  </div>
                  <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                    <p class="text-[9px] text-pd-text-disabled uppercase">
                      Frames
                    </p>
                    <p class="text-sm text-pd-text font-bold mt-1">
                      {{ estimatedFrameCount }}
                    </p>
                  </div>
                  <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                    <p class="text-[9px] text-pd-text-disabled uppercase">
                      Output Size
                    </p>
                    <p class="text-sm text-pd-text font-bold mt-1">
                      {{ gifBlob ? formatBytes(gifBlob.size) : '--' }}
                    </p>
                  </div>
                  <div class="p-3 border border-pd-border/60 bg-pd-bg-subtle/40">
                    <p class="text-[9px] text-pd-text-disabled uppercase">
                      Size Delta
                    </p>
                    <p
                      class="text-sm font-bold mt-1"
                      :class="outputDelta !== null && outputDelta < 0 ? 'text-pd-success' : 'text-pd-warning'"
                    >
                      {{ outputDelta === null ? '--' : `${outputDelta > 0 ? '+' : ''}${outputDelta}%` }}
                    </p>
                  </div>
                </div>
              </div>

              <div class="gap-6 grid grid-cols-1 xl:grid-cols-2">
                <div class="border border-pd-border rounded-sm bg-pd-bg overflow-hidden">
                  <div class="px-5 py-4 border-b border-pd-border flex items-center justify-between">
                    <div>
                      <p class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
                        Original Video
                      </p>
                      <p class="text-xs text-pd-text-secondary mt-1">
                        {{ sourceVideo.width }} × {{ sourceVideo.height }} • {{ formatBytes(sourceVideo.file.size) }}
                      </p>
                    </div>
                    <span class="text-[9px] text-pd-text-disabled uppercase">
                      Browser decode
                    </span>
                  </div>
                  <div class="bg-bg-angled p-4 flex h-[360px] items-center justify-center">
                    <video
                      :src="sourceVideo.url"
                      controls
                      muted
                      playsinline
                      loop
                      class="border border-pd-border bg-black max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div class="border border-pd-border rounded-sm bg-pd-bg overflow-hidden">
                  <div class="px-5 py-4 border-b border-pd-border flex items-center justify-between">
                    <div>
                      <p class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
                        GIF Output
                      </p>
                      <p class="text-xs text-pd-text-secondary mt-1">
                        {{ config.width }} × {{ estimatedHeight || '--' }} • {{ config.fps }} FPS • {{ config.maxColors }} colors
                      </p>
                    </div>
                    <button
                      v-if="gifBlob"
                      class="text-pd-text-muted p-2 border border-pd-border rounded-sm cursor-pointer transition-colors hover:text-pd-accent"
                      title="Download"
                      @click="downloadCurrentGif"
                    >
                      <Download class="h-4 w-4" />
                    </button>
                  </div>
                  <div class="bg-bg-angled p-4 flex h-[360px] items-center justify-center">
                    <img
                      v-if="gifUrl"
                      :src="gifUrl"
                      alt="GIF preview"
                      class="border border-pd-border bg-pd-bg max-h-full max-w-full object-contain"
                    >
                    <div
                      v-else
                      class="text-pd-text-muted flex flex-col gap-3 items-center justify-center"
                    >
                      <Loader2 v-if="isConverting" class="text-pd-accent h-8 w-8 animate-spin" />
                      <Film v-else class="opacity-30 h-10 w-10" />
                      <div class="text-center flex flex-col gap-1">
                        <p class="text-sm text-pd-text-secondary">
                          {{ isConverting ? 'Building GIF preview' : 'No GIF generated yet' }}
                        </p>
                        <p class="text-[10px] text-pd-text-disabled tracking-widest uppercase">
                          {{ isConverting ? 'Frames are being encoded in a worker' : 'Tune the clip and run conversion' }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="p-5 border border-pd-border rounded-sm bg-pd-bg flex flex-col gap-3">
                <p class="text-[10px] text-pd-text-muted tracking-widest font-bold uppercase">
                  Notes
                </p>
                <p class="text-[11px] text-pd-text-secondary leading-relaxed">
                  Conversion stays local. The page can only process codecs your current browser can decode, so some MOV or HEVC files may still fail even if the extension is accepted.
                </p>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              v-if="history.length === 0"
              class="text-pd-text-muted py-20 opacity-40 flex flex-1 flex-col h-full items-center justify-center"
            >
              <History class="mb-4 h-14 w-14" :stroke-width="1" />
              <div class="text-center flex flex-col gap-2">
                <p class="text-sm text-pd-text-secondary">
                  No GIF exports yet
                </p>
                <p class="text-[10px] text-pd-text-disabled tracking-[0.2em] uppercase">
                  Completed conversions will appear here
                </p>
              </div>
            </div>

            <div v-else class="flex flex-col gap-3">
              <div
                v-for="record in history"
                :key="record.id"
                class="group border border-pd-border bg-pd-bg-subtle/10 flex h-28 transition-all relative overflow-hidden hover:border-pd-accent/30 hover:bg-pd-bg-subtle/20"
              >
                <div
                  class="bg-bg-angled border-r border-pd-border flex shrink-0 w-28 items-center justify-center relative overflow-hidden"
                >
                  <HistoryPreview v-if="record.savedFile" :blob="record.savedFile" />
                  <div v-else class="opacity-20">
                    <Film class="h-8 w-8" />
                  </div>
                </div>

                <div class="p-4 flex flex-1 flex-col min-w-0 justify-between">
                  <div class="flex gap-4 items-start justify-between">
                    <div class="min-w-0">
                      <h4 class="text-xs tracking-tight font-bold truncate uppercase">
                        {{ record.originalName }}
                      </h4>
                      <p class="text-[9px] text-pd-text-muted tracking-tighter mt-1 uppercase">
                        {{ new Date(record.timestamp).toLocaleString() }}
                      </p>
                    </div>

                    <div class="flex gap-1 items-center">
                      <button
                        v-if="record.savedFile"
                        class="text-pd-text-muted p-2 opacity-0 transition-all hover:text-pd-accent group-hover:opacity-100"
                        title="Download"
                        @click="downloadHistoryItem(record)"
                      >
                        <Download class="h-3.5 w-3.5" />
                      </button>
                      <button
                        class="text-pd-text-muted p-2 opacity-0 transition-all hover:text-pd-danger group-hover:opacity-100"
                        title="Remove"
                        @click="removeHistory(record.id)"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-6 items-center">
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Clip</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ formatSeconds(record.duration) }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Frames</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ record.framesCount ?? '--' }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">FPS</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ record.fps ?? '--' }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Output</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">
                        {{ record.width ?? '--' }} × {{ record.height ?? '--' }}
                      </span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] text-pd-text-disabled leading-none font-bold uppercase">Size</span>
                      <span class="text-[10px] text-pd-accent leading-none font-medium mt-1">{{ formatBytes(record.processedSize) }}</span>
                    </div>
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
