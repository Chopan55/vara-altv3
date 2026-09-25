/**
 * Documentos.
 *
 * Lo que se protege acá: que el rechazo de un archivo explique qué hacer, y
 * que la lista priorice lo que de verdad frena la operación. Un usuario que
 * ve "error al subir" y nada más abandona; uno que lee "pesa 22 MB, el máximo
 * son 15" sabe exactamente cuál es el próximo paso.
 */

import { describe, it, expect } from 'vitest'
import {
  checkFile, canTransitionDocument, sortDocuments, summarize,
  blockingDocuments, pendingDocuments, hasFile, isCriticalCategory,
  MAX_FILE_BYTES,
  type OperationDocument, type DocumentStatus,
} from '@/lib/documents/model'

function doc(over: Partial<OperationDocument> = {}): OperationDocument {
  return {
    id: 'd-1', operationId: 'op-1', name: 'Escritura.pdf',
    category: 'ESCRITURA', status: 'PENDING', version: 1,
    createdAt: 1_700_000_000_000,
    ...over,
  }
}

function file(over: Partial<{ name: string; type: string; size: number }> = {}) {
  return { name: 'informe.pdf', type: 'application/pdf', size: 1024 * 500, ...over }
}

describe('qué archivo se acepta', () => {
  it('un PDF normal pasa', () => {
    expect(checkFile(file()).ok).toBe(true)
  })

  it('una foto del documento también', () => {
    for (const [name, type] of [
      ['escritura.jpg', 'image/jpeg'],
      ['plano.png', 'image/png'],
      ['frente.webp', 'image/webp'],
      ['doc.heic', 'image/heic'],
    ]) {
      expect(checkFile(file({ name, type })).ok).toBe(true)
    }
  })

  it('un archivo vacío se rechaza', () => {
    expect(checkFile(file({ size: 0 })).ok).toBe(false)
  })

  it('el rechazo por tamaño dice cuánto pesa y cuál es el límite', () => {
    const r = checkFile(file({ size: 22 * 1024 * 1024 }))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/22\.0 MB/)
    expect(r.error).toMatch(/15 MB/)
  })

  it('el rechazo por tipo dice qué SÍ se puede subir', () => {
    const r = checkFile(file({ name: 'contrato.docx', type: 'application/msword' }))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/PDF/)
  })

  it('justo en el límite entra', () => {
    expect(checkFile(file({ size: MAX_FILE_BYTES })).ok).toBe(true)
  })

  it('si el navegador no declara tipo, decide la extensión', () => {
    expect(checkFile(file({ name: 'escaneo.pdf', type: '' })).ok).toBe(true)
    expect(checkFile(file({ name: 'algo.exe', type: '' })).ok).toBe(false)
  })

  it('un archivo sin extensión ni tipo se rechaza', () => {
    expect(checkFile(file({ name: 'documento', type: '' })).ok).toBe(false)
  })

  it('la extensión en mayúsculas también vale', () => {
    expect(checkFile(file({ name: 'ESCRITURA.PDF', type: '' })).ok).toBe(true)
  })
})

describe('estados', () => {
  it('un documento pedido solo puede pasar a recibido', () => {
    expect(canTransitionDocument('PENDING', 'RECEIVED')).toBe(true)
    expect(canTransitionDocument('PENDING', 'APPROVED')).toBe(false)
  })

  it('uno rechazado se puede volver a subir', () => {
    // Es exactamente lo que hace alguien cuando le dicen que el informe está viejo.
    expect(canTransitionDocument('REJECTED', 'RECEIVED')).toBe(true)
    expect(canTransitionDocument('EXPIRED', 'RECEIVED')).toBe(true)
  })

  it('uno aprobado puede vencer', () => {
    expect(canTransitionDocument('APPROVED', 'EXPIRED')).toBe(true)
  })

  it('nunca se vuelve a "falta subirlo" con el archivo ya cargado', () => {
    for (const from of ['RECEIVED', 'APPROVED', 'REJECTED', 'EXPIRED', 'IN_REVIEW'] as DocumentStatus[]) {
      expect(canTransitionDocument(from, 'PENDING')).toBe(false)
    }
  })
})

describe('qué hay y qué falta', () => {
  it('sin storagePath no hay archivo', () => {
    expect(hasFile(doc())).toBe(false)
    expect(hasFile(doc({ storagePath: 'u-1/d-1.pdf' }))).toBe(true)
    expect(hasFile(doc({ storagePath: '' }))).toBe(false)
  })

  it('los pendientes incluyen rechazados y vencidos', () => {
    const list = [
      doc({ id: '1', status: 'PENDING' }),
      doc({ id: '2', status: 'REJECTED' }),
      doc({ id: '3', status: 'EXPIRED' }),
      doc({ id: '4', status: 'APPROVED' }),
      doc({ id: '5', status: 'RECEIVED' }),
    ]
    expect(pendingDocuments(list).map(d => d.id)).toEqual(['1', '2', '3'])
  })

  it('solo bloquea lo crítico sin resolver', () => {
    const list = [
      doc({ id: 'esc', category: 'ESCRITURA', status: 'PENDING' }),
      doc({ id: 'exp', category: 'EXPENSAS', status: 'PENDING' }),
      doc({ id: 'inf', category: 'INFORMES', status: 'APPROVED' }),
    ]
    expect(blockingDocuments(list).map(d => d.id)).toEqual(['esc'])
  })

  it('las expensas no bloquean una compraventa', () => {
    expect(isCriticalCategory('EXPENSAS')).toBe(false)
    expect(isCriticalCategory('ESCRITURA')).toBe(true)
  })
})

describe('orden', () => {
  it('lo crítico va primero aunque esté más avanzado', () => {
    const list = [
      doc({ id: 'otro', category: 'OTROS', status: 'PENDING', name: 'Otro' }),
      doc({ id: 'esc', category: 'ESCRITURA', status: 'RECEIVED', name: 'Escritura' }),
    ]
    expect(sortDocuments(list)[0].id).toBe('esc')
  })

  it('dentro de lo crítico, primero lo rechazado', () => {
    const list = [
      doc({ id: 'ok', category: 'ESCRITURA', status: 'APPROVED', name: 'A' }),
      doc({ id: 'bad', category: 'ESCRITURA', status: 'REJECTED', name: 'B' }),
      doc({ id: 'pend', category: 'ESCRITURA', status: 'PENDING', name: 'C' }),
    ]
    expect(sortDocuments(list).map(d => d.id)).toEqual(['bad', 'pend', 'ok'])
  })

  it('no muta la lista original', () => {
    const list = [
      doc({ id: 'a', category: 'OTROS' }),
      doc({ id: 'b', category: 'ESCRITURA' }),
    ]
    sortDocuments(list)
    expect(list.map(d => d.id)).toEqual(['a', 'b'])
  })
})

describe('resumen', () => {
  it('cuenta lo pedido, no lo subido', () => {
    // La diferencia entre total y uploaded ES la deuda: no la escondemos.
    const list = [
      doc({ id: '1', storagePath: 'u/1.pdf', status: 'APPROVED' }),
      doc({ id: '2', status: 'PENDING' }),
      doc({ id: '3', status: 'PENDING', category: 'EXPENSAS' }),
    ]
    expect(summarize(list)).toEqual({ total: 3, uploaded: 1, approved: 1, blocking: 1 })
  })

  it('sin documentos, todo en cero', () => {
    expect(summarize([])).toEqual({ total: 0, uploaded: 0, approved: 0, blocking: 0 })
  })
})
