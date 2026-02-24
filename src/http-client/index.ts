import type { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import log from '@/log'
import { logRequest, logResponse } from '@/log/fetch'

// Create a custom instance
const instance = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor
instance.interceptors.request.use(
  (config) => {
    // 1. Inject Token
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 2. Log Start Time for performance tracking
    // @ts-expect-error custom property
    config.startTime = performance.now()

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response Interceptor
instance.interceptors.response.use(
  (response) => {
    // 3. Global success logic if needed
    return response
  },
  (error) => {
    // 4. Global Error Handling
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          // Unauthorized: login redirect or logout
          console.warn('Unauthorized, redirecting to login...')
          localStorage.removeItem('token')
          // window.location.href = '/login'
          break
        case 403:
          console.error('Forbidden access')
          break
        case 500:
          console.error('Internal Server Error')
          break
      }

      const responseType = error.response.headers['content-type']
      if (responseType?.includes('application/json')) {
        return Promise.reject(new Error(data.error || data.message || error.response.statusText))
      }
      return Promise.reject(new Error(error.response.statusText))
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timeout'))
    }

    return Promise.reject(error)
  },
)

interface RequestOptions extends AxiosRequestConfig {
  notifyErrorMessage?: boolean
  debug?: boolean
}

/**
 * Generic request function
 */
export async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  const {
    notifyErrorMessage = true,
    debug = false,
    ...restOptions
  } = options || {}

  try {
    if (debug) {
      logRequest({ url, ...restOptions })
    }

    const response = await instance.request<T>({
      url,
      ...restOptions,
    })

    if (debug) {
      logResponse(response)
    }

    return response.data
  }
  catch (e: any) {
    if (notifyErrorMessage) {
      // TODO: Integration with a notification library like Element Plus or others
      // For now, just console.error
      console.error('[HTTP Error]', e.message || e)
    }
    log.error(e)
    return Promise.reject(e)
  }
}
