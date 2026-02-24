import dayjs from 'dayjs'

export function formatDate(date: Date | string | number) {
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatTime(date: Date | string | number) {
  return dayjs(date).format('HH:mm:ss')
}

export function formatDateTime(date: Date | string | number) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

export function formatFullDate(date: Date | string | number) {
  return dayjs(date).format('dddd, MMM D, YYYY')
}

export * from './downloadFile'
export * from './formatBytes'
export * from './getBase64'
export * from './hasFocusElement'
export * from './json'
