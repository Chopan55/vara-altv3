'use client'
import { useEffect, useRef, useState } from 'react'
import { Building2, Check, RotateCcw, ScrollText, ShieldCheck, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BANK_NAME, CASE_REF, DEMO_PROPERTIES, EXECUTIVE_NOTE, NEVER_SHARED, SCOPE_INFO,
  acceptInvitation, chooseProperty, grantConsent, initialState, isConsentActive, readAsExecutive, revokeConsent, setNextStep,
  type DemoState, type ExecutiveView, type Scope,
} from '@/lib/bank/demo'

type Tab = 'cliente' | 'ejecutivo' | 'auditoria'

const fmt = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
const nowIso = () => new Date().toISOString()

const ACTION_LABEL: Record<string, string> = {
  INVITATION_ACCEPTED: 'Invitación aceptada',
  CONSENT_GRANTED: 'Permiso otorgado',
  MILESTONES_READ: 'Hitos consultados',
  STATUS_UPDATED: 'Estado actualizado',
  CONSENT_REVOKED: 'Permiso retirado',
  ACCESS_DENIED: 'Acceso denegado',
}

export default function BancoDemoPage() {
  const [state, setState] = useState<DemoState>(initialState)
  const [tab, setTab] = useState<Tab>('cliente')
  const [scopes, setScopes] = useState<Scope[]>(['INVITATION_ACCEPTED', 'PROPERTY_SELECTED'])
  const [previewing, setPreviewing] = useState(false)
  const [clientNotice, setClientNotice] = useState<string | null>(null)
  const [execView, setExecView] = useState<ExecutiveView | null>(null)
  const [execNotice, setExecNotice] = useState<string | null>(null)
  const [form, setForm] = useState({ status: 'Tasación a coordinar', owner: 'Equipo de tasación' })

  const panelRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    panelRef.current?.focus()
  }, [tab])

  const consent = state.consent
  const active = isConsentActive(consent)
  const revokedAt = consent?.revokedAt ?? null
  const chosen = DEMO_PROPERTIES.find(p => p.id === state.chosenPropertyId) ?? null
  // El ejecutivo se conecta con el último permiso que conoce; si el cliente lo retiró, ese permiso ya no sirve.
  const presentedId = consent?.id ?? 'permiso-0'

  function readExecutive(id: string = presentedId) {
    const { state: next, view } = readAsExecutive(state, id, nowIso())
    setState(next)
    setExecView(view)
    setExecNotice(null)
  }

  function openTab(next: Tab) {
    setTab(next)
    if (next === 'ejecutivo') readExecutive()
  }

  function toggleScope(scope: Scope) {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope])
    setPreviewing(false)
  }

  function confirmShare() {
    const result = grantConsent(state, scopes, nowIso())
    setState(result.state)
    setClientNotice(result.ok ? null : result.reason)
    if (result.ok) setPreviewing(false)
  }

  function register() {
    const result = setNextStep(state, presentedId, form, nowIso())
    setState(result.state)
    if (result.ok) {
      const { state: after, view } = readAsExecutive(result.state, presentedId, nowIso())
      setState(after)
      setExecView(view)
      setExecNotice('Registrado. El cliente lo ve en su pantalla.')
    } else {
      setExecView({ allowed: false, reason: 'El cliente no tiene un permiso activo para este caso. No hay hitos para mostrar.' })
      setExecNotice(result.reason)
    }
  }

  function reset() {
    setState(initialState())
    setScopes(['INVITATION_ACCEPTED', 'PROPERTY_SELECTED'])
    setPreviewing(false)
    setClientNotice(null)
    setExecView(null)
    setExecNotice(null)
    setTab('cliente')
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'cliente', label: 'Vista del cliente', icon: User },
    { id: 'ejecutivo', label: 'Vista del ejecutivo', icon: Building2 },
    { id: 'auditoria', label: `Auditoría (${state.audit.length})`, icon: ScrollText },
  ]

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 pb-24 pt-6">
      <div className="mx-auto max-w-3xl">
        <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Demostración con datos ficticios.</strong> {BANK_NAME} y los clientes no existen. No es una oferta de crédito ni una
          promesa de aprobación. VARA no evalúa crédito: el banco decide por sus propios circuitos.
        </div>

        <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">VARA para bancos</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              El cliente busca y entiende en privado. El banco ve solo los hitos que el cliente decide compartir, y el permiso se
              puede retirar cuando quiera.
            </p>
          </div>
          <button type="button" onClick={reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-brand-700">
            <RotateCcw size={14} aria-hidden="true" /> Reiniciar demo
          </button>
        </header>

        <div role="tablist" aria-label="Vistas de la demo" className="mt-5 flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => openTab(id)}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
                tab === id ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}>
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {tab === 'cliente' && (
          <section ref={panelRef} id="panel-cliente" tabIndex={-1} role="tabpanel" aria-labelledby="tab-cliente" className="mt-5 space-y-4">
            <Card title="1. Invitación">
              {state.invitationAcceptedAt ? (
                <p className="flex items-center gap-2 text-sm text-slate-700"><Check size={15} className="text-emerald-600" aria-hidden="true" /> Aceptada el {fmt(state.invitationAcceptedAt)}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">Tu ejecutivo de {BANK_NAME} te invitó a activar VARA para organizar tu búsqueda y entender qué te falta. Podés explorar en privado.</p>
                  <Btn onClick={() => setState(acceptInvitation(state, nowIso()))}>Aceptar invitación</Btn>
                </>
              )}
            </Card>

            <Card title="2. Tus propiedades (privadas)">
              <p className="text-sm text-slate-600">Solo las ves vos. El banco no sabe qué guardaste ni qué analizaste.</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {DEMO_PROPERTIES.map(p => (
                  <li key={p.id} className={cn('rounded-xl border p-3', state.chosenPropertyId === p.id ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 bg-white')}>
                    <p className="text-sm font-bold text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-600">{p.zone}</p>
                    <p className="mt-1 text-xs text-slate-600">{p.price}</p>
                    <button type="button" disabled={!state.invitationAcceptedAt || state.chosenPropertyId === p.id}
                      onClick={() => { setState(chooseProperty(state, p.id)); setPreviewing(false) }}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50">
                      {state.chosenPropertyId === p.id ? 'Elegida (privada)' : 'Elegir esta propiedad'}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={`3. Compartir con ${BANK_NAME}`}>
              {active && consent ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><ShieldCheck size={16} aria-hidden="true" /> Compartido desde el {fmt(consent.grantedAt)}</p>
                  <ul className="text-sm text-slate-700">
                    {consent.scopes.map(s => <li key={s}>• {SCOPE_INFO[s].label}: {SCOPE_INFO[s].bankSees}</li>)}
                  </ul>
                  {consent.propertyId && (
                    <p className="text-sm text-slate-700">
                      Propiedad compartida: <strong>{DEMO_PROPERTIES.find(p => p.id === consent.propertyId)?.title}</strong>. Si elegís otra, el banco sigue viendo esta; para compartir otra, retirá el permiso y volvé a compartir.
                    </p>
                  )}
                  <Btn tone="danger" onClick={() => { setState(revokeConsent(state, nowIso())); setClientNotice(null) }}>Retirar permiso</Btn>
                </div>
              ) : (
                <div className="space-y-3">
                  {revokedAt && (
                    <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
                      Retiraste el permiso el {fmt(revokedAt)}. {BANK_NAME} ya no ve ningún hito. Podés volver a compartir cuando quieras: el permiso nuevo es otro y los enlaces anteriores no sirven.
                    </p>
                  )}
                  <fieldset>
                    <legend className="text-sm font-semibold text-slate-800">¿Qué querés compartir?</legend>
                    {(Object.keys(SCOPE_INFO) as Scope[]).map(scope => (
                      <label key={scope} className="mt-2 flex min-h-11 items-start gap-2 text-sm text-slate-700">
                        <input type="checkbox" className="mt-1" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)}
                          disabled={scope === 'PROPERTY_SELECTED' && !chosen} />
                        <span>{SCOPE_INFO[scope].label}{scope === 'PROPERTY_SELECTED' && !chosen ? ' (elegí una propiedad primero)' : ''}</span>
                      </label>
                    ))}
                  </fieldset>
                  {!previewing ? (
                    <Btn onClick={() => { setClientNotice(null); setPreviewing(true) }} disabled={scopes.length === 0 || !state.invitationAcceptedAt}>Ver qué vería el banco</Btn>
                  ) : (
                    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3" data-testid="consent-preview">
                      <p className="text-sm font-bold text-brand-900">Esto es exactamente lo que vería {BANK_NAME}:</p>
                      <ul className="mt-1 text-sm text-slate-800">
                        {scopes.map(s => <li key={s}>• {SCOPE_INFO[s].label}: {SCOPE_INFO[s].bankSees}</li>)}
                      </ul>
                      <p className="mt-2 text-sm text-slate-800">• {EXECUTIVE_NOTE}</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">Lo que NO ve nunca:</p>
                      <ul className="text-sm text-slate-700">{NEVER_SHARED.map(n => <li key={n}>• {n}</li>)}</ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn onClick={confirmShare}>Confirmar y compartir</Btn>
                        <Btn tone="ghost" onClick={() => setPreviewing(false)}>Cancelar</Btn>
                      </div>
                    </div>
                  )}
                  {clientNotice && <p role="alert" className="text-sm text-red-700">{clientNotice}</p>}
                </div>
              )}
            </Card>

            <Card title="4. Próximo paso">
              {state.nextStep ? (
                <p className="text-sm text-slate-800"><strong>{state.nextStep.status}</strong> · Responsable: {state.nextStep.owner} · actualizado el {fmt(state.nextStep.updatedAt)}</p>
              ) : (
                <p className="text-sm text-slate-600">Cuando el ejecutivo coordine una gestión, la ves acá con el responsable y la fecha.</p>
              )}
            </Card>
          </section>
        )}

        {tab === 'ejecutivo' && (
          <section ref={panelRef} id="panel-ejecutivo" tabIndex={-1} role="tabpanel" aria-labelledby="tab-ejecutivo" className="mt-5 space-y-4">
            <Card title={`Panel del ejecutivo · ${BANK_NAME} · ${CASE_REF}`}>
              {execView?.allowed ? (
                execView.milestones.length > 0 ? (
                  <ul className="space-y-2">
                    {execView.milestones.map(m => (
                      <li key={m.kind} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <strong>{m.label}</strong> — {m.detail} <span className="text-slate-600">({fmt(m.at)})</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-600">El permiso está activo pero todavía no hay hitos para mostrar.</p>
              ) : (
                <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">{execView?.reason ?? 'Sin datos todavía.'}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn tone="ghost" onClick={() => readExecutive()}>Actualizar vista</Btn>
                <Btn tone="ghost" onClick={() => readExecutive('permiso-1')}>Probar con el enlace guardado antes</Btn>
              </div>
            </Card>

            <Card title="Registrar la próxima gestión">
              <p className="text-sm text-slate-600">El ejecutivo coordina en su circuito habitual y deja acá solo el estado y el responsable.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">Estado
                  <input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} maxLength={80}
                    className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-800">Responsable
                  <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} maxLength={80}
                    className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" />
                </label>
              </div>
              <div className="mt-3"><Btn onClick={register}>Registrar</Btn></div>
              {execNotice && <p role="status" className="mt-2 text-sm text-slate-800">{execNotice}</p>}
            </Card>
          </section>
        )}

        {tab === 'auditoria' && (
          <section ref={panelRef} id="panel-auditoria" tabIndex={-1} role="tabpanel" aria-labelledby="tab-auditoria" className="mt-5">
            <Card title="Registro de auditoría">
              <p className="text-sm text-slate-600">Quién hizo qué, sobre qué caso y con qué alcance. No copia el contenido de los hitos.</p>
              {state.audit.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Todavía no hay eventos.</p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {state.audit.map(e => (
                    <li key={e.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-900">{ACTION_LABEL[e.action]}</span>
                      <span className="text-slate-600"> · {e.actor === 'CLIENT' ? 'Cliente' : 'Ejecutivo'} · {e.caseRef} · alcance: {e.scope} · {fmt(e.at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>
        )}

        <p className="mt-8 text-xs leading-relaxed text-slate-600">
          Lo que esta demo no hace: no evalúa ni predice la decisión del banco, no lee documentos, no se conecta con sistemas del banco
          y no envía mensajes. Un piloto real requiere acordar con la entidad los datos permitidos, la auditoría y la retención.
        </p>
      </div>
    </main>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Btn({ children, onClick, disabled, tone = 'primary' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        'mt-2 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:opacity-50',
        tone === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        tone === 'ghost' && 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300',
        tone === 'danger' && 'bg-red-700 text-white hover:bg-red-800',
      )}>
      {children}
    </button>
  )
}
