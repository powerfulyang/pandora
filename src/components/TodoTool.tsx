import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, Plus, Terminal, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// --- Types & Schema ---
const todoSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Task cannot be empty'),
  completed: z.boolean(),
  createdAt: z.number(),
})

type Todo = z.infer<typeof todoSchema>

// --- Component ---
export default function TodoTool() {
  // State
  const [todos, setTodos] = useState<Array<Todo>>([])
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('pandora-todos')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const validTodos = z.array(todoSchema).safeParse(parsed)
        if (validTodos.success) {
          setTodos(validTodos.data)
        }
      } catch (e) {
        console.error('Failed to load todos', e)
      }
    }
  }, [])

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('pandora-todos', JSON.stringify(todos))
  }, [todos])

  // GSAP Entry Animation
  useGSAP(
    () => {
      gsap.from('.todo-header', {
        y: -20,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      })

      gsap.from('.todo-input-container', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        delay: 0.2,
        ease: 'power3.out',
      })
    },
    { scope: containerRef },
  )

  // Handlers
  const handleAdd = () => {
    setError(null)
    const text = inputValue.trim()

    if (!text) {
      setError('PROTOCOL ERROR: Input cannot be empty.')
      return
    }

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: Date.now(),
    }

    setTodos((prev) => [newTodo, ...prev])
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    )
  }

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const clearCompleted = () => {
    setTodos((prev) => prev.filter((t) => !t.completed))
  }

  // Animation Variants
  const listVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  }

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0, transition: { duration: 0.2 } },
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto p-6 md:p-12 w-full">
      {/* Header */}
      <div className="todo-header mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-sm border border-accent/20">
              <Terminal className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl font-display font-black uppercase text-text tracking-tighter">
              Task<span className="text-text-muted">Manager</span>
            </h1>
          </div>
          <p className="text-text-secondary font-mono text-xs">
            Local persistence enabled. syncing_status:{' '}
            <span className="text-success">ONLINE</span>
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-text-muted uppercase">Total</span>
            <span className="text-xl font-bold text-text">{todos.length}</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-end">
            <span className="text-text-muted uppercase">Active</span>
            <span className="text-xl font-bold text-accent">
              {todos.filter((t) => !t.completed).length}
            </span>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="todo-input-container mb-12">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Plus className="h-5 w-5 text-text-muted group-focus-within:text-accent transition-colors" />
          </div>
          <input
            type="text"
            className="w-full bg-bg-subtle border border-border py-4 pl-12 pr-4 text-text placeholder:text-text-disabled font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all rounded-sm"
            placeholder="Initialize new task protocol..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button
              onClick={handleAdd}
              className="bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/20 hover:border-accent px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide transition-all"
            >
              Add
            </button>
          </div>
        </div>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 text-error text-xs font-mono"
          >
            <AlertCircle className="w-3 h-3" />
            {error}
          </motion.div>
        )}
      </div>

      {/* Todo List */}
      <div className="bg-bg border border-border rounded-sm overflow-hidden">
        <div className="bg-bg-subtle/50 border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
            Task_Queue
          </span>
          {todos.some((t) => t.completed) && (
            <button
              onClick={clearCompleted}
              className="text-[10px] uppercase font-bold text-text-muted hover:text-error transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear Completed
            </button>
          )}
        </div>

        <div className="divide-y divide-border/50 min-h-[300px]">
          <AnimatePresence mode="popLayout">
            {todos.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-text-disabled"
              >
                <div className="w-12 h-12 rounded-full border border-dashed border-text-disabled/30 flex items-center justify-center mb-4">
                  <Terminal className="w-5 h-5 opacity-50" />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest">
                  No active tasks found
                </span>
              </motion.div>
            ) : (
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
              >
                {todos.map((todo) => (
                  <motion.div
                    key={todo.id}
                    variants={itemVariants}
                    layout
                    className={`group flex items-center justify-between p-4 hover:bg-bg-elevated transition-colors ${todo.completed ? 'bg-bg-subtle/30' : ''}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        onClick={() => toggleTodo(todo.id)}
                        className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-all ${
                          todo.completed
                            ? 'bg-success border-success text-bg'
                            : 'bg-transparent border-text-muted hover:border-accent'
                        }`}
                      >
                        {todo.completed && (
                          <Check className="w-3.5 h.3.5 stroke-[3]" />
                        )}
                      </button>
                      <span
                        className={`font-mono text-sm transition-all ${
                          todo.completed
                            ? 'text-text-disabled line-through decoration-text-disabled/50'
                            : 'text-text'
                        }`}
                      >
                        {todo.text}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-text-muted hover:text-error transition-all"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
