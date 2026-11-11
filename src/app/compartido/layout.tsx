import type { Metadata } from 'next'

const description = 'Precio frente a avisos parecidos, costo total con gastos y qué preguntarle al vendedor.'

export const metadata: Metadata = {
  title: 'Análisis compartido',
  description,
  robots: { index: false, follow: false },
  openGraph: { title: 'Mirá lo que VARA encontró sobre esta propiedad', description, type: 'website', locale: 'es_AR' },
  twitter: { card: 'summary_large_image', title: 'Mirá lo que VARA encontró sobre esta propiedad', description },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
