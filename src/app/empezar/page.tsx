'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { COUNTRIES, PROVINCES_BY_COUNTRY } from '@/lib/onboarding/options'
import { resolveProvinceCode } from '@/lib/regulations'
import { createOperationAnywhere, hasRealOperations } from '@/lib/userOperations'

type Intent = 'BUY' | 'SELL'
type Saved = { intent?: Intent; country?: string }
type Bubble = { from: 'vara' | 'user'; text: string }

const KEY = 'vara_empezar'
const load = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved } catch { return {} } }
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

const INTENTS = [
  { id: 'BUY', label: 'Quiero comprar', hint: 'Busco propiedades y quiero entender costos y riesgos' },
  { id: 'SELL', label: 'Quiero vender', hint: 'Tengo una propiedad y quiero prepararla y gestionar la venta' },
  { id: 'FOUND', label: 'Ya encontré una propiedad', hint: 'Tengo el link del aviso y quiero que VARA la analice' },
  { id: 'IN_PROGRESS', label: 'Ya estoy en una operación', hint: 'Quiero ordenar lo que ya tengo en marcha' },
] as const

const GREETING = 'Hola. Para empezar, contame: ¿qué querés hacer?'

function Conversation() {
  const router = useRouter()
  const params = useSearchParams()
  const bottom = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState<Saved>({})
  const [bubbles, setBubbles] = useState<Bubble[]>([{ from: 'vara', text: GREETING }])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  // Quien ya tiene operaciones va directo a lo suyo; se puede forzar con ?nuevo=1.
  useEffect(() => {
    if (params.get('nuevo') !== '1' && hasRealOperations()) { router.replace('/dashboard'); return }
    const s = load()
    setSaved(s)
    if (s.intent) {
      setBubbles([
        { from: 'vara', text: GREETING },
        { from: 'user', text: s.intent === 'BUY' ? 'Quiero comprar' : 'Quiero vender' },
        { from: 'vara', text: s.country ? 'Retomamos donde lo dejaste. ¿En qué provincia o estado es?' : '¿En qué país es la operación?' },
      ])
    }
    setReady(true)
  }, [router, params])

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [bubbles])

  const say = (...b: Bubble[]) => setBubbles(prev => [...prev, ...b])

  const pickIntent = (id: (typeof INTENTS)[number]['id'], label: string) => {
    if (id === 'FOUND') { router.push('/propiedades'); return }
    if (id === 'IN_PROGRESS') { router.push('/dashboard'); return }
    save({ intent: id })
    setSaved({ intent: id })
    say({ from: 'user', text: label }, { from: 'vara', text: id === 'BUY' ? 'Perfecto, vamos a ordenar tu compra. ¿En qué país es?' : 'Perfecto, vamos a preparar tu venta. ¿En qué país está la propiedad?' })
  }

  const pickCountry = (code: string, label: string) => {
    const s = { ...saved, country: code }
    save(s); setSaved(s)
    say({ from: 'user', text: label }, { from: 'vara', text: 'Bien. ¿En qué provincia o estado?' })
  }

  const pickProvince = async (province: string) => {
    if (!saved.intent || !saved.country || busy) return
    setBusy(true)
    say({ from: 'user', text: province }, { from: 'vara', text: 'Con esto ya puedo empezar. Te armo el plan de tu operación…' })
    try { localStorage.setItem('vara_country', saved.country) } catch {}
    const op = await createOperationAnywhere({
      type: saved.intent,
      province,
      provinceCode: resolveProvinceCode(province, saved.country as 'AR' | 'MX'),
      title: saved.intent === 'SELL' ? 'Mi venta' : 'Mi compra',
      country: saved.country as 'AR' | 'MX',
    })
    try { localStorage.setItem('vara_operation_id', op.id); localStorage.removeItem(KEY) } catch {}
    router.push('/dashboard')
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
            {!saved.intent && (
              <div className="grid gap-3">
                {INTENTS.map(o => (
                  <button key={o.id} type="button" onClick={() => pickIntent(o.id, o.label)} className="rounded-2xl border-2 border-slate-100 bg-white px-5 py-4 text-left hover:border-brand-300">
                    <span className="block font-bold text-slate-800">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.hint}</span>
                  </button>
                ))}
              </div>
            )}
            {saved.intent && !saved.country && (
              <div className="flex flex-wrap gap-2">{COUNTRIES.map(c => <button key={c.code} type="button" className={chip} onClick={() => pickCountry(c.code, c.label)}>{c.label}</button>)}</div>
            )}
            {saved.intent && saved.country && (
              <div className="flex flex-wrap gap-2">{(PROVINCES_BY_COUNTRY[saved.country] ?? []).map(p => <button key={p} type="button" disabled={busy} className={chip} onClick={() => pickProvince(p)}>{p}</button>)}</div>
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
