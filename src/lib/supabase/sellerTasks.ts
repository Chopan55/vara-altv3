import { tryCreateClient } from './client'
import type { OperationTaskRow } from './types'

const STAGE = 'SELLER_CHECKLIST'

export interface SellerTaskDef {
  key: string
  title: string
  description: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export const SELLER_TASK_DEFS: SellerTaskDef[] = [
  { key: 'docs',      title: 'Reunir documentación del inmueble', description: 'Título, planos, impuestos al día',       priority: 'HIGH' },
  { key: 'price',     title: 'Definir precio de publicación',     description: 'Basado en comparables de la zona',      priority: 'HIGH' },
  { key: 'photos',    title: 'Fotos profesionales',               description: 'Al menos 12 fotos de buena calidad',    priority: 'MEDIUM' },
  { key: 'publish',   title: 'Publicar en portales',              description: 'Zonaprop, Argenprop, MercadoLibre',     priority: 'MEDIUM' },
  { key: 'visits',    title: 'Organizar visitas',                 description: 'Coordinar con potenciales compradores', priority: 'MEDIUM' },
  { key: 'offer',     title: 'Evaluar ofertas recibidas',         description: 'Reserva y boleto de compraventa',       priority: 'HIGH' },
  { key: 'escritura', title: 'Escriturar',                        description: 'Con escribano y comprador',             priority: 'HIGH' },
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

export async function fetchSellerTasks(operationId: string): Promise<SellerTaskState[] | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null

  const { data, error } = await supabase
    .from('operation_tasks')
    .select('*')
    .eq('operation_id', operationId)
    .eq('stage_key', STAGE)
    .order('priority', { ascending: true })

  if (error) return null

  if (!data || data.length === 0) {
    const inserted = await supabase
      .from('operation_tasks')
      .insert(
        SELLER_TASK_DEFS.map(def => ({
          user_id: u.user!.id,
          operation_id: operationId,
          stage_key: STAGE,
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
  const newDefs = SELLER_TASK_DEFS.filter(d => !existingKeys.has(d.key))
  if (newDefs.length > 0) {
    await supabase.from('operation_tasks').insert(
      newDefs.map(def => ({
        user_id: u.user!.id,
        operation_id: operationId,
        stage_key: STAGE,
        task_key: def.key,
        title: def.title,
        description: def.description,
        status: 'TODO' as const,
        priority: def.priority,
      })),
    )
  }

  return SELLER_TASK_DEFS.map(def => {
    const row = data.find(r => r.task_key === def.key)
    return row ? rowToState(row) : {
      id: '',
      key: def.key,
      title: def.title,
      description: def.description,
      done: false,
    }
  })
}

export async function toggleSellerTask(
  operationId: string,
  taskKey: string,
  done: boolean,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase
    .from('operation_tasks')
    .update({
      status: done ? 'DONE' : 'TODO',
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('operation_id', operationId)
    .eq('stage_key', STAGE)
    .eq('task_key', taskKey)
  return !error
}

export async function setSellerTaskDueDate(
  operationId: string,
  taskKey: string,
  dueDate: string | null,
): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase
    .from('operation_tasks')
    .update({ due_date: dueDate, updated_at: new Date().toISOString() })
    .eq('operation_id', operationId)
    .eq('stage_key', STAGE)
    .eq('task_key', taskKey)
  return !error
}
