export interface JSONStats {
  keys: number
  depth: number
  size: string
}

export function calcJSONStats(data: unknown): { keys: number, depth: number } {
  let keyCount = 0
  let maxDepth = 0

  function traverse(val: unknown, depth: number) {
    if (depth > maxDepth)
      maxDepth = depth
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        for (const item of val) traverse(item, depth + 1)
      }
      else {
        const entries = Object.entries(val as Record<string, unknown>)
        keyCount += entries.length
        for (const [, v] of entries) traverse(v, depth + 1)
      }
    }
  }

  traverse(data, 0)
  return { keys: keyCount, depth: maxDepth }
}
