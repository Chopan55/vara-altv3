'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { exampleById, formatCopiedAt } from '@/data/exampleListing'
import { AlertCircle } from 'lucide-react'
import { useBrowserValue } from '@/hooks/useHydrated'
import { isBuyWowV3Enabled } from '@/lib/analysis/access'
import { useBuyAnalysis } from '@/components/buy-v3/useBuyAnalysis'
import { BlockedPaste, BrightDataPanel, EntryForm, ProgressPanel } from '@/components/buy-v3/Entry'
import { isMexicanUrl } from '@/lib/analysis/country'
import { ResultView } from '@/components/buy-v3/ResultView'

/**
 * VARA Buy WOW V3 — pegás una propiedad y entendés qué hacer.
 *
 * Encendido por defecto (flag `buyWowV3`; se apaga con NEXT_PUBLIC_FLAGS_OFF). `?test=1` es el modo de prueba con
 * usuarios: pantalla limpia, sin menú, con la consigna y sin ninguna
 * explicación de la interfaz. Si hay que explicarla, la UX falló.
 */
const Spinner = () => <div className="mx-auto mt-20 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />

// useSearchParams necesita un límite de Suspense para el prerender.
export default function AnalizarPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 py-6"><Spinner /></main>}>
      <Analizar />
    </Suspense>
  )
}

function Analizar() {
  // Los parámetros salen de la ruta (no de window.location): al llegar desde la home con
  // navegación del cliente, window.location todavía tiene la dirección anterior durante el render.
  const params = useSearchParams()
  const search = params.toString()
  const testMode = params.get('test') === '1'
  const example = exampleById(params.get('ejemplo'))
  const isExample = example !== null
  const initialUrl = isExample ? '' : (params.get('url') ?? '')
  // El acceso de prueba (?v3=1) se recuerda en el navegador: se lee recién al hidratar (null = cargando).
  const enabled = useBrowserValue<boolean | null>(() => isBuyWowV3Enabled(search ? `?${search}` : ''), null, search)
  const a = useBuyAnalysis()
  const { submit } = a
  /** Qué se analizó solo al abrir: si cambia el ejemplo o el link sin salir de la página, se analiza el nuevo. */
  const autoRan = useRef<string | null>(null)

  // ?url=... analiza el aviso apenas se abre la página, una sola vez. ?ejemplo=1 analiza el aviso real de ejemplo.
  useEffect(() => {
    if (!enabled) return
    const key = example ? `ejemplo:${example.id}` : initialUrl ? `url:${initialUrl}` : null
    if (!key || autoRan.current === key) return
    autoRan.current = key
    if (example) void submit(example.url, example.text, { example: true, comparables: example.comparables })
    else void submit(initialUrl)
  }, [enabled, initialUrl, example, submit])

  const { state } = a
  const busy = state.phase === 'reading' || state.phase === 'analyzing'
  // Un aviso pegado como texto o cargado a mano no tiene link: se le da uno único para que no se pisen entre sí.
  const pastedUrl = () => `https://aviso.pegado/${Date.now()}`

  let body: React.ReactNode
  if (enabled === null) {
    body = <Spinner />
  } else if (!enabled) {
    body = (
      <div className="pt-16">
        <h1 className="text-xl font-semibold text-slate-900">Esta vista previa todavía no está habilitada</h1>
        <p className="mt-2 text-slate-600">Para probarla, agregá <code>?v3=1</code> al final de la dirección.</p>
      </div>
    )
  } else if (state.phase === 'done') {
    body = <ResultView state={state} actions={a} onAnother={a.reset} />
  } else if (state.phase === 'reading' || state.phase === 'analyzing') {
    body = (
      <ProgressPanel
        state={state}
        mx={isMexicanUrl(state.url)}
        onConfirm={a.confirmField}
        onPaste={text => a.submit(state.url, text)}
        onManual={m => a.submitManual(state.url, m)}
        onPause={a.holdRead}
        onRetry={() => a.submit(state.url)}
      />
    )
  } else if (state.phase === 'brightdata') {
    body = <BrightDataPanel progress={state.brightDataProgress} message={state.message} mx={isMexicanUrl(state.url)} onSubmit={text => a.submit(state.url, text)} onManual={m => a.submitManual(state.url, m)} />
  } else if (state.phase === 'blocked') {
    body = (
      <BlockedPaste
        message={state.message}
        mx={isMexicanUrl(state.url)}
        url={state.url}
        onSubmit={text => a.submit(state.url, text)}
        onManual={m => a.submitManual(state.url, m)}
      />
    )
  } else {
    body = (
      <>
        {state.phase === 'error' && state.message && (
          <p role="alert" className="mt-8 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{state.message}
          </p>
        )}
        <EntryForm
          onSubmit={a.submit}
          busy={busy}
          initialUrl={initialUrl}
          onPasteText={text => a.submit(pastedUrl(), text)}
          onManual={m => a.submitManual(pastedUrl(), m)}
        />
      </>
    )
  }

  const content = (
    <main className="mx-auto min-w-0 w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {example && enabled && (
        <p role="note" className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-slate-700">
          <strong>Ejemplo con avisos reales</strong> de {example.portal} (la propiedad y {example.comparables.length} parecidas de la zona), copiados el {formatCopiedAt(example.copiedAt)}. Puede que ya no estén publicados. {example.id === 'cdmx' ? 'Para analizar el tuyo, pega su link en la portada.' : 'Para analizar el tuyo, pegá su link en la portada.'}
        </p>
      )}
      {testMode && enabled && state.phase === 'idle' && (
        <p className="mb-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          Estás evaluando esta propiedad. Usá VARA para decidir qué harías.
        </p>
      )}
      {body}
    </main>
  )

  // Modo de prueba: tapa el menú de la app para que no haya nada que explicar.
  return testMode
    ? <div className="fixed inset-0 z-50 min-w-0 overflow-x-hidden overflow-y-auto bg-[var(--background,#fff)] print:static print:overflow-visible">{content}</div>
    : content
}
