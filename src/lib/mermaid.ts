async function getMermaid() {
  return (await import('mermaid')).default
}

let initialized = false

/**
 * Initialize Mermaid with theme configuration
 */
export async function initMermaid(theme: 'dark' | 'default' = 'default') {
  const mermaid = await getMermaid()
  mermaid.initialize({
    startOnLoad: false,
    theme,
    logLevel: 'error',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
    securityLevel: 'strict',
  })
  initialized = true
}

/**
 * Get current Mermaid initialization status
 */
export function isInitialized(): boolean {
  return initialized
}

/**
 * Render Mermaid diagram code to SVG string
 * @param id - Unique identifier for the diagram
 * @param code - Mermaid diagram definition code
 * @returns SVG string or empty string on error
 */
export async function renderMermaid(id: string, code: string): Promise<string> {
  const mermaid = await getMermaid()
  if (!initialized) {
    await initMermaid()
  }

  try {
    const { svg } = await mermaid.render(id, code)
    return svg
  }
  catch (e) {
    console.warn('Mermaid render error:', e)
    return ''
  }
}

/**
 * Validate Mermaid syntax without rendering
 * @param code - Mermaid diagram definition code
 * @returns true if valid, false otherwise
 */
export async function validateMermaid(code: string): Promise<boolean> {
  const mermaid = await getMermaid()
  if (!initialized) {
    await initMermaid()
  }

  try {
    await mermaid.parse(code)
    return true
  }
  catch {
    return false
  }
}

/**
 * Parse and get detailed error message
 * @param code - Mermaid diagram definition code
 * @returns error message string or null if valid
 */
export async function getMermaidParseError(code: string): Promise<string | null> {
  const mermaid = await getMermaid()
  if (!initialized) {
    await initMermaid()
  }

  try {
    await mermaid.parse(code)
    return null
  }
  catch (e) {
    if (e instanceof Error) {
      // Clean up the error message for display
      const message = e.message
        .replace(/Error parsing mermaid syntax:\s*/i, '')
        .replace(/Expecting\s*/i, 'Expecting: ')
        .split('\n')[0] // Take first line only
      return message || 'Invalid Mermaid syntax'
    }
    return 'Invalid Mermaid syntax'
  }
}

/**
 * Reinitialize Mermaid with a new theme
 * Call this when theme changes
 */
export async function updateMermaidTheme(theme: 'dark' | 'default') {
  const mermaid = await getMermaid()
  mermaid.initialize({
    startOnLoad: false,
    theme,
    logLevel: 'error',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
    securityLevel: 'strict',
  })
}
