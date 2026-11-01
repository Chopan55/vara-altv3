'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { useSellOperation } from '@/hooks/useSellOperation'
import { loadSellerPhotos } from '@/lib/sellerPhotos'
import { UNLABELED, isPublishable } from '@/lib/photoAdvice'
import { readHave } from '@/lib/sellPrep'
import { buildPack, type Pack, type PackSource } from '@/lib/propertyPack'

const DRAFT_KEY = 'vara_publish_draft'

export default function PropertyPackPage() {
  const [pack, setPack] = useState<Pack | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [excluded, setExcluded] = useState(0)
  const [unlabeled, setUnlabeled] = useState(0)
  const [reviewed, setReviewed] = useState(false)
  const { op, loaded } = useSellOperation()

  useEffect(() => {
    if (!loaded) return
    ;(async () => {
      let src: PackSource = {}
      try { src = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as PackSource } catch {}
      const docs = op ? readHave(op.id) : []
      setPack(buildPack(src, docs))
      try {
        const all = await loadSellerPhotos()
        const pub = all.filter(p => isPublishable(p.label))
        setExcluded(all.length - pub.length)
        setUnlabeled(pub.filter(p => !p.label || p.label === UNLABELED).length)
        setPhotos(pub.slice(0, 4).map(p => p.url))
      } catch {}
    })()
  }, [loaded, op?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!pack) return null

  // Datos mínimos y revisión visual antes de exportar o compartir.
  const missing: string[] = []
  if (!pack.priceLine) missing.push('el precio')
  if (!pack.location) missing.push('la ubicación')
  if (photos.length === 0) missing.push('al menos una foto publicable')
  const canExport = !pack.isEmpty && missing.length === 0 && reviewed

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link href="/publicar" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Volver a Mi propiedad</Link>
          <button type="button" onClick={() => window.print()} disabled={!canExport} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Printer size={14} /> Guardar como PDF</button>
        </div>

        {!pack.isEmpty && (
          <section aria-label="Antes de exportar" className="mb-6 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 print:hidden">
            {missing.length > 0 && <p className="text-rose-700"><span className="font-semibold">Falta para exportar:</span> {missing.join(', ')}. <Link href="/publicar" className="underline">Completarlo</Link></p>}
            {excluded > 0 && <p>{excluded} {excluded === 1 ? 'imagen marcada como plano o documento no se incluye' : 'imágenes marcadas como plano o documento no se incluyen'}: son internas y nunca se muestran en la ficha.</p>}
            {unlabeled > 0 && <p className="text-amber-800">{unlabeled} {unlabeled === 1 ? 'foto sin etiquetar' : 'fotos sin etiquetar'}: revisá que no sea un plano o un documento antes de compartir. <Link href="/publicar" className="underline">Etiquetar</Link></p>}
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={reviewed} onChange={e => setReviewed(e.target.checked)} /> Revisé las fotos y los datos que se van a mostrar en la ficha.</label>
          </section>
        )}

        {pack.isEmpty ? (
          <div className="rounded-2xl border border-slate-100 p-6">
            <p className="text-sm text-slate-700">Todavía no cargaste datos de tu propiedad. El Property Pack se arma con lo que completes en “Mi propiedad”.</p>
            <Link href="/publicar" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Cargar mi propiedad</Link>
          </div>
        ) : (
          <article>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">VARA Property Pack</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{pack.title}</h1>
            {pack.location && <p className="mt-1 text-slate-600">{pack.location}</p>}
            {pack.priceLine && <p className="mt-3 text-2xl font-bold text-brand-700">{pack.priceLine}</p>}

            {photos.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {photos.map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt={`Foto ${i + 1} de la propiedad`} className={`w-full rounded-xl object-cover ${i === 0 ? 'col-span-2 h-64' : 'h-36'}`} />
                ))}
              </div>
            )}

            {pack.facts.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {pack.facts.map(f => (
                  <div key={f.label}><dt className="text-xs text-slate-400">{f.label}</dt><dd className="text-sm font-semibold text-slate-800">{f.value}</dd></div>
                ))}
              </dl>
            )}

            {pack.features.length > 0 && (
              <p className="mt-5 text-sm text-slate-700"><span className="font-semibold">Incluye:</span> {pack.features.join(' · ')}</p>
            )}
            {pack.description && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{pack.description}</p>}

            {pack.documents.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-bold text-slate-900">Documentación disponible</h2>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{pack.documents.map(d => <li key={d}>{d}</li>)}</ul>
              </section>
            )}

            <p className="mt-8 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Ficha armada con los datos que cargó el propietario. Verificá la información antes de decidir.</p>
          </article>
        )}
      </div>
    </main>
  )
}
