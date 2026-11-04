import { describe, it, expect } from 'vitest'
import { buildAdText, EMPTY_FORM } from '@/components/publicar/model'

describe('buildAdText', () => {
  it('arma el aviso solo con los datos cargados, en orden', () => {
    const text = buildAdText({
      ...EMPTY_FORM,
      title: 'Casa en Pilar', price: '185000', address: 'Calle 1', neighborhood: 'Centro', city: 'Pilar',
      surface: '420', rooms: '3', description: 'Linda casa.', features: ['Pileta', 'Quincho'],
    })
    expect(text).toBe([
      'Casa en Pilar',
      `Precio: USD ${(185000).toLocaleString('es-AR')}`,
      'Ubicación: Calle 1, Centro, Pilar',
      'Superficie: 420 m²',
      'Ambientes: 3',
      '\nLinda casa.',
      '\nCaracterísticas: Pileta, Quincho',
    ].join('\n'))
  })

  it('sin dirección usa la ciudad, y no agrega líneas vacías', () => {
    const text = buildAdText({ ...EMPTY_FORM, title: 'Depto', price: '', city: 'Rosario' })
    expect(text).toBe('Depto\nPrecio: USD 0\nCiudad: Rosario')
  })
})
