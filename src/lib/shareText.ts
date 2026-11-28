import { copyText } from '@/components/buy-v3/format'

/** On mobile the system share sheet is more reliable than opening a blank wa.me tab. */
export async function shareText(text: string): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      // Cancelled or unavailable: give the person a usable clipboard fallback.
    }
  }
  await copyText(text)
  return 'copied'
}
