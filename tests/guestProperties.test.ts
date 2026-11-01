/**
 * GUEST PROPERTY MIGRATION — una propiedad/candidato creado o importado como invitado se conserva al crear
 * cuenta o iniciar sesión, igual que las operaciones: mismo id cuando se puede, sin duplicados, con el vínculo
 * operación ↔ propiedad, sin bandera global y conservando lo local si una subida falla.
 * Supabase se simula con una nube en memoria (RLS por usuario y clave foránea operación → propiedad).
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface PropRow { id: string; userId: string; sourceUrl?: string; title: string; source: 'imported' | 'draft'; status: string; userNotes?: string; discardReason?: string; promotedOperationId?: string; promotedAt?: number }
interface OpRow { id: string; userId: string; propertyId?: string; op: Record<string, unknown> }

const cloud = vi.hoisted(() => ({
  session: null as string | null,
  props: [] as Record<string, unknown>[],
  ops: [] as Record<string, unknown>[],
  propInserts: 0,
  opInserts: 0,
  failProp: 0,
  failOp: 0,
}))
const props = () => cloud.props as unknown as PropRow[]
const ops = () => cloud.ops as unknown as OpRow[]
const mine = <T extends { userId: string }>(rows: T[]) => rows.filter(r => r.userId === cloud.session)

const toUserProperty = (r: PropRow) => ({
  id: r.id, type: 'HOUSE', operationType: 'sale', price: 100000, currency: 'USD', title: r.title, address: '', neighborhood: '', city: '', province: '',
  surface: 100, rooms: 3, bedrooms: 2, bathrooms: 1, garage: false, description: '', images: [], features: [], incompleteFields: [],
  source: r.source, sourceUrl: r.sourceUrl, portal: null,
})
const toCandidate = (r: PropRow) => ({ ...toUserProperty(r), status: r.status, userNotes: r.userNotes, discardReason: r.discardReason, promotedOperationId: r.promotedOperationId, promotedAt: r.promotedAt, addedAt: 1 })

vi.mock('@/lib/supabase/properties', async () => {
  const { isUuid } = await import('@/lib/operationIds')
  return {
    hasSession: async () => cloud.session !== null,
    fetchUserProperties: async () => mine(props()).map(toUserProperty),
    fetchUserPropertyById: async (id: string) => {
      const r = mine(props()).find(p => p.id === id)
      return r ? toUserProperty(r) : null
    },
    insertProperty: async (input: { id?: string; sourceUrl?: string | null; title?: string; source: 'IMPORTED' | 'MANUAL' }) => {
      cloud.propInserts++
      if (cloud.failProp > 0) { cloud.failProp--; return null }
      if (!cloud.session) return null
      if (isUuid(input.id)) {
        const existing = props().find(p => p.id === input.id)
        if (existing) return existing.userId === cloud.session ? existing.id : null // 23505 + RLS
      }
      const id = isUuid(input.id) ? input.id : globalThis.crypto.randomUUID()
      cloud.props.push({ id, userId: cloud.session, sourceUrl: input.sourceUrl ?? undefined, title: input.title ?? '', source: input.source === 'IMPORTED' ? 'imported' : 'draft', status: 'ANALYZING' })
      return id
    },
  }
})

vi.mock('@/lib/supabase/candidates', () => ({
  hasSession: async () => cloud.session !== null,
  fetchCandidates: async () => mine(props()).map(toCandidate),
  insertCandidate: async () => null,
  deleteCandidate: async () => true,
  updateCandidate: async (id: string, patch: Partial<PropRow> & { status?: string }) => {
    const row = mine(props()).find(p => p.id === id)
    if (!row) return null
    // Clave foránea promoted_operation_id → operations(id): la operación tiene que existir en la cuenta.
    if (patch.promotedOperationId && !mine(ops()).some(o => o.id === patch.promotedOperationId)) return null
    Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
    return toCandidate(row)
  },
}))

vi.mock('@/lib/supabase/operations', async () => {
  const { isUuid } = await import('@/lib/operationIds')
  return {
    fetchOperations: async () => mine(ops()).map(o => ({ ...o.op, id: o.id, propertyId: o.propertyId })),
    insertOperation: async (op: { id: string; propertyId?: string }) => {
      cloud.opInserts++
      if (cloud.failOp > 0) { cloud.failOp--; return null }
      if (!cloud.session) return null
      // Igual que el insertOperation real: property_id solo si es UUID; si apunta a una propiedad que no existe, la base lo rechaza (FK).
      const propertyId = isUuid(op.propertyId) ? op.propertyId : undefined
      if (propertyId && !mine(props()).some(p => p.id === propertyId)) return null
      if (isUuid(op.id)) {
        const existing = ops().find(o => o.id === op.id)
        if (existing) return existing.userId === cloud.session ? existing.id : null
      }
      const id = isUuid(op.id) ? op.id : globalThis.crypto.randomUUID()
      cloud.ops.push({ id, userId: cloud.session, propertyId, op: { ...op } })
      return id
    },
  }
})

import { addCandidate, loadCandidates, promoteCandidate, setCandidateNotes, setCandidateStatus } from '@/lib/candidates/store'
import { isUuid } from '@/lib/operationIds'
import { loadOperations, OPERATIONS_KEY, createOperationAnywhere } from '@/lib/userOperations'
import {
  IMPORTED_LIST_KEY, collectGuestProperties, getUserProperties, loadUserPropertyById, loadUserProperties, mapPropertyId, migratePropertiesToSupabase,
  type UserProperty,
} from '@/lib/userProperties'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const U = (n: number) => `https://www.zonaprop.com.ar/propiedades/casa-${n}.html`
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const jsonKey = <T>(k: string): T | null => { try { return JSON.parse(store.get(k) ?? 'null') as T } catch { return null } }
const remoteOf = (user: string) => props().filter(p => p.userId === user)

/** Una propiedad importada como invitado (formato de `vara_imported_properties`). */
function seedImported(url: string, importedAt: number): void {
  const list = jsonKey<unknown[]>(IMPORTED_LIST_KEY) ?? []
  list.push({ url, portal: 'zonaprop', data: { title: `Casa ${importedAt}`, price: 100000, currency: 'USD', totalM2: 100, rooms: 3 }, photos: [], importedAt })
  store.set(IMPORTED_LIST_KEY, JSON.stringify(list))
}

/** Un candidato con id viejo (`cand_…`) como los que ya existen en navegadores de usuarios actuales. */
function seedLegacyCandidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  const c = {
    id: 'cand_lq1x2y_ab12cd', type: 'HOUSE', operationType: 'sale', price: 90000, currency: 'USD', title: 'Casa vieja', address: '', neighborhood: '', city: '', province: '',
    surface: 80, rooms: 3, bedrooms: 2, bathrooms: 1, garage: false, description: '', images: [], features: [], incompleteFields: [],
    source: 'imported', sourceUrl: U(900), portal: 'zonaprop', status: 'ANALYZING', addedAt: 1, ...over,
  }
  const list = jsonKey<unknown[]>('vara_candidates') ?? []
  store.set('vara_candidates', JSON.stringify([...list, c]))
  return c
}

const aProperty = (over: Partial<UserProperty> = {}): UserProperty => ({
  id: 'x', type: 'HOUSE', operationType: 'sale', price: 120000, currency: 'USD', title: 'Casa del invitado', address: 'Calle 1', neighborhood: 'Palermo', city: 'CABA', province: 'Ciudad de Buenos Aires',
  surface: 90, rooms: 3, bedrooms: 2, bathrooms: 1, garage: false, description: '', images: [], features: [], source: 'imported', sourceUrl: U(1), portal: 'zonaprop', incompleteFields: [], ...over,
} as UserProperty)

beforeEach(() => {
  store.clear()
  Object.assign(cloud, { session: null, props: [], ops: [], propInserts: 0, opInserts: 0, failProp: 0, failOp: 0 })
})

describe('guest crea propiedad → crea cuenta → la propiedad sigue', () => {
  it('una propiedad importada como invitado pasa a la cuenta y sale del navegador', async () => {
    seedImported(U(1), 1760000000001)
    expect((await loadUserProperties()).map(p => p.sourceUrl)).toEqual([U(1)]) // invitado: la ve en el navegador
    expect(cloud.propInserts).toBe(0)

    cloud.session = 'u1' // crea la cuenta y entra
    const shown = await loadUserProperties()

    expect(shown.map(p => p.sourceUrl)).toEqual([U(1)])
    expect(remoteOf('u1')).toHaveLength(1)
    expect(remoteOf('u1')[0].source).toBe('imported')
    expect(store.get(IMPORTED_LIST_KEY)).toBeUndefined() // ya vive en la cuenta
    expect(getUserProperties()).toEqual([])
  })

  it('un candidato creado como invitado conserva el MISMO id, su estado y sus notas', async () => {
    const c = await addCandidate(aProperty())
    expect(c && isUuid(c.id)).toBe(true)
    await setCandidateStatus(c!.id, 'FAVORITE')
    await setCandidateNotes(c!.id, 'Hablar con el dueño')

    cloud.session = 'u1'
    const list = await loadCandidates()

    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(c!.id)
    expect(list[0].status).toBe('FAVORITE')
    expect(list[0].userNotes).toBe('Hablar con el dueño')
    expect(remoteOf('u1').map(p => p.id)).toEqual([c!.id])
    expect(jsonKey<unknown[]>('vara_candidates')).toEqual([])
  })

  it('un candidato viejo (`cand_…`) recibe id nuevo, y el id viejo sigue funcionando para abrir la ficha', async () => {
    seedLegacyCandidate({ status: 'DISCARDED', discardReason: 'Muy cara' })
    cloud.session = 'u1'
    const [c] = await loadCandidates()

    expect(isUuid(c.id)).toBe(true)
    expect(c.id).not.toBe('cand_lq1x2y_ab12cd')
    expect(c.status).toBe('DISCARDED')
    expect(c.discardReason).toBe('Muy cara')
    expect(mapPropertyId('cand_lq1x2y_ab12cd')).toBe(c.id)
    expect((await loadUserPropertyById('cand_lq1x2y_ab12cd'))?.id).toBe(c.id) // un link viejo no se rompe
  })

  it('un importado y su copia como candidato (misma URL) son UNA sola propiedad en la cuenta', async () => {
    seedImported(U(5), 1760000000005)
    await loadCandidates() // como invitado adopta el importado como candidato
    expect(jsonKey<unknown[]>('vara_candidates')).toHaveLength(1)

    cloud.session = 'u1'
    await loadCandidates()
    await loadUserProperties()

    expect(remoteOf('u1')).toHaveLength(1)
    expect(cloud.propInserts).toBe(1)
    expect(jsonKey<unknown[]>('vara_candidates')).toEqual([])
    expect(store.get(IMPORTED_LIST_KEY)).toBeUndefined()
  })

  it('el borrador de publicación (un formulario en curso, sin identidad) no se sube ni se borra', async () => {
    store.set('vara_publish_draft', JSON.stringify({ title: 'Mi casa en venta', price: '150000', address: 'Calle 5' }))
    cloud.session = 'u1'
    await loadUserProperties()
    expect(cloud.propInserts).toBe(0)
    expect(collectGuestProperties()).toEqual([])
    expect(store.get('vara_publish_draft')).toContain('Mi casa en venta')
  })
})

describe('la operación mantiene su propertyId', () => {
  it('candidato nuevo promovido a operación: la operación sigue apuntando a la propiedad y la propiedad a la operación', async () => {
    const c = await addCandidate(aProperty({ province: 'Ciudad de Buenos Aires' }))
    const promoted = await promoteCandidate(c!.id)
    expect(promoted.ok).toBe(true)
    const opId = promoted.candidate!.promotedOperationId!

    cloud.session = 'u1'
    const shown = await loadOperations()

    expect(shown.map(o => o.id)).toEqual([opId])
    expect(shown[0].propertyId).toBe(c!.id) // mismo id: el vínculo no cambió
    expect(ops()[0].propertyId).toBe(c!.id)
    const prop = remoteOf('u1')[0]
    expect(prop.id).toBe(c!.id)
    expect(prop.status).toBe('PROMOTED')
    expect(prop.promotedOperationId).toBe(opId) // vuelta: candidato → operación
    expect(jsonKey<unknown[]>(OPERATIONS_KEY)).toEqual([])
  })

  it('con ids viejos (`cand_…` y `op-…`) la operación apunta al id NUEVO de la propiedad', async () => {
    seedLegacyCandidate({ status: 'PROMOTED', promotedOperationId: 'op-1760000000000-abc12', promotedAt: 5 })
    store.set(OPERATIONS_KEY, JSON.stringify([{
      id: 'op-1760000000000-abc12', type: 'BUY', title: 'Mi compra', status: 'ACTIVE', province: 'Córdoba', provinceCode: 'CBA', city: '', propertyId: 'cand_lq1x2y_ab12cd', progress: 0, createdAt: 1760000000000,
    }]))
    cloud.session = 'u1'

    const shown = await loadOperations()
    const prop = remoteOf('u1')[0]
    const op = ops()[0]

    expect(isUuid(prop.id)).toBe(true)
    expect(shown).toHaveLength(1)
    expect(op.propertyId).toBe(prop.id) // antes de este cambio esto se subía como null
    expect(shown[0].propertyId).toBe(prop.id)
    expect(prop.promotedOperationId).toBe(op.id)
    expect(jsonKey<unknown[]>(OPERATIONS_KEY)).toEqual([])
  })

  it('si la propiedad no se pudo subir, la operación espera: no se sube sin su vínculo; al reintentar, suben juntas', async () => {
    const c = await addCandidate(aProperty())
    const { candidate } = await promoteCandidate(c!.id)
    cloud.session = 'u1'
    cloud.failProp = 1

    const first = await loadOperations()
    expect(first.map(o => o.id)).toEqual([candidate!.promotedOperationId]) // sigue visible (pendiente)
    expect(ops()).toHaveLength(0) // no se subió sin su propiedad
    expect(cloud.opInserts).toBe(0)
    expect(remoteOf('u1')).toHaveLength(0)

    const second = await loadOperations()
    expect(second).toHaveLength(1)
    expect(remoteOf('u1').map(p => p.id)).toEqual([c!.id])
    expect(ops()[0].propertyId).toBe(c!.id)
    expect(remoteOf('u1')[0].promotedOperationId).toBe(ops()[0].id)
  })

  it('una operación que apunta a una propiedad que ya no existe en el navegador no queda bloqueada', async () => {
    const op = await createOperationAnywhere({ type: 'BUY', province: 'Córdoba', provinceCode: 'CBA', propertyId: 'imported-123' })
    cloud.session = 'u1'
    expect((await loadOperations()).map(o => o.id)).toEqual([op.id])
    expect(ops()).toHaveLength(1)
  })
})

describe('cuenta existente + propiedad de invitado', () => {
  it('suma lo del invitado sin duplicar lo que la cuenta ya tenía (misma URL) ni pisar su estado', async () => {
    props().push({ id: globalThis.crypto.randomUUID(), userId: 'u1', sourceUrl: U(1), title: 'Ya en la cuenta', source: 'imported', status: 'FAVORITE', userNotes: 'nota de la cuenta' } as never)
    props().push({ id: globalThis.crypto.randomUUID(), userId: 'u1', sourceUrl: U(2), title: 'Otra de la cuenta', source: 'imported', status: 'ANALYZING' } as never)
    const [existing] = remoteOf('u1')

    seedLegacyCandidate({ id: 'cand_dup', sourceUrl: U(1), status: 'DISCARDED' }) // la misma propiedad que ya tiene la cuenta
    seedLegacyCandidate({ id: 'cand_nueva', sourceUrl: U(3), title: 'Nueva del invitado' })
    cloud.session = 'u1'

    const list = await loadCandidates()

    expect(list).toHaveLength(3)
    expect(remoteOf('u1')).toHaveLength(3)
    expect(cloud.propInserts).toBe(1) // solo la nueva
    const kept = remoteOf('u1').find(p => p.id === existing.id)!
    expect(kept.status).toBe('FAVORITE') // lo de la cuenta manda
    expect(kept.userNotes).toBe('nota de la cuenta')
    expect(mapPropertyId('cand_dup')).toBe(existing.id) // la operación que apuntaba al duplicado apunta a la existente
    expect(jsonKey<unknown[]>('vara_candidates')).toEqual([])
  })

  it('una cuenta sin nada de invitado no sube nada', async () => {
    props().push({ id: globalThis.crypto.randomUUID(), userId: 'u1', sourceUrl: U(1), title: 'De la cuenta', source: 'imported', status: 'ANALYZING' } as never)
    cloud.session = 'u1'
    expect(await loadUserProperties()).toHaveLength(1)
    expect(cloud.propInserts).toBe(0)
  })
})

describe('dos cargas simultáneas no duplican', () => {
  it('varios componentes pidiendo propiedades y operaciones a la vez suben cada cosa una vez', async () => {
    seedImported(U(1), 1760000000001)
    seedImported(U(2), 1760000000002)
    const c = await addCandidate(aProperty({ sourceUrl: U(3) }))
    await promoteCandidate(c!.id)
    cloud.session = 'u1'

    const results = await Promise.all([loadUserProperties(), loadUserProperties(), loadUserProperties(), loadOperations(), loadOperations(), migratePropertiesToSupabase()])

    expect(remoteOf('u1')).toHaveLength(3)
    expect(cloud.propInserts).toBe(3)
    expect(cloud.opInserts).toBe(1)
    expect(ops()).toHaveLength(1)
    for (const shown of results.slice(0, 3)) expect(shown as unknown[]).toHaveLength(3)
    // Cargas posteriores tampoco vuelven a subir nada
    await loadUserProperties()
    await loadCandidates()
    await loadOperations()
    expect(cloud.propInserts).toBe(3)
    expect(cloud.opInserts).toBe(1)
  })
})

describe('si falla una subida, lo local se conserva y se reintenta', () => {
  it('la propiedad sigue visible (pendiente) y se sube en la próxima carga sin duplicarse', async () => {
    seedImported(U(1), 1760000000001)
    seedImported(U(2), 1760000000002)
    cloud.session = 'u1'
    cloud.failProp = 1 // falla la primera subida, la segunda sale bien

    const first = await loadUserProperties()
    expect(first).toHaveLength(2) // ninguna desaparece de la pantalla
    expect(remoteOf('u1')).toHaveLength(1)
    expect(collectGuestProperties()).toHaveLength(1) // la que falló sigue en el navegador

    const second = await loadUserProperties()
    expect(second).toHaveLength(2)
    expect(remoteOf('u1')).toHaveLength(2)
    expect(collectGuestProperties()).toEqual([])
    expect(new Set(remoteOf('u1').map(p => p.sourceUrl)).size).toBe(2) // sin duplicados
  })

  it('un candidato pendiente también se sigue mostrando en la lista de candidatos', async () => {
    const c = await addCandidate(aProperty())
    cloud.session = 'u1'
    cloud.failProp = 1
    expect((await loadCandidates()).map(x => x.id)).toEqual([c!.id])
    expect(remoteOf('u1')).toHaveLength(0)
    expect((await loadCandidates()).map(x => x.id)).toEqual([c!.id])
    expect(remoteOf('u1').map(p => p.id)).toEqual([c!.id])
  })

  it('un corte entre "subió" y "limpió el navegador" no la duplica al reintentar', async () => {
    seedLegacyCandidate({ id: 'cand_corte', sourceUrl: undefined, title: 'Sin URL' })
    const remoteId = globalThis.crypto.randomUUID()
    props().push({ id: remoteId, userId: 'u1', title: 'Sin URL', source: 'imported', status: 'ANALYZING' } as never) // ya estaba arriba…
    store.set('vara_props_idmap', JSON.stringify({ cand_corte: remoteId })) // …y quedó registrada, pero la copia local sigue
    cloud.session = 'u1'

    await loadCandidates()

    expect(cloud.propInserts).toBe(0)
    expect(remoteOf('u1')).toHaveLength(1)
    expect(jsonKey<unknown[]>('vara_candidates')).toEqual([])
  })
})

describe('no se pierde una propiedad local', () => {
  it('sin sesión no se toca nada', async () => {
    seedImported(U(1), 1760000000001)
    const c = await addCandidate(aProperty({ sourceUrl: U(2) }))
    expect(await loadUserProperties()).toHaveLength(1) // las propiedades importadas
    expect((await loadCandidates()).map(x => x.sourceUrl).sort()).toEqual([U(1), U(2)]) // el importado adoptado + el candidato
    expect(cloud.propInserts).toBe(0)
    expect(collectGuestProperties().map(g => g.localId)).toContain(c!.id)
    expect(collectGuestProperties()).toHaveLength(2)
  })

  it('si la nube falla una y otra vez, la propiedad sigue en el navegador cada vez', async () => {
    seedImported(U(1), 1760000000001)
    cloud.session = 'u1'
    cloud.failProp = 3
    for (let i = 0; i < 3; i++) {
      expect(await loadUserProperties()).toHaveLength(1)
      expect(collectGuestProperties()).toHaveLength(1)
    }
    expect(remoteOf('u1')).toHaveLength(0)
    expect(await loadUserProperties()).toHaveLength(1)
    expect(remoteOf('u1')).toHaveLength(1)
  })
})

describe('sin bandera global que bloquee futuras migraciones', () => {
  it('después de migrar, una propiedad nueva del invitado también migra (incluso a otra cuenta)', async () => {
    seedImported(U(1), 1760000000001)
    cloud.session = 'u1'
    await loadUserProperties()
    expect(remoteOf('u1')).toHaveLength(1)

    // Cierra sesión (se limpia el navegador como hace AppShell), un nuevo invitado importa otra y entra a otra cuenta.
    store.clear()
    cloud.session = null
    seedImported(U(2), 1760000000002)
    cloud.session = 'u2'
    await loadUserProperties()
    expect(remoteOf('u2').map(p => p.sourceUrl)).toEqual([U(2)])
    expect(remoteOf('u1')).toHaveLength(1)
  })

  it('el código ya no usa la bandera global, y el cierre de sesión limpia los mapas de ids', () => {
    expect(read('src/lib/userProperties.ts')).not.toContain('vara_migrated_to_supabase')
    expect([...store.keys()]).not.toContain('vara_migrated_to_supabase')
    const shell = read('src/components/layout/AppShell.tsx')
    for (const key of ['vara_ops_idmap', 'vara_props_idmap', 'vara_props_promo_links']) expect(shell).toContain(`'${key}'`)
  })
})
