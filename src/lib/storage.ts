import localforage from 'localforage'

// Configure localforage for image processing
localforage.config({
  name: 'PandoraApp',
  storeName: 'image_processing_records',
  description: 'Stores records of processed images',
})

export interface ProcessingRecord {
  id: string
  originalName: string
  timestamp: number
  format: string
  originalSize: number
  processedSize: number
  quality?: number
  scale?: number
  savedFile?: Blob // For PDF "Merge Long", this is the merged image. For multi-page, we might just store the zip? Or the first page?
  pagesCount?: number
}

export const recordStorage = {
  async saveRecord(record: ProcessingRecord) {
    await localforage.setItem(record.id, record)
  },

  async getRecords(): Promise<ProcessingRecord[]> {
    const records: ProcessingRecord[] = []
    await localforage.iterate((value) => {
      records.push(value as ProcessingRecord)
    })
    return records.sort((a, b) => b.timestamp - a.timestamp)
  },

  async clearRecords() {
    await localforage.clear()
  },

  async deleteRecord(id: string) {
    await localforage.removeItem(id)
  },
}

// --- PDF Processing Storage ---
const pdfRecordStore = localforage.createInstance({
  name: 'PandoraApp',
  storeName: 'pdf_processing_records',
  description: 'Stores records of PDF to image conversions',
})

export const pdfRecordStorage = {
  async saveRecord(record: ProcessingRecord) {
    await pdfRecordStore.setItem(record.id, record)
  },

  async getRecords(): Promise<ProcessingRecord[]> {
    const records: ProcessingRecord[] = []
    await pdfRecordStore.iterate((value) => {
      records.push(value as ProcessingRecord)
    })
    return records.sort((a, b) => b.timestamp - a.timestamp)
  },

  async clearRecords() {
    await pdfRecordStore.clear()
  },

  async deleteRecord(id: string) {
    await pdfRecordStore.removeItem(id)
  },
}

// --- Data Parser Storage ---
const dataParserStore = localforage.createInstance({
  name: 'PandoraApp',
  storeName: 'data_parser',
  description: 'Stores data parser state (parsed data, editor content)',
})

export interface DataParserState {
  json: any[] | Record<string, any[]>
  types: string
  fileName: string
  fileType: 'excel' | 'csv'
  isMultiSheet?: boolean
  sheetNames?: string[]
}

const DATA_KEY = 'dp_parsed_data'
const EDITOR_KEY = 'dp_editor_content'
const EXTRA_LIB_KEY = 'dp_extra_lib'

export const dataParserStorage = {
  async saveData(state: DataParserState) {
    await dataParserStore.setItem(DATA_KEY, state)
  },

  async loadData(): Promise<DataParserState | null> {
    return dataParserStore.getItem<DataParserState>(DATA_KEY)
  },

  async saveEditorContent(content: string) {
    await dataParserStore.setItem(EDITOR_KEY, content)
  },

  async loadEditorContent(): Promise<string | null> {
    return dataParserStore.getItem<string>(EDITOR_KEY)
  },

  async saveExtraLib(lib: string) {
    await dataParserStore.setItem(EXTRA_LIB_KEY, lib)
  },

  async loadExtraLib(): Promise<string | null> {
    return dataParserStore.getItem<string>(EXTRA_LIB_KEY)
  },

  async clear() {
    await dataParserStore.clear()
  },
}
