<script lang="ts">
</script>

<script setup lang="ts">
import ExcelJS from 'exceljs'
import { UploadCloud } from 'lucide-vue-next'
import Papa from 'papaparse'
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { generateTypeScript } from '@/utils/type-generator'

export interface ParsedData {
  json: any[] | Record<string, any[]>
  types: string
  fileName: string
  fileType: 'excel' | 'csv'
  isMultiSheet?: boolean
  sheetNames?: string[]
}

const emit = defineEmits<{
  (e: 'parsed', data: ParsedData): void
  (e: 'loading', value: boolean): void
}>()

const isLoading = ref(false)
const parseError = ref<string | null>(null)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function parseExcelFile(file: File): Promise<{ data: any[] | Record<string, any[]>, isMultiSheet: boolean, sheetNames: string[] }> {
  const arrayBuffer = await file.arrayBuffer()

  // First, use SheetJS (XLSX) for robust parsing of data and structures
  const data = new Uint8Array(arrayBuffer)
  const xlsxWorkbook = XLSX.read(data, { type: 'array' })

  if (!xlsxWorkbook.SheetNames || xlsxWorkbook.SheetNames.length === 0) {
    throw new Error('Excel 文件中没有找到工作表')
  }

  const allSheetsData: Record<string, any[]> = {}
  const sheetNames: string[] = []

  xlsxWorkbook.SheetNames.forEach((sheetName) => {
    const worksheet = xlsxWorkbook.Sheets[sheetName]
    if (worksheet) {
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
      })
      if (jsonData.length > 0) {
        allSheetsData[sheetName] = jsonData as any[]
        sheetNames.push(sheetName)
      }
    }
  })

  // Then try ExcelJS for image extraction in a non-failing try-catch block
  try {
    const excelJsWorkbook = new ExcelJS.Workbook()
    await excelJsWorkbook.xlsx.load(arrayBuffer)
    const images = excelJsWorkbook.model.media || []

    excelJsWorkbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name
      const jsonData = allSheetsData[sheetName]
      if (!jsonData)
        return

      // Get headers from first row
      const headers: string[] = []
      const firstRow = worksheet.getRow(1)
      if (firstRow && firstRow.values) {
        firstRow.eachCell((cell, colNumber) => {
          headers[colNumber] = cell.value ? String(cell.value) : `Column${colNumber}`
        })
      }

      const sheetImages = worksheet.getImages()
      for (const image of sheetImages) {
        const idx = Number(image.imageId)
        if (Number.isNaN(idx) || idx >= images.length)
          continue
        const imgBody = images[idx] as any
        if (!imgBody)
          continue

        const ext = imgBody.extension || 'png'
        const buffer = imgBody.buffer as ArrayBuffer
        const uint8 = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < uint8.byteLength; i++) {
          binary += String.fromCharCode(uint8[i]!)
        }
        const base64 = btoa(binary)
        const dataUri = `data:image/${ext};base64,${base64}`

        const rowNum = Math.floor(image.range.tl.nativeRow)
        const colNum = Math.floor(image.range.tl.nativeCol) + 1
        const rowIndex = rowNum - 1
        const header = headers[colNum] || `Column${colNum}`

        if (jsonData[rowIndex]) {
          jsonData[rowIndex]![header] = dataUri
        }
      }
    })
  }
  catch (err) {
    console.warn('ExcelJS failed to extract images, falling back to basic parsing.', err)
  }

  if (sheetNames.length === 0) {
    throw new Error('所有工作表都没有有效数据')
  }

  if (sheetNames.length === 1) {
    const firstSheetName = sheetNames[0]!
    return {
      data: allSheetsData[firstSheetName]!,
      isMultiSheet: false,
      sheetNames,
    }
  }
  else {
    return {
      data: allSheetsData,
      isMultiSheet: true,
      sheetNames,
    }
  }
}

async function parseCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transform: (value: string) => {
        if (value === '')
          return null
        const num = Number(value)
        if (!Number.isNaN(num) && Number.isFinite(num)) {
          return num
        }
        if (value.toLowerCase() === 'true')
          return true
        if (value.toLowerCase() === 'false')
          return false
        const date = new Date(value)
        if (!Number.isNaN(date.getTime()) && value.match(/\d{4}-\d{2}-\d{2}/)) {
          return date.toISOString()
        }
        return value
      },
      complete: (results: any) => {
        if (results.errors && results.errors.length > 0) {
          reject(new Error(`CSV 解析错误: ${results.errors[0].message}`))
        }
        else {
          resolve(results.data)
        }
      },
      error: (error: any) => {
        reject(new Error(`CSV 文件解析失败: ${error.message}`))
      },
    })
  })
}

async function handleFile(file: File) {
  parseError.value = null
  isLoading.value = true
  emit('loading', true)

  try {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    let jsonData: any[] | Record<string, any[]>
    let fileType: 'excel' | 'csv'
    let isMultiSheet = false
    let sheetNames: string[] = []

    if (['xlsx', 'xls', 'xlsm'].includes(fileExtension || '')) {
      const excelResult = await parseExcelFile(file)
      jsonData = excelResult.data
      isMultiSheet = excelResult.isMultiSheet
      sheetNames = excelResult.sheetNames
      fileType = 'excel'
    }
    else if (['csv', 'txt'].includes(fileExtension || '')) {
      const csvData = await parseCSVFile(file)
      jsonData = csvData
      fileType = 'csv'
    }
    else {
      throw new Error('不支持的文件格式。请上传 Excel (.xlsx, .xls) 或 CSV 文件。')
    }

    if (!jsonData || (Array.isArray(jsonData) && jsonData.length === 0)
      || (!Array.isArray(jsonData) && Object.keys(jsonData).length === 0)) {
      throw new Error('文件中没有找到有效数据')
    }

    const types = Array.isArray(jsonData)
      ? generateTypeScript(jsonData, file.name)
      : generateTypeScript(Object.values(jsonData).flat(), file.name, sheetNames)

    emit('parsed', {
      json: jsonData,
      types,
      fileName: file.name,
      fileType,
      isMultiSheet,
      sheetNames,
    })
  }
  catch (error: any) {
    console.error('文件处理失败:', error)
    parseError.value = error.message
  }
  finally {
    isLoading.value = false
    emit('loading', false)
  }
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const acceptedFiles = input.files
  if (acceptedFiles && acceptedFiles.length > 0) {
    const file = acceptedFiles[0]
    if (file) {
      handleFile(file)
    }
  }
  // Reset input file so the same file can be selected again
  if (input) {
    input.value = ''
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file) {
      handleFile(file)
    }
  }
}
</script>

<template>
  <div class="w-full">
    <div
      class="p-12 text-center border-2 rounded-sm border-dashed cursor-pointer transition-all duration-200 relative"
      :class="[
        isDragging ? 'border-pd-accent bg-pd-accent/5' : 'border-pd-border hover:border-pd-accent/50 bg-pd-bg-subtle/30',
        isLoading ? 'pointer-events-none opacity-60' : '',
      ]"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".xlsx,.xls,.csv,.txt"
        @change="onFileSelect"
      >

      <div class="flex flex-col items-center">
        <div v-if="isLoading" class="flex flex-col items-center">
          <div class="mb-4 border-2 border-pd-accent border-t-transparent rounded-full h-10 w-10 animate-spin" />
          <p class="text-sm text-pd-text-muted tracking-widest uppercase">
            Processing...
          </p>
        </div>
        <template v-else>
          <div class="mb-4 p-4 border border-pd-border rounded-full bg-pd-bg transition-transform group-hover:scale-110">
            <UploadCloud class="text-pd-text-muted h-8 w-8" :stroke-width="1.5" />
          </div>
          <p class="text-lg text-pd-text tracking-tight font-bold mb-2 uppercase">
            {{ isDragging ? 'Drop to Upload' : 'Upload Data File' }}
          </p>
          <p class="text-xs text-pd-text-muted tracking-widest mb-6 uppercase">
            Excel (.xlsx, .xls) or CSV Files
          </p>
          <div class="text-sm text-pd-text-inverted tracking-widest font-bold px-6 py-2 rounded-sm bg-pd-accent uppercase transition-colors hover:bg-pd-accent-hover">
            Select File
          </div>
        </template>
      </div>
    </div>

    <div v-if="parseError" class="mt-4 p-4 border border-pd-danger/20 rounded-sm bg-pd-danger/5 flex gap-3 items-start">
      <div class="text-pd-danger mt-0.5 shrink-0">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h4 class="text-xs text-pd-danger tracking-widest font-bold mb-1 uppercase">
          Parse Error
        </h4>
        <p class="text-sm text-pd-danger/80">
          {{ parseError }}
        </p>
      </div>
    </div>
  </div>
</template>
