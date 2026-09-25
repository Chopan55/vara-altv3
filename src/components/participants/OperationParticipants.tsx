'use client'

/**
 * El equipo de una operación.
 *
 * Esta pestaña existía y renderizaba una lista siempre vacía: `participants`
 * nacía en `[]` y nadie lo llenaba nunca. Ahora se cargan de verdad.
 *
 * Son datos de contacto de OTRAS personas — el escribano, el martillero, la
 * contraparte. Por eso no se comparten entre operaciones aunque sea el mismo
 * escribano, y no hay ninguna vista que los exponga fuera de esta cuenta.
 */

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Trash2, Mail, Phone, Loader2, AlertCircle } from 'lucide-react'
import { tryCreateClient } from '@/lib/supabase/client'
import type { OperationParticipantRow, ParticipantRoleDb } from '@/lib/supabase/types'

const ROLE_LABELS: Record<ParticipantRoleDb, string> = {
  NOTARY: 'Escribano/a',
  BROKER: 'Martillero / inmobiliaria',
  ACCOUNTANT: 'Contador/a',
  LAWYER: 'Abogado/a',
  APPRAISER: 'Tasador/a',
  COUNTERPARTY: 'La otra parte',
  BANK: 'Banco',
  OTHER: 'Otro',
}

const ROLES = Object.keys(ROLE_LABELS) as ParticipantRoleDb[]

interface Participant {
  id: string
  name: string
  role: ParticipantRoleDb
  email?: string
  phone?: string
  notes?: string
}

function rowToParticipant(r: OperationParticipantRow): Participant {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    notes: r.notes ?? undefined,
  }
}

interface FormValues {
  name: string
  role: ParticipantRoleDb
  email: string
  phone: string
  notes: string
}

const EMPTY: FormValues = { name: '', role: 'NOTARY', email: '', phone: '', notes: '' }

function AddForm({ onAdd, busy }: { onAdd: (v: FormValues) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState<FormValues>(EMPTY)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold py-2.5 rounded-xl transition-colors">
        <Plus size={13} /> Sumar a alguien
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <input
        value={v.name} onChange={e => setV({ ...v, name: e.target.value })} autoFocus
        placeholder="Nombre"
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
      />
      <select
        value={v.role} onChange={e => setV({ ...v, role: e.target.value as ParticipantRoleDb })}
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none bg-white">
        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      <input
        value={v.phone} onChange={e => setV({ ...v, phone: e.target.value })}
        placeholder="Teléfono — opcional" inputMode="tel"
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
      />
      <input
        value={v.email} onChange={e => setV({ ...v, email: e.target.value })}
        placeholder="Email — opcional" inputMode="email"
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
      />
      <input
        value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })}
        placeholder="Nota — ej: atiende de 9 a 13"
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => { onAdd(v); setV(EMPTY); setOpen(false) }}
          disabled={v.name.trim().length < 2 || busy}
          className="text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40">
          Sumar
        </button>
        <button onClick={() => { setV(EMPTY); setOpen(false) }}
          className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
      </div>
    </div>
  )
}

export function OperationParticipants({ operationId }: { operationId: string }) {
  const [people, setPeople] = useState<Participant[]>([])
  const [session, setSession] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = tryCreateClient()
    if (!supabase) return
    const { data } = await supabase
      .from('operation_participants')
      .select('*')
      .eq('operation_id', operationId)
      .order('created_at', { ascending: true })
    setPeople((data ?? []).map(rowToParticipant))
  }, [operationId])

  useEffect(() => {
    let alive = true
    const supabase = tryCreateClient()
    if (!supabase) { setSession(false); setLoaded(true); return }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return
      const ok = Boolean(data.user)
      setSession(ok)
      if (ok) await refresh()
      if (alive) setLoaded(true)
    })
    return () => { alive = false }
  }, [refresh])

  const add = async (v: FormValues) => {
    const supabase = tryCreateClient()
    if (!supabase) return
    setBusy(true); setError(null)

    const { data: u } = await supabase.auth.getUser()
    const userId = u.user?.id
    if (!userId) { setError('Necesitás iniciar sesión.'); setBusy(false); return }

    const { error: err } = await supabase.from('operation_participants').insert({
      user_id: userId,
      operation_id: operationId,
      name: v.name.trim(),
      role: v.role,
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
      notes: v.notes.trim() || null,
    })
    if (err) setError('No pudimos sumar a esa persona. Probá de nuevo.')
    await refresh()
    setBusy(false)
  }

  const remove = async (id: string, name: string) => {
    const supabase = tryCreateClient()
    if (!supabase) return
    if (!window.confirm(`¿Sacar a ${name} del equipo?`)) return
    setBusy(true)
    await supabase.from('operation_participants').delete().eq('id', id)
    await refresh()
    setBusy(false)
  }

  if (session === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Equipo</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Para guardar los contactos de tu operación necesitás iniciar sesión. Son datos
          de otras personas, así que no los dejamos en el navegador.
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-slate-300" />
        <p className="text-xs text-slate-400">Cargando el equipo…</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Equipo</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {people.length === 0
            ? 'Quién más participa: escribano, martillero, la otra parte.'
            : `${people.length} ${people.length === 1 ? 'persona' : 'personas'} en esta operación`}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          <AlertCircle size={12} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {people.length === 0 && (
        <div className="text-center py-5">
          <div className="w-11 h-11 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2.5">
            <Users size={19} className="text-slate-300" />
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Todavía no sumaste a nadie. Tener los contactos acá te evita buscarlos
            en WhatsApp cada vez.
          </p>
        </div>
      )}

      {people.map(p => (
        <div key={p.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-100 to-brand-200 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 font-bold text-sm">{p.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-tight">{p.name}</p>
            <p className="text-[11px] text-slate-400">{ROLE_LABELS[p.role]}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {p.phone && (
                <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800">
                  <Phone size={10} /> {p.phone}
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 break-all">
                  <Mail size={10} /> {p.email}
                </a>
              )}
            </div>
            {p.notes && <p className="text-[11px] text-slate-400 mt-1">{p.notes}</p>}
          </div>
          <button onClick={() => remove(p.id, p.name)} disabled={busy}
            aria-label={`Sacar a ${p.name}`}
            className="text-slate-300 hover:text-rose-500 flex-shrink-0 disabled:opacity-40">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <AddForm onAdd={add} busy={busy} />
    </div>
  )
}
