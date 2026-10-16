'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { VaraVisitLogo } from '@/components/ui/VaraVisitLogo'
import { tryCreateClient } from '@/lib/supabase/client'

/**
 * Barra del portal de Visit Partners.
 *
 * Los partners no usan el menú de quien compra o vende: es otra puerta del
 * producto, con otra cara. Esta barra es lo único que comparten con el resto de
 * la app, y solo lo necesario para saber dónde están y poder salir.
 */
export function PartnerBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = tryCreateClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  async function logout() {
    await tryCreateClient()?.auth.signOut()
    router.push('/partner/entrar')
    router.refresh()
  }

  // La pantalla de entrada ocupa todo: ahí la barra sobra.
  if (pathname === '/partner/entrar') return null

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 lg:px-6">
        <VaraVisitLogo size={30} href="/partner" />
        <span className="hidden rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 sm:inline">Partners</span>

        <div className="ml-auto flex items-center gap-3">
          {email ? (
            <>
              <span className="hidden max-w-[200px] truncate text-xs text-slate-500 sm:inline">{email}</span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <LogOut size={13} aria-hidden="true" /> Salir
              </button>
            </>
          ) : (
            <Link
              href="/partner/entrar"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
