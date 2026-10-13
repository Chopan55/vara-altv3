import { describe, it, expect } from 'vitest'
import { forcedJourney, routeArea } from '@/lib/routeContext'

describe('mapa de rutas', () => {
  it('las pantallas de compra exigen modo compra', () => {
    for (const r of ['/mi-busqueda', '/propiedades', '/propiedades/abc', '/comparar', '/visitas']) {
      expect(forcedJourney(r), r).toBe('BUY')
    }
  })

  it('las pantallas de venta exigen modo venta', () => {
    for (const r of ['/publicar', '/precio-venta', '/preparar-venta', '/interesados', '/ofertas', '/visitas-vendedor', '/fotos-venta', '/video-presentacion', '/property-pack', '/revisar-publicacion']) {
      expect(forcedJourney(r), r).toBe('SELL')
    }
  })

  it('la operación, Dinero y compartidas no fuerzan nada', () => {
    for (const r of ['/operacion/abc', '/operacion/abc?tab=documentos', '/dinero', '/dashboard', '/guia', '/asistente', '/acciones', '/vara-visit', '/planes']) {
      expect(forcedJourney(r), r).toBeNull()
    }
    expect(routeArea('/operacion/abc')).toBe('OPERATION')
    expect(routeArea('/dashboard')).toBe('SHARED')
  })

  it('no confunde rutas con prefijo parecido', () => {
    expect(forcedJourney('/visitas-vendedor')).toBe('SELL')
    expect(forcedJourney('/visitas')).toBe('BUY')
    expect(forcedJourney('/mis-visitas')).toBeNull()
    expect(forcedJourney('/propiedades-nuevas')).toBeNull()
  })

  it('ignora la barra final y los parámetros', () => {
    expect(forcedJourney('/comparar/')).toBe('BUY')
    expect(forcedJourney('/publicar?x=1')).toBe('SELL')
  })
})
