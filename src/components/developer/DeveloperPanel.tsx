'use client'
import { useCallback, useState } from 'react'
import { useLoad } from '@/hooks/useLoad'
import Link from 'next/link'
import { Check, Copy, KeyRound, Loader2, Plus, Webhook, X } from 'lucide-react'
import {
  createApiKey, createWebhook, listApiKeys, listWebhooks, revokeApiKey, revokeWebhook,
  WEBHOOK_EVENTS, type DevError,
} from '@/lib/supabase/developer'
import type { ApiKeyRow, WebhookEndpointRow } from '@/lib/supabase/types'
import { accountUrl } from '@/lib/auth/entryJourney'
import { cn } from '@/lib/utils'

const ERRORS: Record<DevError, string> = {
  NOT_READY: 'Las claves y los webhooks todavía no están activados en la base de VARA.',
  NO_SESSION: 'Entrá a tu cuenta para crear claves y webhooks.',
  INVALID: 'Revisá los datos: la URL tiene que empezar con https://.',
  FAILED: 'No pudimos guardar. Probá de nuevo.',
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" aria-label={label}
      onClick={() => { void navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000) }) }}
      className={cn('flex-shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700')}>
      {ok ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
    </button>
  )
}

/** Claves de API y webhooks del usuario. Solo con sesión. */
export function DeveloperPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [hooks, setHooks] = useState<WebhookEndpointRow[]>([])
  const [state, setState] = useState<'loading' | 'ready' | DevError>('loading')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyName, setKeyName] = useState('')
  const [hookUrl, setHookUrl] = useState('')
  const [hookEvents, setHookEvents] = useState<string[]>([])
  const [error, setError] = useState<DevError | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [k, h] = await Promise.all([listApiKeys(), listWebhooks()])
    setKeys(k.data); setHooks(h.data)
    setState(k.error === 'NO_SESSION' || k.error === 'NOT_READY' ? k.error : 'ready')
  }, [])
  useLoad(load)

  async function addKey(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await createApiKey(keyName || 'Mi integración')
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setError(null); setNewKey(r.key ?? null); setKeyName('')
    await load()
  }

  async function addHook(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await createWebhook(hookUrl, hookEvents)
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setError(null); setHookUrl(''); setHookEvents([])
    await load()
  }

  if (state === 'loading') {
    return <p role="status" className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Cargando…</p>
  }
  if (state === 'NO_SESSION') {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 text-center shadow-card">
        <p className="text-sm text-slate-600">Entrá a tu cuenta para crear claves de API y webhooks.</p>
        <Link href={accountUrl('/vara-pro', 'login')} className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white">Entrar</Link>
      </div>
    )
  }
  if (state === 'NOT_READY') {
    return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">{ERRORS.NOT_READY}</p>
  }

  return (
    <div className="space-y-4">
      {/* Claves */}
      <section aria-label="Claves de API" className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <h3 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">
          <KeyRound size={14} className="text-brand-500" aria-hidden="true" /> Claves de API
        </h3>
        {newKey && (
          <div className="m-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-900">Copiá tu clave ahora: no la vamos a volver a mostrar.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-slate-800">{newKey}</code>
              <CopyButton text={newKey} label="Copiar clave" />
            </div>
          </div>
        )}
        {keys.length > 0 && (
          <ul className="divide-y divide-slate-50">
            {keys.map(k => (
              <li key={k.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-800">{k.name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{k.prefix}… · {k.last_used_at ? `usada ${new Date(k.last_used_at).toLocaleDateString('es-AR')}` : 'sin usar'}</span>
                </span>
                <button type="button" aria-label={`Revocar ${k.name}`} onClick={async () => { if (confirm(`¿Revocar la clave "${k.name}"? Las integraciones que la usen dejan de funcionar.`)) { await revokeApiKey(k.id); await load() } }}
                  className="rounded-lg p-1 text-slate-300 hover:text-rose-500"><X size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addKey} className="flex gap-2 border-t border-slate-100 px-4 py-3">
          <label htmlFor="key-name" className="sr-only">Nombre de la clave</label>
          <input id="key-name" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Nombre, ej: CRM"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={busy} className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Plus size={13} aria-hidden="true" /> Crear
          </button>
        </form>
      </section>

      {/* Webhooks */}
      <section aria-label="Webhooks" className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <h3 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">
          <Webhook size={14} className="text-brand-500" aria-hidden="true" /> Webhooks
        </h3>
        {hooks.length > 0 && (
          <ul className="divide-y divide-slate-50">
            {hooks.map(h => (
              <li key={h.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{h.url}</span>
                  <button type="button" aria-label={`Quitar ${h.url}`} onClick={async () => { await revokeWebhook(h.id); await load() }}
                    className="rounded-lg p-1 text-slate-300 hover:text-rose-500"><X size={14} aria-hidden="true" /></button>
                </div>
                <p className="text-[11px] text-slate-400">{h.events.length ? h.events.map(e => WEBHOOK_EVENTS.find(x => x.value === e)?.label ?? e).join(', ') : 'Todos los eventos'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Secreto para verificar la firma</span>
                  <CopyButton text={h.secret} label="Copiar secreto" />
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addHook} className="space-y-2 border-t border-slate-100 px-4 py-3">
          <label htmlFor="hook-url" className="sr-only">URL del webhook</label>
          <input id="hook-url" type="url" value={hookUrl} onChange={e => setHookUrl(e.target.value)} placeholder="https://tu-sistema.com/vara"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Eventos</legend>
            {WEBHOOK_EVENTS.map(ev => {
              const on = hookEvents.includes(ev.value)
              return (
                <button key={ev.value} type="button" aria-pressed={on}
                  onClick={() => setHookEvents(on ? hookEvents.filter(x => x !== ev.value) : [...hookEvents, ev.value])}
                  className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500')}>
                  {ev.label}
                </button>
              )
            })}
          </fieldset>
          <p className="text-[11px] text-slate-400">Sin eventos marcados recibís todos. Cada envío lleva X-Vara-Signature: sha256=HMAC del cuerpo con tu secreto.</p>
          <button type="submit" disabled={busy || !hookUrl.trim()} className="flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Plus size={13} aria-hidden="true" /> Agregar webhook
          </button>
        </form>
      </section>

      {error && <p role="alert" className="text-xs text-rose-600">{ERRORS[error]}</p>}
    </div>
  )
}
