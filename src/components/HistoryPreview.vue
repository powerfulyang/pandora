<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  blob: Blob
}>()

const url = ref<string | null>(null)

onMounted(() => {
  url.value = URL.createObjectURL(props.blob)
})

onUnmounted(() => {
  if (url.value)
    URL.revokeObjectURL(url.value)
})
</script>

<template>
  <img
    v-if="url"
    :src="url"
    alt="preview"
    class="h-full w-full object-contain"
    loading="lazy"
  >
</template>
