import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { FunnelBeacon } from '@/components/layout/FunnelBeacon'

const description = 'Pegá el link de un aviso y en segundos ves cuánto sale de verdad: costo total, precio frente a avisos parecidos y qué preguntar antes de avanzar.'

export const metadata: Metadata = {
  title: { default: 'VARA — Comprá y vendé a tu manera', template: '%s · VARA' },
  description,
  openGraph: { siteName: 'VARA', title: '¿Cuánto te sale de verdad esa propiedad?', description, type: 'website', locale: 'es_AR' },
  twitter: { card: 'summary_large_image', title: '¿Cuánto te sale de verdad esa propiedad?', description },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-900 min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <FunnelBeacon />
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
