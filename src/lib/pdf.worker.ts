import * as Comlink from 'comlink'
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Set up the worker source for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

const fakeDocument = {
  createElement(name: string) {
    if (name === 'canvas') {
      return new OffscreenCanvas(1, 1)
    }
    return null
  },
}

// Mocking document for PDF.js in worker
;(globalThis as any).document = fakeDocument as any

const CMAP_URL = '/pdfjs/cmaps/'
const STANDARD_FONT_DATA_URL = '/pdfjs/standard_fonts/'

const loadingOptions = {
  cMapUrl: CMAP_URL,
  cMapPacked: true,
  standardFontDataUrl: STANDARD_FONT_DATA_URL,
  ownerDocument: fakeDocument as any,
  disableFontFace: true,
  useWorkerFetch: false,
  isEvalSupported: false,
}

// Custom CanvasFactory for non-DOM environments (Workers)
const canvasFactory = {
  create(width: number, height: number) {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    return {
      canvas,
      context,
    }
  },
  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  },
  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  },
}

const api = {
  async getPageCount(blob: Blob): Promise<number> {
    const data = await blob.arrayBuffer()
    const loadingTask = pdfjs.getDocument({
      data,
      ...loadingOptions,
    })
    const pdf = await loadingTask.promise
    return pdf.numPages
  },

  async renderPageToImage(
    blob: Blob,
    pageNumber: number,
    scale: number = 2,
    format: 'png' | 'jpeg' = 'png',
  ): Promise<Blob> {
    const data = await blob.arrayBuffer()
    const loadingTask = pdfjs.getDocument({
      data,
      ...loadingOptions,
    })
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(pageNumber)

    const viewport = page.getViewport({ scale })
    const canvas = new OffscreenCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Failed to get canvas context')
    }

    await (page.render as any)({
      canvasContext: context,
      viewport,
      canvasFactory,
    }).promise

    const resultBlob = await canvas.convertToBlob({
      type: `image/${format}`,
      quality: 0.9,
    })

    return resultBlob
  },

  async renderAllPagesToLongImage(
    blob: Blob,
    scale: number = 2,
    format: 'png' | 'jpeg' = 'png',
  ): Promise<Blob> {
    const data = await blob.arrayBuffer()
    const loadingTask = pdfjs.getDocument({
      data,
      ...loadingOptions,
    })
    const pdf = await loadingTask.promise
    const pageCount = pdf.numPages

    const viewports: pdfjs.PageViewport[] = []
    let totalHeight = 0
    let maxWidth = 0

    // First pass: calculate total height and max width
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      viewports.push(viewport)
      totalHeight += viewport.height
      maxWidth = Math.max(maxWidth, viewport.width)
    }

    const canvas = new OffscreenCanvas(maxWidth, totalHeight)
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Failed to get canvas context')
    }

    let currentY = 0
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      const viewport = viewports[i - 1]

      if (!viewport)
        continue

      // We need a temporary canvas to render the page because we want to draw it at currentY
      const tempCanvas = new OffscreenCanvas(viewport.width, viewport.height)
      const tempContext = tempCanvas.getContext('2d')

      if (!tempContext)
        continue

      await (page.render as any)({
        canvasContext: tempContext,
        viewport,
        canvasFactory,
      }).promise

      context.drawImage(tempCanvas, (maxWidth - viewport.width) / 2, currentY)
      currentY += viewport.height
    }

    const resultBlob = await canvas.convertToBlob({
      type: `image/${format}`,
      quality: 0.9,
    })

    return resultBlob
  },
}

Comlink.expose(api)

export type PDFWorkerAPI = typeof api
