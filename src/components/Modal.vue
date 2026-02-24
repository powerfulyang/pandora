<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components'
import { X } from 'lucide-vue-next'
import { onMounted, onUnmounted } from 'vue'

interface Props {
  show: boolean
  title?: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

// Lock scroll when show
onMounted(() => {
  if (props.show)
    document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

function handleClose() {
  emit('close')
}

// Handle ESC key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    handleClose()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="p-4 bg-pd-bg/80 flex items-center inset-0 justify-center fixed z-[100] backdrop-blur-md lg:p-6">
        <Transition
          appear
          enter-active-class="transition duration-300 ease-out delay-75"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-on-click-outside="handleClose"
            class="border border-pd-border rounded-[2px] bg-pd-bg-elevated flex flex-col max-h-[90vh] max-w-4xl w-full shadow-2xl relative overflow-hidden"
          >
            <!-- Header -->
            <div class="p-4 border-b border-pd-border bg-pd-bg-elevated/50 flex items-center justify-between">
              <div class="flex gap-2 items-center">
                <slot name="icon" />
                <span v-if="title" class="text-sm text-pd-text tracking-widest font-bold uppercase">
                  {{ title }}
                </span>
              </div>
              <button
                class="text-pd-text-muted p-1 cursor-pointer transition-colors hover:text-pd-danger"
                @click="handleClose"
              >
                <X class="h-4 w-4" />
              </button>
            </div>

            <!-- Body -->
            <div class="bg-bg-angled flex-1 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] overflow-auto">
              <slot />
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="p-4 border-t border-pd-border bg-pd-bg-subtle/80 flex items-center justify-between">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Ensure the modal content doesn't jitter during scaling */
.bg-pd-bg-elevated {
  backface-visibility: hidden;
  transform-style: preserve-3d;
}
</style>
