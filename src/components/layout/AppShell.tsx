'use client'
import { useState, useEffect, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Home, FileText, Building2, DollarSign,
  MessageSquare, Eye, Share2,
  ChevronLeft, ChevronRight, Menu, X, Inbox,
  LogIn, LogOut, BookOpen, Search, Plus, Sparkles,
  ShieldAlert, Users, MapPin, CalendarCheck,
  ClipboardCheck, Zap, BarChart2, Globe, FolderOpen, LifeBuoy, ChevronDown, Wrench,
} from 'lucide-react'
import { tryCreateClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { isEnabled } from '@/lib/flags'
import { useVaraState } from '@/hooks/useVaraState'
import { useOperations } from '@/hooks/useOperations'
import { journeyToStored } from '@/lib/journey'
import { forcedJourney } from '@/lib/routeContext'
import { searchApp } from '@/lib/search/appSearch'
import { GuiameButton, GuiameTrigger } from '@/components/guidance/GuiameButton'
import { VaraAIFloat } from '@/components/ai/VaraAIFloat'

const NO_SHELL = new Set(['/', '/onboarding', '/login', '/demo', '/labs', '/empezar', '/property-pack', '/planes'])

type JourneyType = 'BUY' | 'SELL'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  /** Etiqueta chica a la derecha, para señalar lo que recién se suma. */
  tag?: string
  /** Encabezado del grupo: se muestra cuando cambia respecto del ítem anterior. */
  section?: string
}

/**
 * Menú en tres niveles, para que nadie se pierda:
 *  1. Cinco destinos fijos (los mismos en la barra de abajo del celular).
 *  2. Herramientas del recorrido (compra o venta), plegadas.
 *  3. Más: país, compartidas, VARA Visit y Labs, plegadas.
 */
function getPrimaryNav(operationId: string): NavItem[] {
  const opHref = operationId ? `/operacion/${operationId}` : '/operacion/inicio'
  return [
    { href: '/dashboard', icon: Home, label: 'Inicio' },
    { href: opHref, icon: FileText, label: 'Mi operación' },
    { href: '/dinero', icon: DollarSign, label: 'Dinero' },
    { href: `${opHref}?tab=documentos`, icon: FolderOpen, label: 'Documentos' },
    { href: '/guia', icon: LifeBuoy, label: 'Ayuda' },
  ]
}

function getBuyTools(operationId: string): NavItem[] {
  const opHref = operationId ? `/operacion/${operationId}` : '/operacion/inicio'
  return [
    { href: '/acciones', icon: Zap, label: 'Qué hago ahora' },
    // VARA Buy WOW V3: pegás el link de una propiedad y VARA la analiza.
    ...(isEnabled('buyWowV3') ? [{ href: '/analizar', icon: Search, label: 'Analizar propiedad' } as NavItem] : []),
    { href: '/mi-busqueda', icon: ClipboardCheck, label: 'Mi búsqueda' },
    { href: '/propiedades', icon: Building2, label: 'Propiedades' },
    { href: '/comparar', icon: BarChart2, label: 'Comparar' },
    { href: '/visitas', icon: ClipboardCheck, label: 'Checklist de visita' },
    { href: '/mis-visitas', icon: CalendarCheck, label: 'Visitas agendadas' },
    { href: `${opHref}?tab=riesgos`, icon: ShieldAlert, label: 'Riesgos' },
    { href: '/profesionales', icon: Users, label: 'Profesionales' },
  ]
}

function getSellTools(operationId: string): NavItem[] {
  const opHref = operationId ? `/operacion/${operationId}` : '/operacion/inicio'
  return [
    { href: '/acciones', icon: Zap, label: 'Qué hago ahora' },
    { href: '/publicar', icon: Share2, label: 'Mi propiedad' },
    { href: '/precio-venta', icon: DollarSign, label: 'Precio' },
    { href: '/revisar-publicacion', icon: Eye, label: 'Publicación' },
    { href: '/fotos-venta', icon: Eye, label: 'Fotos y video' },
    { href: '/interesados', icon: Users, label: 'Interesados' },
    { href: '/ofertas', icon: Inbox, label: 'Ofertas' },
    { href: '/visitas-vendedor', icon: CalendarCheck, label: 'Visitas' },
    { href: '/preparar-venta', icon: FileText, label: 'Papeles de la venta' },
    { href: `${opHref}?tab=riesgos`, icon: ShieldAlert, label: 'Riesgos' },
    { href: '/profesionales', icon: Users, label: 'Profesionales' },
  ]
}

const JOURNEY_TOOL_HREFS = new Set(['/mi-busqueda', '/preparar-venta', '/precio-venta', '/property-pack', '/video-presentacion', '/interesados', '/fotos-venta', '/revisar-publicacion', '/recorrido-ia'])

/** Lo que no es del día a día: plegado bajo "Más". Labs (lo que está en prueba) va acá, no en el menú principal. */
const MORE_NAV: NavItem[] = [
  { href: '/configuracion', icon: Globe, label: 'País y alertas' },
  { href: '/compartida', icon: Users, label: 'Compartidas conmigo' },
  { href: '/asistente', icon: MessageSquare, label: 'Asistente' },
  { href: '/vara-visit', icon: MapPin, label: 'VARA Visit' },
  { href: '/vara-labs', icon: Sparkles, label: 'VARA Labs' },
]

/** Sin cuenta ni operación, estas pantallas se ven sin menú: el que llega de un link no tiene nada que administrar. */
const PUBLIC_WHEN_NEW = new Set(['/analizar', '/compartido'])

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

/** Grupo plegable del menú. Con el menú angosto (solo íconos) se muestra abierto. */
function NavGroup({
  label, icon: Icon, open, collapsed, onToggle, children,
}: {
  label: string; icon: React.ElementType; open: boolean; collapsed: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="pt-1">
      {!collapsed && (
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 hover:bg-slate-50 hover:text-slate-600">
          <Icon size={15} className="flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          <ChevronDown size={14} aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      )}
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

/**
 * Barra de abajo en el celular: los mismos cinco destinos fijos que el menú.
 * Se alcanza con el pulgar y no hace falta abrir el menú para lo de todos los días.
 */
function MobileTabBar({ operationId }: { operationId: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  return (
    <nav aria-label="Accesos principales"
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {getPrimaryNav(operationId).map(item => {
          const active = isActive(pathname, search, item.href)
          const Icon = item.icon
          return (
            <li key={item.label}>
              <Link href={item.href} aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[10px] font-semibold',
                  active ? 'text-brand-700' : 'text-slate-500')}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Marco mínimo para quien llega de afuera (sin cuenta ni operación): logo, entrar y el contenido. */
function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
        <VaraLogo size={24} />
        <Link href="/login" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Entrar</Link>
      </header>
      {/* Las páginas ya traen su propio <main>: acá solo el ancla del "saltar al contenido". */}
      <div id="main-content">{children}</div>
    </div>
  )
}

function SidebarContent({
  collapsed,
  onClose,
  journey,
  pathname,
  userName,
  operationId,
  onChangeJourney,
}: {
  collapsed: boolean
  onClose?: () => void
  journey: JourneyType
  pathname: string
  userName: string
  operationId: string
  onChangeJourney: (j: JourneyType) => void
}) {
  const primaryNav = getPrimaryNav(operationId)
  // Interruptor de rollback: sin las herramientas nuevas del recorrido.
  const tools = (journey === 'SELL' ? getSellTools(operationId) : getBuyTools(operationId))
    .filter(i => isEnabled('journeyTools') || !JOURNEY_TOOL_HREFS.has(i.href))
  // useSearchParams obliga a un límite de Suspense; lo acotamos al menú
  // para no suspender el contenido de la página entera.
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  // Un grupo plegado se abre solo si estás en una de sus pantallas. Con el menú agrupado
  // apagado (rollback), las herramientas quedan siempre a la vista.
  const inTools = tools.some(t => isActive(pathname, search, t.href))
  const inMore = MORE_NAV.some(t => isActive(pathname, search, t.href))
  const [toolsOpen, setToolsOpen] = useState(inTools || !isEnabled('groupedMenu'))
  const [moreOpen, setMoreOpen] = useState(inMore)
  const showTools = toolsOpen || inTools || collapsed
  const showMore = moreOpen || inMore || collapsed

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
        <div role="group" aria-label="Qué estás haciendo" className="mx-4 mb-2 flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-semibold">
          {(['BUY', 'SELL'] as const).map(j => (
            <button
              key={j}
              type="button"
              aria-pressed={journey === j}
              onClick={() => onChangeJourney(j)}
              className={cn('flex-1 rounded-[10px] px-2 py-1.5 transition-colors', journey === j ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              {j === 'SELL' ? 'Vendiendo' : 'Comprando'}
            </button>
          ))}
        </div>
      )}

      <nav aria-label="Menú principal" className="flex-1 space-y-0.5 px-3 overflow-y-auto no-scrollbar">
        {primaryNav.map(item => (
          <NavLink key={`${item.href}|${item.label}`} item={item} collapsed={collapsed} onClick={onClose} pathname={pathname} search={search} />
        ))}

        <div className="my-3 border-t border-slate-200 mx-2" />

        <NavGroup
          label={journey === 'SELL' ? 'Herramientas de venta' : 'Herramientas de compra'}
          icon={Wrench} open={showTools} collapsed={collapsed}
          onToggle={() => setToolsOpen(o => !o)}
        >
          {tools.map(item => (
            <NavLink key={`${item.href}|${item.label}`} item={item} collapsed={collapsed} onClick={onClose} pathname={pathname} search={search} />
          ))}
        </NavGroup>

        <NavGroup label="Más" icon={BookOpen} open={showMore} collapsed={collapsed} onToggle={() => setMoreOpen(o => !o)}>
          {MORE_NAV.map(item => (
            <NavLink key={`${item.href}|${item.label}`} item={item} collapsed={collapsed} onClick={onClose} pathname={pathname} search={search} />
          ))}
        </NavGroup>
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

      {/* El portal del Visit Partner NO está en este menú: es otra cara del producto
          y entra por la pantalla de login, no desde adentro de la cuenta de quien
          compra o vende. */}
      <AuthFooter collapsed={collapsed} userName={userName} />
    </div>
  )
}

function AuthFooter({ collapsed, userName }: { collapsed: boolean; userName: string }) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  // Sin base configurada no hay sesión que consultar.
  const [done, setDone] = useState(false)
  const checked = !isSupabaseConfigured || done

  useEffect(() => {
    const supabase = tryCreateClient()
    if (!supabase) return
    let alive = true
    supabase.auth.getUser()
      .then(({ data }) => { if (alive) setEmail(data.user?.email ?? null) })
      .finally(() => { if (alive) setDone(true) })
    return () => { alive = false }
  }, [])

  const logout = async () => {
    const supabase = tryCreateClient()
    if (!supabase) return
    await supabase.auth.signOut()
    // Limpiar datos locales VARA del usuario saliente (H15)
    try {
      const keysToRemove = [
        'vara_operations', 'vara_operation_id', 'vara_ops_migrated',
        'vara_imported_property', 'vara_imported_properties', 'vara_candidates', 'vara_candidates_adopted',
        'vara_user_name', 'vara_journey_type', 'vara_province',
        'vara_property_url', 'vara_onboarding_done', 'vara_dismissed_guidance',
        'vara_country', 'vara_publish_requests', 'vara_publish_draft', 'vara_scoring_weights',
        // Mapas de ids de la migración invitado → cuenta: no deben pasar a la persona que entre después.
        'vara_ops_idmap', 'vara_props_idmap', 'vara_props_promo_links', 'vara_save_banner_dismissed',
      ]
      keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch {}
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
              <p className="text-slate-400 text-[10px] truncate">{email ?? 'Verificando sesión…'}</p>
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
function TopBar({
  onOpenDrawer, journey, guiaOpen, onToggleGuia,
}: {
  onOpenDrawer: () => void
  journey: JourneyType
  guiaOpen: boolean
  onToggleGuia: () => void
}) {
  const router = useRouter()
  const { activeOperationId, operations } = useOperations()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const results = searchApp(q, { journey, operationId: activeOperationId, operations: operations.map(o => ({ id: o.id, title: o.title })) })

  const go = (href: string) => { setOpen(false); setQ(''); router.push(href) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (results[0]) go(results[0].href)
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

      <form onSubmit={submit} className="flex-1 max-w-md relative" role="search">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar en VARA: documentos, costos, visitas…"
          aria-label="Buscar en VARA"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls="vara-search-results"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
        />
        {open && results.length > 0 && (
          <ul id="vara-search-results" role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {results.map(r => (
              <li key={`${r.kind}|${r.href}|${r.label}`} role="option" aria-selected={false}>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => go(r.href)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                  <span className="block text-sm font-semibold text-slate-800">{r.label}</span>
                  <span className="block text-[11px] text-slate-400">{r.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="ml-auto flex items-center gap-2">
      <GuiameTrigger expanded={guiaOpen} onClick={onToggleGuia} />

      <Link
        href={journey === 'SELL' ? '/publicar' : '/propiedades'}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition-colors"
      >
        <Plus size={15} />
        {journey === 'SELL' ? 'Completar mi propiedad' : 'Agregar propiedad'}
      </Link>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const vara = useVaraState()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [guiaMenuOpen, setGuiaMenuOpen] = useState(false)

  const { journey, activeOperationId, operations: allOps, loaded: opsLoaded } = useOperations()
  const changeJourney = (j: JourneyType) => vara.setJourneyType(journeyToStored(j))

  // Una pantalla de compra o de venta ajusta el modo a sí misma: menú, guía y contenido nunca se contradicen.
  const { loaded: varaLoaded, setJourneyType } = vara
  useEffect(() => {
    // Una pantalla de compra o de venta fija el modo; abrir una operación fija el de esa operación.
    const opId = pathname.match(/^\/operacion\/([^/?]+)/)?.[1]
    const opType = opId ? allOps.find(o => o.id === opId)?.type : undefined
    const forced = forcedJourney(pathname) ?? opType ?? null
    if (varaLoaded && forced && forced !== journey) setJourneyType(journeyToStored(forced))
  }, [pathname, journey, varaLoaded, allOps, setJourneyType])

  // Al navegar se cierran el menú lateral y el de la guía.
  const [navPath, setNavPath] = useState(pathname)
  if (pathname !== navPath) {
    setNavPath(pathname)
    setDrawerOpen(false)
    setGuiaMenuOpen(false)
  }

  // Visit Mode ocupa la pantalla entera: el partner lo usa parado en la puerta
  // de una casa, con una mano. Un sidebar ahi seria un estorbo.
  // El portal de partners (/partner) tampoco usa el menú del comprador o vendedor:
  // es otra puerta, con su propia barra (ver app/partner/layout.tsx).
  if (NO_SHELL.has(pathname) || pathname.startsWith('/visit/') || pathname.startsWith('/partner')) {
    return <>{children}</>
  }
  // Quien llega a analizar un aviso o a ver un análisis compartido, sin operación propia, no necesita el menú.
  if (PUBLIC_WHEN_NEW.has(pathname) && (!opsLoaded || allOps.length === 0)) {
    return <PublicFrame>{children}</PublicFrame>
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
            operationId={activeOperationId ?? ''}
            onChangeJourney={changeJourney}
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
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
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
            operationId={activeOperationId ?? ''}
            onChangeJourney={changeJourney}
          />
        </Suspense>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          onOpenDrawer={() => setDrawerOpen(true)}
          journey={journey}
          guiaOpen={guiaMenuOpen}
          onToggleGuia={() => setGuiaMenuOpen(o => !o)}
        />

        {/* pb-20: en el celular la barra de abajo no tapa el final de la página. */}
        <main id="main-content" className="flex-1 min-w-0 pb-20 lg:pb-0">
          {children}
        </main>

        <GuiameButton menuOpen={guiaMenuOpen} onMenuOpenChange={setGuiaMenuOpen} />
        <VaraAIFloat />
        <Suspense fallback={null}>
          <MobileTabBar operationId={activeOperationId ?? ''} />
        </Suspense>
      </div>
    </div>
  )
}
