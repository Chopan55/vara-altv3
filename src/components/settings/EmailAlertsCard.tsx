'use client'
import { useCallback, useState } from 'react'
import { Mail } from 'lucide-react'
import { useLoad } from '@/hooks/useLoad'
import { useBrowserValue } from '@/hooks/useHydrated'
import { getEmailDigest, setEmailDigest, type AlertPrefState } from '@/lib/supabase/alertPreferences'
import { cn } from '@/lib/utils'

/** Interruptor del resumen diario por email, en /configuracion. */
export function EmailAlertsCard() {
  const [pref, setPref] = useState<AlertPrefState | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const notice = useBrowserValue(() => new URLSearchParams(window.location.search).get('alertas'), null)

  const load = useCallback(async () => setPref(await getEmailDigest()), [])
  useLoad(load)

  const toggle = async () => {
    if (!pref || (pref.status !== 'on' && pref.status !== 'off')) return
    const next = pref.status !== 'on'
    setSaving(true)
    setFailed(false)
    const ok = await setEmailDigest(next)
    setSaving(false)
    if (ok) setPref({ status: next ? 'on' : 'off' })
    else setFailed(true)
  }

  const on = pref?.status === 'on'
  const usable = pref?.status === 'on' || pref?.status === 'off'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Mail size={16} className="mt-0.5 text-brand-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Alertas por email</h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Un resumen por día, solo cuando algo está vencido, vence en los próximos 3 días o
              hay un documento vencido o rechazado. Si no hay nada urgente, no te escribimos.
            </p>
          </div>
        </div>
        {usable && (
          <button type="button" role="switch" aria-checked={on} aria-label="Recibir resumen diario por email"
            disabled={saving} onClick={toggle}
            className={cn('relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-60',
              on ? 'bg-brand-600' : 'bg-slate-300')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
              on ? 'left-[22px]' : 'left-0.5')} />
          </button>
        )}
      </div>
      {pref?.status === 'signed_out' && (
        <p className="mt-3 text-xs text-slate-500">Iniciá sesión para activarlas.</p>
      )}
      {pref?.status === 'unavailable' && (
        <p className="mt-3 text-xs text-amber-700">Todavía no están disponibles en esta instalación.</p>
      )}
      {failed && <p className="mt-3 text-xs text-red-600">No se pudo guardar. Probá de nuevo.</p>}
      {notice === 'baja' && pref?.status === 'off' && (
        <p className="mt-3 text-xs text-slate-600">Listo: no vas a recibir más el resumen por email.</p>
      )}
      {notice === 'error' && (
        <p className="mt-3 text-xs text-red-600">El link de baja no es válido. Podés apagarlas desde acá.</p>
      )}
    </div>
  )
}
