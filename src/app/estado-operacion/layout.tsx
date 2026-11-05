import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Estado de la operación' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
