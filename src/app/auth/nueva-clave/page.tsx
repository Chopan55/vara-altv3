'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { tryCreateClient } from '@/lib/supabase/client'

/**
 * Destino del link de recuperación. Llega acá con la sesión ya creada por
 * /auth/callback, así que alcanza con `updateUser` para fijar la nueva clave.
 */
export default function NuevaClavePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  // Sin sesión el link venció o ya se usó: mejor decirlo que dejar un form muerto.
  useEffect(() => {
    const supabase = tryCreateClient()
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
      setChecking(false)
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = tryCreateClient()
    if (!supabase) { setError('La base todavía no está configurada.'); return }

    setLoading(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(
        error.message.toLowerCase().includes('should be at least')
          ? 'La contraseña necesita al menos 6 caracteres.'
          : 'No pudimos cambiar la contraseña. Pedí un link nuevo.'
      )
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[var(--background)] flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-8">
          <VaraLogo size={26} />
        </div>

        <div className="rounded-3xl bg-white border border-slate-200/70 shadow-elevated p-7">
          {checking ? (
            <div className="flex items-center justify-center py-10 text-slate-300">
              <Loader2 size={20} aria-hidden="true" className="animate-spin" />
            </div>
          ) : !hasSession ? (
            <div className="text-center space-y-3">
              <h1 className="text-xl font-extrabold text-slate-900">Ese link ya no sirve</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Los links de recuperación vencen y se usan una sola vez. Pedí uno nuevo.
              </p>
              <Link
                href="/login"
                className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                Volver al login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Elegí tu nueva contraseña</h1>
                <p className="text-slate-400 text-sm">Con esta vas a entrar de acá en adelante.</p>
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div className="relative">
                  <label htmlFor="new-password" className="sr-only">Nueva contraseña</label>
                  <Lock size={16} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    id="new-password" type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required minLength={6} autoComplete="new-password" autoFocus
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-brand-400 outline-none text-slate-800 text-sm placeholder:text-slate-300 transition-colors"
                  />
                  <button
                    type="button" onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div aria-live="polite">
                  {error && (
                    <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                      <AlertCircle size={13} aria-hidden="true" className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{error}</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                >
                  {loading
                    ? <><Loader2 size={18} aria-hidden="true" className="animate-spin" /> Un segundo…</>
                    : <>Guardar y entrar <ArrowRight size={18} aria-hidden="true" /></>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
