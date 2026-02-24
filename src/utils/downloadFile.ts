export function downloadFile(blob: Blob, name: string, format?: string) {
  const finalName = format
    ? (name.toLowerCase().endsWith(`.${format.toLowerCase()}`) ? name : `${name}.${format}`)
    : name
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = finalName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
