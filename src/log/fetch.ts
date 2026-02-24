import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { isEmpty, omit } from 'lodash-es'
import { getBase64 } from '@/utils/getBase64'
import logger from '.'

export async function logRequest(
  config: AxiosRequestConfig,
) {
  const startTime = performance.now()
  // @ts-expect-error custom property
  config.startTime = startTime

  const method = config.method?.toUpperCase() || 'GET'
  const url = config.url || ''

  // headers
  const _headers = config.headers || {}
  const contentType = (_headers['content-type'] || _headers['Content-Type']) as string
  const headers = omit(
    _headers as Record<string, any>,
    ['content-type', 'Content-Type'],
  )

  // params
  const params = config.params || {}

  // data
  let json = {} as any
  if (contentType?.includes('application/json') && typeof config.data === 'string') {
    try {
      json = JSON.parse(config.data)
    }
    catch {
      json = config.data
    }
  }
  else if (config.data !== undefined && config.data !== null) {
    json = config.data
  }

  console.groupCollapsed(
    `%c${method}%c 🌐 ${url}`,
    'color: #fff; background: #2ecc71; font-weight: bold; font-size: 10px; padding: 2px; border-radius: 2px;',
    'color: inherit; font-size: inherit;',
  )

  if (!isEmpty(headers)) {
    console.groupCollapsed(
      '%c📋 Request Headers %o',
      'color: #9b59b6; font-size: 11px',
      headers,
    )
    console.table(headers)
    console.groupEnd()
  }

  if (!isEmpty(params)) {
    console.groupCollapsed(
      '%c🔍 Request Params %o',
      'color: #e67e22; font-size: 11px',
      params,
    )
    console.table(params)
    console.groupEnd()
  }

  if (!isEmpty(json)) {
    console.groupCollapsed(
      `%c📦 Request Body %c${contentType || 'unknown'} %o`,
      'color: #3498db; font-size: 11px',
      'background: #3498db; color: #fff; padding: 2px; border-radius: 2px; margin-left: 4px;',
      json,
    )
    console.table(json)
    console.groupEnd()
  }

  if (config.data instanceof FormData) {
    console.groupCollapsed(
      `%c📦 Request Body %c${contentType} %o`,
      'color: #3498db; font-size: 11px',
      'background: #3498db; color: #fff; padding: 2px; border-radius: 2px; margin-left: 4px;',
      config.data,
    )

    for (const [key, value] of (config.data as any).entries()) {
      if (value instanceof File) {
        const dataURL = await getBase64(value)
        if (value.type.startsWith('image/')) {
          console.log(
            `%c${key} %c=> %c🖼️`,
            'color: #3498db',
            'color: inherit',
            'color: inherit',
          )
          logger.debug(
            '%c ',
            `
              padding: 100px 200px;
              background-image: url('${dataURL}');
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
            `,
          )
        }
        else {
          const url = URL.createObjectURL(value)
          console.log(
            `%c${key} %c=> %c${url}`,
            'color: #3498db',
            'color: inherit',
            'color: #fff; background: #2ecc71; padding: 2px; border-radius: 2px',
          )
        }
      }
      else {
        console.log(
          `%c${key} %c=> %c${value}`,
          'color: #3498db',
          'color: inherit',
          'color: #3498db',
        )
      }
    }
    console.groupEnd()
  }
  console.groupEnd()
}

export async function logResponse(
  response: AxiosResponse,
) {
  const config = response.config
  const url = config.url || ''
  const _headers = response.headers || {}
  const contentType = (_headers['content-type'] || _headers['Content-Type']) as string
  const headers = omit(
    _headers as Record<string, any>,
    ['content-type', 'Content-Type'],
  )

  // @ts-expect-error custom property
  const startTime = config.startTime
  const endTime = performance.now()
  const duration = startTime ? (endTime - startTime).toFixed(0) : '?'

  console.groupCollapsed(
    `%c${response.status}%c %c⚡${duration}ms%c 🌐 ${url}`,
    `color: #fff; background: ${response.status >= 200 && response.status < 300 ? '#2ecc71' : '#e74c3c'}; font-weight: bold; font-size: 10px; padding: 2px; border-radius: 2px;`,
    'color: inherit',
    `color: #fff; background: ${duration === '?' || Number(duration) > 1000 ? '#e74c3c' : '#2ecc71'}; font-size: 10px; padding: 2px; border-radius: 2px;`,
    'color: inherit',
  )

  if (!isEmpty(headers)) {
    console.groupCollapsed(
      '%c📋 Response Headers %o',
      'color: #9b59b6; font-size: 11px',
      headers,
    )
    console.table(headers)
    console.groupEnd()
  }

  const json = response.data
  if (contentType?.includes('application/json')) {
    if (!isEmpty(json)) {
      console.groupCollapsed(
        `%c📦 Response Body %c${contentType} %o`,
        'color: #3498db; font-size: 11px',
        'background: #3498db; color: #fff; padding: 2px; border-radius: 2px; margin-left: 4px;',
        json,
      )
      console.table(json)
      console.groupEnd()
    }
  }
  else if (contentType?.startsWith('image/')) {
    const dataURL = await getBase64(new Blob([response.data]))
    console.groupCollapsed(
      `%c📦 Response Body %c${contentType}`,
      'color: #3498db; font-size: 11px',
      'background: #3498db; color: #fff; padding: 2px; border-radius: 2px; margin-left: 4px;',
    )
    logger.debug(
      '%c ',
      `
        padding: 100px 200px;
        background-image: url('${dataURL}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
      `,
    )
    console.groupEnd()
  }
  else {
    console.groupCollapsed(
      `%c📦 Response Body %c${contentType} %o`,
      'color: #3498db; font-size: 11px',
      'background: #3498db; color: #fff; padding: 2px; border-radius: 2px; margin-left: 4px;',
      json,
    )
    logger.debug(json)
    console.groupEnd()
  }
  console.groupEnd()
}
