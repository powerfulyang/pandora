import type { ProcessOptions } from './image-processor'
import * as Comlink from 'comlink'
import { getCroppedImageData, processAndEncodeImage } from './image-processor'

const api = {
  getCroppedImageData: async (
    source: ImageBitmap,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
    scaleX: number,
    scaleY: number,
  ) => {
    const imageData = getCroppedImageData(
      source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      scaleX,
      scaleY,
    )
    source.close()
    return imageData
  },
  processAndEncodeImage: async (
    imageData: ImageData,
    options: ProcessOptions,
  ) => {
    return processAndEncodeImage(imageData, options)
  },
  processFile: async (blob: Blob, options: ProcessOptions) => {
    const { decodeImage } = await import('./image-processor')
    const imageData = await decodeImage(blob)
    return processAndEncodeImage(imageData, options)
  },
}

Comlink.expose(api)

export type ImageWorkerAPI = typeof api
