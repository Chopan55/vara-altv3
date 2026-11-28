import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planes',
  description: 'Conocé los planes de VARA para seguir tu compra o venta de una propiedad.',
}

export default function PlanesLayout({ children }: { children: React.ReactNode }) {
  return children
}
