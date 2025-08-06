import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// 定义插件参数类型
interface AutoIconServerOptions {
  iconPath?: string // 可选
}

export default function AutoIconServerPlugin(options: AutoIconServerOptions = {}): Plugin {
  const iconPath = options.iconPath || 'icons'
  return {
    name: 'vite-plugin-auto-icon-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.end()
        }
        if (req.method === 'POST' && req.url === '/api/auto-icon') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            function obj2str(obj: any) {
              return JSON.stringify(obj)
            }
            try {
              const data = JSON.parse(body)
              const { name, content } = data
              if (!name || !content) {
                res.end(obj2str({
                  success: false,
                  message: 'name 和 content 不能为空',
                }))
                return
              }

              // name 只能是 ascii
              const isAscii = /^[a-z0-9\-]+$/i.test(name)
              if (!isAscii) {
                res.end(obj2str({
                  success: false,
                  message: 'name 只能是英文、数字、连接符',
                }))
                return
              }
              const filename = `${name}.svg`
              const realPath = path.join(process.cwd(), iconPath, filename)
              // 先检查文件是否存在，已存在
              const isExist = fs.existsSync(realPath)
              if (isExist) {
                res.end(obj2str({
                  success: false,
                  message: '文件已存在，请修改命名后尝试。',
                }))
                return
              }
              fs.writeFileSync(realPath, content)
              res.end(obj2str({
                success: true,
              }))
            }
            catch (e: any) {
              // ignore error
              res.end(obj2str({
                success: false,
                message: e.message,
              }))
            }
          })
        }
        else {
          next()
        }
      })
    },
  }
}
