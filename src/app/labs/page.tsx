import Link from 'next/link'
import { ArrowRight, FlaskConical } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'

export const metadata = { title: 'VARA Labs', description: 'Herramientas experimentales de VARA.' }

const experiments = [
  { title: 'Visual Intelligence', desc: 'Subí una foto y visualizá cómo podría quedar con otra pintura o ambientación. Es una imagen generada, no el estado real.' },
  { title: 'Respuestas a mensajes', desc: 'Pegá lo que te mandaron por WhatsApp o mail y VARA te sugiere qué responder. Vos revisás y decidís.' },
  { title: 'Más experimentos', desc: 'Probamos ideas nuevas antes de sumarlas al producto. Pueden cambiar o desaparecer.' },
]

export default function LabsPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/" aria-label="Volver al inicio"><VaraLogo size={26} /></Link>
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Entrar</Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-14">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
          <FlaskConical size={12} /> Experimental
        </span>
        <h1 className="mt-4 text-3xl font-black text-balance md:text-4xl">VARA Labs</h1>
        <p className="mt-3 max-w-2xl text-slate-500">
          Herramientas en prueba. No son parte de tu operación y no cambian tus datos sin que lo veas.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {experiments.map(e => (
            <div key={e.title} className="rounded-2xl border border-slate-200 p-5">
              <p className="font-bold">{e.title}</p>
              <p className="mt-2 text-sm text-slate-500">{e.desc}</p>
            </div>
          ))}
        </div>
        <Link href="/vara-labs" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-500">
          Probar los experimentos <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  )
}
