<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW({
  onRegistered(r) {
    console.log('SW Registered:', r)
  },
  onRegisterError(error) {
    console.log('SW registration error', error)
  },
})

function close() {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <div
    v-if="offlineReady || needRefresh"
    class="font-mono p-5 border border-green-500/30 rounded-sm bg-white max-w-[calc(100vw-3rem)] w-full shadow-green-500/10 shadow-lg transition-all duration-300 bottom-6 right-6 fixed z-50 backdrop-blur-md dark:bg-[#0a0a0a] sm:w-96 dark:shadow-[0_0_20px_rgba(34,197,94,0.15)]"
  >
    <div class="text-xs text-green-700 mb-4 pb-2 border-b border-green-200 flex gap-2 transition-colors duration-300 items-center dark:text-green-600 dark:border-green-900/50">
      <div class="bg-green-500 h-2 w-2 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse dark:shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
      <span class="tracking-widest font-bold">PANDORA_TERMINAL</span>
    </div>
    <div class="text-sm text-green-800 leading-relaxed mb-6 transition-colors duration-300 dark:text-green-400">
      <div v-if="offlineReady">
        <span class="text-green-600 mr-2 select-none dark:text-green-500">root@pandora:~$</span>
        <span>sysctl status cache</span>
        <div class="text-zinc-600 mt-2 transition-colors duration-300 dark:text-green-300">
          <div>> <span class="text-green-600 font-bold transition-colors duration-300 dark:text-green-500">[OK]</span> Application cached.</div>
          <div>> Offline mode active.<span class="text-green-600 font-bold ml-1 transition-colors duration-300 animate-pulse dark:text-green-500">_</span></div>
        </div>
      </div>
      <div v-else>
        <span class="text-green-600 mr-2 select-none dark:text-green-500">root@pandora:~$</span>
        <span>fetch --latest</span>
        <div class="text-zinc-600 mt-2 transition-colors duration-300 dark:text-green-300">
          <div class="text-yellow-600 font-bold transition-colors duration-300 dark:text-yellow-400">
            > [WARN] New payload detected.
          </div>
          <div>> Action required: Execute update<span class="text-green-600 font-bold ml-1 transition-colors duration-300 animate-pulse dark:text-green-500">_</span></div>
        </div>
      </div>
    </div>
    <div class="flex gap-3 items-center justify-end">
      <button
        class="text-xs text-zinc-500 tracking-widest px-4 py-1.5 border border-zinc-300 uppercase transition-all duration-300 dark:text-zinc-500 hover:text-zinc-800 focus:outline-none dark:border-zinc-800 hover:border-zinc-400 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
        @click="close"
      >
        [ Abort ]
      </button>
      <button
        v-if="needRefresh"
        class="text-xs text-green-600 tracking-widest font-bold px-4 py-1.5 border border-green-500/50 uppercase transition-all duration-300 dark:text-green-400 hover:text-white focus:outline-none hover:border-green-600 hover:bg-green-600 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] dark:hover:text-black dark:hover:border-green-500 dark:hover:bg-green-500 dark:hover:shadow-[0_0_15px_rgba(34,197,94,0.6)]"
        @click="updateServiceWorker()"
      >
        [ Execute ]
      </button>
    </div>
  </div>
</template>
