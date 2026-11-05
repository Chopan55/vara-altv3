import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dinero' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
