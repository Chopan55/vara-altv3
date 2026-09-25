/**
 * Persistencia de candidatos.
 *
 * Lo que se protege acá: que nadie pierda una propiedad. El modelo viejo
 * guardaba una sola (`vara_imported_property`); al pasar a una lista, lo que
 * la persona ya tenía cargado tiene que aparecer, aparecer **una sola vez**, y
 * la clave vieja tiene que seguir intacta por si algo sale mal.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// localStorage de mentira, pero con la semántica real: solo strings.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

const store = new MemStorage()
;(globalThis as unknown as { localStorage: MemStorage }).localStorage = store

const {
  loadCandidates, addCandidate, setCandidateStatus, setCandidateNotes,
  markPromoted, removeCandidate, toCandidate,
} = await import('@/lib/candidates/store')

const { IMPORTED_KEY } = await import('@/lib/userProperties')

function seedLegacyImported() {
  store.setItem(IMPORTED_KEY, JSON.stringify({
    url: 'https://portal.test/aviso/1',
    portal: 'zonaprop',
    importedAt: 1_700_000_000_000,
    photos: [],
    data: { title: 'Casa en Pilar', price: 180000, totalM2: 120, rooms: 4, bedrooms: 3 },
  }))
}

function newProperty(over: Record<string, unknown> = {}) {
  return {
    id: 'x', type: 'HOUSE', operationType: 'sale', price: 150_000, currency: 'USD',
    title: 'Casa nueva', address: 'Calle 2', neighborhood: 'Centro', city: 'Pilar',
    province: 'Buenos Aires', surface: 90, rooms: 3, bedrooms: 2, bathrooms: 1,
    garage: false, description: '', images: [], features: [],
    source: 'imported' as const, incompleteFields: [],
    ...over,
  } as Parameters<typeof addCandidate>[0]
}

beforeEach(() => { store.clear() })

describe('adopción de la propiedad vieja', () => {
  it('la propiedad única que ya existía aparece en la lista', async () => {
    seedLegacyImported()
    const list = await loadCandidates()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Casa en Pilar')
    expect(list[0].status).toBe('ANALYZING')
  })

  it('conserva la fecha original de importación, no la de hoy', async () => {
    seedLegacyImported()
    const [c] = await loadCandidates()
    expect(c.addedAt).toBe(1_700_000_000_000)
  })

  it('NO la duplica al volver a leer', async () => {
    seedLegacyImported()
    await loadCandidates()
    const second = await loadCandidates()
    expect(second).toHaveLength(1)
  })

  it('no borra la clave vieja: si algo falla, el dato sigue ahí', async () => {
    seedLegacyImported()
    await loadCandidates()
    expect(store.getItem(IMPORTED_KEY)).not.toBeNull()
  })

  it('sin nada cargado, la lista arranca vacía', async () => {
    expect(await loadCandidates()).toEqual([])
  })
})

describe('alta', () => {
  it('agregar no pisa lo que ya estaba', async () => {
    seedLegacyImported()
    await addCandidate(newProperty())
    const list = await loadCandidates()
    expect(list).toHaveLength(2)
    expect(list.map(c => c.title)).toContain('Casa en Pilar')
  })

  it('cada candidato recibe su propio id', async () => {
    await addCandidate(newProperty({ title: 'A' }))
    await addCandidate(newProperty({ title: 'B' }))
    const ids = (await loadCandidates()).map(c => c.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('cambios de estado', () => {
  it('descartar guarda el motivo', async () => {
    const c = await addCandidate(newProperty())
    const r = await setCandidateStatus(c!.id, 'DISCARDED', { discardReason: 'Muy lejos' })
    expect(r.ok).toBe(true)
    expect(r.candidate?.discardReason).toBe('Muy lejos')
  })

  it('recuperarla limpia el motivo del descarte', async () => {
    const c = await addCandidate(newProperty())
    await setCandidateStatus(c!.id, 'DISCARDED', { discardReason: 'Muy lejos' })
    const r = await setCandidateStatus(c!.id, 'FAVORITE')
    expect(r.ok).toBe(true)
    expect(r.candidate?.discardReason).toBeUndefined()
  })

  it('una transición prohibida falla y explica por qué', async () => {
    const c = await addCandidate(newProperty())
    await markPromoted(c!.id, 'op-1')
    const r = await setCandidateStatus(c!.id, 'DISCARDED')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/operación/i)
  })

  it('una propiedad inexistente no explota', async () => {
    const r = await setCandidateStatus('no-existe', 'FAVORITE')
    expect(r.ok).toBe(false)
  })
})

describe('promoción', () => {
  it('conserva TODO el contexto previo', async () => {
    const c = await addCandidate(newProperty())
    await setCandidateNotes(c!.id, 'Hablé con la dueña, acepta oferta')
    await setCandidateStatus(c!.id, 'VISITED')

    const r = await markPromoted(c!.id, 'op-42')
    expect(r.ok).toBe(true)
    expect(r.candidate?.userNotes).toBe('Hablé con la dueña, acepta oferta')
    expect(r.candidate?.promotedOperationId).toBe('op-42')
    expect(r.candidate?.addedAt).toBe(c!.addedAt)
  })

  it('no se promueve dos veces', async () => {
    const c = await addCandidate(newProperty())
    await markPromoted(c!.id, 'op-1')
    const again = await markPromoted(c!.id, 'op-2')
    expect(again.ok).toBe(false)
  })

  it('una descartada hay que recuperarla antes de avanzar', async () => {
    const c = await addCandidate(newProperty())
    await setCandidateStatus(c!.id, 'DISCARDED')
    const r = await markPromoted(c!.id, 'op-1')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/recuperala/i)
  })
})

describe('borrado', () => {
  it('saca solo la que se pidió', async () => {
    const a = await addCandidate(newProperty({ title: 'A' }))
    await addCandidate(newProperty({ title: 'B' }))
    expect(await removeCandidate(a!.id)).toBe(true)
    const list = await loadCandidates()
    expect(list.map(c => c.title)).toEqual(['B'])
  })

  it('borrar algo que no existe devuelve false', async () => {
    expect(await removeCandidate('no-existe')).toBe(false)
  })
})

describe('toCandidate', () => {
  it('una propiedad nueva arranca en análisis', () => {
    expect(toCandidate(newProperty()).status).toBe('ANALYZING')
  })
})
