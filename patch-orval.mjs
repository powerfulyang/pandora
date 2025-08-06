import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const content = readFileSync(join(process.cwd(), 'src/orval/service.ts'), 'utf-8')
// 在最上面增加
const newContent = `// @ts-nocheck\nimport type { RequestOptions as RequestInit } from '../http-client/index'\n\n${content}`
writeFileSync(join(process.cwd(), 'src/orval/service.ts'), newContent)
