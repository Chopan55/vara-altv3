'use client'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { patchCandidate } from '@/lib/candidates/store'
import { advertiserMessage, patchFor, sentenceFor } from '@/lib/candidates/missing'

/** Dice exactamente qué falta y deja completarlo ahí mismo o preguntárselo al anunciante. */
export function MissingDataFix({ candidateId, title, missing, onSaved }: { candidateId: string; title?: string; missing: string[]; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMessage, setShowMessage] = useState(false)

  const save = async (field: string) => {
    const patch = patchFor(field, values[field] ?? '')
    if (!patch) { setError(`Escribí ${field === 'ubicación' ? 'una ubicación' : `un número válido para ${field === 'precio' ? 'el precio' : 'la superficie'}`}.`); return }
    setError(null); setSaving(field)
    const r = await patchCandidate(candidateId, patch)
    setSaving(null)
    if (!r) { setError('No pudimos guardar el dato. No se perdió nada: probá de nuevo.'); return }
    setValues(v => ({ ...v, [field]: '' }))
    onSaved()
  }

  return (
    <div className="mb-3 space-y-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
      <p className="flex items-start gap-2 text-[11px] text-amber-800"><AlertCircle size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />{sentenceFor(missing)}</p>
      <div className="space-y-1.5">
        {missing.map(field => (
          <form key={field} className="flex gap-2" onSubmit={e => { e.preventDefault(); void save(field) }}>
            <input value={values[field] ?? ''} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))} inputMode={field === 'ubicación' ? 'text' : 'numeric'} aria-label={field}
              placeholder={field === 'precio' ? 'Precio en USD' : field === 'superficie' ? 'Superficie en m²' : 'Ciudad o barrio'}
              className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-base sm:text-xs" />
            <button type="submit" disabled={saving === field} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving === field ? '…' : 'Guardar'}</button>
          </form>
        ))}
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-700">{error}</p>}
      <button type="button" onClick={() => setShowMessage(s => !s)} className="text-[11px] font-semibold text-amber-800 underline">{showMessage ? 'Ocultar el mensaje' : 'Preguntar al anunciante'}</button>
      {showMessage && (
        <textarea readOnly rows={3} value={advertiserMessage(missing, title)} onFocus={e => e.currentTarget.select()} className="w-full rounded-lg border border-amber-200 bg-white p-2 text-base sm:text-xs text-slate-700" aria-label="Mensaje para el anunciante" />
      )}
    </div>
  )
}
