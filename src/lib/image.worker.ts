import * as Comlink from 'comlink'
import { getCroppedImageData, processAndEncodeImage } from './image-processor'
import type { ProcessOptions } from './image-processor'

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
    // We can close the bitmap since we've extracted the data
    source.close()
    return imageData
  },
  processAndEncodeImage: async (
    imageData: ImageData,
    options: ProcessOptions,
  ) => {
    return processAndEncodeImage(imageData, options)
  },
}

Comlink.expose(api)

export type ImageWorkerAPI = typeof api
