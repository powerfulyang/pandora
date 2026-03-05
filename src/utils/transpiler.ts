import * as esbuild from 'esbuild-wasm'

let initialized = false

export async function transpileTypeScript(tsCode: string): Promise<string> {
  if (!initialized) {
    try {
      await esbuild.initialize({
        wasmURL: '/node_modules/esbuild-wasm/esbuild.wasm',
      })
      initialized = true
    }
    catch (e: any) {
      // If already initialized, forget it
      if (!e.message?.includes('initialize')) {
        throw e
      }
      initialized = true
    }
  }

  const result = await esbuild.transform(tsCode, {
    loader: 'ts',
    target: 'esnext',
    format: 'esm',
    minify: false,
  })

  return result.code
}
