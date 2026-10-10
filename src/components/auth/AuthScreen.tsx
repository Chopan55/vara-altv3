'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2, Calculator, ShieldCheck, Sparkles, Eye, EyeOff, Briefcase, ClipboardCheck, KeyRound, MapPin, Scale, Layers, Compass } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { VaraVisitLogo } from '@/components/ui/VaraVisitLogo'
import { tryCreateClient, isSupabaseConfigured } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'

/**
 * A quién le habla la pantalla. El cliente (compra o vende) y el Visit Partner
 * (muestra propiedades o acompaña visitas) son dos puertas distintas del mismo
 * producto: misma autenticación, pero cada uno con sus textos, sus beneficios y
 * su destino después de entrar.
 */
export type AuthAudience = 'client' | 'partner'

/**
 * VARA Visit tiene que verse como otra cosa que VARA: otro logo y otra paleta
 * (verde azulado en lugar del índigo). Acá están las clases que cambian por público.
 */
const THEME = {
  client: { btn: 'bg-brand-600 hover:bg-brand-700', link: 'text-brand-600', focus: 'focus:border-brand-400' },
  partner: { btn: 'bg-teal-700 hover:bg-teal-800', link: 'text-teal-700', focus: 'focus:border-teal-500' },
} as const

const FIELD_BASE =
  'w-full pl-11 py-3.5 rounded-2xl border-2 border-slate-100 outline-none text-slate-800 text-sm placeholder:text-slate-300 transition-colors'

function translateError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Mail o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu mail. Revisá tu casilla.'
  if (m.includes('user already registered')) return 'Ese mail ya está registrado. Probá iniciar sesión.'
  if (m.includes('password should be at least')) return 'La contraseña necesita al menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'Ese mail no parece válido.'
  // El límite de mails de Supabase es por hora, no por minuto: decir "esperá un
  // minuto" mandaba a reintentar justo lo que va a volver a fallar.
  if (m.includes('email rate limit')) return 'Se alcanzó el límite de mails de confirmación por hora. Probá de nuevo más tarde.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Esperá un minuto.'
  if (m.includes('error sending') && m.includes('email')) return 'No pudimos enviar el mail de confirmación. Es un problema del servicio de mail, no de tus datos.'
  return raw
}

/** Un `next` externo mandaría al usuario a un dominio ajeno después de loguearse. */
function safeNext(raw: string | null, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

type Titles = Record<Mode, { heading: string; sub: string; cta: string }>

const PARTNER_TITLES: Titles = {
  login: {
    heading: 'Entrá a tu portal',
    sub: 'Tus visitas, tu disponibilidad y tus reportes en un solo lugar.',
    cta: 'Entrar',
  },
  signup: {
    heading: 'Sumate como Visit Partner',
    sub: 'Creá tu cuenta y empezá el alta. Habilitarte lleva varios pasos y los revisa una persona de VARA.',
    cta: 'Crear mi cuenta',
  },
  reset: {
    heading: 'Recuperá tu contraseña',
    sub: 'Poné tu mail y te mandamos un link para elegir una nueva.',
    cta: 'Mandar link',
  },
}

const TITLES: Titles = {
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

function LoginForm({ audience }: { audience: AuthAudience }) {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'), audience === 'partner' ? '/partner' : '/dashboard')
  const th = THEME[audience]
  const field = `${FIELD_BASE} ${th.focus}`
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        })

        // TEMPORAL: diagnóstico del registro. Sin el mail ni la clave. Quitar cuando
        // el signup esté verificado en producción.
        console.info('[signup]', {
          error: error?.message ?? null,
          userId: data?.user?.id ?? null,
          confirmedAt: data?.user?.confirmed_at ?? null,
          identities: data?.user?.identities?.length ?? null,
          hasSession: Boolean(data?.session),
        })

        if (error) throw error

        // Con un mail que ya tiene cuenta, Supabase responde "éxito" sin mandar nada
        // (para no revelar qué mails existen). Antes la pantalla decía "revisá tu mail".
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('Ese mail ya tiene una cuenta. Entrá o recuperá tu contraseña.')
        }

        // Si el proyecto no exige confirmar el mail, el registro ya trae sesión.
        if (data.session) {
          router.push(next)
          router.refresh()
          return
        }

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
          ¿No te llegó? Mirá en spam o promociones, o{' '}
          <button
            onClick={() => { setSentTo(null); switchTo(sentTo.mode) }}
            className={`${th.link} font-semibold hover:underline`}
          >
            probá con otro mail
          </button>.
        </p>
      </div>
    )
  }

  const t = (audience === 'partner' ? PARTNER_TITLES : TITLES)[mode]

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
              className={`${field} pr-4`}
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
            className={`${field} pr-4`}
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
              className={`${field} pr-12`}
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
          className={`w-full ${th.btn} disabled:opacity-50 text-white font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors`}
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
          <button onClick={() => switchTo('login')} className={`${th.link} font-semibold hover:underline`}>
            Volver a entrar
          </button>
        ) : (
          <>
            {mode === 'login' ? '¿Todavía no tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              onClick={() => switchTo(mode === 'login' ? 'signup' : 'login')}
              className={`${th.link} font-semibold hover:underline`}
            >
              {mode === 'login' ? 'Creá una' : 'Entrá'}
            </button>
          </>
        )}
      </p>

      {audience === 'partner' ? (
        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
          ¿Querés comprar o vender?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Entrá a VARA
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-center text-xs text-slate-300">
            ¿Solo querés mirar?{' '}
            <Link href="/onboarding" className="text-slate-400 hover:text-slate-600 underline">
              Probá sin cuenta
            </Link>
          </p>

          {/* La puerta de los Visit Partners. Entran por acá y no desde adentro de la
              cuenta de quien compra o vende: son otra cara del producto. */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <Link
              href="/partner/entrar"
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                <Briefcase size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">Soy Visit Partner</span>
                <span className="block text-xs text-slate-500">Mostrás propiedades o acompañás visitas con VARA</span>
              </span>
              <ArrowRight size={15} className="flex-shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </>
  )
}

/**
 * Lo que se promete acá tiene que existir del otro lado del login.
 * Nada de "tasaciones automáticas" ni métricas: solo lo que la app hace hoy.
 */
const CLIENT_HEADING = 'VARA empieza donde terminan los portales.'
const CLIENT_SUB =
  'Encontrar una propiedad ya es digital. Comprar o venderla todavía no. VARA no necesita que compres esa propiedad: necesita ayudarte a tomar una buena decisión.'
const CLIENT_NOT =
  'VARA no es un portal, ni un chatbot inmobiliario, ni una inmobiliaria digital: es una capa de inteligencia, coordinación y ejecución. Puede convivir con tu inmobiliaria.'
const PARTNER_HEADING = 'Mostrá propiedades y acompañá visitas, con respaldo.'
const PARTNER_SUB = 'No sos agente inmobiliario ni participás de la negociación: sos quien hace la visita.'

const CLIENT_VALUE_PROPS = [
  {
    icon: Compass,
    title: 'Qué falta, qué riesgo hay y qué hacer ahora',
    detail: 'Convierte información en acción con Next Best Action. Una buena recomendación puede ser “no avances”.',
  },
  {
    icon: Scale,
    title: 'Compará según tus prioridades',
    detail: 'No existe la mejor propiedad: existe la mejor para vos. Sin un score opaco.',
  },
  {
    icon: Calculator,
    title: 'Los costos reales, no solo el precio de publicación',
    detail: 'Sellos, escribano e impuestos calculados con la normativa de tu provincia.',
  },
  {
    icon: ShieldCheck,
    title: 'Documentos y riesgos en lenguaje humano',
    detail: 'Sin reemplazar al escribano, al abogado ni a otros profesionales.',
  },
  {
    icon: Layers,
    title: 'Toda la operación en un solo lugar',
    detail: 'Hoy vive dispersa entre WhatsApp, mails, PDFs y portales. Acá queda ordenada, con qué pasó y qué sigue.',
  },
  {
    icon: Sparkles,
    title: 'Vos decidís. VARA te da el control.',
    detail: 'La IA explica y prepara; no inventa hechos ni decide por vos.',
  },
]

/**
 * Lo que se le promete a un Visit Partner también tiene que existir hoy:
 * alta con identidad, referencias y capacitación; checklist y reporte por visita;
 * PIN para empezar; zona y horarios propios. Sin ingresos ni cifras prometidas.
 */
const PARTNER_VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'Un estándar alto, a propósito',
    detail: 'Entrás a la casa de alguien. Verificamos identidad, referencias y capacitación antes de habilitarte.',
  },
  {
    icon: ClipboardCheck,
    title: 'Checklist y reporte en cada visita',
    detail: 'Registrás lo que pasó con hechos, no opiniones, y VARA lo suma a la operación.',
  },
  {
    icon: KeyRound,
    title: 'Un PIN para empezar cada visita',
    detail: 'El cliente te da un código de cuatro dígitos: así los dos saben con quién están.',
  },
  {
    icon: MapPin,
    title: 'Tu zona y tus horarios',
    detail: 'Elegís dónde y cuándo podés cubrir visitas.',
  },
]

export function AuthScreen({ audience = 'client' }: { audience?: AuthAudience }) {
  const partner = audience === 'partner'
  const valueProps = partner ? PARTNER_VALUE_PROPS : CLIENT_VALUE_PROPS
  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-2">
      {/* Panel de marca. En celular se esconde: ahí lo único que importa es el formulario. */}
      <aside
        className={`hidden lg:flex flex-col justify-between text-white p-10 xl:p-14 ${partner ? '' : 'bg-brand-700'}`}
        style={partner ? { background: 'linear-gradient(160deg,#0b3f3c 0%,#115e59 55%,#0f766e 100%)' } : undefined}
      >
        {partner ? <VaraVisitLogo size={56} tone="light" /> : <VaraLogo size={28} showText={false} />}

        <div className="max-w-md">
          {partner && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Briefcase size={12} aria-hidden="true" /> Para Visit Partners
            </p>
          )}
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-balance">
            {partner ? PARTNER_HEADING : CLIENT_HEADING}
          </h2>
          <p className={`mt-3 leading-relaxed ${partner ? 'text-teal-100' : 'text-brand-200'}`}>
            {partner ? PARTNER_SUB : CLIENT_SUB}
          </p>

          <ul className="mt-9 space-y-5">
            {valueProps.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className={`text-[13px] leading-relaxed mt-0.5 ${partner ? 'text-teal-100' : 'text-brand-200'}`}>{detail}</p>
                </div>
              </li>
            ))}
          </ul>

          {!partner && <p className="mt-7 text-[13px] leading-relaxed text-brand-200">{CLIENT_NOT}</p>}
        </div>

        <p className={`text-xs ${partner ? 'text-teal-200' : 'text-brand-300'}`}>
          {partner
            ? 'El alta tiene 7 pasos y ninguno se saltea: subir documentos no alcanza para quedar habilitado.'
            : 'Software cuando alcanza. Personas cuando agregan valor. Especialistas cuando hacen falta. Tu cuenta guarda operaciones, documentos y fotos; sin cuenta, todo vive solo en este navegador.'}
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8 lg:hidden">
            {partner ? <VaraVisitLogo size={44} /> : <VaraLogo size={26} />}
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
                <LoginForm audience={audience} />
              </Suspense>
            </div>
          )}

          {/* En celular el panel de marca se esconde: este bloque cuenta lo mismo, debajo del formulario. */}
          <section className="mt-10 lg:hidden" aria-label={partner ? 'Para Visit Partners' : 'Por qué VARA'}>
            <h2 className="text-base font-extrabold text-slate-800 text-balance">{partner ? PARTNER_HEADING : CLIENT_HEADING}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{partner ? PARTNER_SUB : CLIENT_SUB}</p>
            <ul className="mt-5 space-y-4">
              {valueProps.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${partner ? 'bg-teal-50 text-teal-700' : 'bg-brand-50 text-brand-600'}`}
                  >
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            {!partner && <p className="mt-5 text-xs leading-relaxed text-slate-400">{CLIENT_NOT}</p>}
          </section>
        </div>
      </main>
    </div>
  )
}
