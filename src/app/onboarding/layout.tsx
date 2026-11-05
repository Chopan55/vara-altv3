import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nueva operación' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
