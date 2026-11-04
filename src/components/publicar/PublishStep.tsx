'use client'
import Link from 'next/link'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PORTALS, type Portal, type PublishForm } from './model'

export function PublishStep({ form, published, copiedPortal, handlePublish }: {
  form: PublishForm
  published: string[]
  copiedPortal: string | null
  handlePublish: (portal: Portal) => void
}) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
        <p className="text-xs font-semibold text-slate-500 mb-1">Tu aviso</p>
        <p className="font-bold text-slate-900">{form.title}</p>
        <p className="text-sm text-slate-400">USD {Number(form.price).toLocaleString('es-AR')} · {form.city}</p>
      </div>

      <div className="space-y-3">
        {PORTALS.map(portal => {
          const isPublished = published.includes(portal.id)
          return (
            <div key={portal.id} className={cn(
              'bg-white rounded-2xl border border-slate-200/70 shadow-card p-5',
              isPublished && 'border border-green-200'
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl">
                    {portal.logo}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{portal.name}</p>
                    <p className="text-xs text-slate-400">{portal.reach}</p>
                  </div>
                </div>
                {!portal.free && (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    Pago
                  </span>
                )}
                {portal.free && (
                  <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    Gratis
                  </span>
                )}
              </div>

              {isPublished ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-semibold">
                      {copiedPortal === portal.id ? 'Texto copiado — pegalo en el portal' : 'Abierto en nueva pestaña'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Publicá directamente en {portal.name} con los datos que preparaste.
                    Cuando tengas la URL del aviso, completá la tarea de publicación en tu operación.
                  </p>
                  <button
                    onClick={() => handlePublish(portal)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Abrir {portal.name} de nuevo
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePublish(portal)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={12} /> Ir a publicar en {portal.name}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {published.length > 0 && (
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <p className="text-sm font-bold text-emerald-800">
              {published.length === 1 ? '1 portal abierto' : `${published.length} portales abiertos`}
            </p>
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Publicaste directamente. La tarea de publicación en tu operación
            se completa cuando cargues la URL del aviso publicado.
          </p>
          <Link href="/asistente" className="mt-2 flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline">
            Estrategia de negociación con VARA →
          </Link>
        </div>
      )}
    </>
  )
}
