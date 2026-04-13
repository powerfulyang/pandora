<script setup lang="ts">
import type * as MonacoType from 'monaco-editor'
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  language?: string
  theme?: string
  options?: MonacoType.editor.IStandaloneEditorConstructionOptions
  extraLib?: string
  autoScroll?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'mount', editor: MonacoType.editor.IStandaloneCodeEditor, monaco: typeof MonacoType): void
}>()

// Use a shallowRef to store the monaco instance
const monacoInstance = shallowRef<typeof MonacoType | null>(null)

declare global {
  interface Window {
    MonacoEnvironment: MonacoType.Environment
  }
}

// MonacoEnvironment layout will be set in onMounted

const editorContainer = ref<HTMLElement | null>(null)
let editor: MonacoType.editor.IStandaloneCodeEditor | null = null
let extraLibDispose: MonacoType.IDisposable | null = null

function updateExtraLib() {
  const monaco = monacoInstance.value
  if (!monaco)
    return

  if (extraLibDispose) {
    extraLibDispose.dispose()
  }
  if (props.extraLib) {
    extraLibDispose = (monaco.languages.typescript as any).typescriptDefaults.addExtraLib(
      props.extraLib,
      'filename/types.d.ts',
    )
  }
}

onMounted(async () => {
  if (typeof window === 'undefined')
    return

  // Set up workers for Monaco if not already set
  if (!window.MonacoEnvironment) {
    const EditorWorker = (await import('monaco-editor/esm/vs/editor/editor.worker?worker')).default
    const JsonWorker = (await import('monaco-editor/esm/vs/language/json/json.worker?worker')).default
    const TsWorker = (await import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')).default

    window.MonacoEnvironment = {
      getWorker(_, label) {
        if (label === 'json')
          return new JsonWorker()
        if (label === 'typescript' || label === 'javascript')
          return new TsWorker()
        return new EditorWorker()
      },
    }
  }

  // @ts-expect-error - editor.api doesn't have a specific type declaration
  const monaco = (await import('monaco-editor/esm/vs/editor/editor.api')) as typeof MonacoType
  // Register basic languages and language services for Monaco
  // @ts-expect-error - contribution files don't have types
  await import('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution')
  // @ts-expect-error - contribution files don't have types
  await import('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution')
  // @ts-expect-error - contribution files don't have types
  await import('monaco-editor/esm/vs/language/typescript/monaco.contribution')
  // @ts-expect-error - contribution files don't have types
  await import('monaco-editor/esm/vs/language/json/monaco.contribution')

  monacoInstance.value = monaco

  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: props.modelValue,
      language: props.language || 'typescript',
      theme: props.theme || 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      scrollBeyondLastLine: false,
      ...props.options,
    })

    editor?.onDidChangeModelContent(() => {
      const value = editor?.getValue() || ''
      emit('update:modelValue', value)
    })

    updateExtraLib()
    if (props.autoScroll) {
      scrollToBottom()
    }
    emit('mount', editor!, monaco)
  }
})

function scrollToBottom() {
  if (editor) {
    const lineCount = editor.getModel()?.getLineCount() || 0
    if (lineCount > 0) {
      editor.revealLine(lineCount)
    }
  }
}

onUnmounted(() => {
  editor?.dispose()
  extraLibDispose?.dispose()
})

watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
    if (props.autoScroll) {
      scrollToBottom()
    }
  }
})

watch(() => props.theme, (newTheme) => {
  const monaco = monacoInstance.value
  if (editor && newTheme && monaco) {
    monaco.editor.setTheme(newTheme)
  }
})

watch(() => props.extraLib, () => {
  updateExtraLib()
})

defineExpose({
  getEditor: () => editor,
  getMonaco: () => monacoInstance.value,
  scrollToBottom,
})
</script>

<template>
  <div ref="editorContainer" class="h-full w-full" />
</template>

<style scoped>
/* Ensure the container has dimensions */
div {
  min-height: 200px;
}
</style>
