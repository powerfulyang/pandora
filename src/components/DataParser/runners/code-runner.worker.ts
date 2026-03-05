import * as Comlink from 'comlink'

export interface RunnerLog {
  type: 'log' | 'warn' | 'error' | 'info' | 'table'
  args: any[]
}

export type LogHandler = (log: RunnerLog) => void

const runner = {
  async execute(code: string, onLog: LogHandler) {
    const sandboxConsole = {
      log: (...args: any[]) => onLog({ type: 'log', args }),
      warn: (...args: any[]) => onLog({ type: 'warn', args }),
      error: (...args: any[]) => onLog({ type: 'error', args }),
      info: (...args: any[]) => onLog({ type: 'info', args }),
      table: (...args: any[]) => onLog({ type: 'table', args }),
    }

    try {
      // Use Function constructor in worker (isolated from main thread)
      // eslint-disable-next-line no-new-func
      const fn = new Function('console', code)
      const result = await fn(sandboxConsole)
      return result
    }
    catch (error: any) {
      onLog({ type: 'error', args: [error.message || String(error)] })
      throw error
    }
  },
}

Comlink.expose(runner)
