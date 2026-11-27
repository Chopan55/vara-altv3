import { describe, expect, it, vi } from 'vitest'

const { numPages } = vi.hoisted(() => ({ numPages: { value: 201 } }))
const extract = vi.hoisted(() => vi.fn(async () => ({ text: ['a'] })))
vi.mock('unpdf', () => ({
  getDocumentProxy: async () => ({ numPages: numPages.value }),
  extractText: extract,
}))

import { MAX_PDF_PAGES, TooManyPagesError, extractPages } from '@/lib/documents/extractPdf'

describe('PDF con demasiadas páginas', () => {
  it('se rechaza ANTES de extraer: no consume CPU ni se recorta en silencio', async () => {
    numPages.value = MAX_PDF_PAGES + 1
    await expect(extractPages(new Uint8Array([1]))).rejects.toBeInstanceOf(TooManyPagesError)
    expect(extract).not.toHaveBeenCalled()
  })
  it('justo en el límite sí se lee', async () => {
    numPages.value = MAX_PDF_PAGES
    await expect(extractPages(new Uint8Array([1]))).resolves.toEqual(['a'])
  })
})
