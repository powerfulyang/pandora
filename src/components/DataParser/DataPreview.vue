<script setup lang="ts">
import { FileJson, Table, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import { formatBytes } from '@/utils'
import 'vue-json-pretty/lib/styles.css'

const props = defineProps<{
  data: any[] | Record<string, any[]>
  fileName: string
  fileType: string
  isMultiSheet?: boolean
  sheetNames?: string[]
}>()

const activeSheet = ref(props.sheetNames?.[0] || '')
const displayMode = ref<'table' | 'json'>('table')
const previewImage = ref<string | null>(null)

const currentData = computed(() => {
  if (props.isMultiSheet && typeof props.data === 'object' && !Array.isArray(props.data)) {
    return props.data[activeSheet.value] || []
  }
  return Array.isArray(props.data) ? props.data : []
})

const columns = computed(() => {
  if (currentData.value.length === 0)
    return []
  return Object.keys(currentData.value[0])
})

const stats = computed(() => {
  const jsonString = JSON.stringify(props.data)
  const bytes = new Blob([jsonString]).size
  return {
    size: formatBytes(bytes),
    rows: Array.isArray(currentData.value) ? currentData.value.length : 0,
    fields: columns.value.length,
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header with Stats -->
    <div class="flex flex-wrap gap-4 items-center justify-between">
      <div class="flex gap-4 items-center">
        <div class="p-2 border border-pd-border rounded-sm bg-pd-bg-subtle/50">
          <FileJson v-if="displayMode === 'json'" class="text-pd-accent h-4 w-4" />
          <Table v-else class="text-pd-accent h-4 w-4" />
        </div>
        <div>
          <h3 class="text-sm text-pd-text tracking-widest font-bold uppercase">
            {{ fileName }}
          </h3>
          <div class="text-[10px] text-pd-text-muted tracking-wider flex gap-2 uppercase">
            <span>{{ fileType }}</span>
            <span class="opacity-30">|</span>
            <span>{{ stats.rows }} Rows</span>
            <span class="opacity-30">|</span>
            <span>{{ stats.size }}</span>
          </div>
        </div>
      </div>

      <div class="p-1 border border-pd-border rounded-sm bg-pd-bg-subtle/50 flex gap-2">
        <button
          class="text-[10px] tracking-widest font-bold px-3 py-1 rounded-sm uppercase transition-all"
          :class="displayMode === 'table' ? 'bg-pd-accent text-pd-text-inverted shadow-sm' : 'text-pd-text-muted hover:text-pd-text'"
          @click="displayMode = 'table'"
        >
          Table
        </button>
        <button
          class="text-[10px] tracking-widest font-bold px-3 py-1 rounded-sm uppercase transition-all"
          :class="displayMode === 'json' ? 'bg-pd-accent text-pd-text-inverted shadow-sm' : 'text-pd-text-muted hover:text-pd-text'"
          @click="displayMode = 'json'"
        >
          JSON
        </button>
      </div>
    </div>

    <!-- Sheet Tabs -->
    <div v-if="isMultiSheet && sheetNames && sheetNames.length > 1" class="border-b border-pd-border flex flex-wrap gap-1">
      <button
        v-for="sheet in sheetNames"
        :key="sheet"
        class="text-[10px] tracking-widest font-bold px-4 py-2 border-b-2 uppercase transition-all"
        :class="activeSheet === sheet ? 'border-pd-accent text-pd-accent' : 'border-transparent text-pd-text-muted hover:text-pd-text'"
        @click="activeSheet = sheet"
      >
        {{ sheet }}
      </button>
    </div>

    <!-- Content Area -->
    <div class="border border-pd-border rounded-sm bg-pd-bg min-h-[400px] relative overflow-hidden">
      <!-- Table View -->
      <div v-if="displayMode === 'table'" class="custom-scrollbar max-h-[600px] overflow-auto">
        <table class="text-left w-full border-collapse">
          <thead class="bg-pd-bg-subtle/90 top-0 sticky z-10 backdrop-blur-md">
            <tr>
              <th
                v-for="col in columns"
                :key="col"
                class="text-[10px] text-pd-text-muted tracking-widest font-bold px-4 py-3 border-b border-pd-border whitespace-nowrap uppercase"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in currentData"
              :key="i"
              class="group transition-colors hover:bg-pd-accent/5"
            >
              <td
                v-for="col in columns"
                :key="col"
                class="text-xs text-pd-text px-4 py-2 border-b border-pd-border/50 max-w-xs truncate"
                :title="String(row[col])"
              >
                <template v-if="typeof row[col] === 'string' && row[col].startsWith('data:image/')">
                  <img
                    :src="row[col]"
                    class="rounded-[2px] max-h-12 cursor-zoom-in origin-left transition-transform object-contain hover:scale-[3]"
                    alt="Image cell"
                    @click="previewImage = row[col]"
                  >
                </template>
                <template v-else>
                  {{ row[col] }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- JSON View -->
      <div v-else class="custom-scrollbar p-6 max-h-[600px] overflow-auto">
        <VueJsonPretty
          :data="currentData"
          :deep="2"
          :show-length="true"
          :show-line="true"
          class="text-xs"
        />
      </div>
    </div>

    <!-- Image Preview Modal -->
    <div
      v-if="previewImage"
      class="p-8 bg-black/60 flex items-center inset-0 justify-center fixed z-50 backdrop-blur-sm"
      @click="previewImage = null"
    >
      <div class="p-2 border border-pd-border rounded-sm bg-pd-bg flex flex-col max-h-full max-w-full shadow-2xl items-center relative" @click.stop>
        <button
          class="text-pd-text p-1 border border-pd-border rounded-sm bg-pd-bg cursor-pointer shadow-md transition-colors absolute hover:text-pd-danger -right-3 -top-3"
          @click="previewImage = null"
        >
          <X class="h-4 w-4" />
        </button>
        <img :src="previewImage" class="rounded-sm max-h-[85vh] max-w-[85vw] object-contain" alt="Preview Image">
      </div>
    </div>
  </div>
</template>
