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
  <div v-if="error" class="m-4 p-6 border border-pd-danger/20 rounded-sm bg-pd-danger/5 shadow-sm">
    <div class="mb-4 flex gap-3 items-center">
      <div class="i-carbon:error-filled text-pd-danger h-6 w-6" />
      <h3 class="text-lg text-pd-danger tracking-tight font-bold uppercase">
        System Exception
      </h3>
    </div>
    <div class="text-sm text-pd-danger/80 mb-4 p-4 rounded-sm bg-pd-danger/10 max-h-60 overflow-auto">
      {{ error.message }}
    </div>
    <button
      class="text-sm text-pd-bg font-medium px-4 py-2 rounded-sm bg-pd-text shadow-sm transition-colors hover:bg-pd-accent"
      @click="reset"
    >
      Reset Module
    </button>
  </div>
  <slot v-else />
</template>
