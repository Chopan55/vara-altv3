'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2, Calculator, ShieldCheck, BookOpen, Sparkles, Eye, EyeOff } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { tryCreateClient, isSupabaseConfigured } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'

const FIELD_CLASS =
  'w-full pl-11 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-brand-400 outline-none text-slate-800 text-sm placeholder:text-slate-300 transition-colors'

function translateError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Mail o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu mail. Revisá tu casilla.'
  if (m.includes('user already registered')) return 'Ese mail ya está registrado. Probá iniciar sesión.'
  if (m.includes('password should be at least')) return 'La contraseña necesita al menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'Ese mail no parece válido.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Esperá un minuto.'
  return raw
}

/** Un `next` externo mandaría al usuario a un dominio ajeno después de loguearse. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

const TITLES: Record<Mode, { heading: string; sub: string; cta: string }> = {
  login: {
    heading: 'Entrá a tu operación',
    sub: 'Tus operaciones, documentos y propiedades donde las dejaste.',
    cta: 'Entrar',
  },
  signup: {
    heading: 'Creá tu cuenta',
    sub: 'Guardá tu operación y accedé desde cualquier dispositivo.',
    cta: 'Crear cuenta',
  },
  reset: {
    heading: 'Recuperá tu contraseña',
    sub: 'Poné tu mail y te mandamos un link para elegir una nueva.',
    cta: 'Mandar link',
  },
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(params.get('error'))
  const [sentTo, setSentTo] = useState<{ email: string; mode: Mode } | null>(null)

  const switchTo = (m: Mode) => { setMode(m); setError(null); setShowPassword(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = tryCreateClient()
    if (!supabase) {
      setError('La base todavía no está configurada.')
      return
    }

    setLoading(true); setError(null)

    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/nueva-clave`,
        })
        if (error) throw error
        setSentTo({ email: email.trim(), mode: 'reset' })
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        })
        if (error) throw error
        setSentTo({ email: email.trim(), mode: 'signup' })
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        router.push(next)
        router.refresh()
      }
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : 'Algo salió mal.'))
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    const isReset = sentTo.mode === 'reset'
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-emerald-500" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 mb-1">Revisá tu mail</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Te mandamos {isReset ? 'un link para cambiar la contraseña' : 'un link de confirmación'} a{' '}
            <span className="font-semibold text-slate-700">{sentTo.email}</span>.{' '}
            {isReset ? 'Tocalo y elegís una nueva.' : 'Tocalo y entrás directo.'}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          ¿No te llegó? Mirá en spam, o{' '}
          <button
            onClick={() => { setSentTo(null); switchTo(sentTo.mode) }}
            className="text-brand-600 font-semibold hover:underline"
          >
            probá con otro mail
          </button>.
        </p>
      </div>
    )
  }

  const t = TITLES[mode]

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">{t.heading}</h1>
        <p className="text-slate-400 text-sm">{t.sub}</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <div className="relative">
            <label htmlFor="name" className="sr-only">Tu nombre</label>
            <User size={16} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              id="name" type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Tu nombre" autoComplete="name"
              className={`${FIELD_CLASS} pr-4`}
            />
          </div>
        )}

        <div className="relative">
          <label htmlFor="email" className="sr-only">Mail</label>
          <Mail size={16} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="tu@mail.com" required autoComplete="email"
            autoFocus={mode !== 'signup'}
            className={`${FIELD_CLASS} pr-4`}
          />
        </div>

        {mode !== 'reset' && (
          <div className="relative">
            <label htmlFor="password" className="sr-only">Contraseña</label>
            <Lock size={16} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              id="password" type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Contraseña (mín. 6 caracteres)' : 'Tu contraseña'}
              required minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className={`${FIELD_CLASS} pr-12`}
            />
            <button
              type="button" onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}

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
            : <>{t.cta} <ArrowRight size={18} aria-hidden="true" /></>}
        </button>
      </form>

      {mode === 'login' && (
        <p className="mt-3 text-center">
          <button onClick={() => switchTo('reset')} className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
            Me olvidé la contraseña
          </button>
        </p>
      )}

      <p className="mt-5 text-center text-sm text-slate-400">
        {mode === 'reset' ? (
          <button onClick={() => switchTo('login')} className="text-brand-600 font-semibold hover:underline">
            Volver a entrar
          </button>
        ) : (
          <>
            {mode === 'login' ? '¿Todavía no tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              onClick={() => switchTo(mode === 'login' ? 'signup' : 'login')}
              className="text-brand-600 font-semibold hover:underline"
            >
              {mode === 'login' ? 'Creá una' : 'Entrá'}
            </button>
          </>
        )}
      </p>

      <p className="mt-6 text-center text-xs text-slate-300">
        ¿Solo querés mirar?{' '}
        <Link href="/onboarding" className="text-slate-400 hover:text-slate-600 underline">
          Probá sin cuenta
        </Link>
      </p>
    </>
  )
}

/**
 * Lo que se promete acá tiene que existir del otro lado del login.
 * Nada de "tasaciones automáticas" ni métricas: solo lo que la app hace hoy.
 */
const VALUE_PROPS = [
  {
    icon: Calculator,
    title: 'Costos reales de tu provincia',
    detail: 'Sellos, escribano e impuestos calculados con la normativa vigente, no con un promedio.',
  },
  {
    icon: ShieldCheck,
    title: 'Riesgos antes de firmar',
    detail: 'Te marcamos qué documento falta y por qué frena la operación.',
  },
  {
    icon: BookOpen,
    title: 'Cada paso explicado',
    detail: 'Seña, boleto, escritura: qué es, cuándo pasa y qué mirar.',
  },
  {
    icon: Sparkles,
    title: 'Tus fotos, mejoradas con IA',
    detail: 'Cambiá pintura o ambientación sobre tu propia foto para mostrar el potencial.',
  },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-2">
      {/* Panel de marca. En celular se esconde: ahí lo único que importa es el formulario. */}
      <aside className="hidden lg:flex flex-col justify-between bg-brand-700 text-white p-10 xl:p-14">
        <VaraLogo size={28} showText={false} />

        <div className="max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-balance">
            Comprar o vender una propiedad en Argentina, sin ir a ciegas.
          </h2>
          <p className="mt-3 text-brand-200 leading-relaxed">
            VARA te acompaña desde la primera visita hasta la escritura.
          </p>

          <ul className="mt-9 space-y-5">
            {VALUE_PROPS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-[13px] text-brand-200 leading-relaxed mt-0.5">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-300">
          Tu cuenta guarda operaciones, documentos y fotos. Sin cuenta, todo vive solo en este navegador.
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8 lg:hidden">
            <VaraLogo size={26} />
          </div>

          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="font-bold text-slate-800 text-sm mb-1">Las cuentas todavía no están activas</p>
              <p className="text-xs text-slate-500 mb-4">
                Por ahora VARA guarda todo en este navegador. Podés usar la app igual.
              </p>
              <Link href="/onboarding"
                className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
                Empezar
              </Link>
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-slate-200/70 shadow-elevated p-7">
              <Suspense fallback={<div className="h-64" />}>
                <LoginForm />
              </Suspense>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
