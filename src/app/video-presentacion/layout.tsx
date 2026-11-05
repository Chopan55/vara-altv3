import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Video de presentación' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
