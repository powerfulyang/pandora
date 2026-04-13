import type { VNode, VNodeArrayChildren } from 'vue'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { defineComponent, h } from 'vue'

import CodeHighlighter from './CodeHighlighter.vue'

function renderNode(node: any, index = 0): VNode | string | VNodeArrayChildren | null {
  if (node.type === 'text') {
    return node.value
  }

  if (node.type === 'element') {
    const tagName = node.tagName
    const props: Record<string, any> = { ...node.properties, key: index }

    // Transform className array to class string
    if (props.className) {
      props.class = Array.isArray(props.className) ? props.className.join(' ') : props.className
      delete props.className
    }

    // Capture <pre><code> to render with our CodeHighlighter
    if (tagName === 'pre' && node.children?.length === 1 && node.children[0].type === 'element' && node.children[0].tagName === 'code') {
      const codeNode = node.children[0]
      const codeProps = codeNode.properties || {}
      const className = Array.isArray(codeProps.className) ? codeProps.className.join(' ') : (codeProps.className || '')

      const langMatch = className.match(/language-(\w+)/)
      const language = langMatch ? langMatch[1] : ''

      let text = ''
      if (codeNode.children?.length > 0 && codeNode.children[0].type === 'text') {
        text = codeNode.children[0].value
      }

      // Handle mermaid block differently
      if (language === 'mermaid') {
        // Use text in key to force re-render when mermaid code changes
        return h('div', { 'class': 'mermaid', 'data-mermaid': text, 'key': `mermaid-${index}-${text.length}-${text.slice(0, 20)}` }, text)
      }

      return h(CodeHighlighter, {
        language,
        code: text,
        key: index,
      })
    }

    const children = (node.children || []).map((child: any, i: number) => renderNode(child, i))

    // Auto map some standard tags classnames if we want (for example tables)
    // but we have them in CSS under .markdown-preview
    return h(tagName, props, children)
  }

  if (node.type === 'root') {
    return (node.children || []).map((child: any, i: number) => renderNode(child, i))
  }

  return null
}

export default defineComponent({
  name: 'MarkdownRenderer',
  props: {
    content: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)

    return () => {
      try {
        const mdast = processor.parse(props.content)
        const hast = processor.runSync(mdast)
        const elements = renderNode(hast as any)
        return h('article', { class: 'markdown-preview' }, elements as any)
      }
      catch (e) {
        console.error('Markdown processing failed:', e)
        return h('article', { class: 'markdown-preview text-pd-danger' }, 'Failed to render markdown')
      }
    }
  },
})
