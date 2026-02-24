<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err as Error
  return false // prevent error from propagating further
})

function reset() {
  error.value = null
}
</script>

<template>
  <div v-if="error" class="m-4 p-6 border border-red-200 rounded-xl bg-red-50 shadow-sm">
    <div class="mb-4 flex gap-3 items-center">
      <div class="i-carbon:error-filled text-red-500 h-6 w-6" />
      <h3 class="text-lg text-red-800 font-bold">
        Something went wrong
      </h3>
    </div>
    <div class="text-sm text-red-700 font-mono mb-4 p-4 rounded-lg bg-red-100/50 max-h-60 overflow-auto">
      {{ error.message }}
    </div>
    <button
      class="text-sm text-white font-medium px-4 py-2 rounded-lg bg-red-600 shadow-sm transition-colors hover:bg-red-700"
      @click="reset"
    >
      Try again
    </button>
  </div>
  <slot v-else />
</template>
