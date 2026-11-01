'use client'
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { Property } from '@/types'
import { parseCount, saveOverride, type PropertyEdits } from '@/lib/propertyOverrides'

/**
 * Datos que el aviso no trajo o trajo mal: la persona los escribe y VARA los usa en todo
 * (ficha, comparador, análisis). Lo que falta (0) se marca; no se esconde.
 */
const FIELDS: { key: 'bedrooms' | 'bathrooms' | 'surface' | 'coveredSurface' | 'ageYears'; label: string; unit?: string }[] = [
  { key: 'bedrooms', label: 'Dormitorios' },
  { key: 'bathrooms', label: 'Baños' },
  { key: 'surface', label: 'Superficie total', unit: 'm²' },
  { key: 'coveredSurface', label: 'Superficie cubierta', unit: 'm²' },
  { key: 'ageYears', label: 'Antigüedad', unit: 'años' },
]

export function PropertyFactsEditor({ property, onSaved }: { property: Property; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const missing = FIELDS.filter(f => !property[f.key])

  function save() {
    const patch: PropertyEdits = {}
    for (const f of FIELDS) {
      const n = parseCount(values[f.key] ?? '')
      if (n !== undefined) patch[f.key] = n
    }
    if (values.garage === 'SI') patch.garage = true
    if (values.garage === 'NO') patch.garage = false
    if (Object.keys(patch).length === 0) return
    saveOverride(property.id, patch)
    setValues({})
    setOpen(false)
    onSaved()
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Datos de la propiedad</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {missing.length > 0
              ? `El aviso no trajo: ${missing.map(m => m.label.toLowerCase()).join(', ')}. Podés completarlo vos.`
              : 'Si algo no coincide con el aviso, corregilo acá y VARA lo usa en todo.'}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300">
          <Pencil size={12} aria-hidden="true" /> {open ? 'Cerrar' : 'Editar'}
        </button>
      </div>

      {open && (
        <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); save() }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(f => (
              <label key={f.key} className="block text-xs font-semibold text-slate-600">
                {f.label}{f.unit ? ` (${f.unit})` : ''}
                <input
                  inputMode="decimal"
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={property[f.key] ? `Ahora: ${property[f.key]}` : 'Sin dato'}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-normal sm:text-sm"
                />
              </label>
            ))}
            <div className="text-xs font-semibold text-slate-600">
              Cochera
              <div className="mt-1 flex gap-2">
                {[['SI', 'Sí'], ['NO', 'No']].map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={values.garage === v}
                    onClick={() => setValues(s => ({ ...s, garage: s.garage === v ? '' : v }))}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${values.garage === v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Guardar</button>
          <p className="text-[11px] text-slate-400">Se guarda en este dispositivo. Lo que escribas manda sobre lo que dice el aviso.</p>
        </form>
      )}
    </div>
  )
}
