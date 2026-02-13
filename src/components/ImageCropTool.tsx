'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import * as Comlink from 'comlink'
import {
  CheckCircle2,
  ChevronRight,
  Crop as CropIcon,
  Download,
  Maximize,
  Redo2,
  RefreshCw,
  Settings2,
  Undo2,
  Upload,
} from 'lucide-react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import type { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { ImageWorkerAPI } from '@/lib/image.worker'

import type { ImageFormat } from '@/lib/image-processor'
import ThemeToggle from '@/components/ThemeToggle'
import { saveAs } from 'file-saver'

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

export default function ImageCropTool() {
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [format, setFormat] = useState<ImageFormat>('webp')
  const [quality, setQuality] = useState(80)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // History state
  const [history, setHistory] = useState<Array<PixelCrop | undefined>>([
    undefined,
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isInternalUpdate = useRef(false)

  const workerRef = useRef<Worker | null>(null)
  const apiRef = useRef<Comlink.Remote<ImageWorkerAPI> | null>(null)

  useEffect(() => {
    // Relative path to workers is safer in Vite
    const worker = new Worker(
      new URL('@/lib/image.worker.ts', import.meta.url),
      {
        type: 'module',
      },
    )
    workerRef.current = worker
    apiRef.current = Comlink.wrap<ImageWorkerAPI>(worker)

    return () => {
      worker.terminate()
    }
  }, [])

  const [cropWidth, setCropWidth] = useState<string>('')
  const [cropHeight, setCropHeight] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [presetGroup, setPresetGroup] = useState<'common' | 'store'>('common')
  const [customAspectInput, setCustomAspectInput] = useState('1:1')

  const applySizePreset = (w: number, h: number) => {
    const ratio = w / h
    setAspect(ratio)
    setOutputWidth(w.toString())
    setOutputHeight(h.toString())
    setIsOutputExpanded(true)
    isUpdatingOutputFromCrop.current = false

    if (imgRef.current) {
      const { width, height } = imgRef.current
      setCrop(centerAspectCrop(width, height, ratio))
    }
  }

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
        (current &&
          newCrop &&
          current.x === newCrop.x &&
          current.y === newCrop.y &&
          current.width === newCrop.width &&
          current.height === newCrop.height)
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
        width:
          clampedNum / (imgRef.current.naturalWidth / imgRef.current.width),
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
        height:
          clampedNum / (imgRef.current.naturalHeight / imgRef.current.height),
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

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
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
      // Step 1: Create ImageBitmap (transferable) and prepare scaling
      const bitmap = await createImageBitmap(imgRef.current)
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height

      // Step 2: Extract pixel data in Worker
      const imageData = await apiRef.current.getCroppedImageData(
        Comlink.transfer(bitmap, [bitmap]),
        completedCrop.x,
        completedCrop.y,
        completedCrop.width,
        completedCrop.height,
        scaleX,
        scaleY,
      )

      // Step 2: Offload encoding/resizing to Worker
      const blob = await apiRef.current.processAndEncodeImage(
        Comlink.transfer(imageData, [imageData.data.buffer]),
        {
          format,
          quality,
          width: parseInt(outputWidth) || undefined,
          height: parseInt(outputHeight) || undefined,
        },
      )

      saveAs(blob, `pandora-image.${format}`)

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
    <div className="h-screen bg-bg text-text font-sans relative flex flex-col overflow-hidden">
      {/* Theme Toggle */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[1400px] mx-auto border-x border-border h-screen bg-bg shadow-2xl shadow-black/20 flex flex-col">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-8 py-8 border-b border-border bg-surface/30 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-accent text-bg-elevated rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <CropIcon className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-widest uppercase font-display text-text">
                Pandora <span className="text-accent">Crop</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_5px_var(--color-success)]" />
                <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
                  System Active • v{APP_VERSION}
                </p>
                <div className="h-3 w-px bg-border mx-1" />
                <p className="text-[10px] font-mono text-accent uppercase tracking-wider">
                  Quick Export for Chrome Web Store Assets
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Processing Mode
              </span>
              <span className="text-xs font-mono text-accent">
                WASM_CLIENT_SIDE
              </span>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <Link
              to="/"
              className="text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-text transition-colors flex items-center gap-2 group"
            >
              <Undo2 className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              Return
            </Link>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Sidebar Settings */}
          <div className="lg:col-span-3 border-r border-border bg-bg-subtle/30 flex flex-col overflow-y-auto min-h-0">
            <div className="p-6 space-y-8">
              {/* Export Settings */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    Export Config
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-1 p-1 bg-bg-inset rounded-sm border border-border">
                    {(['webp', 'avif', 'jpeg', 'png'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`px-3 py-1.5 rounded-[1px] text-[10px] font-bold uppercase tracking-wide transition-all ${format === f
                          ? 'bg-text-secondary text-bg-elevated shadow-sm'
                          : 'text-text-muted hover:text-text hover:bg-surface-hover'
                          }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {format !== 'png' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-medium text-text-muted uppercase tracking-wider">
                        <span>Compression Quality</span>
                        <span className="text-accent font-mono">{quality}%</span>
                      </div>
                      <div className="relative h-4 flex items-center">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={quality}
                          onChange={(e) => setQuality(Number(e.target.value))}
                          className="w-full accent-accent bg-border h-[2px] rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="h-px bg-border w-full" />

              {/* Resize Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Maximize className="w-3.5 h-3.5 text-text-secondary" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                    Geometry
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative group">
                    <label className="absolute -top-2 left-2 px-1 bg-bg-subtle text-[9px] font-mono text-text-muted uppercase tracking-wider group-focus-within:text-accent transition-colors">
                      Width
                    </label>
                    <input
                      type="number"
                      value={cropWidth}
                      onChange={(e) => onCropWidthChange(e.target.value)}
                      className="w-full bg-bg-inset border border-border rounded-sm px-3 py-2 text-xs font-mono text-text focus:border-accent outline-none transition-all placeholder:text-text-disabled"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-text-disabled font-mono">
                      PX
                    </span>
                  </div>

                  <div className="relative group">
                    <label className="absolute -top-2 left-2 px-1 bg-bg-subtle text-[9px] font-mono text-text-muted uppercase tracking-wider group-focus-within:text-accent transition-colors">
                      Height
                    </label>
                    <input
                      type="number"
                      value={cropHeight}
                      onChange={(e) => onCropHeightChange(e.target.value)}
                      className="w-full bg-bg-inset border border-border rounded-sm px-3 py-2 text-xs font-mono text-text focus:border-accent outline-none transition-all placeholder:text-text-disabled"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-text-disabled font-mono">
                      PX
                    </span>
                  </div>
                </div>
              </section>

              <div className="h-px bg-border w-full" />

              {/* Output Size Scaling */}
              <section className="space-y-4">
                <div className="flex items-center justify-between w-full group">
                  <button
                    onClick={() => setIsOutputExpanded(!isOutputExpanded)}
                    className="flex items-center gap-2 hover:text-text transition-colors"
                  >
                    <div
                      className={`transition-transform duration-200 ${isOutputExpanded ? 'rotate-90' : ''}`}
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary group-hover:text-text">
                      Output Scaling
                    </h2>
                  </button>
                  {isOutputExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        resetOutputSize()
                      }}
                      className="text-[9px] font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1 border border-accent/20 px-1.5 py-0.5 rounded-sm hover:bg-accent/10"
                    >
                      RESET
                    </button>
                  )}
                </div>

                {isOutputExpanded && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300 pl-4 border-l-2 border-border-subtle ml-1.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-text-muted uppercase">
                          Target W
                        </label>
                        <input
                          type="number"
                          value={outputWidth}
                          onChange={(e) => onOutputWidthChange(e.target.value)}
                          className="w-full bg-bg-inset border border-border rounded-sm px-2 py-1.5 text-xs font-mono text-accent focus:border-accent outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-text-muted uppercase">
                          Target H
                        </label>
                        <input
                          type="number"
                          value={outputHeight}
                          onChange={(e) => onOutputHeightChange(e.target.value)}
                          className="w-full bg-bg-inset border border-border rounded-sm px-2 py-1.5 text-xs font-mono text-accent focus:border-accent outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <div className="h-px bg-border w-full" />

              {/* Aspect Ratio */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <CropIcon className="w-3.5 h-3.5 text-text-secondary" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                    Aspect Ratio
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="flex p-0.5 bg-bg-inset rounded-sm border border-border">
                    {[
                      { label: 'Free', value: undefined, type: 'free' },
                      { label: 'Custom', value: 'custom', type: 'custom' },
                      { label: 'Ratio', value: 'preset', type: 'common-group' },
                      { label: 'Store', value: 'store', type: 'store-group' },
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
                          } else if (opt.type === 'common-group') {
                            setPresetGroup('common')
                            setAspect(1)
                            setIsCustom(false)
                            if (imgRef.current) {
                              setCrop(
                                centerAspectCrop(
                                  imgRef.current.width,
                                  imgRef.current.height,
                                  1,
                                ),
                              )
                            }
                          } else if (opt.type === 'store-group') {
                            setPresetGroup('store')
                            setIsCustom(false)
                            // Apply first store preset by default: CWS Icon
                            applySizePreset(128, 128)
                          }
                        }}
                        className={`flex-1 py-1.5 rounded-[1px] text-[10px] font-bold uppercase tracking-wide transition-all ${(opt.type === 'free' &&
                          aspect === undefined &&
                          !isCustom) ||
                          (opt.type === 'custom' && isCustom) ||
                          (opt.type === 'common-group' &&
                            aspect !== undefined &&
                            !isCustom &&
                            presetGroup === 'common') ||
                          (opt.type === 'store-group' &&
                            !isCustom &&
                            presetGroup === 'store')
                          ? 'bg-text-secondary text-bg-elevated shadow-sm'
                          : 'text-text-muted hover:text-text hover:bg-surface-hover'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {isCustom && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="relative group">
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
                          className="w-full bg-bg-inset border border-border rounded-sm px-3 py-2 text-xs font-mono text-text focus:border-accent outline-none transition-all"
                          placeholder="RATIO (e.g. 16:9)"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!isCustom && aspect !== undefined && presetGroup === 'common' && (
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
                                setCrop(
                                  centerAspectCrop(width, height, opt.value),
                                )
                              }
                            }}
                            className={`px-3 py-1.5 rounded-sm border text-[10px] font-mono font-medium transition-all ${aspect === opt.value
                              ? 'bg-accent/10 border-accent text-accent'
                              : 'bg-transparent border-border text-text-muted hover:border-text-muted hover:text-text'
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </>
                    )}

                    {!isCustom && presetGroup === 'store' && (
                      <>
                        {[
                          { label: 'CWS Icon', w: 128, h: 128 },
                          { label: 'Small Tile', w: 440, h: 280 },
                          { label: 'Large Tile', w: 920, h: 680 },
                          { label: 'Marquee', w: 1400, h: 560 },
                          { label: 'Screenshot', w: 1280, h: 800 },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            onClick={() => applySizePreset(opt.w, opt.h)}
                            className={`px-2.5 py-1.5 rounded-sm border text-[9px] font-mono font-medium transition-all ${outputWidth === opt.w.toString() && outputHeight === opt.h.toString()
                              ? 'bg-accent/10 border-accent text-accent'
                              : 'bg-transparent border-border text-text-muted hover:border-text-muted hover:text-text'
                              }`}
                          >
                            {opt.label}
                            <span className="block opacity-50 text-[8px] mt-0.5">{opt.w}×{opt.h}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Action Area */}
            <div className="mt-auto p-6 border-t border-border bg-bg-elevated/10">
              <button
                onClick={handleDownload}
                disabled={!completedCrop || isProcessing}
                className={`w-full py-4 rounded-sm flex items-center justify-center gap-3 font-bold text-sm tracking-widest uppercase transition-all relative overflow-hidden group ${!completedCrop || isProcessing
                  ? 'bg-bg-muted text-text-disabled cursor-not-allowed border border-border'
                  : 'bg-text text-bg hover:bg-accent hover:text-white border border-transparent'
                  }`}
              >
                {showSuccess ? (
                  <CheckCircle2 className="w-5 h-5 animate-in zoom-in" />
                ) : isProcessing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                )}
                <span>
                  {showSuccess
                    ? 'Export Complete'
                    : isProcessing
                      ? 'Processing...'
                      : 'Process & Download'}
                </span>
              </button>
            </div>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-9 relative bg-bg-angled overflow-hidden flex flex-col">


            {!imgSrc ? (
              <label className="flex-1 flex flex-col items-center justify-center m-6 border border-dashed border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer group relative overflow-hidden rounded-sm">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onSelectFile}
                />

                {/* Decorative corners */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-text-muted group-hover:border-accent transition-colors" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-text-muted group-hover:border-accent transition-colors" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-text-muted group-hover:border-accent transition-colors" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-text-muted group-hover:border-accent transition-colors" />

                <div className="relative flex flex-col items-center z-10 space-y-6">
                  <div className="w-20 h-20 bg-bg-elevated rounded-full flex items-center justify-center border border-border group-hover:scale-110 transition-transform duration-300 shadow-xl">
                    <Upload className="w-8 h-8 text-text-muted group-hover:text-accent transition-colors" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-display font-bold text-text tracking-widest uppercase">
                      Initialize Workspace
                    </h3>
                    <p className="text-text-muted font-mono text-[10px] bg-bg-inset px-4 py-1.5 border border-border/50 rounded-sm">
                      [DROP ASSETS • CLICK TO BROWSE • <span className="text-accent">CTRL+V</span> TO PASTE]
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {['JPG', 'PNG', 'WEBP', 'AVIF'].map((type) => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-bg-surface border border-border rounded-[1px] text-[10px] font-bold text-text-disabled"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </label>
            ) : (
              <div className="relative w-full h-full flex flex-col">
                {/* Workspace Toolbar */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <div className="bg-bg-elevated/80 backdrop-blur-md border border-border rounded-sm px-3 py-1.5 flex items-center gap-3 shadow-lg">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                        Active Selection
                      </span>
                      <span className="text-sm font-mono font-bold text-accent">
                        {cropWidth
                          ? `${cropWidth} × ${cropHeight}`
                          : 'No Selection'}
                      </span>
                    </div>
                    {outputWidth &&
                      (outputWidth !== cropWidth ||
                        outputHeight !== cropHeight) && (
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
                    <div className="flex items-center border border-border rounded-sm overflow-hidden mr-4 shadow-lg bg-bg-elevated/80 backdrop-blur-md">
                      <button
                        onClick={undo}
                        disabled={historyIndex === 0}
                        title="Undo (Ctrl+Z)"
                        className={`p-2 border-r border-border transition-colors ${historyIndex === 0
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
                        className={`p-2 transition-colors ${historyIndex >= history.length - 1
                          ? 'text-text-disabled bg-bg-muted cursor-not-allowed'
                          : 'text-text hover:bg-surface-hover'
                          }`}
                      >
                        <Redo2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grow bg-bg-angled border-t border-b border-border overflow-hidden flex items-center justify-center p-8 relative">
                  <div className="relative shadow-2xl shadow-black/50 border border-border/20">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => {
                        setCrop(percentCrop)
                      }}
                      onComplete={(c) => {
                        setCompletedCrop(c)
                        const w =
                          imgRef.current &&
                          (c.width * imgRef.current.naturalWidth) /
                          imgRef.current.width
                        const h =
                          imgRef.current &&
                          (c.height * imgRef.current.naturalHeight) /
                          imgRef.current.height
                        if (w && h) {
                          pushToHistory(c)
                        }
                      }}
                      aspect={aspect}
                      className="max-h-[calc(100vh-200px)]"
                    >
                      <img
                        ref={imgRef}
                        alt="Crop target"
                        src={imgSrc}
                        onLoad={onImageLoad}
                        className="max-h-[calc(100vh-200px)] w-auto block"
                      />
                    </ReactCrop>
                  </div>
                </div>

                <button
                  onClick={() => setImgSrc('')}
                  className="absolute top-4 right-4 bg-surface/50 backdrop-blur-md border border-border p-2 rounded-sm hover:bg-danger-muted hover:border-danger text-text-muted hover:text-danger transition-all z-10"
                  title="Clear Image"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
