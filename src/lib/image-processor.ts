import { encode as encodeAvif } from '@jsquash/avif'
import { encode as encodeJpeg } from '@jsquash/jpeg'
import { optimise as optimizePng } from '@jsquash/oxipng'

import resize from '@jsquash/resize'
import { encode as encodeWebp } from '@jsquash/webp'

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'heic'

export interface ProcessOptions {
  format: ImageFormat
  quality?: number
  width?: number
  height?: number
}

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

const HEIC_FTYP_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

/**
 * Detects whether a Blob is a HEIC/HEIF image by checking MIME type
 * and falling back to magic bytes (ftyp box) inspection.
 */
async function isHeicBlob(blob: Blob): Promise<boolean> {
  // Fast path: MIME type check
  if (HEIC_MIME_TYPES.has(blob.type))
    return true

  // Extension-based heuristic for empty MIME (common on Windows)
  if (!blob.type || blob.type === 'application/octet-stream') {
    // Read the ftyp header: bytes 4-8 should be "ftyp", bytes 8-12 are the brand
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
    if (header.length < 12)
      return false

    const ftyp = String.fromCharCode(header[4]!, header[5]!, header[6]!, header[7]!)
    if (ftyp !== 'ftyp')
      return false

    const brand = String.fromCharCode(header[8]!, header[9]!, header[10]!, header[11]!)
    return HEIC_FTYP_BRANDS.has(brand)
  }

  return false
}

/**
 * Decodes a HEIC/HEIF blob into ImageData using the elheif library.
 * Dynamically imported to avoid bundling when not needed.
 */
async function decodeHeicBlob(blob: Blob): Promise<ImageData> {
  const { ensureInitialized, jsDecodeImage } = await import('elheif')
  await ensureInitialized()

  const buffer = new Uint8Array(await blob.arrayBuffer())
  const result = jsDecodeImage(buffer)

  if (result.err)
    throw new Error(`HEIF decoding error: ${result.err}`)

  if (!result.data || result.data.length === 0)
    throw new Error('No images found in HEIF file')

  const image = result.data[0]!
  return new ImageData(
    new Uint8ClampedArray(image.data.slice()),
    image.width,
    image.height,
  )
}

/**
 * Converts a Blob to ImageData using createImageBitmap + canvas.
 */
function decodeBitmapBlob(bitmap: ImageBitmap): ImageData {
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
 * Decodes an image blob to ImageData, with HEIC/HEIF support.
 * For HEIC files, uses heic-decode (WASM). For other formats, uses native createImageBitmap.
 */
export async function decodeImage(blob: Blob): Promise<ImageData> {
  if (await isHeicBlob(blob))
    return decodeHeicBlob(blob)

  const bitmap = await createImageBitmap(blob)
  return decodeBitmapBlob(bitmap)
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
    case 'heic': {
      const { ensureInitialized, jsEncodeImage } = await import('elheif')
      await ensureInitialized()

      const result = jsEncodeImage(
        new Uint8Array(processedData.data.buffer),
        processedData.width,
        processedData.height,
      )

      if (result.err)
        throw new Error(`HEIF encoding error: ${result.err}`)

      return new Blob([result.data.slice()], { type: 'image/heic' })
    }
    default:
      throw new Error(`Unsupported format: ${options.format}`)
  }

  return new Blob([buffer], { type: `image/${options.format}` })
}
