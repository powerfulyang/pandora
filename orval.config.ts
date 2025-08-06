import { defineConfig } from 'orval'

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: 'src/orval/service.ts',
      schemas: 'src/orval/models',
      client: 'vue-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: './src/http-client/index.ts',
          name: 'request',
        },
        // 由于后端 operationId 没有规范，所以通过 url 和 method 生成
        operationName: (operation, route: string, verb) => {
          // 去掉 route 的 prefix
          // prefix 大多数情况为 /api，实际依照实际情况
          const name = route.replace(/^\/api/, '').replace(/\/$/, '')
          // / _ - 转驼峰
          const camelCase = name.replace(/[/_-](\w)/g, (_, letter) => letter.toUpperCase())
          //  只保留英文
          const operationName = camelCase.replace(/[^a-z]/gi, '')
          // 加上 verb, 且首字母大写
          return `${verb}${operationName.charAt(0).toUpperCase()}${camelCase.slice(1)}`
        },
      },
    },
    input: {
      target: 'https://subtitle.us4ever.com/openapi.json',
      // 如果是旧版本的 swagger，需要开启 patch 和 warnOnly
      // openapi 3.0 不需要开启
      // converterOptions: {
      //   patch: true,
      //   warnOnly: true,
      // },
    },
    hooks: {
      afterAllFilesWrite: 'node patch-orval.mjs',
    },
  },
})
