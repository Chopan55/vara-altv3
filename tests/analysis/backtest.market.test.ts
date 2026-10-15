import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { assessConfidence } from '@/lib/analysis/confidence'
import { calculatePrice } from '@/lib/analysis/priceIntelligence'
import { retrieveComparables } from '@/lib/analysis/retrieval'
import type { StoredListing } from '@/lib/analysis/market/store'
import type { ListingFacts } from '@/lib/analysis/types'

/**
 * Backtest con datos REALES del barrido de Zonaprop (leave-one-out).
 *
 * Cada casa del store hace de "propiedad analizada" contra las demás. Mide si
 * el rango de publicación comparable tiene sentido sobre datos reales: cuántas
 * veces hay evidencia suficiente y qué tan lejos queda la mediana del precio
 * pedido. Se saltea solo si no hay barrido local (el store está en .gitignore).
 */

const FILE = path.join(process.cwd(), '.data', 'market', 'listings.json')
const HAS_DATA = existsSync(FILE)

function load(): ListingFacts[] {
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as { listings: Record<string, StoredListing> }
  return Object.values(data.listings)
    .map(s => s.facts)
    .filter(l => l.kind === 'house' && l.currency === 'USD' && l.price && l.coveredArea && l.bedrooms)
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

describe.skipIf(!HAS_DATA)('backtest con avisos reales de Zonaprop', () => {

  it('mide cobertura y error del rango sobre datos reales', async () => {
    const all = load()
    const rows: { conf: string; inBand: boolean; relErr: number; n: number; scope: string }[] = []

    // Muestra repartida (máx. 60 propiedades): el análisis completo es O(n²) por la deduplicación.
    const step = Math.max(1, Math.ceil(all.length / 60))
    const sample = all.filter((_, i) => i % step === 0)
    const timings: number[] = []

    for (const subject of sample) {
      const others = all.filter(l => l.id !== subject.id)
      const t0 = performance.now()
      const r = await retrieveComparables(subject, [{ name: 'store', fetch: async () => others }], { now: new Date() })
      timings.push(performance.now() - t0)
      const calc = calculatePrice({
        subjectPrice: subject.price, subjectCurrency: 'USD',
        subjectCoveredArea: subject.coveredArea, comparables: r.matches,
      })
      const conf = assessConfidence({
        used: calc.used, scope: r.summary.searchScope, band: calc.band, subjectHasCoveredArea: true,
      })
      if (conf.level === 'INSUFFICIENT' || !calc.band) {
        rows.push({ conf: 'INSUFFICIENT', inBand: false, relErr: NaN, n: calc.used.length, scope: r.summary.searchScope })
        continue
      }
      rows.push({
        conf: conf.level,
        inBand: subject.price! >= calc.band.low && subject.price! <= calc.band.high,
        relErr: Math.abs(calc.band.median - subject.price!) / subject.price!,
        n: calc.used.length,
        scope: r.summary.searchScope,
      })
    }

    const answered = rows.filter(r => r.conf !== 'INSUFFICIENT')
    const byConf = (c: string) => rows.filter(r => r.conf === c)
    const report = {
      universo: all.length,
      muestra: rows.length,
      msPorAnalisisMediana: Math.round(median(timings)),
      msPorAnalisisMax: Math.round(Math.max(...timings)),
      conReferencia: `${answered.length} (${Math.round((100 * answered.length) / rows.length)}%)`,
      porConfianza: { ALTA: byConf('HIGH').length, MEDIA: byConf('MEDIUM').length, BAJA: byConf('LOW').length, INSUFICIENTE: byConf('INSUFFICIENT').length },
      precioDentroDelRango: answered.length ? `${Math.round((100 * answered.filter(r => r.inBand).length) / answered.length)}%` : 'n/a',
      errorRelativoMedianaVsPrecio: `${Math.round(100 * median(answered.map(r => r.relErr)))}% (mediana)`,
      avisosUsadosMediana: median(answered.map(r => r.n)),
      // La confianza tiene que significar algo: a más confianza, menos error.
      errorPorConfianza: Object.fromEntries(
        ['HIGH', 'MEDIUM', 'LOW'].map(c => [c, `${Math.round(100 * median(byConf(c).map(r => r.relErr)))}% (n=${byConf(c).length})`]),
      ),
      dentroDelRangoPorConfianza: Object.fromEntries(
        ['HIGH', 'MEDIUM', 'LOW'].map(c => [c, byConf(c).length ? `${Math.round((100 * byConf(c).filter(r => r.inBand).length) / byConf(c).length)}%` : 'n/a']),
      ),
      alcance: Object.fromEntries(
        ['SAME_COMMUNITY', 'NEIGHBORHOOD', 'CITY'].map(s => [s, rows.filter(r => r.scope === s).length]),
      ),
    }
    console.log('BACKTEST', JSON.stringify(report))

    // Sanidad, no precisión: el motor no puede romper ni afirmar sin evidencia.
    expect(rows).toHaveLength(sample.length)
    for (const r of rows) if (r.conf !== 'INSUFFICIENT') expect(r.n).toBeGreaterThanOrEqual(3)
  }, 120_000)
})
