'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cloud, X } from 'lucide-react'
import { accountUrl, shouldInviteToSave } from '@/lib/auth/entryJourney'
import { tryCreateClient } from '@/lib/supabase/client'
import { hasRealOperations } from '@/lib/userOperations'

const DISMISS_KEY = 'vara_save_banner_dismissed'

/**
 * Invitación a crear cuenta, después del primer valor: el invitado ya tiene su operación en el dashboard.
 * Clara pero no agresiva: una sola franja, se puede descartar, y no aparece con sesión ni antes de tener una operación.
 * Crear la cuenta no pierde nada: la operación se sube con el mismo id (ver migrateOperationsToSupabase).
 */
export function SaveOperationBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let alive = true
    const supabase = tryCreateClient()
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch {}
    const decide = (signedIn: boolean) => {
      if (!alive) return
      setShow(shouldInviteToSave({ accountsAvailable: Boolean(supabase), signedIn, hasLocalOperations: hasRealOperations(), dismissed }))
    }
    if (!supabase) { decide(false); return }
    supabase.auth.getUser().then(({ data }) => decide(Boolean(data.user)), () => decide(false))
    return () => { alive = false }
  }, [])

  if (!show) return null

  return (
    <div className="border-b border-brand-100 bg-brand-50/70">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-6">
        <Cloud size={16} className="flex-shrink-0 text-brand-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs text-slate-600">
          <span className="font-bold text-slate-800">Guardá tu operación.</span>{' '}
          Accedé desde cualquier dispositivo.
        </p>
        <Link href={accountUrl('/dashboard')} className="flex-shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-700">
          Crear cuenta
        </Link>
        <button
          type="button"
          onClick={() => { try { localStorage.setItem(DISMISS_KEY, '1') } catch {} setShow(false) }}
          className="flex-shrink-0 p-1 text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Ahora no"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
