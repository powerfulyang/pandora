import { encode as encodeWebp } from '@jsquash/webp'
import { encode as encodeAvif } from '@jsquash/avif'
import { encode as encodeJpeg } from '@jsquash/jpeg'
import { encode as encodePng } from '@jsquash/png'
import resize from '@jsquash/resize'

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png'

export interface ProcessOptions {
  format: ImageFormat
  quality?: number
  width?: number
  height?: number
}

/**
 * Extracts image data from a specific crop area of an image element.
 */
export async function getCroppedImageData(
  image: HTMLImageElement,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
): Promise<ImageData> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  
  canvas.width = cropWidth * scaleX
  canvas.height = cropHeight * scaleY
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  ctx.drawImage(
    image,
    cropX * scaleX,
    cropY * scaleY,
    cropWidth * scaleX,
    cropHeight * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return ctx.getImageData(0, 0, canvas.width, canvas.height)
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
    options.width &&
    options.height &&
    (options.width !== imageData.width || options.height !== imageData.height)
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
    case 'png':
      buffer = await encodePng(processedData)
      break
    default:
      throw new Error(`Unsupported format: ${options.format}`)
  }

  return new Blob([buffer], { type: `image/${options.format}` })
}

/**
 * Triggers a file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
