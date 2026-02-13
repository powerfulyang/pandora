
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as Comlink from 'comlink'
import {
    Upload,
    FileImage,
    Settings,
    X,
    Download,
    Trash2,
    RefreshCw,
    Archive,
    ArrowLeft,
    ArrowRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { recordStorage, type ProcessingRecord } from '@/lib/storage'
import type { ImageWorkerAPI } from '@/lib/image.worker'
import type { ImageFormat } from '@/lib/image-processor'

// Helper component for image preview
function ImagePreview({ data, className }: { data: File | Blob, className?: string }) {
    const [url, setUrl] = useState<string | null>(null)

    useEffect(() => {
        const objectUrl = URL.createObjectURL(data)
        setUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
    }, [data])

    if (!url) return null

    return (
        <img
            src={url}
            alt="preview"
            className={`${className} object-cover`}
            loading="lazy"
        />
    )
}

export const Route = createFileRoute('/image-converter')({
    component: ImageConverter,
    head: () => ({
        meta: [
            {
                title: 'Image Converter | Pandora',
            },
            {
                name: 'description',
                content: 'Pandora Image Converter: Professional batch image conversion and compression. Supports WebP, AVIF, JPEG, and PNG. 100% local processing for maximum privacy.',
            },
        ],
    }),
})


// Types
interface FileItem {
    id: string
    file: File
    status: 'pending' | 'processing' | 'done' | 'error'
    progress: number
    resultBlob?: Blob
    error?: string
    originalSize: number
    processedSize?: number
    format?: ImageFormat
    quality?: number
}


function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function ImageConverter() {
    const [files, setFiles] = useState<FileItem[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [configuration, setConfiguration] = useState({
        format: 'webp' as ImageFormat,
        quality: 80
    })
    const [isProcessing, setIsProcessing] = useState(false)
    const [history, setHistory] = useState<ProcessingRecord[]>([])
    const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')

    // Worker setup
    const workerRef = useRef<Worker | null>(null)
    const workerApiRef = useRef<Comlink.Remote<ImageWorkerAPI> | null>(null)

    useEffect(() => {
        workerRef.current = new Worker(
            new URL('../lib/image.worker.ts', import.meta.url),
            { type: 'module' },
        )
        workerApiRef.current = Comlink.wrap<ImageWorkerAPI>(workerRef.current)

        // Load history
        loadHistory()

        return () => {
            workerRef.current?.terminate()
        }
    }, [])

    const loadHistory = async () => {
        const records = await recordStorage.getRecords()
        setHistory(records)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
        addFiles(droppedFiles)
    }, [configuration])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
            addFiles(selectedFiles)
        }
        // Reset value to allow selecting same file again
        e.target.value = ''
    }

    const addFiles = (newFiles: File[]) => {
        const newItems: FileItem[] = newFiles.map(file => ({
            id: globalThis.crypto.randomUUID(),
            file,
            status: 'pending',
            progress: 0,
            originalSize: file.size,
        }))
        setFiles(prev => [...prev, ...newItems])
    }

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    const clearQueue = () => {
        setFiles([])
    }

    const clearHistory = async () => {
        await recordStorage.clearRecords()
        loadHistory()
    }

    const processQueue = async () => {
        if (!workerApiRef.current) return
        setIsProcessing(true)

        const queue = files.filter(f => f.status === 'pending')

        for (const item of queue) {
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing', progress: 10 } : f))

            try {
                const blob = await workerApiRef.current.processFile(item.file, {
                    format: configuration.format,
                    quality: configuration.quality
                })

                const record: ProcessingRecord = {
                    id: item.id,
                    originalName: item.file.name,
                    timestamp: Date.now(),
                    format: configuration.format,
                    originalSize: item.originalSize,
                    processedSize: blob.size,
                    quality: configuration.quality,
                    // In a real app we might store the blob in IndexedDB if small enough, but localforage handles it well usually
                    savedFile: blob
                }

                await recordStorage.saveRecord(record)

                setFiles(prev => prev.map(f => f.id === item.id ? {
                    ...f,
                    status: 'done',
                    progress: 100,
                    resultBlob: blob,
                    processedSize: blob.size,
                    format: configuration.format,
                    quality: configuration.quality
                } : f))

            } catch (error) {
                console.error("Processing error:", error)
                setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: 'Processing failed' } : f))
            }
        }

        setIsProcessing(false)
        loadHistory()
    }

    const downloadFile = (blob: Blob, originalName: string, format: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        // remove extension and add new one
        const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
        a.download = `${nameWithoutExt}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // Handle paste
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items
            if (!items) return

            const imageFiles: File[] = []
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile()
                    if (file) imageFiles.push(file)
                }
            }
            if (imageFiles.length > 0) {
                addFiles(imageFiles)
            }
        }

        window.addEventListener('paste', handlePaste)
        return () => window.removeEventListener('paste', handlePaste)
    }, [configuration])

    return (
        <div className="min-h-screen bg-bg text-text font-sans relative flex flex-col overflow-x-hidden">
            <div className="w-full max-w-[1400px] mx-auto border-x border-border min-h-screen bg-bg shadow-2xl shadow-black/20 flex flex-col">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-8 py-8 border-b border-border bg-surface/30 backdrop-blur-sm sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-accent text-bg-elevated rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                            <Archive className="w-5 h-5" strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-widest uppercase font-display text-text">
                                Pandora <span className="text-accent">Converter</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_5px_var(--color-success)]" />
                                <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
                                    System Active • v{APP_VERSION}
                                </p>
                                <div className="h-3 w-px bg-border mx-1" />
                                <p className="text-[10px] font-mono text-accent uppercase tracking-wider">
                                    Batch Process & Format Optimization Protocol
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
                                WASM_MULTI_THREADED
                            </span>
                        </div>
                        <div className="h-8 w-px bg-border hidden md:block" />
                        <Link
                            to="/"
                            className="text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-text transition-colors flex items-center gap-2 group"
                        >
                            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                            Return
                        </Link>
                    </div>
                </header>

                {/* Internal State */}
                <main className="flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden bg-bg-angled/50">

                    {/* Left Panel: Upload & Settings */}
                    <section className="col-span-1 lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                        {/* Tool Header */}
                        <div className="space-y-2">
                            <h2 className="font-display font-bold text-2xl uppercase tracking-tight text-text">Workspace</h2>
                            <p className="text-xs text-text-secondary font-mono leading-relaxed max-w-sm">
                                Professional-grade cryptographic-safe image processing workstation.
                                All operations are executed within your browser's secure sandbox.
                            </p>
                        </div>

                        {/* Upload Zone */}
                        <div
                            className={`
               border-2 border-dashed transition-all duration-200 h-64 flex flex-col items-center justify-center gap-4 relative overflow-hidden group rounded-sm
               ${isDragging ? 'border-accent bg-accent/5' : 'border-border/50 hover:border-accent/50 bg-bg-subtle/40'}
             `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="p-4 rounded-full bg-bg border border-border group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-text-muted group-hover:text-accent transition-colors" />
                            </div>
                            <div className="text-center flex flex-col items-center gap-3">
                                <div className="space-y-1">
                                    <p className="font-display font-bold uppercase tracking-widest text-xs text-text-secondary">Workspace Input</p>
                                    <div className="h-px w-8 bg-accent/30 mx-auto" />
                                </div>
                                <div className="font-mono text-[10px] text-text-muted flex items-center gap-2 uppercase tracking-widest bg-bg-subtle/50 px-3 py-1.5 border border-border/50 rounded-sm">
                                    <span>Drop</span>
                                    <span className="opacity-30">•</span>
                                    <span>Browse</span>
                                    <span className="opacity-30">•</span>
                                    <span className="text-accent group-hover:animate-pulse">Paste</span>
                                </div>
                                <p className="font-mono text-[9px] text-text-disabled uppercase tracking-tighter">
                                    Format: WebP, AVIF, PNG, JPEG
                                </p>
                            </div>
                        </div>

                        {/* Settings Panel */}
                        <div className="bg-bg border border-border p-6 flex flex-col gap-6 shadow-xl shadow-black/5 rounded-sm">
                            <div className="flex items-center gap-2 pb-4 border-b border-border">
                                <Settings className="w-4 h-4 text-accent" />
                                <span className="font-bold text-xs uppercase tracking-widest">Configuration</span>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-text-muted uppercase">Output Format</label>
                                    <select
                                        value={configuration.format}
                                        onChange={(e) => setConfiguration(prev => ({ ...prev, format: e.target.value as ImageFormat }))}
                                        className="w-full bg-bg-subtle border border-border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none"
                                    >
                                        <option value="webp">WebP (Recommended)</option>
                                        <option value="avif">AVIF (Best Compression)</option>
                                        <option value="jpeg">JPEG</option>
                                        <option value="png">PNG</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-mono text-text-muted uppercase">Quality</label>
                                        <span className="text-xs font-mono text-accent">{configuration.quality}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={configuration.quality}
                                        onChange={(e) => setConfiguration(prev => ({ ...prev, quality: parseInt(e.target.value) }))}
                                        className="w-full accent-accent h-1 bg-border rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-text-disabled font-mono">
                                        <span>Small Size</span>
                                        <span>High Quality</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={processQueue}
                                disabled={files.filter(f => f.status === 'pending').length === 0 || isProcessing}
                                className={`
                 w-full py-3 font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2
                 ${files.filter(f => f.status === 'pending').length > 0 && !isProcessing
                                        ? 'bg-accent text-white hover:bg-accent-hover'
                                        : 'bg-bg-subtle text-text-disabled cursor-not-allowed'}
               `}
                            >
                                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {isProcessing ? 'Processing...' : 'Start Batch Process'}
                            </button>
                        </div>
                    </section>

                    {/* Right Panel: Lists */}
                    <section className="col-span-1 lg:col-span-8 bg-bg/60 backdrop-blur-sm border border-border flex flex-col min-h-[600px] shadow-2xl shadow-black/10 rounded-sm overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`px-6 py-3 text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${activeTab === 'queue' ? 'bg-bg-subtle/50 text-accent border-r border-border' : 'text-text-muted hover:text-text'}`}
                            >
                                <FileImage className="w-4 h-4" />
                                Queue ({files.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-6 py-3 text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${activeTab === 'history' ? 'bg-bg-subtle/50 text-accent border-r border-l border-border' : 'text-text-muted hover:text-text'}`}
                            >
                                <Archive className="w-4 h-4" />
                                History ({history.length})
                            </button>
                            <div className="flex-1" />
                            {activeTab === 'queue' && files.length > 0 && (
                                <button onClick={clearQueue} className="px-4 py-3 text-xs font-mono text-text-muted hover:text-error transition-colors flex items-center gap-2">
                                    <Trash2 className="w-3 h-3" /> Clear Queue
                                </button>
                            )}
                            {activeTab === 'history' && history.length > 0 && (
                                <button onClick={clearHistory} className="px-4 py-3 text-xs font-mono text-text-muted hover:text-error transition-colors flex items-center gap-2">
                                    <Trash2 className="w-3 h-3" /> Clear History
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col custom-scrollbar">
                            {activeTab === 'queue' ? (
                                <AnimatePresence mode='popLayout'>
                                    {files.length === 0 ? (
                                        <motion.div
                                            key="empty-queue"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className="h-full flex-1 flex flex-col items-center justify-center text-text-muted opacity-50 py-20"
                                        >
                                            <FileImage className="w-12 h-12 mb-4 stroke-1" />
                                            <div className="text-center space-y-2">
                                                <p className="text-sm font-mono text-text-secondary">Queue is empty</p>
                                                <p className="text-[10px] font-mono text-text-disabled uppercase tracking-[0.2em]">Drop or Paste assets to begin</p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {files.map(file => (
                                                <motion.div
                                                    key={file.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="bg-bg-subtle/30 border border-border flex flex-col group hover:bg-bg-subtle/50 transition-colors overflow-hidden"
                                                >
                                                    {/* Preview Area */}
                                                    <div className="w-full h-48 bg-bg-angled border-b border-border flex items-center justify-center shrink-0 overflow-hidden relative">
                                                        <ImagePreview data={file.file} className="w-full h-full object-contain" />

                                                        {/* Floating Actions */}
                                                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {file.status === 'done' && file.resultBlob && (
                                                                <button
                                                                    onClick={() => downloadFile(file.resultBlob!, file.file.name, file.format || configuration.format)}
                                                                    className="p-2 bg-bg/80 backdrop-blur-md border border-border text-text-muted hover:text-accent transition-colors"
                                                                    title="Download"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => removeFile(file.id)}
                                                                className="p-2 bg-bg/80 backdrop-blur-md border border-border text-text-muted hover:text-error transition-colors"
                                                                title="Remove"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Info Bar */}
                                                    <div className="p-3 space-y-3">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-sm truncate text-text mb-1">{file.file.name}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-mono text-text-muted uppercase">
                                                                        {formatBytes(file.originalSize)}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-text-disabled" />
                                                                    <span className="text-[10px] font-mono text-accent uppercase font-bold">
                                                                        {(file.format || configuration.format).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Status Area */}
                                                        <div>
                                                            {file.status === 'processing' && (
                                                                <div className="w-full h-1 bg-border overflow-hidden">
                                                                    <motion.div
                                                                        className="h-full bg-accent"
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: '100%' }}
                                                                        transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {file.status === 'done' && (
                                                                <div className="flex items-center justify-between text-[10px] font-mono">
                                                                    <div className="flex items-center gap-2 text-success">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                                                        <span>COMPLETED</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-text-muted">{formatBytes(file.processedSize || 0)}</span>
                                                                        {file.processedSize && (
                                                                            <span className={file.processedSize < file.originalSize ? "text-success" : "text-warning"}>
                                                                                ({Math.round(((file.processedSize - file.originalSize) / file.originalSize) * 100)}%)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {file.status === 'error' && (
                                                                <div className="flex items-center gap-2 text-error text-[10px] font-mono uppercase">
                                                                    <X className="w-3 h-3" />
                                                                    <span>{file.error}</span>
                                                                </div>
                                                            )}
                                                            {file.status === 'pending' && (
                                                                <div className="flex items-center gap-2 text-text-disabled text-[10px] font-mono uppercase">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-text-disabled" />
                                                                    <span>READY FOR PROCESSING</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </AnimatePresence>
                            ) : (
                                history.length === 0 ? (
                                    <div className="h-full flex-1 flex flex-col items-center justify-center text-text-muted opacity-50 py-20">
                                        <Archive className="w-12 h-12 mb-4 stroke-1" />
                                        <p className="text-sm font-mono">No history available</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        {history.map(record => (
                                            <div key={record.id} className="bg-bg-subtle/10 border border-border flex flex-col opacity-80 hover:opacity-100 transition-opacity overflow-hidden group">
                                                {/* Preview Area */}
                                                <div className="w-full h-48 bg-bg-angled border-b border-border flex items-center justify-center shrink-0 overflow-hidden relative">
                                                    {record.savedFile ? (
                                                        <ImagePreview data={record.savedFile} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-text-disabled">
                                                            <FileImage className="w-8 h-8 stroke-1" />
                                                            <span className="text-[10px] font-mono">NO PREVIEW</span>
                                                        </div>
                                                    )}

                                                    {/* Floating Actions */}
                                                    {record.savedFile && (
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => downloadFile(record.savedFile!, record.originalName, record.format)}
                                                                className="p-2 bg-bg/80 backdrop-blur-md border border-border text-text-muted hover:text-accent transition-colors"
                                                                title="Download"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info Bar */}
                                                <div className="p-3 space-y-2">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-sm truncate text-text mb-0.5">{record.originalName}</h4>
                                                            <span className="text-[9px] text-text-disabled font-mono uppercase tracking-tighter">
                                                                {new Date(record.timestamp).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-border/50 pt-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-text-muted">{formatBytes(record.originalSize)}</span>
                                                            <ArrowRight className="w-3 h-3 text-text-disabled" />
                                                            <span className="text-accent font-bold">{formatBytes(record.processedSize)}</span>
                                                        </div>
                                                        <span className="px-1.5 py-0.5 bg-accent/10 border border-accent/20 text-accent text-[9px] font-bold">
                                                            {record.format.toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    )
}
