import { encode as encodeAvif } from '@jsquash/avif'
import { encode as encodeJpeg } from '@jsquash/jpeg'
import { optimise as optimizePng } from '@jsquash/oxipng'

import resize from '@jsquash/resize'
import { encode as encodeWebp } from '@jsquash/webp'

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png'

export interface ProcessOptions {
  format: ImageFormat
  quality?: number
  width?: number
  height?: number
}

export async function decodeImage(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap

  let canvas: OffscreenCanvas | HTMLCanvasElement
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height)
  }
  else {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  if (!ctx)
    throw new Error('Could not get canvas context')

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return ctx.getImageData(0, 0, width, height)
}

/**
 * Extracts image data from a specific crop area of an image element.
 */
export function getCroppedImageData(
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
  scaleX: number,
  scaleY: number,
): ImageData {
  const width = Math.round(cropWidth * scaleX)
  const height = Math.round(cropHeight * scaleY)

  let canvas: HTMLCanvasElement | OffscreenCanvas
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height)
  }
  else {
    if (typeof document === 'undefined') {
      throw new TypeError('Canvas not supported in this environment')
    }
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  ctx.drawImage(
    source as CanvasImageSource,
    cropX * scaleX,
    cropY * scaleY,
    cropWidth * scaleX,
    cropHeight * scaleY,
    0,
    0,
    width,
    height,
  )

  return ctx.getImageData(0, 0, width, height)
}

/**
 * Processes image data (resize and encode) and returns a Blob.
 */
export async function processAndEncodeImage(
  imageData: ImageData,
  options: ProcessOptions,
): Promise<Blob> {
  let processedData = imageData

  // Resize if needed
  if (
    options.width
    && options.height
    && (options.width !== imageData.width || options.height !== imageData.height)
  ) {
    processedData = await resize(imageData, {
      width: options.width,
      height: options.height,
    })
  }

  let buffer: ArrayBuffer

  const quality = options.quality ?? 80

  switch (options.format) {
    case 'webp':
      buffer = await encodeWebp(processedData, { quality })
      break
    case 'avif':
      buffer = await encodeAvif(processedData, { quality })
      break
    case 'jpeg':
      buffer = await encodeJpeg(processedData, { quality })
      break
    case 'png': {
      let canvas: HTMLCanvasElement | OffscreenCanvas
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(processedData.width, processedData.height)
      }
      else {
        canvas = document.createElement('canvas')
        canvas.width = processedData.width
        canvas.height = processedData.height
      }

      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
      if (!ctx)
        throw new Error('Failed to get 2D context')

      ctx.putImageData(processedData, 0, 0)

      let blob: Blob
      if ('convertToBlob' in canvas) {
        blob = await canvas.convertToBlob({ type: 'image/png' })
      }
      else {
        blob = await new Promise<Blob>((resolve, reject) => {
          (canvas as HTMLCanvasElement).toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png')
        })
      }

      const pngBuffer = await blob.arrayBuffer()
      buffer = await optimizePng(pngBuffer, { level: 3 })
      break
    }
    default:
      throw new Error(`Unsupported format: ${options.format}`)
  }

  return new Blob([buffer], { type: `image/${options.format}` })
}
