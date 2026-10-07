/**
 * VARA Alquiler Check — notas sobre garantías.
 *
 * Lo que se protege acá: que VARA hable de garantías con hechos generales y
 * prudentes, NUNCA con precios inventados. Una prima de seguro de caución o el
 * costo de una póliza jurídica cambian por aseguradora, por mes y por perfil;
 * un número que VARA ponga ahí es un número que nadie puede respaldar. El
 * único costo que aparece es el que la persona declaró.
 *
 * Y la garantía que la persona eligió siempre va primera y marcada, aunque no
 * sea de las habituales del lugar (en ese caso, se le avisa).
 */

import { describe, it, expect } from 'vitest'
import {
  runRentalCheck, emptyRentalInput, getPack,
  type RentalInput, type GuaranteeType, type GuaranteeNote, type RentalJurisdiction,
} from '@/lib/rentals'

const AR = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('AR'), ...over })
const MX = (over: Partial<RentalInput> = {}): RentalInput => ({ ...emptyRentalInput('MX'), ...over })

const ALL_TYPES: GuaranteeType[] = [
  'NONE', 'FIADOR', 'OBLIGADO_SOLIDARIO', 'GARANTE_PROPIETARIO', 'SEGURO_CAUCION',
  'POLIZA_JURIDICA', 'FIANZA', 'DEPOSITO', 'OTRA',
]

const JURISDICTIONS: {
  name: RentalJurisdiction
  base: (over?: Partial<RentalInput>) => RentalInput
  /** Garantías habituales según el spec (el pack puede tener más). */
  specUsual: GuaranteeType[]
}[] = [
  { name: 'AR_CABA', base: AR, specUsual: ['SEGURO_CAUCION', 'FIADOR'] },
  { name: 'MX_CDMX', base: MX, specUsual: ['FIADOR', 'OBLIGADO_SOLIDARIO', 'POLIZA_JURIDICA', 'FIANZA', 'DEPOSITO'] },
]

const noteText = (n: GuaranteeNote): string => [n.label, n.summary, ...n.caveats].join(' \n ')

/** Dígitos seguidos de % o de una moneda, o una moneda seguida de dígitos. */
const PRICE_LIKE = /\d\s*(%|\$|€|US\$|USD|ARS|MXN|pesos|d[oó]lares)|(\$|€|US\$|USD|ARS|MXN)\s*\d/i

/** Cómo se avisa que una garantía no está entre las habituales de la jurisdicción. */
const NOT_USUAL = /habitual|usual|frecuent|com[uú]n(es)?\b/i

describe.each(JURISDICTIONS)('$name — garantía declarada', ({ name, base, specUsual }) => {
  const pack = getPack(name)!

  it('el pack incluye las garantías habituales del spec', () => {
    for (const t of specUsual) expect(pack.applicableGuarantees).toContain(t)
  })

  it.each(ALL_TYPES)('%s: hay exactamente una nota seleccionada, es la primera y es la declarada', (type) => {
    const r = runRentalCheck(base({ guaranteeType: type }))
    const selected = r.guaranteeNotes.filter(n => n.selected)
    expect(selected).toHaveLength(1)
    expect(r.guaranteeNotes[0].selected).toBe(true)
    expect(r.guaranteeNotes[0].type).toBe(type)
  })

  it('no repite tipos de garantía entre las notas', () => {
    for (const type of ALL_TYPES) {
      const types = runRentalCheck(base({ guaranteeType: type })).guaranteeNotes.map(n => n.type)
      expect(new Set(types).size, `selección ${type}`).toBe(types.length)
    }
  })

  it('las garantías habituales de la jurisdicción siempre figuran entre las notas', () => {
    for (const type of ALL_TYPES) {
      const types = runRentalCheck(base({ guaranteeType: type })).guaranteeNotes.map(n => n.type)
      for (const usual of pack.applicableGuarantees) {
        expect(types, `selección ${type}`).toContain(usual)
      }
    }
  })

  it('cada nota tiene etiqueta y resumen con texto', () => {
    for (const n of runRentalCheck(base({ guaranteeType: 'FIADOR' })).guaranteeNotes) {
      expect(n.label.trim().length, `${n.type} label`).toBeGreaterThan(0)
      expect(n.summary.trim().length, `${n.type} summary`).toBeGreaterThan(0)
      expect(Array.isArray(n.caveats)).toBe(true)
    }
  })

  describe('garantía fuera de las habituales', () => {
    const nonUsual = ALL_TYPES.filter(t => !pack.applicableGuarantees.includes(t))

    it('hay al menos un tipo no habitual para probar', () => {
      expect(nonUsual.length).toBeGreaterThan(0)
    })

    it.each(nonUsual)('%s: sigue siendo la seleccionada y se avisa que no es habitual', (type) => {
      const r = runRentalCheck(base({ guaranteeType: type }))
      const first = r.guaranteeNotes[0]
      expect(first.selected).toBe(true)
      expect(first.type).toBe(type)
      expect(first.caveats.some(c => NOT_USUAL.test(c))).toBe(true)
    })

    it('una garantía habitual NO lleva ese aviso', () => {
      for (const type of specUsual) {
        const first = runRentalCheck(base({ guaranteeType: type })).guaranteeNotes[0]
        expect(first.type).toBe(type)
        expect(first.caveats.some(c => NOT_USUAL.test(c)), `${type} habitual`).toBe(false)
      }
    })
  })
})

describe('costo declarado de la garantía', () => {
  it.each(JURISDICTIONS)('$name: la nota seleccionada trae el costo declarado', ({ base }) => {
    const r = runRentalCheck(base({ guaranteeType: 'FIADOR', guaranteeCost: 12_345 }))
    expect(r.guaranteeNotes[0].selected).toBe(true)
    expect(r.guaranteeNotes[0].declaredCost).toBe(12_345)
  })

  it.each(JURISDICTIONS)('$name: sin costo declarado, declaredCost es null', ({ base }) => {
    const r = runRentalCheck(base({ guaranteeType: 'FIADOR', guaranteeCost: null }))
    expect(r.guaranteeNotes[0].declaredCost).toBeNull()
  })

  it.each(JURISDICTIONS)('$name: un costo declarado en 0 se respeta (no es null)', ({ base }) => {
    const r = runRentalCheck(base({ guaranteeType: 'FIADOR', guaranteeCost: 0 }))
    expect(r.guaranteeNotes[0].declaredCost).toBe(0)
  })

  it.each(JURISDICTIONS)('$name: las notas no seleccionadas no tienen costo', ({ base }) => {
    const r = runRentalCheck(base({ guaranteeType: 'FIADOR', guaranteeCost: 12_345 }))
    for (const n of r.guaranteeNotes.filter(x => !x.selected)) {
      expect(n.declaredCost, n.type).toBeNull()
    }
  })

  it('el costo declarado de la garantía coincide con el de la calculadora', () => {
    const r = runRentalCheck(AR({ guaranteeType: 'SEGURO_CAUCION', guaranteeCost: 150_000 }))
    const item = r.entryCostItems.find(i => i.id === 'entry.guarantee-cost')!
    expect(item.amount).toBe(r.guaranteeNotes[0].declaredCost)
  })
})

describe('VARA no inventa precios de garantías', () => {
  it.each(JURISDICTIONS)('$name: ningún resumen ni aviso trae un precio o porcentaje', ({ base }) => {
    for (const type of ALL_TYPES) {
      const r = runRentalCheck(base({ guaranteeType: type, guaranteeCost: 777 }))
      for (const n of r.guaranteeNotes) {
        expect(n.summary, `${type}/${n.type} summary`).not.toMatch(PRICE_LIKE)
        for (const c of n.caveats) expect(c, `${type}/${n.type} caveat`).not.toMatch(PRICE_LIKE)
      }
    }
  })

  it.each(JURISDICTIONS)('$name: tampoco el texto propio del pack de la jurisdicción', ({ name }) => {
    const copy = getPack(name)!.guaranteeCopy
    for (const [type, entry] of Object.entries(copy)) {
      expect(entry!.summary, `${type} summary`).not.toMatch(PRICE_LIKE)
      for (const c of entry!.caveats) expect(c, `${type} caveat`).not.toMatch(PRICE_LIKE)
    }
  })

  it('el detector de precios sí detecta precios (el test no pasa por no mirar)', () => {
    for (const bad of ['cuesta 3%', 'unos $5000', 'USD 200 por año', '1500 ARS', 'prima de 2 %']) {
      expect(bad).toMatch(PRICE_LIKE)
    }
    for (const ok of ['Ley 27.551', 'art. 1196 del Código', 'DNU 70/2023', 'una prima']) {
      expect(ok).not.toMatch(PRICE_LIKE)
    }
  })
})

describe('seguro de caución', () => {
  it.each(JURISDICTIONS)('$name: la nota seleccionada aclara que VARA no estima primas', ({ base }) => {
    const r = runRentalCheck(base({ guaranteeType: 'SEGURO_CAUCION', guaranteeCost: null }))
    const first = r.guaranteeNotes[0]
    expect(first.type).toBe('SEGURO_CAUCION')
    expect(noteText(first)).toMatch(/VARA no estima/i)
  })

  it('con costo declarado también lo aclara (la prima la informa la aseguradora)', () => {
    const r = runRentalCheck(AR({ guaranteeType: 'SEGURO_CAUCION', guaranteeCost: 150_000 }))
    expect(noteText(r.guaranteeNotes[0])).toMatch(/VARA no estima/i)
  })
})
