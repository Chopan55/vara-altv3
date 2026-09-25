/**
 * Formateo.
 *
 * Parece lo más trivial del producto y es lo que más se ve: cada precio, cada
 * fecha y cada estado pasa por acá. Un `formatPrice` que devuelve "NaN" o
 * "Invalid Date" en un borde raro aparece en la pantalla de alguien que está
 * por poner doscientos mil dólares, y tira abajo la confianza en todo el resto.
 */

import { describe, it, expect } from 'vitest'
import {
  cn, formatPrice, formatDate, formatSurface,
  getStatusLabel, getPropertyTypeLabel, getProfessionalLabel,
} from '@/lib/utils'

describe('precios', () => {
  it('formatea en dólares por defecto', () => {
    const s = formatPrice(185_000)
    expect(s).toMatch(/185/)
    expect(s).toMatch(/USD|\$/)
  })

  it('respeta los pesos cuando se los pide', () => {
    expect(formatPrice(50_000, 'ARS')).toMatch(/ARS|\$/)
  })

  it('el cero se muestra, no se esconde', () => {
    // Un precio de 0 es un dato ("sin precio"), y la pantalla decide qué hacer.
    expect(formatPrice(0)).toMatch(/0/)
  })

  it('nunca devuelve NaN', () => {
    for (const v of [0, -1, 1e12, 0.5]) {
      expect(formatPrice(v)).not.toMatch(/NaN/)
    }
  })

  it('un valor no numérico no imprime NaN en pantalla', () => {
    expect(formatPrice(Number.NaN)).not.toMatch(/NaN/)
  })
})

describe('superficie', () => {
  it('dice los metros', () => {
    expect(formatSurface(120)).toMatch(/120/)
    expect(formatSurface(120)).toMatch(/m/)
  })

  it('el cero no rompe', () => {
    expect(() => formatSurface(0)).not.toThrow()
  })
})

describe('fechas', () => {
  it('formatea una fecha ISO', () => {
    const s = formatDate('2026-03-20')
    expect(s).toBeTruthy()
    expect(s).not.toMatch(/Invalid/i)
  })

  it('una fecha basura no imprime "Invalid Date"', () => {
    // Pasa con datos importados de un portal. Mejor vacío que un error crudo.
    expect(formatDate('no-es-una-fecha')).not.toMatch(/Invalid/i)
  })

  it('un string vacío no rompe', () => {
    expect(() => formatDate('')).not.toThrow()
  })
})

describe('etiquetas', () => {
  it('traduce los estados a castellano', () => {
    for (const s of ['PENDING', 'APPROVED', 'REJECTED']) {
      const label = getStatusLabel(s)
      expect(label).toBeTruthy()
      // Si sale el enum crudo, es que falta la traducción.
      expect(label).not.toBe(s)
    }
  })

  it('un estado desconocido devuelve algo mostrable', () => {
    expect(getStatusLabel('ALGO_NUEVO')).toBeTruthy()
  })

  it('traduce los tipos de propiedad', () => {
    expect(getPropertyTypeLabel('HOUSE')).toBeTruthy()
    expect(getPropertyTypeLabel('APARTMENT')).toBeTruthy()
    expect(getPropertyTypeLabel('HOUSE')).not.toBe('HOUSE')
  })

  it('un tipo desconocido no deja la tarjeta vacía', () => {
    expect(getPropertyTypeLabel('CASTILLO')).toBeTruthy()
  })

  it('traduce las especialidades', () => {
    expect(getProfessionalLabel('NOTARY')).toBeTruthy()
  })
})

describe('clases css', () => {
  it('junta clases', () => {
    expect(cn('a', 'b')).toContain('a')
    expect(cn('a', 'b')).toContain('b')
  })

  it('descarta las condiciones falsas', () => {
    expect(cn('a', false && 'b', undefined, null)).not.toMatch(/false|undefined|null/)
  })

  it('sin argumentos devuelve un string', () => {
    expect(typeof cn()).toBe('string')
  })
})
