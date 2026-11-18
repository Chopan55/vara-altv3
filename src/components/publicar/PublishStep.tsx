'use client'
import Link from 'next/link'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PORTALS, type Portal, type PublishForm } from './model'

export function PublishStep({ form, published, copiedPortal, blockedPortal, handlePublish }: {
  form: PublishForm
  published: string[]
  copiedPortal: string | null
  blockedPortal: string | null
  handlePublish: (portal: Portal) => void
}) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
        <p className="text-xs font-semibold text-slate-500 mb-1">Tu aviso</p>
        <p className="font-bold text-slate-900">{form.title}</p>
        <p className="text-sm text-slate-500">USD {Number(form.price).toLocaleString('es-AR')} · {form.city}</p>
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
                    <p className="text-xs text-slate-500">{portal.reach}</p>
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

              {blockedPortal === portal.id && (
                <p role="alert" className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Tu navegador bloqueó la pestaña nueva. Permití las ventanas emergentes, o abrí {portal.name}{' '}
                  <a href={portal.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">en otra pestaña</a>
                  {' '}o{' '}
                  <a href={portal.url} className="font-semibold underline">en esta misma</a>
                  {' '}(tu aviso queda guardado: volvés con «Atrás»).
                </p>
              )}

              {isPublished ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-semibold">
                      {blockedPortal === portal.id ? 'El navegador no abrió el portal (ver aviso de arriba)' : copiedPortal === portal.id ? 'Texto copiado — pegalo en el portal' : 'Te llevamos al portal en una pestaña nueva'}
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
                <div>
                <button
                  onClick={() => handlePublish(portal)}
                  className="w-full bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={12} /> Ir a publicar en {portal.name}
                </button>
                </div>
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
              Falta publicar en el portal
            </p>
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed">
            {blockedPortal ? 'La publicación se completa en el portal, no en VARA.' : 'Te llevamos al portal en una pestaña nueva: la publicación se completa ahí, no en VARA.'}
            La tarea de publicación en tu operación se completa cuando cargues la URL del aviso publicado.
          </p>
          <Link href="/asistente" className="mt-2 flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline">
            Estrategia de negociación con VARA →
          </Link>
        </div>
      )}
    </>
  )
}
