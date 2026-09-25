'use client'

/**
 * Cuando algo se rompe.
 *
 * Hasta acá no había ningún límite de error: un componente que tiraba una
 * excepción dejaba la pantalla en blanco. La persona no sabía si se cayó la
 * app, si se cortó internet o si hizo algo mal, y lo único que podía hacer
 * era irse.
 *
 * Esta pantalla hace tres cosas, en orden de importancia:
 *  1. dice que el problema es nuestro, no suyo;
 *  2. le deja una salida que funciona (reintentar, o volver al inicio);
 *  3. registra el evento, que es lo único que nos permite arreglarlo.
 *
 * Lo que NO hace es mostrar el stack. A nadie le sirve, y suele arrastrar
 * rutas internas y datos.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import { log } from '@/lib/observability/logger'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()

  useEffect(() => {
    log.error('app.crash', error, { route: pathname, code: error.digest ?? '' })
  }, [error, pathname])

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-7 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-amber-500" />
        </div>

        <h1 className="text-lg font-bold text-slate-900 mb-1.5">Se nos rompió algo</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          No fue culpa tuya y no perdiste nada de lo que habías cargado.
          Probá de nuevo; si vuelve a pasar, escribinos y lo miramos.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={reset}
            className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <RotateCcw size={14} /> Probar de nuevo
          </button>
          <Link href="/dashboard"
            className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Home size={14} /> Volver al inicio
          </Link>
        </div>

        {/*
          El digest es el identificador que genera Next para este error.
          Sirve para que, si nos escribís, podamos encontrar exactamente este
          caso. No dice nada de vos.
        */}
        {error.digest && (
          <p className="text-[10px] text-slate-300 mt-5 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
