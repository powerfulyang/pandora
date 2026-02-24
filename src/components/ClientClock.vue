<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { formatTime } from '@/utils'

const time = ref('')
let interval: ReturnType<typeof setInterval> | null = null

function updateTime() {
  time.value = formatTime(new Date())
}

onMounted(() => {
  updateTime()
  interval = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (interval)
    clearInterval(interval)
})
</script>

<template>
  <span class="text-2xl text-pd-text tracking-widest">
    {{ time || '--:--:--' }}
  </span>
</template>
