import * as Comlink from 'comlink'
import { processAndEncodeImage, type ProcessOptions } from './image-processor'

const api = {
  processAndEncodeImage: async (imageData: ImageData, options: ProcessOptions) => {
    return processAndEncodeImage(imageData, options)
  }
}

Comlink.expose(api)

export type ImageWorkerAPI = typeof api
