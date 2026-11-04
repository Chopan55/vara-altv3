'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { acceptInvite } from '@/lib/supabase/sharing'
import { hasSession } from '@/lib/supabase/visits'
import { accountUrl } from '@/lib/auth/entryJourney'

/**
 * Link de invitación a una operación. Se acepta con la cuenta del email invitado:
 * el token solo no alcanza, para que un link reenviado no le abra la operación a otro.
 */

const REASONS: Record<string, string> = {
  INVALID: 'Esta invitación no existe o fue revocada. Pedile a quien te invitó que te mande una nueva.',
  USED: 'Esta invitación ya la usó otra cuenta.',
  OWNER: 'Esta operación es tuya: no hace falta aceptar la invitación.',
  NOT_READY: 'El acceso compartido todavía no está activado en VARA. Probá de nuevo en unos días.',
  FAILED: 'No pudimos procesar la invitación. Probá de nuevo en un momento.',
  NO_SESSION: 'Necesitás entrar a tu cuenta para aceptar la invitación.',
  NOT_SIGNED_IN: 'Necesitás entrar a tu cuenta para aceptar la invitación.',
}

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'signin' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!(await hasSession())) { if (alive) setState('signin'); return }
      const r = await acceptInvite(token)
      if (!alive) return
      if (r.ok) { router.replace(`/compartida/${r.operationId}`); return }
      setMessage(r.reason === 'EMAIL_MISMATCH'
        ? `La invitación es para ${'invitedEmail' in r && r.invitedEmail ? r.invitedEmail : 'otro email'}. Entrá con esa cuenta para aceptarla.`
        : REASONS[r.reason] ?? REASONS.FAILED)
      setState('error')
    })()
    return () => { alive = false }
  }, [token, router])

  return (
    <div className="min-h-[70vh] px-4 py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
        {state === 'loading' && (
          <p role="status" className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Abriendo la invitación…
          </p>
        )}
        {state === 'signin' && (
          <>
            <ShieldCheck size={28} className="mx-auto text-brand-600" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-extrabold text-slate-900">Te invitaron a una operación en VARA</h1>
            <p className="mt-2 text-sm text-slate-600">
              Entrá o creá tu cuenta con el email al que te llegó la invitación. Vas a poder seguir
              el estado de la operación y sus documentos.
            </p>
            <Link href={accountUrl(`/invitacion/${token}`, 'signup')}
              className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              Entrar o crear cuenta
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <AlertTriangle size={28} className="mx-auto text-amber-500" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-extrabold text-slate-900">No pudimos abrir la invitación</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Ir a VARA
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
