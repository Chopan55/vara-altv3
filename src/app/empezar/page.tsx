'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isEnabled } from '@/lib/flags'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { COUNTRIES, PROVINCES_BY_COUNTRY } from '@/lib/onboarding/options'
import { PROPERTY_TYPES, destination, nextStep, operationTitle, question, type Answers, type Step } from '@/lib/onboarding/flow'
import { resolveProvinceCode } from '@/lib/regulations'
import { createOperationAnywhere, hasRealOperations } from '@/lib/userOperations'

type Bubble = { from: 'vara' | 'user'; text: string }

const KEY = 'vara_empezar'
const load = (): Answers => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Answers } catch { return {} } }
const save = (a: Answers) => { try { localStorage.setItem(KEY, JSON.stringify(a)) } catch {} }

const INTENTS = [
  { id: 'BUY', label: 'Quiero comprar', hint: 'Busco propiedades y quiero entender costos y riesgos' },
  { id: 'SELL', label: 'Quiero vender', hint: 'Tengo una propiedad y quiero prepararla y gestionar la venta' },
  { id: 'FOUND', label: 'Ya encontré una propiedad', hint: 'Tengo el link del aviso y quiero que VARA la analice' },
  { id: 'IN_PROGRESS', label: 'Ya estoy en una operación', hint: 'Quiero ordenar lo que ya tengo en marcha' },
] as const

const GREETING = 'Hola. Para empezar, contame: ¿qué querés hacer?'

/** Reconstruye la charla a partir de lo ya respondido, para retomar sin repetir preguntas. */
function replay(a: Answers): Bubble[] {
  if (!a.intent) return [{ from: 'vara', text: GREETING }]
  const out: Bubble[] = [{ from: 'vara', text: GREETING }, { from: 'user', text: a.intent === 'BUY' ? 'Quiero comprar' : 'Quiero vender' }]
  const asked: [Step, string | undefined][] = [
    ['country', COUNTRIES.find(c => c.code === a.country)?.label],
    ['province', a.province],
    ['city', a.cityDone ? (a.city || 'Prefiero no decirlo todavía') : undefined],
    ['type', a.propertyType],
    ['already', a.alreadyHas === undefined ? undefined : a.alreadyHas ? 'Sí' : 'No'],
  ]
  for (const [step, answer] of asked) {
    out.push({ from: 'vara', text: question(step, a) })
    if (answer === undefined) return out
    out.push({ from: 'user', text: answer })
  }
  return out
}

function Conversation() {
  const router = useRouter()
  const params = useSearchParams()
  const bottom = useRef<HTMLDivElement>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [bubbles, setBubbles] = useState<Bubble[]>([{ from: 'vara', text: GREETING }])
  const [city, setCity] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  // Quien ya tiene operaciones va directo a lo suyo; se puede forzar con ?nuevo=1.
  useEffect(() => {
    if (!isEnabled('conversationalEntry')) { router.replace('/dashboard'); return }
    if (params.get('nuevo') !== '1' && hasRealOperations()) { router.replace('/dashboard'); return }
    const a = load()
    setAnswers(a)
    setBubbles(replay(a))
    setReady(true)
  }, [router, params])

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [bubbles])

  const step: Step | 'intent' = answers.intent ? nextStep(answers) : 'intent'

  const finish = async (a: Answers) => {
    if (busy || !a.intent || !a.country || !a.province) return
    setBusy(true)
    try { localStorage.setItem('vara_country', a.country) } catch {}
    const op = await createOperationAnywhere({
      type: a.intent,
      province: a.province,
      provinceCode: resolveProvinceCode(a.province, a.country as 'AR' | 'MX'),
      city: a.city || undefined,
      title: operationTitle(a),
      country: a.country as 'AR' | 'MX',
    })
    // El menú lee este valor para mostrar el recorrido de compra o de venta.
    try { localStorage.setItem('vara_operation_id', op.id); localStorage.setItem('vara_journey_type', a.intent === 'SELL' ? 'SELL_PROPERTY' : 'BUY_PROPERTY'); localStorage.removeItem(KEY) } catch {}
    router.push(destination(a))
  }

  /** Guarda la respuesta, la muestra y hace la pregunta siguiente. */
  const answer = (patch: Partial<Answers>, shown: string) => {
    const next = { ...answers, ...patch }
    save(next); setAnswers(next)
    const upcoming = nextStep(next)
    setBubbles(b => [...b, { from: 'user', text: shown }, { from: 'vara', text: question(upcoming, next) }])
    if (upcoming === 'done') void finish(next)
  }

  const pickIntent = (id: (typeof INTENTS)[number]['id'], label: string) => {
    if (id === 'FOUND') { router.push('/propiedades'); return }
    if (id === 'IN_PROGRESS') { router.push('/dashboard'); return }
    const next: Answers = { intent: id }
    save(next); setAnswers(next)
    setBubbles(b => [...b, { from: 'user', text: label }, { from: 'vara', text: question('country', next) }])
  }

  const chip = 'rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50'

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="mx-auto flex h-16 max-w-xl items-center px-5"><VaraLogo size={26} /></header>
      <div className="mx-auto max-w-xl px-5 pb-16">
        <div className="space-y-3" aria-live="polite">
          {bubbles.map((b, i) => (
            <div key={i} className={b.from === 'user' ? 'text-right' : ''}>
              <p className={`inline-block max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${b.from === 'user' ? 'bg-brand-600 text-white' : 'border border-slate-100 bg-white text-slate-700 shadow-sm'}`}>{b.text}</p>
            </div>
          ))}
        </div>

        {ready && (
          <div className="mt-5">
            {step === 'intent' && (
              <div className="grid gap-3">
                {INTENTS.map(o => (
                  <button key={o.id} type="button" onClick={() => pickIntent(o.id, o.label)} className="rounded-2xl border-2 border-slate-100 bg-white px-5 py-4 text-left hover:border-brand-300">
                    <span className="block font-bold text-slate-800">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.hint}</span>
                  </button>
                ))}
              </div>
            )}
            {step === 'country' && (
              <div className="flex flex-wrap gap-2">{COUNTRIES.map(c => <button key={c.code} type="button" className={chip} onClick={() => answer({ country: c.code }, c.label)}>{c.label}</button>)}</div>
            )}
            {step === 'province' && (
              <div className="flex flex-wrap gap-2">{(PROVINCES_BY_COUNTRY[answers.country ?? ''] ?? []).map(p => <button key={p} type="button" className={chip} onClick={() => answer({ province: p }, p)}>{p}</button>)}</div>
            )}
            {step === 'city' && (
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const c = city.trim(); answer({ city: c || undefined, cityDone: true }, c || 'Prefiero no decirlo todavía'); setCity('') }}>
                <input value={city} onChange={e => setCity(e.target.value)} maxLength={60} placeholder="Ciudad, zona o barrio" aria-label="Ciudad, zona o barrio" className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base sm:text-sm" />
                <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{city.trim() ? 'Seguir' : 'Saltear'}</button>
              </form>
            )}
            {step === 'type' && (
              <div className="flex flex-wrap gap-2">{PROPERTY_TYPES.map(t => <button key={t} type="button" className={chip} onClick={() => answer({ propertyType: t }, t)}>{t}</button>)}</div>
            )}
            {step === 'already' && (
              <div className="flex gap-2">
                <button type="button" className={chip} onClick={() => answer({ alreadyHas: true }, 'Sí')}>Sí</button>
                <button type="button" className={chip} onClick={() => answer({ alreadyHas: false }, 'No')}>No</button>
              </div>
            )}
          </div>
        )}
        <div ref={bottom} />
      </div>
    </main>
  )
}

export default function EmpezarPage() {
  return <Suspense fallback={null}><Conversation /></Suspense>
}
