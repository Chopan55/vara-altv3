import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Guía paso a paso' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
