import { describe, it, expect } from 'vitest'
import { advisePhotos, isPublishable, tourOrder, type PhotoInfo } from '@/lib/photoAdvice'

const ph = (id: string, label: string, extra: Partial<PhotoInfo> = {}): PhotoInfo => ({ id, label, width: 1600, height: 1000, brightness: 130, ...extra })

describe('orden de recorrido', () => {
  it('va de la calle hacia adentro y lo no reconocido queda al final en su orden', () => {
    const r = tourOrder([{ label: 'Baño' }, { label: 'Sin etiquetar', n: 1 }, { label: 'Cocina' }, { label: 'Frente' }, { label: 'Sin etiquetar', n: 2 }, { label: 'Living' }] as { label: string; n?: number }[])
    expect(r.map(x => x.label)).toEqual(['Frente', 'Living', 'Cocina', 'Baño', 'Sin etiquetar', 'Sin etiquetar'])
    expect(r[4].n).toBe(1)
    expect(r[5].n).toBe(2)
  })
})

describe('recomendaciones de fotos', () => {
  it('sin fotos no hay nada que recomendar', () => {
    expect(advisePhotos([])).toEqual([])
  })

  it('pide más fotos y etiquetas cuando hay pocas y sin etiquetar', () => {
    const a = advisePhotos([ph('1', 'Sin etiquetar', { isCover: true }), ph('2', 'Sin etiquetar')])
    expect(a.find(x => x.id === 'count')!.severity).toBe('high')
    expect(a.find(x => x.id === 'unlabeled')!.text).toContain('2 fotos sin etiquetar')
    expect(a.find(x => x.id === 'missing')).toBeUndefined()
  })

  it('avisa qué ambientes esenciales faltan cuando ya hay etiquetas', () => {
    const photos = ['Frente', 'Living', 'Cocina', 'Dormitorio principal', 'Jardín', 'Pileta', 'Quincho', 'Entrada'].map((l, i) => ph(String(i), l, { isCover: i === 0 }))
    const a = advisePhotos(photos)
    expect(a.find(x => x.id === 'missing')!.text).toContain('Baño')
    expect(a.find(x => x.id === 'count')).toBeUndefined()
  })

  it('detecta foto oscura, chica y vertical por separado', () => {
    const a = advisePhotos([
      ph('d', 'Living', { brightness: 40, isCover: true }),
      ph('s', 'Cocina', { width: 640, height: 480 }),
      ph('v', 'Baño', { width: 800, height: 1200 }),
    ])
    expect(a.some(x => x.id === 'dark-d')).toBe(true)
    expect(a.some(x => x.id === 'small-s')).toBe(true)
    expect(a.some(x => x.id === 'tall-v')).toBe(true)
  })

  it('ordena de lo más importante a lo menos', () => {
    const a = advisePhotos([ph('1', 'Living', { brightness: 250 })])
    const sev = a.map(x => x.severity)
    expect(sev).toEqual([...sev].sort((x, y) => ['high', 'medium', 'info'].indexOf(x) - ['high', 'medium', 'info'].indexOf(y)))
  })
})

describe('fotos publicables', () => {
  it('planos y documentos nunca son publicables', () => {
    expect(isPublishable('Plano')).toBe(false)
    expect(isPublishable('Documento (privado)')).toBe(false)
    expect(isPublishable('Escritura')).toBe(false)
    expect(isPublishable('Living')).toBe(true)
    expect(isPublishable('Sin etiquetar')).toBe(true)
  })

  it('los planos no cuentan como fotos de la propiedad en las recomendaciones', () => {
    const a = advisePhotos([ph('1', 'Plano'), ph('2', 'Plano'), ph('3', 'Documento (privado)')])
    expect(a).toEqual([])
  })
})
