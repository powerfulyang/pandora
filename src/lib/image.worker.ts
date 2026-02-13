import * as Comlink from 'comlink'
import { processAndEncodeImage } from './image-processor'
import type { ProcessOptions } from './image-processor'

const api = {
  processAndEncodeImage: async (
    imageData: ImageData,
    options: ProcessOptions,
  ) => {
    return processAndEncodeImage(imageData, options)
  },
}

Comlink.expose(api)

export type ImageWorkerAPI = typeof api
