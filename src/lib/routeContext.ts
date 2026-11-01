/**
 * Mapa de rutas: cada pantalla declara a qué parte del producto pertenece.
 *
 * - BUY: solo tiene sentido comprando.
 * - SELL: solo tiene sentido vendiendo.
 * - OPERATION: la operación formal (documentos, riesgos, costos…), sirve en los dos.
 * - SHARED: Dashboard, Guía, Asistente, etc.; no fuerzan ningún modo.
 *
 * El menú, el panel "Tu camino" y el botón principal leen UN modo. Si el usuario abre
 * una pantalla de compra o de venta, el modo se ajusta a esa pantalla para que
 * contenido y navegación nunca se contradigan.
 */
export type RouteArea = 'BUY' | 'SELL' | 'OPERATION' | 'SHARED'

const BUY_ROUTES = ['/mi-busqueda', '/propiedades', '/comparar', '/visitas']
const SELL_ROUTES = [
  '/publicar', '/precio-venta', '/preparar-venta', '/interesados', '/ofertas', '/visitas-vendedor',
  '/fotos-venta', '/video-presentacion', '/property-pack', '/revisar-publicacion',
]
const OPERATION_ROUTES = ['/operacion', '/dinero', '/profesionales', '/negociacion', '/costos', '/financiamiento']

const startsWithRoute = (pathname: string, route: string) => pathname === route || pathname.startsWith(route + '/')

export function routeArea(pathname: string): RouteArea {
  const p = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  if (BUY_ROUTES.some(r => startsWithRoute(p, r))) return 'BUY'
  if (SELL_ROUTES.some(r => startsWithRoute(p, r))) return 'SELL'
  if (OPERATION_ROUTES.some(r => startsWithRoute(p, r))) return 'OPERATION'
  return 'SHARED'
}

/** Modo que esta ruta exige, o null si sirve en cualquiera. */
export function forcedJourney(pathname: string): 'BUY' | 'SELL' | null {
  const area = routeArea(pathname)
  return area === 'BUY' || area === 'SELL' ? area : null
}
