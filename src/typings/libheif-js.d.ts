declare module 'libheif-js' {
  export interface HeifImage {
    get_width: () => number
    get_height: () => number
    display: (imageData: ImageData, callback: (data: any) => void) => void
    free: () => void
  }

  export class HeifDecoder {
    decode: (buffer: ArrayBuffer) => HeifImage[]
  }

  const libheif: {
    HeifDecoder: typeof HeifDecoder
  }

  export default libheif
}
