'use client'

/**
 * Qué pasó en esta operación.
 *
 * El caso que resuelve: alguien vuelve después de dos semanas. El estado le
 * dice dónde está; esto le dice cómo llegó hasta acá.
 *
 * El texto de cada línea viene armado desde la base y acá NO se reinterpreta.
 * Un historial cuyo texto se recalcula en la pantalla puede decir algo
 * distinto en seis meses, que es justo cuando uno lo necesita para resolver
 * un "yo no dije eso".
 */

import { useState, useEffect, useCallback } from 'react'
import { FileText, Handshake, Home, Flag, Loader2, Sparkles } from 'lucide-react'
import {
  groupByDay, relativeTime, newSince, familyOf,
  type ActivityEvent, type ActivityFamily,
} from '@/lib/activity/model'
import {
  hasActivitySession, fetchActivity, getLastSeen, markSeen,
} from '@/lib/supabase/activity'

const FAMILY_STYLE: Record<ActivityFamily, { icon: React.ElementType; bg: string; fg: string }> = {
  DOCUMENT: { icon: FileText, bg: 'bg-sky-50', fg: 'text-sky-600' },
  OFFER: { icon: Handshake, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  PROPERTY: { icon: Home, bg: 'bg-brand-50', fg: 'text-brand-600' },
  OPERATION: { icon: Flag, bg: 'bg-slate-100', fg: 'text-slate-500' },
}

function EventRow({ event, isNew }: { event: ActivityEvent; isNew: boolean }) {
  const style = FAMILY_STYLE[familyOf(event.kind)]
  const Icon = style.icon

  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
        <Icon size={12} className={style.fg} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-slate-700 leading-relaxed">
            {event.summary}
            {isNew && (
              <span className="ml-1.5 text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full align-middle">
                NUEVO
              </span>
            )}
          </p>
          <span className="text-[10px] text-slate-300 flex-shrink-0 whitespace-nowrap tabular-nums">
            {relativeTime(event.createdAt)}
          </span>
        </div>
        {event.detail && (
          <p className="text-[11px] text-slate-400 italic mt-0.5 leading-relaxed">“{event.detail}”</p>
        )}
      </div>
    </li>
  )
}

export function ActivityLedger({ operationId }: { operationId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [session, setSession] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const list = await fetchActivity(operationId)

    // Calculamos las novedades ANTES de marcar como visto, si no el resumen
    // se borra a sí mismo en el mismo render.
    const since = newSince(list, getLastSeen(operationId))
    setFresh(new Set(since?.map(e => e.id) ?? []))
    setEvents(list)
    markSeen(operationId)
  }, [operationId])

  useEffect(() => {
    let alive = true
    hasActivitySession().then(async ok => {
      if (!alive) return
      setSession(ok)
      if (ok) await load()
      if (alive) setLoaded(true)
    })
    return () => { alive = false }
  }, [load])

  if (session === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Qué pasó</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          El historial se guarda con tu cuenta. Iniciá sesión para verlo.
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-slate-300" />
        <p className="text-xs text-slate-400">Cargando el historial…</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
        <p className="text-sm font-semibold text-slate-800 mb-1">Todavía no pasó nada</p>
        <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
          Acá van a aparecer los documentos que subas, las ofertas que hagas y cada
          cambio de la operación, con la fecha en que ocurrió.
        </p>
      </div>
    )
  }

  const days = groupByDay(events)

  return (
    <div className="space-y-3">
      {fresh.size > 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3 flex items-start gap-2">
          <Sparkles size={13} className="text-brand-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-brand-800">
            {fresh.size === 1
              ? 'Pasó 1 cosa desde la última vez que entraste.'
              : `Pasaron ${fresh.size} cosas desde la última vez que entraste.`}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
        <p className="text-sm font-semibold text-slate-800 mb-1">Qué pasó</p>
        <p className="text-[11px] text-slate-400 mb-3">
          Se registra solo, cuando algo cambia. No se puede editar ni borrar.
        </p>

        {days.map(day => (
          <div key={day.date} className="border-t border-slate-50 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {day.label}
            </p>
            <ul className="divide-y divide-slate-50">
              {day.events.map(e => (
                <EventRow key={e.id} event={e} isNew={fresh.has(e.id)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
