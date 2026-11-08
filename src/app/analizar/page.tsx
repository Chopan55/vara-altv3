'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBrowserValue } from '@/hooks/useHydrated'
import { isBuyWowV3Enabled } from '@/lib/analysis/access'
import { useBuyAnalysis } from '@/components/buy-v3/useBuyAnalysis'
import { BlockedPaste, EntryForm, ProgressPanel } from '@/components/buy-v3/Entry'
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
  const initialUrl = params.get('url') ?? ''
  // El acceso de prueba (?v3=1) se recuerda en el navegador: se lee recién al hidratar (null = cargando).
  const enabled = useBrowserValue<boolean | null>(() => isBuyWowV3Enabled(search ? `?${search}` : ''), null, search)
  const a = useBuyAnalysis()
  const { submit } = a
  const autoRan = useRef(false)

  // ?url=... analiza el aviso apenas se abre la página, una sola vez.
  useEffect(() => {
    if (enabled && initialUrl && !autoRan.current) {
      autoRan.current = true
      void submit(initialUrl)
    }
  }, [enabled, initialUrl, submit])

  const { state } = a
  const busy = state.phase === 'reading' || state.phase === 'analyzing'

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
    body = <ProgressPanel state={state} />
  } else if (state.phase === 'blocked') {
    body = (
      <BlockedPaste
        message={state.message}
        mx={isMexicanUrl(state.url)}
        onSubmit={text => a.submit(state.url, text)}
        onManual={m => a.submitManual(state.url, m)}
      />
    )
  } else {
    body = (
      <>
        {state.phase === 'error' && state.message && (
          <p role="alert" className="mt-8 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.message}</p>
        )}
        <EntryForm onSubmit={a.submit} busy={busy} initialUrl={initialUrl} />
      </>
    )
  }

  const content = (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
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
    ? <div className="fixed inset-0 z-50 overflow-auto bg-[var(--background,#fff)]">{content}</div>
    : content
}
