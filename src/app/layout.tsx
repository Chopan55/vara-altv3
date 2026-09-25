import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'VARA — Tu GPS Inmobiliario',
  description: 'La plataforma que te guía en cada paso de tu operación inmobiliaria en Argentina.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-900 min-h-screen">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
