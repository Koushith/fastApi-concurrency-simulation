export const API_BASE = 'http://localhost:8000/api'

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    console.error('Failed to copy', e)
  }
}

export const generateIdempotencyKey = (prefix: string = 'idem') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
