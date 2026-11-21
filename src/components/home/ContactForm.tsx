'use client'
import { useState, useSyncExternalStore } from 'react'

/** Mensajes precargados según el motivo que trae el link (?tema=…). */
const TOPICS: Record<string, { message: string; place: string }> = {
  escribano: { message: 'Quiero que VARA me recomiende un escribano para mi operación.', place: 'Localidad y provincia de la propiedad' },
  notario: { message: 'Quiero que VARA me recomiende un notario para mi operación.', place: 'Municipio o alcaldía y estado de la propiedad' },
}

/** El motivo se lee de la URL sin estado: en el servidor no hay motivo; en el navegador, el de ?tema=. */
const noop = () => () => {}
const readTopic = () => new URLSearchParams(window.location.search).get('tema')
const serverTopic = () => null

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const t = useSyncExternalStore(noop, readTopic, serverTopic)
  const topic = t && TOPICS[t] ? TOPICS[t] : null

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    if (data.place) { data.message = `${data.message}\nUbicación de la propiedad: ${data.place}`; delete data.place }
    setStatus('sending'); setError('')
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'No pudimos enviarlo. Probá de nuevo en un rato.')
      }
      form.reset()
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviarlo.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800" role="status">
        Listo, recibimos tu mensaje. Te respondemos por mail.
      </div>
    )
  }

  const field = 'w-full rounded-xl border-2 border-slate-100 px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-400'
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input name="name" required maxLength={80} placeholder="Tu nombre" aria-label="Tu nombre" className={field} />
      <input name="email" type="email" required maxLength={120} placeholder="Tu mail" aria-label="Tu mail" className={field} />
      {topic && (
        <label className="block text-left text-sm text-slate-600">
          {topic.place}
          <input name="place" required minLength={3} maxLength={120} className={`${field} mt-1`} />
        </label>
      )}
      <textarea key={topic?.message ?? ''} name="message" required minLength={10} maxLength={800} rows={4} defaultValue={topic?.message ?? ''} placeholder="¿Qué querés hacer o qué te gustaría saber?" aria-label="Tu mensaje" className={field} />
      {/* Campo trampa: una persona no lo ve ni lo completa. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {status === 'error' && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {status === 'sending' ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}
