<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatFullDate } from '@/utils'

const date = ref('')

onMounted(() => {
  date.value = formatFullDate(new Date())
})
</script>

<template>
  <span class="text-sm text-pd-text-secondary">
    {{ date || 'Loading...' }}
  </span>
</template>
