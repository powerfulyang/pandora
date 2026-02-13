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
  processFile: async (blob: Blob, options: ProcessOptions) => {
    // Dynamically import to avoid circular dependency issues if any,
    // though here dependencies are statically imported at top.
    // We need to re-import decodeImage essentially or move it to a shared place?
    // It is exported from image-processor.ts which is imported above.
    const { decodeImage } = await import('./image-processor')
    const imageData = await decodeImage(blob)
    return processAndEncodeImage(imageData, options)
  },
}

Comlink.expose(api)

export type ImageWorkerAPI = typeof api
