import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'VARA Pro' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
