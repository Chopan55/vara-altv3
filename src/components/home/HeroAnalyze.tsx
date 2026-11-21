'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Link2 } from 'lucide-react'

/** Acepta "zonaprop.com.ar/..." sin https:// y descarta lo que no es un link. */
export function normalizeListingUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes('.') || /\s/.test(t)) return null
    return u.toString()
  } catch {
    return null
  }
}

/**
 * La puerta de entrada: pegás el link del aviso y vas directo al análisis.
 * Sin cuenta ni formularios.
 */
export function HeroAnalyze() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = normalizeListingUrl(url)
    if (!clean) return setError('Pegá el link completo del aviso (por ejemplo, el de Zonaprop o Inmuebles24).')
    setError(null)
    router.push(`/analizar?url=${encodeURIComponent(clean)}`)
  }

  return (
    <div className="mx-auto mt-9 max-w-2xl text-left">
      <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-2 shadow-lg transition-shadow focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600 sm:flex-row">
        <label htmlFor="hero-url" className="sr-only">Link del aviso</label>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <Link2 size={18} className="flex-shrink-0 text-ink-soft" aria-hidden="true" />
          <input
            id="hero-url"
            value={url}
            onChange={e => { setUrl(e.target.value); if (error) setError(null) }}
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="Pegá el link del aviso"
            aria-invalid={!!error}
            aria-describedby={error ? 'hero-url-error' : 'hero-url-hint'}
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-ink-soft"
          />
        </div>
        <button type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Ver cuánto sale <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      {error ? (
        <p id="hero-url-error" role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
        </p>
      ) : (
        <p id="hero-url-hint" className="mt-2 px-1 text-sm text-ink-soft">
          Gratis y sin cuenta. Avisos de Argentina y México. Si un portal no deja leer el link, pegás el texto o cargás el precio.
        </p>
      )}
      {/* Para seguir una operación (compra o venta) se entra con la cuenta: el único acceso de clientes es Entrar. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
        <Link href="/login" className="text-brand-700 hover:underline">Entrar</Link>
        <Link href="/analizar" className="text-brand-700 hover:underline">No tengo el link</Link>
        <Link href="#como-funciona" className="text-ink-soft hover:text-ink">Ver cómo funciona</Link>
      </div>
    </div>
  )
}
