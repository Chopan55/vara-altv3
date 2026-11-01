'use client'

import { useEffect, useRef, useState } from 'react'
import { isBuyWowV3Enabled } from '@/lib/analysis/access'
import { useBuyAnalysis } from '@/components/buy-v3/useBuyAnalysis'
import { BlockedPaste, EntryForm, ProgressPanel } from '@/components/buy-v3/Entry'
import { ResultView } from '@/components/buy-v3/ResultView'

/**
 * VARA Buy WOW V3 — pegás una propiedad y entendés qué hacer.
 *
 * Detrás del flag `buyWowV3` (o `?v3=1`). `?test=1` es el modo de prueba con
 * usuarios: pantalla limpia, sin menú, con la consigna y sin ninguna
 * explicación de la interfaz. Si hay que explicarla, la UX falló.
 */
export default function AnalizarPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [initialUrl, setInitialUrl] = useState('')
  const a = useBuyAnalysis()
  const autoRan = useRef(false)

  useEffect(() => {
    const q = window.location.search
    const params = new URLSearchParams(q)
    const on = isBuyWowV3Enabled(q)
    setEnabled(on)
    setTestMode(params.get('test') === '1')
    const url = params.get('url') ?? ''
    setInitialUrl(url)
    if (on && url && !autoRan.current) {
      autoRan.current = true
      void a.submit(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { state } = a
  const busy = state.phase === 'reading' || state.phase === 'analyzing'

  let body: React.ReactNode
  if (enabled === null) {
    body = <div className="mt-20 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
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
    body = <BlockedPaste message={state.message} onSubmit={text => a.submit(state.url, text)} />
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
