import localforage from 'localforage'

// Configure localforage
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
  quality: number
  savedFile?: Blob
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
