import { useState, useRef, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  Crop,
  PixelCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  Upload,
  Download,
  Settings2,
  Crop as CropIcon,
  RefreshCw,
  Maximize,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Undo2,
  Redo2,
} from 'lucide-react'
import * as Comlink from 'comlink'
import type { ImageWorkerAPI } from '@/lib/image.worker'
import ThemeToggle from '@/components/ThemeToggle'

import {
  getCroppedImageData,
  downloadBlob,
  type ImageFormat,
} from '@/lib/image-processor'

export const Route = createFileRoute('/demo/image-crop')({
  component: ImageCropTool,
})

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

function ImageCropTool() {
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [format, setFormat] = useState<ImageFormat>('webp')
  const [quality, setQuality] = useState(80)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // History state
  const [history, setHistory] = useState<(PixelCrop | undefined)[]>([undefined])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isInternalUpdate = useRef(false)

  const workerRef = useRef<Worker | null>(null)
  const apiRef = useRef<Comlink.Remote<ImageWorkerAPI> | null>(null)

  useEffect(() => {
    // Relative path to workers is safer in Vite
    const worker = new Worker(new URL('../../lib/image.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    apiRef.current = Comlink.wrap<ImageWorkerAPI>(worker)

    return () => {
      worker.terminate()
    }
  }, [])

  const [cropWidth, setCropWidth] = useState<string>('')
  const [cropHeight, setCropHeight] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [customAspectInput, setCustomAspectInput] = useState('1:1')
  
  // Output Scaling state
  const [outputWidth, setOutputWidth] = useState<string>('')
  const [outputHeight, setOutputHeight] = useState<string>('')
  const [isOutputExpanded, setIsOutputExpanded] = useState(false)
  const [isOutputLockAspect] = useState(true)

  // Ref to track if we're currently updating from inputs to avoid feedback loops
  const isUpdatingFromInput = useRef(false)
  const isUpdatingOutputFromCrop = useRef(true) // Sync output with crop by default

  const imgRef = useRef<HTMLImageElement>(null)

  // Sync dimensions when crop changes
  useEffect(() => {
    if (isUpdatingFromInput.current) return
    if (completedCrop && imgRef.current) {
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height
      
      const nw = Math.round(completedCrop.width * scaleX)
      const nh = Math.round(completedCrop.height * scaleY)
      
      setCropWidth(nw.toString())
      setCropHeight(nh.toString())
      
      // Update output if still synced
      if (isUpdatingOutputFromCrop.current) {
        setOutputWidth(nw.toString())
        setOutputHeight(nh.toString())
      }
    } else if (!completedCrop) {
      setCropWidth('')
      setCropHeight('')
      if (isUpdatingOutputFromCrop.current) {
        setOutputWidth('')
        setOutputHeight('')
      }
    }
  }, [completedCrop])

  const updateCropFromTarget = (w: number, h: number) => {
    if (!imgRef.current) return
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height
    
    // Clamp to natural size
    const clampedW = Math.min(w, imgRef.current.naturalWidth)
    const clampedH = Math.min(h, imgRef.current.naturalHeight)

    isUpdatingFromInput.current = true
    const newCrop: PixelCrop = {
      unit: 'px',
      x: crop?.x || 0,
      y: crop?.y || 0,
      width: clampedW / scaleX,
      height: clampedH / scaleY,
    }
    setCrop(newCrop)
    setCompletedCrop(newCrop)
    
    // Update local string states if clamped
    setCropWidth(Math.round(clampedW).toString())
    setCropHeight(Math.round(clampedH).toString())

    if (isUpdatingOutputFromCrop.current) {
      setOutputWidth(Math.round(clampedW).toString())
      setOutputHeight(Math.round(clampedH).toString())
    }
    
    setTimeout(() => {
      isUpdatingFromInput.current = false
    }, 0)
  }

  const pushToHistory = (newCrop: PixelCrop | undefined) => {
    if (isInternalUpdate.current) return
    
    setHistory((prev) => {
      const current = prev[historyIndex]
      // Skip if same as current
      if (
        (current === undefined && newCrop === undefined) ||
        (current && newCrop && 
          current.x === newCrop.x && current.y === newCrop.y && 
          current.width === newCrop.width && current.height === newCrop.height)
      ) {
        return prev
      }

      const nextHistory = prev.slice(0, historyIndex + 1)
      nextHistory.push(newCrop)
      // Limit history to 50 steps
      if (nextHistory.length > 50) nextHistory.shift()
      return nextHistory
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 49))
  }

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      const prevState = history[prevIndex]
      isInternalUpdate.current = true
      setCrop(prevState)
      setCompletedCrop(prevState)
      setHistoryIndex(prevIndex)
      setTimeout(() => {
        isInternalUpdate.current = false
      }, 0)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const nextState = history[nextIndex]
      isInternalUpdate.current = true
      setCrop(nextState)
      setCompletedCrop(nextState)
      setHistoryIndex(nextIndex)
      setTimeout(() => {
        isInternalUpdate.current = false
      }, 0)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history])

  const onCropWidthChange = (val: string) => {
    setCropWidth(val)
    if (!imgRef.current) return
    const num = parseFloat(val)
    if (!isNaN(num)) {
      const clampedNum = Math.min(num, imgRef.current.naturalWidth)
      let h = parseFloat(cropHeight)
      if (aspect) {
        h = Math.round(clampedNum / aspect)
      }
      updateCropFromTarget(clampedNum, h)
      pushToHistory({
        unit: 'px',
        x: crop?.x || 0,
        y: crop?.y || 0,
        width: clampedNum / (imgRef.current.naturalWidth / imgRef.current.width),
        height: h / (imgRef.current.naturalHeight / imgRef.current.height),
      })
    }
  }

  const onCropHeightChange = (val: string) => {
    setCropHeight(val)
    if (!imgRef.current) return
    const num = parseFloat(val)
    if (!isNaN(num)) {
      const clampedNum = Math.min(num, imgRef.current.naturalHeight)
      let w = parseFloat(cropWidth)
      if (aspect) {
        w = Math.round(clampedNum * aspect)
      }
      updateCropFromTarget(w, clampedNum)
      pushToHistory({
        unit: 'px',
        x: crop?.x || 0,
        y: crop?.y || 0,
        width: w / (imgRef.current.naturalWidth / imgRef.current.width),
        height: clampedNum / (imgRef.current.naturalHeight / imgRef.current.height),
      })
    }
  }

  // Output handlers
  const onOutputWidthChange = (val: string) => {
    setOutputWidth(val)
    isUpdatingOutputFromCrop.current = false
    const num = parseFloat(val)
    if (!isNaN(num) && isOutputLockAspect) {
      const currentAspect = parseFloat(cropWidth) / parseFloat(cropHeight)
      if (!isNaN(currentAspect)) {
        setOutputHeight(Math.round(num / currentAspect).toString())
      }
    }
  }

  const onOutputHeightChange = (val: string) => {
    setOutputHeight(val)
    isUpdatingOutputFromCrop.current = false
    const num = parseFloat(val)
    if (!isNaN(num) && isOutputLockAspect) {
      const currentAspect = parseFloat(cropWidth) / parseFloat(cropHeight)
      if (!isNaN(currentAspect)) {
        setOutputWidth(Math.round(num * currentAspect).toString())
      }
    }
  }

  const resetOutputSize = () => {
    setOutputWidth(cropWidth)
    setOutputHeight(cropHeight)
    isUpdatingOutputFromCrop.current = true
  }

  // Parsing custom aspect ratio input
  const parseCustomAspect = (input: string) => {
    // Matches patterns like "16:9", "16/9", "16 9", "16：9" or any digit pair with non-digit separator
    const match = input.match(/(\d+)\D+(\d+)/)
    if (match) {
      const w = parseInt(match[1])
      const h = parseInt(match[2])
      if (w > 0 && h > 0) {
        const ratio = w / h
        setAspect(ratio)
        if (imgRef.current) {
          const { width, height } = imgRef.current
          setCrop(centerAspectCrop(width, height, ratio))
        }
        return `${w}:${h}`
      }
    }
    return null
  }

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    setImgSrc('')
    setCrop(undefined)
    setCompletedCrop(undefined)
    setHistory([undefined])
    setHistoryIndex(0)

    const reader = new FileReader()
    reader.addEventListener('load', () =>
      setImgSrc(reader.result?.toString() || ''),
    )
    reader.readAsDataURL(file)
  }

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            handleFile(file)
          }
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    if (aspect) {
      setCrop(centerAspectCrop(width, height, aspect))
    } else {
      // Default to no crop in Free/Custom mode until user drags
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }

  const handleDownload = async () => {
    if (!imgRef.current || !completedCrop || !apiRef.current) return

    setIsProcessing(true)
    setShowSuccess(false)
    
    try {
      // Step 1: Extract pixel data (must be main thread due to Canvas)
      const imageData = await getCroppedImageData(
        imgRef.current,
        completedCrop.x,
        completedCrop.y,
        completedCrop.width,
        completedCrop.height
      )

      // Step 2: Offload encoding/resizing to Worker
      const blob = await apiRef.current.processAndEncodeImage(
        Comlink.transfer(imageData, [imageData.data.buffer]),
        {
          format,
          quality,
          width: parseInt(outputWidth) || undefined,
          height: parseInt(outputHeight) || undefined,
        }
      )

      downloadBlob(blob, `pandora-image.${format}`)
      
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (e) {
      console.error('Error during image processing:', e)
      alert('Failed to process image. Check console for details.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text p-6 md:p-12 font-sans relative overflow-x-hidden">
      {/* Theme Toggle */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-6xl font-black tracking-tighter mb-4 bg-linear-to-r from-accent via-secondary to-accent bg-clip-text text-transparent italic font-display">
            PANDORA CROP
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto font-light">
            High-performance image suite. Crop, resize, and convert with
            WebAssembly power.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Settings */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface backdrop-blur-2xl border border-border rounded-sm p-6 flex flex-col gap-8">
              {/* Export Settings */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
                    Export
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-2">
                      Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['webp', 'avif', 'jpeg', 'png'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFormat(f)}
                          className={`px-3 py-2 rounded-sm text-xs font-bold transition-all border ${
                            format === f
                              ? 'bg-accent-muted border-accent text-accent'
                              : 'bg-bg-muted border-transparent text-text-muted hover:border-border-hover'
                          }`}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {format !== 'png' && (
                    <div>
                      <label className="flex justify-between text-xs font-medium text-text-muted mb-2">
                        <span>Quality</span>
                        <span className="text-accent font-mono">
                          {quality}%
                        </span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-full accent-accent bg-bg-muted rounded-sm h-1"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Resize (Crop Area) Settings */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Maximize className="w-4 h-4 text-secondary" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
                    Resize
                  </h2>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 relative">
                      <label className="text-xs text-text font-bold uppercase tracking-tight">
                        Width
                      </label>
                      <input
                        type="number"
                        value={cropWidth}
                        onChange={(e) => onCropWidthChange(e.target.value)}
                        className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm focus:border-secondary outline-none transition-all font-mono text-text"
                        placeholder="W"
                      />  
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs text-text font-bold uppercase tracking-tight">
                        Height
                      </label>
                      <input
                        type="number"
                        value={cropHeight}
                        onChange={(e) => onCropHeightChange(e.target.value)}
                        className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm focus:border-secondary outline-none transition-all font-mono text-text"
                        placeholder="H"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Output Size Scaling */}
              <section className="border-t border-border pt-6">
                  <div className="flex items-center justify-between w-full group mb-4">
                    <button
                      onClick={() => setIsOutputExpanded(!isOutputExpanded)}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-accent" />
                      <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary group-hover:text-accent transition-colors">
                        Output Size
                      </h2>
                      {isOutputExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                    {isOutputExpanded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          resetOutputSize()
                        }}
                        className="text-[10px] font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        RESET
                      </button>
                    )}
                  </div>

                {isOutputExpanded && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-4 relative">
                      <div className="space-y-2">
                        <label className="text-xs text-text font-bold uppercase tracking-tight">
                          Target W
                        </label>
                        <input
                          type="number"
                          value={outputWidth}
                          onChange={(e) => onOutputWidthChange(e.target.value)}
                          className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm focus:border-accent outline-none transition-all font-mono text-text"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-text font-bold uppercase tracking-tight">
                          Target H
                        </label>
                        <input
                          type="number"
                          value={outputHeight}
                          onChange={(e) => onOutputHeightChange(e.target.value)}
                          className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm focus:border-accent outline-none transition-all font-mono text-text"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-text-secondary font-medium leading-tight italic px-1">
                      * Final scale for export. Can exceed source resolution.
                    </p>
                  </div>
                )}
              </section>

              {/* Aspect Ratio */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <CropIcon className="w-4 h-4 text-success" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
                    Aspect
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Free', value: undefined, type: 'free' },
                    { label: 'Custom', value: 'custom', type: 'custom' },
                    { label: 'Preset', value: 'preset', type: 'preset-group' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        if (opt.type === 'free') {
                          setAspect(undefined)
                          setIsCustom(false)
                        } else if (opt.type === 'custom') {
                          setIsCustom(true)
                          parseCustomAspect(customAspectInput)
                        } else {
                          // Default to 1:1 if switching to presets group
                          setAspect(1)
                          setIsCustom(false)
                          if (imgRef.current) {
                            setCrop(centerAspectCrop(imgRef.current.width, imgRef.current.height, 1))
                          }
                        }
                      }}
                      className={`px-2 py-2 rounded-sm text-xs font-bold transition-all border ${
                        (opt.type === 'free' && aspect === undefined && !isCustom) ||
                        (opt.type === 'custom' && isCustom) ||
                        (opt.type === 'preset-group' && aspect !== undefined && !isCustom)
                          ? 'bg-success-muted border-success text-success'
                          : 'bg-bg-muted border-transparent text-text-muted hover:border-border-hover'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {isCustom && (
                  <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-xs text-text font-bold uppercase block px-1 mb-2">
                      Ratio (e.g. 16:9, 4/3)
                    </label>
                    <input
                      type="text"
                      value={customAspectInput}
                      onChange={(e) => {
                        setCustomAspectInput(e.target.value)
                        parseCustomAspect(e.target.value)
                      }}
                      onBlur={(e) => {
                        const formatted = parseCustomAspect(e.target.value)
                        if (formatted) setCustomAspectInput(formatted)
                      }}
                      className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm focus:border-success outline-none transition-all font-mono text-text"
                      placeholder="W:H"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {!isCustom && aspect !== undefined && (
                    <>
                      {[
                        { label: '1:1', value: 1 },
                        { label: '4:3', value: 4 / 3 },
                        { label: '16:9', value: 16 / 9 },
                        { label: '3:2', value: 3 / 2 },
                        { label: '2:3', value: 2 / 3 },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => {
                            setAspect(opt.value)
                            if (imgRef.current) {
                              const { width, height } = imgRef.current
                              setCrop(centerAspectCrop(width, height, opt.value))
                            }
                          }}
                          className={`px-1 py-2 rounded-sm text-xs font-bold transition-all border ${
                            aspect === opt.value
                              ? 'bg-success-muted border-success text-success'
                              : 'bg-bg-muted border-transparent text-text-muted hover:border-border-hover'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownload}
                disabled={!completedCrop || isProcessing}
                className={`w-full py-5 rounded-sm flex items-center justify-center gap-3 font-black text-lg transition-all relative overflow-hidden ${
                  !completedCrop || isProcessing
                    ? 'bg-bg-muted text-text-disabled cursor-not-allowed'
                    : 'bg-linear-to-r from-accent to-secondary hover:scale-[1.02] active:scale-[0.98] text-text-inverted'
                }`}
              >
                {showSuccess ? (
                  <CheckCircle2 className="w-6 h-6 text-white animate-in zoom-in" />
                ) : isProcessing ? (
                  <RefreshCw className="w-6 h-6 animate-spin opacity-50" />
                ) : (
                  <Download className="w-6 h-6" />
                )}
                <span className="relative z-10">
                  {showSuccess ? 'COMPLETED' : isProcessing ? 'PROCESSING...' : 'DOWNLOAD'}
                </span>
              </button>
            </div>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-2 h-full">
            {!imgSrc ? (
              <label className="group relative flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-accent-muted rounded-sm h-full min-h-[600px] bg-surface backdrop-blur-md transition-all cursor-pointer overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onSelectFile}
                />
                <div className="absolute inset-0 bg-linear-to-br from-accent-subtle to-secondary-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex flex-col items-center">
                  <div className="mb-8 p-10">
                    <Upload className="w-16 h-16 text-text-muted" />
                  </div>
                  <h3 className="text-3xl font-black mb-3">DROP ASSETS</h3>
                  <p className="text-text-muted font-medium">
                    Supports JPG, PNG, WEBP, AVIF
                  </p>
                </div>
              </label>
            ) : (
              <div className="flex flex-col gap-6 h-full">
                <div className="flex items-center justify-between shrink-0 mb-4">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-tighter">
                        Resize (Crop)
                      </span>
                      <span className="text-lg font-black text-accent font-mono">
                        {cropWidth ? `${cropWidth} × ${cropHeight}` : 'No Selection'}
                      </span>
                    </div>
                    {outputWidth && (outputWidth !== cropWidth || outputHeight !== cropHeight) && (
                      <div className="flex flex-col border-l border-border pl-6">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-tighter">
                          Final Output
                        </span>
                        <span className="text-lg font-black text-secondary font-mono">
                          {outputWidth} × {outputHeight}
                        </span>
                      </div>
                    )}
                    {imgRef.current && (
                      <div className="flex flex-col border-l border-border pl-6">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-tighter">
                          Display Scale
                        </span>
                        <span className="text-sm font-mono text-text-secondary">
                          {Math.round(
                            (imgRef.current.width /
                              imgRef.current.naturalWidth) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-border rounded-sm overflow-hidden mr-4">
                      <button
                        onClick={undo}
                        disabled={historyIndex === 0}
                        title="Undo (Ctrl+Z)"
                        className={`p-2 border-r border-border transition-colors ${
                          historyIndex === 0
                            ? 'text-text-disabled bg-bg-muted cursor-not-allowed'
                            : 'text-text hover:bg-surface-hover'
                        }`}
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        title="Redo (Ctrl+Shift+Z)"
                        className={`p-2 transition-colors ${
                          historyIndex >= history.length - 1
                            ? 'text-text-disabled bg-bg-muted cursor-not-allowed'
                            : 'text-text hover:bg-surface-hover'
                        }`}
                      >
                        <Redo2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setImgSrc('')
                        setHistory([undefined])
                        setHistoryIndex(0)
                      }}
                      className="px-6 py-2 rounded-sm border border-border text-xs font-bold text-text-muted hover:bg-surface-hover hover:text-text transition-all uppercase tracking-widest"
                    >
                      Reset Canvas
                    </button>
                  </div>
                </div>

                <div className="relative overflow-hidden border border-border bg-surface backdrop-blur-xl rounded-sm flex-1 flex items-center justify-center p-8 min-h-[600px]">
                  {!crop && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <div className="bg-bg/80 backdrop-blur-md border border-border px-6 py-4 rounded-sm flex flex-col items-center gap-2">
                        <Maximize className="w-8 h-8 text-text-muted opacity-50" />
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">
                          Click & Drag to Select Area
                        </p>
                      </div>
                    </div>
                  )}
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => {
                      setCompletedCrop(c)
                      pushToHistory(c)
                    }}
                    aspect={aspect}
                    className="max-h-[75vh]"
                  >
                    <img
                      ref={imgRef}
                      alt="Crop target"
                      src={imgSrc}
                      onLoad={onImageLoad}
                      className="max-w-full h-auto rounded-sm"
                    />
                  </ReactCrop>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decorative Blur */}
      <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-subtle rounded-md blur-[150px] -z-10" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary-subtle rounded-md blur-[150px] -z-10" />
    </div>
  )
}
