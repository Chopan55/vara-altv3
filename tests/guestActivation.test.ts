/**
 * NEW USER ACTIVATION — guest → valor → cuenta.
 * El invitado crea su operación y ve el dashboard; al crear cuenta (o entrar a una existente) la operación
 * se conserva, se sube una sola vez y sin duplicados. Supabase se simula con una nube en memoria con la misma
 * semántica que usa la app (RLS por usuario, ids UUID conservados, duplicado de clave primaria).
 */
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const cloud = vi.hoisted(() => ({
  session: null as string | null,
  rows: [] as { userId: string; op: Record<string, unknown> }[],
  inserts: 0,
  failNext: 0,
}))

vi.mock('@/lib/supabase/properties', () => ({ hasSession: async () => cloud.session !== null }))
vi.mock('@/lib/supabase/operations', async () => {
  const { isUuid } = await import('@/lib/operationIds')
  return {
    fetchOperations: async () => cloud.rows.filter(r => r.userId === cloud.session).map(r => r.op),
    insertOperation: async (op: { id: string }) => {
      cloud.inserts++
      if (cloud.failNext > 0) { cloud.failNext--; return null }
      if (!cloud.session) return null
      if (isUuid(op.id)) {
        const existing = cloud.rows.find(r => r.op.id === op.id)
        if (existing) return existing.userId === cloud.session ? (existing.op.id as string) : null // 23505 + RLS
        cloud.rows.push({ userId: cloud.session, op: { ...op } })
        return op.id
      }
      const id = globalThis.crypto.randomUUID() // ids viejos (no UUID): la base asigna uno nuevo
      cloud.rows.push({ userId: cloud.session, op: { ...op, id } })
      return id
    },
  }
})

import { buildTransaction, setTaskState } from '@/lib/operationFromChecklist'
import { accountUrl, shouldInviteToSave } from '@/lib/auth/entryJourney'
import { isUuid } from '@/lib/operationIds'
import {
  OPERATIONS_KEY, createOperationAnywhere, getOperations, hasRealOperations, loadOperations, migrateOperationsToSupabase,
  type StoredOperation,
} from '@/lib/userOperations'

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const ONBOARDING_INPUT = { type: 'SELL' as const, province: 'Ciudad de Buenos Aires', provinceCode: 'CABA', title: 'Mi venta', country: 'AR' as const }
const remoteIds = (user: string) => cloud.rows.filter(r => r.userId === user).map(r => r.op.id as string)
const localIds = () => getOperations().map(o => o.id)
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** Una operación de las versiones anteriores: id con prefijo `op-`, que no es UUID. */
function seedLegacyLocal(id = 'op-1760000000000-abc12'): StoredOperation {
  const op: StoredOperation = { id, type: 'BUY', title: 'Mi compra', status: 'ACTIVE', province: 'Córdoba', provinceCode: 'CBA', city: '', progress: 0, createdAt: 1760000000000 }
  store.set(OPERATIONS_KEY, JSON.stringify([...getOperations(), op]))
  return op
}

// Vitest: si varios import() dinámicos de un módulo mockeado arrancan a la vez por primera vez, solo el primero recibe el mock
// (los demás reciben el módulo real). En el navegador los módulos se cachean sin esa carrera. Se precargan para probar la concurrencia de verdad.
beforeAll(async () => {
  await import('@/lib/supabase/properties')
  await import('@/lib/supabase/operations')
})

beforeEach(() => {
  store.clear()
  cloud.session = null
  cloud.rows = []
  cloud.inserts = 0
  cloud.failNext = 0
})

describe('guest crea operación → dashboard', () => {
  it('sin cuenta y sin sesión: la operación se crea en el navegador, con id UUID, y no toca la nube', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    expect(isUuid(op.id)).toBe(true)
    expect(cloud.inserts).toBe(0)
    expect(hasRealOperations()).toBe(true)
    expect(localIds()).toEqual([op.id])
  })

  it('el dashboard del invitado la carga y tiene etapas y tareas reales', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    const shown = await loadOperations()
    expect(shown.map(o => o.id)).toEqual([op.id])
    const txn = buildTransaction(shown[0])
    expect(txn.stages.length).toBeGreaterThan(0)
    expect(txn.stages.flatMap(s => s.tasks).length).toBeGreaterThan(0)
  })

  it('un invitado sin Supabase tampoco pierde nada: seguir sin cuenta funciona', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    expect((await loadOperations()).map(o => o.id)).toEqual([op.id])
    expect((await loadOperations()).map(o => o.id)).toEqual([op.id])
    expect(cloud.inserts).toBe(0)
  })
})

describe('guest crea cuenta → la operación sigue existiendo', () => {
  it('con confirmación de mail pendiente (todavía sin sesión) la operación sigue intacta en este navegador', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    // signUp respondió "revisá tu mail": no hay sesión hasta confirmar
    expect((await loadOperations()).map(o => o.id)).toEqual([op.id])
    // Aun si algo llamara a la migración, sin sesión no sube nada (insertOperation devuelve null) y la copia local se conserva.
    expect(await migrateOperationsToSupabase()).toBe(0)
    expect(remoteIds('u1')).toEqual([])
    expect(localIds()).toEqual([op.id])
  })

  it('al confirmar y entrar, se sube con el MISMO id y se conserva el estado de las tareas y la operación elegida', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    store.set('vara_operation_id', op.id)
    const firstTask = buildTransaction(op).stages[0].tasks[0]
    setTaskState(op.id, firstTask.id, 'DONE')
    const tasksBefore = store.get('vara_op_tasks_' + op.id)
    expect(tasksBefore).toBeTruthy()

    cloud.session = 'u1' // confirmó el mail y entró
    const shown = await loadOperations()

    expect(shown.map(o => o.id)).toEqual([op.id])
    expect(remoteIds('u1')).toEqual([op.id])
    expect(localIds()).toEqual([]) // ya vive en la cuenta
    expect(store.get('vara_operation_id')).toBe(op.id)
    expect(store.get('vara_op_tasks_' + op.id)).toBe(tasksBefore)
    expect(buildTransaction(shown[0]).stages[0].tasks[0].status).toBe('DONE')
  })

  it('si el signup trae sesión de inmediato (sin confirmar mail) pasa lo mismo en la primera carga', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    cloud.session = 'u1'
    expect((await loadOperations()).map(o => o.id)).toEqual([op.id])
    expect(remoteIds('u1')).toEqual([op.id])
  })

  it('con sesión, crear una operación nueva va directo a la cuenta, con el mismo id y sin copia local', async () => {
    cloud.session = 'u1'
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    expect(remoteIds('u1')).toEqual([op.id])
    expect(localIds()).toEqual([])
    expect((await loadOperations()).map(o => o.id)).toEqual([op.id])
  })
})

describe('la migración ocurre una sola vez', () => {
  it('varias cargas simultáneas (varios componentes pidiendo operaciones) suben cada operación una vez', async () => {
    const a = await createOperationAnywhere(ONBOARDING_INPUT)
    const b = await createOperationAnywhere({ ...ONBOARDING_INPUT, type: 'BUY', title: 'Mi compra' })
    cloud.session = 'u1'
    const results = await Promise.all([loadOperations(), loadOperations(), loadOperations(), migrateOperationsToSupabase()])
    for (const shown of results.slice(0, 3)) expect((shown as StoredOperation[]).map(o => o.id).sort()).toEqual([a.id, b.id].sort())
    expect(cloud.inserts).toBe(2)
    expect(remoteIds('u1').sort()).toEqual([a.id, b.id].sort())
  })

  it('cargas posteriores no vuelven a subir nada', async () => {
    await createOperationAnywhere(ONBOARDING_INPUT)
    cloud.session = 'u1'
    await loadOperations()
    const afterFirst = cloud.inserts
    await loadOperations()
    await loadOperations()
    expect(await migrateOperationsToSupabase()).toBe(0)
    expect(cloud.inserts).toBe(afterFirst)
  })
})

describe('sin duplicados', () => {
  it('una operación vieja (id no UUID) se sube una vez, recibe id nuevo y arrastra tareas y selección', async () => {
    const legacy = seedLegacyLocal()
    store.set('vara_operation_id', legacy.id)
    store.set('vara_op_tasks_' + legacy.id, '{"t1":"DONE"}')
    cloud.session = 'u1'

    const shown = await loadOperations()
    const [newId] = remoteIds('u1')
    expect(isUuid(newId)).toBe(true)
    expect(newId).not.toBe(legacy.id)
    expect(shown.map(o => o.id)).toEqual([newId])
    expect(localIds()).toEqual([])
    expect(store.get('vara_operation_id')).toBe(newId)
    expect(store.get('vara_op_tasks_' + newId)).toBe('{"t1":"DONE"}')
    expect(store.has('vara_op_tasks_' + legacy.id)).toBe(false)

    await loadOperations()
    expect(cloud.inserts).toBe(1)
    expect(remoteIds('u1')).toEqual([newId])
  })

  it('si se cortó después de subir y antes de limpiar el navegador, el reintento no la duplica', async () => {
    const legacy = seedLegacyLocal()
    store.set('vara_op_tasks_' + legacy.id, '{"t1":"DONE"}')
    cloud.session = 'u1'
    const remoteId = globalThis.crypto.randomUUID()
    cloud.rows.push({ userId: 'u1', op: { ...legacy, id: remoteId } }) // ya estaba arriba…
    store.set('vara_ops_idmap', JSON.stringify({ [legacy.id]: remoteId })) // …y quedó registrada, pero la copia local sigue

    const shown = await loadOperations()
    expect(cloud.inserts).toBe(0)
    expect(remoteIds('u1')).toEqual([remoteId])
    expect(shown.map(o => o.id)).toEqual([remoteId])
    expect(localIds()).toEqual([])
    expect(store.get('vara_op_tasks_' + remoteId)).toBe('{"t1":"DONE"}')
  })

  it('el mismo UUID subido dos veces no crea una segunda fila', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    cloud.session = 'u1'
    await loadOperations()
    store.set(OPERATIONS_KEY, JSON.stringify([op])) // vuelve a aparecer en el navegador (p. ej. restauración de storage)
    await loadOperations()
    expect(remoteIds('u1')).toEqual([op.id])
    expect(localIds()).toEqual([])
  })

  it('si la subida falla, la operación NO se pierde: sigue visible y se reintenta sin duplicar', async () => {
    const op = await createOperationAnywhere(ONBOARDING_INPUT)
    cloud.session = 'u1'
    cloud.failNext = 1
    const first = await loadOperations()
    expect(first.map(o => o.id)).toEqual([op.id]) // visible como pendiente
    expect(localIds()).toEqual([op.id])
    expect(remoteIds('u1')).toEqual([])

    const second = await loadOperations()
    expect(second.map(o => o.id)).toEqual([op.id])
    expect(remoteIds('u1')).toEqual([op.id])
    expect(localIds()).toEqual([])
  })
})

describe('login existente no pierde nada', () => {
  it('una cuenta con operaciones y un invitado con una nueva: quedan las dos, una vez cada una', async () => {
    cloud.rows.push({ userId: 'u1', op: { id: globalThis.crypto.randomUUID(), type: 'SELL', title: 'Venta de siempre', status: 'ACTIVE', province: 'Santa Fe', provinceCode: 'SF', city: '', progress: 0, createdAt: 1 } })
    const [existing] = remoteIds('u1')
    const guest = await createOperationAnywhere(ONBOARDING_INPUT)

    cloud.session = 'u1' // inicia sesión en la cuenta que ya tenía
    const shown = await loadOperations()

    expect(shown.map(o => o.id).sort()).toEqual([existing, guest.id].sort())
    expect(remoteIds('u1').sort()).toEqual([existing, guest.id].sort())
    expect(localIds()).toEqual([])
    await loadOperations()
    expect(cloud.inserts).toBe(1)
  })

  it('una cuenta con operaciones y sin nada de invitado: carga las remotas y no sube nada', async () => {
    cloud.rows.push({ userId: 'u1', op: { id: globalThis.crypto.randomUUID(), type: 'BUY', title: 'Mi compra', status: 'ACTIVE', province: 'Mendoza', provinceCode: 'MZA', city: '', progress: 0, createdAt: 2 } })
    cloud.session = 'u1'
    const shown = await loadOperations()
    expect(shown.map(o => o.id)).toEqual(remoteIds('u1'))
    expect(cloud.inserts).toBe(0)
  })

  it('otra persona que entra después en el mismo navegador ve solo lo suyo', async () => {
    await createOperationAnywhere(ONBOARDING_INPUT)
    cloud.session = 'u1'
    await loadOperations() // la operación del invitado pasó a la cuenta de u1 y salió del navegador
    cloud.rows.push({ userId: 'u2', op: { id: globalThis.crypto.randomUUID(), type: 'BUY', title: 'De u2', status: 'ACTIVE', province: 'Salta', provinceCode: 'SA', city: '', progress: 0, createdAt: 3 } })
    cloud.session = 'u2'
    const shown = await loadOperations()
    expect(shown.map(o => o.id)).toEqual(remoteIds('u2'))
    expect(remoteIds('u2')).toHaveLength(1)
  })
})

describe('invitación a crear cuenta', () => {
  const base = { accountsAvailable: true, signedIn: false, hasLocalOperations: true, dismissed: false }

  it('solo después del primer valor, sin cuenta y si no la descartó', () => {
    expect(shouldInviteToSave(base)).toBe(true)
    expect(shouldInviteToSave({ ...base, hasLocalOperations: false })).toBe(false) // nunca antes del primer valor
    expect(shouldInviteToSave({ ...base, signedIn: true })).toBe(false)
    expect(shouldInviteToSave({ ...base, dismissed: true })).toBe(false)
    expect(shouldInviteToSave({ ...base, accountsAvailable: false })).toBe(false)
  })

  it('el link abre "Crear cuenta" y vuelve al dashboard', () => {
    expect(accountUrl('/dashboard')).toBe('/login?mode=signup&next=%2Fdashboard')
    expect(accountUrl('https://evil.com')).toBe('/login?mode=signup&next=%2Fdashboard')
    expect(accountUrl('/dashboard', 'login')).toBe('/login?next=%2Fdashboard')
  })
})

describe('el invitado no se topa con un muro de registro', () => {
  const GUEST_PAGES = ['src/app/onboarding/page.tsx', 'src/app/dashboard/page.tsx', 'src/app/analizar/page.tsx', 'src/app/comparar/page.tsx', 'src/proxy.ts']

  it('onboarding, dashboard, analizar, comparar y el proxy no redirigen al login ni exigen sesión', () => {
    for (const f of GUEST_PAGES) {
      const src = read(f)
      expect(src, f).not.toMatch(/redirect\(\s*['"`]\/login/)
      expect(src, f).not.toMatch(/router\.(push|replace)\(\s*['"`]\/login/)
      expect(src, f).not.toMatch(/NextResponse\.redirect/)
    }
  })

  it('el onboarding crea la operación con createOperationAnywhere (invitado o con sesión) y no abre signup', () => {
    const src = read('src/app/onboarding/page.tsx')
    expect(src).toContain('createOperationAnywhere')
    expect(src).not.toMatch(/signUp|signInWith|AuthScreen/)
  })

  it('el login avisa que la operación sigue guardada mientras se confirma el mail, y acepta ?mode=signup', () => {
    const src = read('src/components/auth/AuthScreen.tsx')
    expect(src).toContain('Tu operación sigue guardada en este dispositivo')
    expect(src).toContain("params.get('mode') === 'signup'")
  })
})
