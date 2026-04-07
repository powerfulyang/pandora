<script setup lang="ts">
import { FileWarning, Loader2 } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { decodeImage } from '@/lib/image-processor'

const props = defineProps<{
  blob: Blob
}>()

const url = ref<string | null>(null)
const isLoading = ref(false)
const isError = ref(false)

async function generatePreview() {
  if (url.value) {
    if (!url.value.startsWith('data:'))
      URL.revokeObjectURL(url.value)
    url.value = null
  }

  isError.value = false
  const blob = props.blob

  // For non-HEIC files, use native object URL for efficiency
  const isHeic = blob.type === 'image/heic' || blob.type === 'image/heif'

  if (!isHeic) {
    url.value = URL.createObjectURL(blob)
    return
  }

  // Handle HEIC preview by decoding
  isLoading.value = true
  try {
    const imageData = await decodeImage(blob)
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.putImageData(imageData, 0, 0)
      url.value = canvas.toDataURL('image/png')
    }
  }
  catch (e) {
    console.error('HEIC preview failed', e)
    isError.value = true
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  generatePreview()
})

watch(() => props.blob, () => {
  generatePreview()
})

onUnmounted(() => {
  if (url.value && !url.value.startsWith('data:'))
    URL.revokeObjectURL(url.value)
})
</script>

<template>
  <div class="bg-pd-bg-subtle/20 flex h-full w-full items-center justify-center relative overflow-hidden">
    <div v-if="isLoading" class="flex flex-col gap-2 items-center">
      <Loader2 class="text-pd-accent opacity-50 h-5 w-5 animate-spin" />
      <span class="text-[9px] text-pd-text-disabled uppercase">Decoding...</span>
    </div>

    <div v-else-if="isError" class="flex flex-col gap-2 items-center">
      <FileWarning class="text-pd-text-muted opacity-30 h-6 w-6" />
      <span class="text-[9px] text-pd-text-muted uppercase">暂不支持预览</span>
    </div>

    <img
      v-else-if="url"
      :src="url"
      alt="preview"
      class="h-full w-full object-contain"
      loading="lazy"
    >
  </div>
</template>
