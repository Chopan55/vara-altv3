import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-6xl font-bold text-slate-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-sm text-slate-500 mb-6">
          La dirección que ingresaste no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
