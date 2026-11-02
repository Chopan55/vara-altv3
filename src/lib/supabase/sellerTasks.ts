import { tryCreateClient } from './client'
import type { OperationTaskRow } from './types'

export interface SellerTaskDef {
  key: string
  title: string
  description: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

const SELLER_STAGE = 'SELLER_CHECKLIST'
const BUYER_STAGE  = 'BUYER_CHECKLIST'

export const SELLER_TASK_DEFS: SellerTaskDef[] = [
  { key: 'docs',      title: 'Reunir documentación del inmueble', description: 'Título, planos, impuestos al día',       priority: 'HIGH' },
  { key: 'price',     title: 'Definir precio de publicación',     description: 'Basado en comparables de la zona',      priority: 'HIGH' },
  { key: 'photos',    title: 'Fotos profesionales',               description: 'Al menos 12 fotos de buena calidad',    priority: 'MEDIUM' },
  { key: 'publish',   title: 'Publicar en portales',              description: 'Zonaprop, Argenprop, MercadoLibre',     priority: 'MEDIUM' },
  { key: 'visits',    title: 'Organizar visitas',                 description: 'Coordinar con potenciales compradores', priority: 'MEDIUM' },
  { key: 'offer',     title: 'Evaluar ofertas recibidas',         description: 'Reserva y boleto de compraventa',       priority: 'HIGH' },
  { key: 'escritura', title: 'Escriturar',                        description: 'Con escribano y comprador',             priority: 'HIGH' },
]

export const BUYER_TASK_DEFS: SellerTaskDef[] = [
  { key: 'financiamiento', title: 'Definir financiamiento',          description: 'Crédito hipotecario, ahorros o financiación privada', priority: 'HIGH' },
  { key: 'docs',           title: 'Documentación personal',          description: 'DNI, constancias de ingresos, CUIL',                  priority: 'HIGH' },
  { key: 'visitas',        title: 'Visitar propiedades',             description: 'Coordinar visitas con agente o vendedor',             priority: 'MEDIUM' },
  { key: 'oferta',         title: 'Hacer oferta',                    description: 'Oferta escrita con condiciones y plazos',             priority: 'HIGH' },
  { key: 'reserva',        title: 'Firmar reserva',                  description: 'Reserva económica para asegurar la operación',        priority: 'HIGH' },
  { key: 'boleto',         title: 'Firmar boleto de compraventa',    description: 'Con escribano: condiciones, monto, entrega',          priority: 'HIGH' },
  { key: 'escritura',      title: 'Escriturar',                      description: 'Acto de escrituración con el escribano',              priority: 'HIGH' },
]

export interface SellerTaskState {
  id: string
  key: string
  title: string
  description: string
  done: boolean
  dueDate?: string
}

function rowToState(r: OperationTaskRow): SellerTaskState {
  return {
    id: r.id,
    key: r.task_key,
    title: r.title,
    description: r.description ?? '',
    done: r.status === 'DONE',
    dueDate: r.due_date ?? undefined,
  }
}

async function fetchChecklist(
  operationId: string,
  stage: string,
  defs: SellerTaskDef[],
): Promise<SellerTaskState[] | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null

  const { data, error } = await supabase
    .from('operation_tasks')
    .select('*')
    .eq('operation_id', operationId)
    .eq('stage_key', stage)
    .order('priority', { ascending: true })

  if (error) return null

  if (!data || data.length === 0) {
    const inserted = await supabase
      .from('operation_tasks')
      .insert(
        defs.map(def => ({
          user_id: u.user!.id,
          operation_id: operationId,
          stage_key: stage,
          task_key: def.key,
          title: def.title,
          description: def.description,
          status: 'TODO' as const,
          priority: def.priority,
        })),
      )
      .select('*')
    if (inserted.error || !inserted.data) return null
    return inserted.data.map(rowToState)
  }

  const existingKeys = new Set(data.map(r => r.task_key))
  const newDefs = defs.filter(d => !existingKeys.has(d.key))
  let extraRows: OperationTaskRow[] = []
  if (newDefs.length > 0) {
    const inserted = await supabase.from('operation_tasks').insert(
      newDefs.map(def => ({
        user_id: u.user!.id,
        operation_id: operationId,
        stage_key: stage,
        task_key: def.key,
        title: def.title,
        description: def.description,
        status: 'TODO' as const,
        priority: def.priority,
      })),
    ).select('*')
    extraRows = inserted.data ?? []
  }

  const allRows = [...data, ...extraRows]
  return defs.map(def => {
    const row = allRows.find(r => r.task_key === def.key)
    return row ? rowToState(row) : {
      id: '',
      key: def.key,
      title: def.title,
      description: def.description,
      done: false,
    }
  })
}

export async function fetchSellerTasks(operationId: string): Promise<SellerTaskState[] | null> {
  return fetchChecklist(operationId, SELLER_STAGE, SELLER_TASK_DEFS)
}

export async function fetchBuyerTasks(operationId: string): Promise<SellerTaskState[] | null> {
  return fetchChecklist(operationId, BUYER_STAGE, BUYER_TASK_DEFS)
}

/** Unificado: elige automáticamente SELLER o BUYER según el tipo de operación. */
export async function fetchOperationTasks(
  operationId: string,
  type: 'SELL' | 'BUY',
): Promise<SellerTaskState[] | null> {
  return type === 'BUY'
    ? fetchBuyerTasks(operationId)
    : fetchSellerTasks(operationId)
}

export async function toggleOperationTask(
  operationId: string,
  taskKey: string,
  done: boolean,
  type: 'SELL' | 'BUY' = 'SELL',
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const stage = type === 'BUY' ? BUYER_STAGE : SELLER_STAGE
  const { error } = await supabase
    .from('operation_tasks')
    .update({
      status: done ? 'DONE' : 'TODO',
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('operation_id', operationId)
    .eq('stage_key', stage)
    .eq('task_key', taskKey)
  return !error
}

export async function setOperationTaskDueDate(
  operationId: string,
  taskKey: string,
  dueDate: string | null,
  type: 'SELL' | 'BUY' = 'SELL',
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const stage = type === 'BUY' ? BUYER_STAGE : SELLER_STAGE
  const { error } = await supabase
    .from('operation_tasks')
    .update({ due_date: dueDate, updated_at: new Date().toISOString() })
    .eq('operation_id', operationId)
    .eq('stage_key', stage)
    .eq('task_key', taskKey)
  return !error
}

/** @deprecated Use toggleOperationTask with type param */
export const toggleSellerTask = (operationId: string, taskKey: string, done: boolean) =>
  toggleOperationTask(operationId, taskKey, done, 'SELL')

/** @deprecated Use setOperationTaskDueDate with type param */
export const setSellerTaskDueDate = (operationId: string, taskKey: string, dueDate: string | null) =>
  setOperationTaskDueDate(operationId, taskKey, dueDate, 'SELL')
