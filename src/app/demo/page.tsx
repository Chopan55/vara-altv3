import Link from 'next/link'
import { ArrowRight, ShieldAlert, Calculator, Scale, Compass, Handshake } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'

export const metadata = { title: 'VARA — Demo', description: 'Una operación de ejemplo, con datos ficticios.' }

/** Todo lo que se ve acá es ficticio y fijo: no lee ni escribe datos de nadie. */
const candidates = [
  { name: 'Departamento en Palermo', price: 185000, m2: 62, fit: 'Encaja con tus prioridades: ubicación y luz', risk: 'Riesgo bajo' },
  { name: 'Casa en Pilar', price: 210000, m2: 140, fit: 'Encaja en espacio y jardín; está sobre tu presupuesto', risk: 'Riesgo medio' },
  { name: 'Departamento en Belgrano', price: 178000, m2: 58, fit: 'Encaja en precio; falta plano actualizado', risk: 'Riesgo medio' },
]
const costs = [
  { label: 'Sellos', value: 3330 },
  { label: 'Honorarios del escribano', value: 2220 },
  { label: 'Inscripción en el registro', value: 370 },
]
const risks = [
  { label: 'Dominial', level: 'Alto', note: 'Observación en la cadena de titularidad' },
  { label: 'Fiscal', level: 'Medio', note: 'Verificar estado de inhibiciones' },
  { label: 'Documental', level: 'Bajo', note: 'Falta el plano actualizado' },
]
const usd = (n: number) => `USD ${n.toLocaleString('es-AR')}`

export default function DemoPage() {
  const total = costs.reduce((s, c) => s + c.value, 0)
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" aria-label="Volver al inicio"><VaraLogo size={26} /></Link>
          <Link href="/onboarding" className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-500">
            Empezar con mi propiedad <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-center text-xs font-semibold text-amber-800">
        DEMO · Datos ficticios. Nada de lo que ves acá es real ni se guarda.
      </div>

      <div className="mx-auto max-w-5xl space-y-14 px-5 py-14">
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">Una operación de ejemplo</p>
          <h1 className="text-3xl font-black text-balance md:text-4xl">Así te acompaña VARA, paso a paso</h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Buscás un departamento para comprar en Buenos Aires, con un presupuesto de USD 190.000. Esto es lo que VARA te mostraría.
          </p>
        </section>

        <section aria-labelledby="comparar">
          <h2 id="comparar" className="mb-4 flex items-center gap-2 text-xl font-black"><Scale size={18} className="text-brand-600" /> Compará según tus prioridades</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {candidates.map(c => (
              <div key={c.name} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="font-bold">{c.name}</p>
                <p className="mt-1 text-lg font-black text-brand-600">{usd(c.price)}</p>
                <p className="text-xs text-slate-400">{c.m2} m² · {usd(Math.round(c.price / c.m2))}/m²</p>
                <p className="mt-3 text-sm text-slate-600">{c.fit}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">{c.risk}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div aria-labelledby="riesgos">
            <h2 id="riesgos" className="mb-4 flex items-center gap-2 text-xl font-black"><ShieldAlert size={18} className="text-brand-600" /> Qué riesgos hay</h2>
            <ul className="space-y-2">
              {risks.map(r => (
                <li key={r.label} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold">{r.label} <span className="font-normal text-slate-400">· {r.level}</span></p>
                  <p className="text-xs text-slate-500">{r.note}</p>
                </li>
              ))}
            </ul>
          </div>
          <div aria-labelledby="costos">
            <h2 id="costos" className="mb-4 flex items-center gap-2 text-xl font-black"><Calculator size={18} className="text-brand-600" /> Cuánto cuesta realmente</h2>
            <div className="rounded-xl border border-slate-200 p-4">
              {costs.map(c => (
                <div key={c.label} className="flex justify-between py-1 text-sm"><span className="text-slate-500">{c.label}</span><span className="font-bold">{usd(c.value)}</span></div>
              ))}
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm"><span>Total de gastos</span><span className="font-black">{usd(total)}</span></div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Valores de ejemplo; en tu operación cada costo muestra su fuente.</p>
          </div>
        </section>

        <section aria-labelledby="proximo">
          <h2 id="proximo" className="mb-4 flex items-center gap-2 text-xl font-black"><Compass size={18} className="text-brand-600" /> Qué hacer ahora</h2>
          <div className="rounded-2xl bg-brand-600 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Tu próximo paso</p>
            <p className="mt-1 text-lg font-bold">Pedí la inhibición de bienes antes de firmar el boleto.</p>
            <p className="mt-2 text-sm text-white/80">Por qué: hay una observación en la cadena de titularidad. Con el informe sabés si podés avanzar. Una buena recomendación también puede ser “no avances”.</p>
          </div>
        </section>

        <section aria-labelledby="negociar">
          <h2 id="negociar" className="mb-4 flex items-center gap-2 text-xl font-black"><Handshake size={18} className="text-brand-600" /> Negociá con contexto</h2>
          <div className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
            Precio publicado <strong>USD 185.000</strong> · tu oferta <strong>USD 172.000</strong> · el vendedor propone <strong>USD 180.000</strong>.
            VARA te ayuda a preparar la respuesta y los argumentos; la decisión final es tuya.
          </div>
        </section>

        <section className="rounded-3xl bg-slate-50 p-8 text-center">
          <h2 className="text-2xl font-black text-balance">Ahora probalo con tu propiedad</h2>
          <p className="mt-2 text-slate-500">Gratis para empezar. Sin cuenta, tus datos quedan solo en este navegador.</p>
          <Link href="/onboarding" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-500">
            Empezar con mi propiedad <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </main>
  )
}
