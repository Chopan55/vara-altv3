'use client'
import { useState, useEffect, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Home, FileText, Building2, DollarSign,
  MessageSquare, Eye, Share2,
  ChevronLeft, ChevronRight, Menu, X, Inbox,
  LogIn, LogOut, BookOpen, Search, Plus, Sparkles,
  ShieldAlert, Users, Landmark, Tag, MapPin, CalendarCheck, Briefcase,
  ClipboardCheck,
} from 'lucide-react'
import { tryCreateClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { useVaraState } from '@/hooks/useVaraState'
import { GuiameButton } from '@/components/guidance/GuiameButton'

const NO_SHELL = new Set(['/', '/onboarding', '/login'])

type JourneyType = 'BUY' | 'SELL'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  /** Etiqueta chica a la derecha, para señalar lo que recién se suma. */
  tag?: string
}

/**
 * El menú sigue el mapa del diseño de referencia, pero solo con destinos
 * que existen de verdad. "Búsqueda" y "Comparar" del mockup quedaron afuera
 * a propósito: no hay pantalla detrás, y un ítem que no lleva a ningún lado
 * hace perder más tiempo que el que ahorra.
 */
function getBuyNav(operationId: string): NavItem[] {
  return [
    { href: '/dashboard', icon: Home, label: 'Inicio' },
    { href: '/propiedades', icon: Building2, label: 'Mis propiedades' },
    { href: '/visitas', icon: ClipboardCheck, label: 'Checklist de visita' },
    { href: '/vara-visit', icon: MapPin, label: 'VARA Visit', tag: 'Nuevo' },
    { href: '/mis-visitas', icon: CalendarCheck, label: 'Visitas agendadas' },
    { href: `/operacion/${operationId}`, icon: FileText, label: 'Mi operación' },
    { href: `/operacion/${operationId}?tab=documentos`, icon: FileText, label: 'Documentos' },
    { href: `/operacion/${operationId}?tab=riesgos`, icon: ShieldAlert, label: 'Riesgos' },
    { href: '/dinero', icon: DollarSign, label: 'Dinero' },
    { href: '/profesionales', icon: Users, label: 'Profesionales' },
  ]
}

function getSellNav(operationId: string): NavItem[] {
  return [
    { href: '/dashboard', icon: Home, label: 'Inicio' },
    { href: '/publicar', icon: Share2, label: 'Mi propiedad' },
    { href: '/ofertas', icon: Inbox, label: 'Ofertas y negociación' },
    { href: '/visitas-vendedor', icon: Eye, label: 'Quién quiere visitar' },
    { href: '/vara-visit', icon: MapPin, label: 'VARA Visit', tag: 'Nuevo' },
    { href: '/mis-visitas', icon: CalendarCheck, label: 'Visitas agendadas' },
    { href: `/operacion/${operationId}`, icon: FileText, label: 'Mi operación' },
    { href: `/operacion/${operationId}?tab=documentos`, icon: FileText, label: 'Documentos' },
    { href: `/operacion/${operationId}?tab=riesgos`, icon: ShieldAlert, label: 'Riesgos' },
    { href: '/dinero', icon: DollarSign, label: 'Dinero' },
    { href: '/profesionales', icon: Users, label: 'Profesionales' },
  ]
}

const SECONDARY_NAV: NavItem[] = [
  { href: '/guia', icon: BookOpen, label: 'Guía' },
  { href: '/asistente', icon: MessageSquare, label: 'Asistente' },
  { href: '/vara-labs', icon: Sparkles, label: 'VARA Labs', tag: 'Labs' },
]

function isActive(pathname: string, search: string, href: string) {
  const [path, query] = href.split('?')
  // Tres ítems comparten /operacion/<id> y se diferencian solo por ?tab=.
  // Sin comparar la query se encenderían los tres a la vez.
  if (query) return pathname === path && search === query
  if (path === '/dashboard') return pathname === '/dashboard'
  if (path.startsWith('/operacion/')) return pathname === path && !search
  return pathname === path || pathname.startsWith(path + '/')
}

function NavLink({
  item,
  collapsed,
  onClick,
  pathname,
  search,
}: {
  item: NavItem
  collapsed: boolean
  onClick?: () => void
  pathname: string
  search: string
}) {
  const active = isActive(pathname, search, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
        collapsed ? 'justify-center' : '',
        active
          ? 'bg-brand-50 text-brand-700 font-semibold'
          : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100'
      )}
    >
      <Icon
        size={18}
        strokeWidth={active ? 2.2 : 1.8}
        className={cn('flex-shrink-0', active ? 'text-brand-600' : 'text-slate-400')}
      />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.tag && (
            <span className="ml-auto flex-shrink-0 rounded-md bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">
              {item.tag}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

function SidebarContent({
  collapsed,
  onClose,
  journey,
  pathname,
  userName,
  operationId,
}: {
  collapsed: boolean
  onClose?: () => void
  journey: JourneyType
  pathname: string
  userName: string
  operationId: string
}) {
  const primaryNav = journey === 'SELL' ? getSellNav(operationId) : getBuyNav(operationId)
  // useSearchParams obliga a un límite de Suspense; lo acotamos al menú
  // para no suspender el contenido de la página entera.
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  return (
    <div className="flex flex-col h-full py-5">
      <div className={cn('flex items-center mb-6 px-4', collapsed ? 'justify-center' : 'gap-3')}>
        <VaraLogo size={collapsed ? 22 : 26} showText={!collapsed} />
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar menú de navegación"
            className="ml-auto text-slate-400 hover:text-slate-700 p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {!collapsed && (
        <p className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {journey === 'SELL' ? 'Vendiendo' : 'Comprando'}
        </p>
      )}

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto no-scrollbar">
        {primaryNav.map(item => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onClick={onClose} pathname={pathname} search={search} />
        ))}

        <div className="my-3 border-t border-slate-200 mx-2" />

        {SECONDARY_NAV.map(item => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onClick={onClose} pathname={pathname} search={search} />
        ))}
      </nav>

      {/* Acceso permanente al asistente: es el atajo cuando el usuario no sabe dónde mirar. */}
      <div className="px-3 pb-2">
        <Link
          href="/asistente"
          onClick={onClose}
          title={collapsed ? 'VARA AI' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl bg-brand-600 hover:bg-brand-700 transition-colors px-3 py-3 text-white',
            collapsed ? 'justify-center' : ''
          )}
        >
          <Sparkles size={16} className="flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight">VARA AI</p>
              <p className="text-[10px] text-brand-100 leading-tight truncate">Preguntame lo que necesites</p>
            </div>
          )}
        </Link>
      </div>

      {/* El portal del partner es otra cara del producto, no otra sección de esta.
          Va discreto: la mayoría de los usuarios son clientes, no partners. */}
      {!collapsed && (
        <div className="px-3 pb-1">
          <Link
            href="/partner"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <Briefcase size={12} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
            Soy Visit Partner
          </Link>
        </div>
      )}

      <AuthFooter collapsed={collapsed} userName={userName} />
    </div>
  )
}

function AuthFooter({ collapsed, userName }: { collapsed: boolean; userName: string }) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let alive = true
    const supabase = tryCreateClient()
    if (!supabase) { setChecked(true); return }
    supabase.auth.getUser()
      .then(({ data }) => { if (alive) setEmail(data.user?.email ?? null) })
      .finally(() => { if (alive) setChecked(true) })
    return () => { alive = false }
  }, [])

  const logout = async () => {
    const supabase = tryCreateClient()
    if (!supabase) return
    await supabase.auth.signOut()
    setEmail(null)
    router.push('/')
    router.refresh()
  }

  // Sin sesión: invitamos a crear cuenta para no perder los datos al cambiar de dispositivo.
  if (checked && !email) {
    return (
      <div className="px-3 pt-3 border-t border-slate-200 mt-1">
        <Link
          href="/login"
          title={collapsed ? 'Entrar o crear cuenta' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors',
            collapsed ? 'justify-center' : ''
          )}
        >
          <LogIn size={16} className="flex-shrink-0 text-slate-400" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 font-semibold text-xs">Entrar</p>
              <p className="text-slate-400 text-[10px] truncate">Guardá tu operación</p>
            </div>
          )}
        </Link>
      </div>
    )
  }

  const initial = (email ?? userName ?? '?').charAt(0).toUpperCase()

  return (
    <div className="px-3 pt-3 border-t border-slate-200 mt-1">
      <div className={cn('flex items-center gap-3 px-2 py-2 rounded-xl', collapsed ? 'justify-center' : '')}>
        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-brand-700">{initial}</span>
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-slate-800 font-semibold text-xs truncate">{userName?.split(' ')[0] || 'Mi cuenta'}</p>
              <p className="text-slate-400 text-[10px] truncate">{email ?? 'Sin cuenta'}</p>
            </div>
            {email && (
              <button
                onClick={logout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors flex-shrink-0"
              >
                <LogOut size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Barra superior. El buscador manda a la Guía porque es lo único que hoy
 * tiene un índice real para buscar; prometer un buscador global que no busca
 * nada sería peor que no tenerlo.
 */
function TopBar({ onOpenDrawer, journey }: { onOpenDrawer: () => void; journey: JourneyType }) {
  const router = useRouter()
  const [q, setQ] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/guia?q=${encodeURIComponent(term)}` : '/guia')
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6 py-3 bg-white/90 backdrop-blur border-b border-slate-200">
      <button
        onClick={onOpenDrawer}
        aria-label="Abrir menú de navegación"
        className="lg:hidden text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none transition-colors"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <form onSubmit={submit} className="flex-1 max-w-md relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar en la guía: seña, boleto, sellos…"
          aria-label="Buscar en la guía"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
        />
      </form>

      <Link
        href={journey === 'SELL' ? '/publicar' : '/propiedades'}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition-colors"
      >
        <Plus size={15} />
        {journey === 'SELL' ? 'Mi propiedad' : 'Agregar propiedad'}
      </Link>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const vara = useVaraState()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const journey: JourneyType = vara.journeyType === 'SELL_PROPERTY' ? 'SELL' : 'BUY'

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Visit Mode ocupa la pantalla entera: el partner lo usa parado en la puerta
  // de una casa, con una mano. Un sidebar ahi seria un estorbo.
  if (NO_SHELL.has(pathname) || pathname.startsWith('/visit/')) {
    return <>{children}</>
  }

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-[248px]'

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-slate-200 transition-[width] duration-200',
          // sticky + h-screen: sin esto el menú se va para arriba al scrollear la página.
          'sticky top-0 h-screen',
          sidebarWidth
        )}
      >
        <Suspense fallback={null}>
          <SidebarContent
            collapsed={collapsed}
            journey={journey}
            pathname={pathname}
            userName={vara.userName}
            operationId={vara.operationId}
          />
        </Suspense>

        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-7 w-6 h-6 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 transition-colors z-10"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          {collapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronLeft size={12} aria-hidden="true" />}
        </button>
      </aside>

      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          'lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white border-r border-slate-200 transition-transform duration-200',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Suspense fallback={null}>
          <SidebarContent
            collapsed={false}
            onClose={() => setDrawerOpen(false)}
            journey={journey}
            pathname={pathname}
            userName={vara.userName}
            operationId={vara.operationId}
          />
        </Suspense>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenDrawer={() => setDrawerOpen(true)} journey={journey} />

        <main className="flex-1 min-w-0">
          {children}
        </main>

        <GuiameButton />
      </div>
    </div>
  )
}
