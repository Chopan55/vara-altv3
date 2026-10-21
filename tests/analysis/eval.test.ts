import { describe, it, expect } from 'vitest'
import { analyzeProperty } from '@/lib/analysis/run'
import { scoreSimilarity, SIMILARITY_CONFIG } from '@/lib/analysis/similarity'
import { dedupeListings, isSpecificAddress } from '@/lib/analysis/dedupe'
import { computeFreshness, FRESHNESS_CONFIG } from '@/lib/analysis/freshness'
import { evaluateFit } from '@/lib/analysis/userFit'
import { retrieveComparables } from '@/lib/analysis/retrieval'
import { subjectFromScrape, flattenSubject, listingFromComparable } from '@/lib/analysis/normalize'
import { secondPropertyRate, activationRate, type AnalyticsEvent } from '@/lib/analysis/events'
import { estimateTransactionCost } from '@/lib/analysis/cost'
import '@/lib/analysis/costProviders/ar'
import { CASES, L, NOW, daysAgo, provider, scrape, strongSet } from './fixtures'

const run = (c: { subject: ReturnType<typeof scrape>; listings: ReturnType<typeof strongSet> }, extra = {}) =>
  analyzeProperty({ scrape: c.subject, providers: [provider(c.listings)], now: NOW, ...extra })

// ───────────────────────── Suite curada (regresión de inteligencia) ─────────────────────────

describe('suite de evaluación: casos curados', () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const a = await run(c)
      const e = c.expect
      expect(a.pricePositioning.confidence).toBe(e.confidence)
      if (e.scope) expect(a.comparableEvidence.geographicScope).toBe(e.scope)
      if (e.position) expect(a.pricePositioning.position).toBe(e.position)
      if (e.strong) {
        expect(a.comparableEvidence.strongMatches).toBeGreaterThanOrEqual(e.strong[0])
        expect(a.comparableEvidence.strongMatches).toBeLessThanOrEqual(e.strong[1])
      }
      if (e.duplicatesMerged !== undefined) {
        expect(a.comparableEvidence.retrieval.duplicatesMerged).toBe(e.duplicatesMerged)
      }
      if (e.expanded !== undefined) {
        expect(a.comparableEvidence.retrieval.searchExpansionReason !== null).toBe(e.expanded)
      }
    })
  }
})

// ───────────────────────── Reglas absolutas ─────────────────────────

describe('reglas absolutas', () => {
  it('nunca habla de valor de mercado ni de venta', async () => {
    const a = await run({ subject: scrape({ price: 480_000 }), listings: strongSet() })
    const text = JSON.stringify([a.pricePositioning, a.conclusion])
    expect(text.toLowerCase()).not.toMatch(/valor de mercado|precio de venta real|vale realmente/)
    expect(a.pricePositioning.comparableListingRange?.basis).toBe('ASKING_PRICE')
  })

  it('con evidencia insuficiente no da conclusión de precio y lo dice', async () => {
    const a = await run({ subject: scrape(), listings: strongSet().slice(0, 2) })
    expect(a.pricePositioning.comparableListingRange).toBeNull()
    expect(a.pricePositioning.interpretation).toContain('No encontré suficientes propiedades realmente comparables')
  })

  it('la banda no tiene falsa precisión', async () => {
    const a = await run({ subject: scrape(), listings: strongSet() })
    const band = a.pricePositioning.comparableListingRange!
    for (const v of [band.low, band.median, band.high]) expect(v % 5000).toBe(0)
  })

  it('UNKNOWN sigue siendo UNKNOWN', () => {
    const s = subjectFromScrape(scrape({ description: undefined, bathrooms: undefined }), NOW)
    expect(s.fields.pool?.status).toBe('UNKNOWN')
    expect(s.fields.pool?.value).toBeNull()
    expect(s.fields.ageYears?.value).toBeNull()
    expect(s.fields.bathrooms?.status).toBe('UNKNOWN')
  })

  it('siempre hay una sola acción primaria y las secundarias son a lo sumo dos', async () => {
    for (const c of CASES) {
      const a = await run(c)
      expect(a.nextBestAction.type).toBeTruthy()
      expect(a.nextBestAction.secondary.length).toBeLessThanOrEqual(2)
      expect(a.nextBestAction.secondary.map(s => s.type)).not.toContain(a.nextBestAction.type)
    }
  })

  it('un bloqueo impide decir que todo está al día', async () => {
    const a = await run({ subject: scrape({ description: undefined }), listings: strongSet() })
    expect(a.nextBestAction.type).toBe('GET_MISSING_INFORMATION')
    expect(a.nextBestAction.blockers.length).toBeGreaterThan(0)
  })

  it('con datos completos y precio en línea recomienda visitar', async () => {
    const a = await run({ subject: scrape(), listings: strongSet() })
    expect(a.nextBestAction.type).toBe('VISIT')
    expect(a.conclusion.verdict).toBe('PROMISING')
  })

  it('el mensaje al vendedor se arma para copiar y no incluye el precio', async () => {
    const a = await run({ subject: scrape({ description: undefined }), listings: strongSet() })
    expect(a.missingInformation.draftMessage).toMatch(/antigüedad/)
    expect(a.missingInformation.draftMessage).not.toMatch(/precio/i)
  })

  it('registra trazabilidad y tiempos', async () => {
    let t = 0
    const a = await run({ subject: scrape(), listings: strongSet() }, { clock: () => (t += 5) })
    expect(a.provenance.length).toBeGreaterThan(5)
    expect(a.timings.timeToPropertyMs).not.toBeNull()
    expect(a.timings.timeToConclusionMs!).toBeGreaterThanOrEqual(a.timings.timeToComparablesMs!)
  })

  it('emite las etapas en orden', async () => {
    const seen: string[] = []
    await analyzeProperty({
      scrape: scrape(), providers: [provider(strongSet())], now: NOW, onStage: e => seen.push(e.stage),
    })
    expect(seen).toEqual(['property', 'insight', 'comparables', 'done'])
  })

  it('un proveedor caído no rompe el análisis', async () => {
    const broken = { name: 'roto', fetch: async () => { throw new Error('timeout') } }
    const a = await analyzeProperty({ scrape: scrape(), providers: [broken, provider(strongSet())], now: NOW })
    const stat = a.comparableEvidence.retrieval.providers.find(p => p.name === 'roto')
    expect(stat?.ok).toBe(false)
    expect(a.pricePositioning.confidence).toBe('HIGH')
  })
})

// ───────────────────────── Similitud (ejemplos A–D del brief) ─────────────────────────

describe('similitud', () => {
  const subject = L({ photoHashes: undefined })

  it('A. misma comunidad, tipo, dormitorios, superficie, terreno y estado → muy alta', () => {
    const r = scoreSimilarity(subject, L({ coveredArea: 248, landArea: 790 }), 'SAME_COMMUNITY')
    expect(r.score).toBeGreaterThanOrEqual(90)
    expect(r.reasons.length).toBeGreaterThan(2)
  })

  it('B. casa vs departamento en la misma calle → mala coincidencia', () => {
    const r = scoreSimilarity(subject, L({ kind: 'apartment' }), 'SAME_COMMUNITY')
    expect(r.score).toBeLessThanOrEqual(SIMILARITY_CONFIG.kindMismatchCap)
    expect(r.differences.join(' ')).toMatch(/departamento/)
  })

  it('C. renovada vs a refaccionar → diferencia significativa y explicada', () => {
    const same = scoreSimilarity({ ...subject, condition: 'excellent' }, L({ condition: 'excellent' }), 'SAME_COMMUNITY')
    const old = scoreSimilarity({ ...subject, condition: 'excellent' }, L({ condition: 'to_renovate' }), 'SAME_COMMUNITY')
    expect(same.score - old.score).toBeGreaterThanOrEqual(5)
    expect(old.differences.join(' ')).toMatch(/refaccionar/)
  })

  it('terreno grande vs chico baja el puntaje', () => {
    const big = scoreSimilarity(subject, L({ landArea: 790 }), 'SAME_COMMUNITY')
    const small = scoreSimilarity(subject, L({ landArea: 300 }), 'SAME_COMMUNITY')
    expect(big.score).toBeGreaterThan(small.score)
  })

  it('D. otra comunidad pero parecida puntúa menos que la misma comunidad', () => {
    const local = scoreSimilarity(subject, L(), 'SAME_COMMUNITY')
    const other = scoreSimilarity(subject, L(), 'NEIGHBORHOOD')
    expect(other.score).toBeLessThan(local.score)
  })

  it('los datos faltantes se informan y no se tratan como coincidencia', () => {
    const r = scoreSimilarity(subject, L({ coveredArea: undefined, bedrooms: undefined }), 'SAME_COMMUNITY')
    expect(r.missing).toEqual(expect.arrayContaining(['dormitorios', 'superficie cubierta']))
  })

  it('el orden del ranking no depende del orden de entrada', async () => {
    const strong = strongSet()
    const list = [...strong, L({ kind: 'apartment' }), L({ bedrooms: 2 })]
    const subjectFacts = () => flattenSubject(subjectFromScrape(scrape(), NOW), NOW)
    const a = await retrieveComparables(subjectFacts(), [provider(list)], { now: NOW })
    const b = await retrieveComparables(subjectFacts(), [provider([...list].reverse())], { now: NOW })
    const strongIds = new Set(strong.map(s => s.id))
    for (const r of [a, b]) {
      // Los seis comparables reales quedan arriba; el departamento y el de 2 dormitorios, abajo.
      expect(new Set(r.matches.slice(0, 6).map(m => m.listing.id))).toEqual(strongIds)
      expect(r.matches[0].similarityScore).toBeGreaterThanOrEqual(r.matches[r.matches.length - 1].similarityScore)
    }
  })
})

// ───────────────────────── Deduplicación ─────────────────────────

describe('deduplicación', () => {
  it('E. tres URLs de la misma propiedad son una sola evidencia', () => {
    const a = L({ address: 'Calle Falsa 123', photoHashes: ['x1', 'x2'] })
    const b = L({ photoHashes: ['x2', 'x3'] })
    const c = L({ address: 'Calle Falsa 123', photoHashes: [] })
    const r = dedupeListings([a, b, c])
    expect(r.kept).toHaveLength(1)
    expect(r.duplicatesMerged).toBe(2)
    expect(r.uncertain.size).toBe(0)
  })

  it('misma propiedad solo por características se fusiona pero queda incierta', () => {
    const a = L({ title: 'Casa 4 dormitorios barrio cerrado Comunidad Uno jardin', photoHashes: [] })
    const b = L({ title: 'Casa 4 dormitorios barrio cerrado Comunidad Uno pileta', photoHashes: [], price: 402_000 })
    const r = dedupeListings([a, b])
    expect(r.kept).toHaveLength(1)
    expect(r.uncertain.size).toBe(1)
  })

  it('la dirección genérica de una comunidad no hace que dos casas sean la misma', () => {
    const generic = 'Mayling c.c 0, Mayling, Pilar'
    const r = dedupeListings([
      L({ address: generic, coveredArea: 250, photoHashes: [] }),
      L({ address: generic, coveredArea: 252, photoHashes: [] }),
    ])
    expect(r.kept).toHaveLength(2)
    expect(isSpecificAddress('calle falsa 123')).toBe(true)
    expect(isSpecificAddress('mayling c c 0 mayling pilar')).toBe(false)
  })

  it('propiedades distintas no se fusionan', () => {
    const r = dedupeListings([L({ photoHashes: [] }), L({ bedrooms: 3, photoHashes: [] })])
    expect(r.kept).toHaveLength(2)
  })

  it('un aviso que es la propia propiedad analizada no se cuenta como comparable', async () => {
    const subject = flattenSubject(subjectFromScrape(scrape(), NOW), NOW)
    const self = L({ url: subject.url, id: 'otro-id' })
    const r = await retrieveComparables(subject, [provider([self, ...strongSet()])], { now: NOW })
    expect(r.matches.some(m => m.listing.id === 'otro-id')).toBe(false)
  })
})

// ───────────────────────── Frescura ─────────────────────────

describe('frescura', () => {
  it('F. un aviso muy viejo pesa menos pero no se descarta', () => {
    const fresh = computeFreshness(L({ publishedAt: daysAgo(10) }), NOW)
    const old = computeFreshness(L({ publishedAt: daysAgo(400) }), NOW)
    expect(old.weight).toBeLessThan(fresh.weight)
    expect(old.weight).toBeGreaterThanOrEqual(FRESHNESS_CONFIG.minWeight)
    expect(old.stale).toBe(true)
    expect(fresh.stale).toBe(false)
  })

  it('sin fecha del portal el peso es intermedio y se aclara', () => {
    const f = computeFreshness(L({ publishedAt: undefined }), NOW)
    expect(f.basis).toBe('OBSERVED')
    expect(f.weight).toBe(FRESHNESS_CONFIG.unknownWeight)
    expect(f.note).toBeTruthy()
  })

  it('un cambio de precio reciente cuenta como actividad reciente', () => {
    const f = computeFreshness(L({ publishedAt: daysAgo(300), priceChangedAt: daysAgo(5) }), NOW)
    expect(f.basis).toBe('PRICE_CHANGE')
    expect(f.stale).toBe(false)
  })

  it('un aviso dado de baja pesa muy poco', () => {
    const f = computeFreshness(L({ status: 'removed' }), NOW)
    expect(f.stale).toBe(true)
    expect(f.weight).toBeLessThan(0.3)
  })
})

// ───────────────────────── Fit ─────────────────────────

describe('encaje con la persona', () => {
  const prefs = {
    budgetCurrency: 'USD' as const,
    rules: [
      { key: 'budget' as const, importance: 'MUST_HAVE' as const, target: 450_000 },
      { key: 'bedrooms' as const, importance: 'MUST_HAVE' as const, target: 4 },
      { key: 'pool' as const, importance: 'DEAL_BREAKER' as const, target: true },
      { key: 'study' as const, importance: 'NICE_TO_HAVE' as const, target: true },
    ],
  }

  it('sin perfil no inventa un puntaje', () => {
    const fit = evaluateFit(L(), null)
    expect(fit.state).toBe('NO_PROFILE')
    expect(fit.score).toBeNull()
  })

  it('el silencio del aviso es UNKNOWN y no MISMATCH', () => {
    const fit = evaluateFit(L({ pool: undefined }), prefs)
    expect(fit.items.find(i => i.key === 'pool')?.status).toBe('UNKNOWN')
    expect(fit.dealBreakerHit).toBe(false)
  })

  it('un DEAL_BREAKER incumplido anula un puntaje alto', () => {
    const fit = evaluateFit(L({ pool: false }), prefs)
    expect(fit.dealBreakerHit).toBe(true)
    expect(fit.score).toBeLessThanOrEqual(25)
    expect(fit.scoreExplanation).toMatch(/no negociable/)
  })

  it('el puntaje se explica', () => {
    const fit = evaluateFit(L({ pool: true }), prefs)
    expect(fit.score).toBe(100)
    expect(fit.scoreExplanation).toMatch(/Cumple \d de \d/)
  })

  it('un deal breaker lleva a descartar', async () => {
    const a = await run(
      { subject: scrape({ description: '10 años de antigüedad, sin pileta' }), listings: strongSet() },
      { preferences: { rules: [{ key: 'budget', importance: 'DEAL_BREAKER', target: 300_000 }], budgetCurrency: 'USD' } },
    )
    expect(a.userFit.dealBreakerHit).toBe(true)
    expect(a.nextBestAction.type).toBe('DISCARD')
    expect(a.conclusion.verdict).toBe('WEAK')
  })
})

// ───────────────────────── Costos y modularidad ─────────────────────────

describe('costo total', () => {
  it('separa conocido, estimado y no incluido', () => {
    const c = estimateTransactionCost('AR', { price: 400_000, currency: 'USD' })
    expect(c.lines.some(l => l.kind === 'KNOWN')).toBe(true)
    expect(c.lines.some(l => l.kind === 'ESTIMATED')).toBe(true)
    expect(c.notIncluded.length).toBeGreaterThan(0)
    expect(c.totalRange!.max).toBeGreaterThan(c.totalRange!.min - 1)
    expect(c.totalRange!.min).toBeGreaterThan(400_000)
  })

  it('precio en pesos no se convierte por las dudas', () => {
    const c = estimateTransactionCost('AR', { price: 400_000_000, currency: 'ARS' })
    expect(c.totalRange).toBeNull()
    expect(c.assumptions.join(' ')).toMatch(/dólares/)
  })

  it('un país sin reglas lo dice en vez de inventar', () => {
    const c = estimateTransactionCost('ZZ', { price: 1, currency: 'USD' })
    expect(c.totalRange).toBeNull()
    expect(c.assumptions[0]).toMatch(/ZZ/)
  })
})

// ───────────────────────── Adaptadores y analítica ─────────────────────────

describe('adaptadores y métricas', () => {
  it('un comparable existente se adapta como precio pedido', () => {
    const l = listingFromComparable({
      id: 'MLA1', source: 'meli', title: 'Casa en Pilar', price: 300_000, currency: 'USD',
      surface: 200, url: 'https://x.test/MLA-123456789', bedrooms: 3,
    }, NOW)
    expect(l.priceProvenance).toBe('ASKING_PRICE')
    expect(l.kind).toBe('house')
  })

  const ev = (name: AnalyticsEvent['name'], sessionId: string, key?: string): AnalyticsEvent =>
    ({ name, sessionId, at: NOW.toISOString(), props: key ? { listingKey: key } : undefined })

  it('tasa de segunda propiedad', () => {
    const events = [
      ev('listing_submitted', 's1', 'a'), ev('analysis_completed', 's1'), ev('listing_submitted', 's1', 'b'),
      ev('listing_submitted', 's2', 'a'), ev('analysis_completed', 's2'),
    ]
    expect(secondPropertyRate(events)).toBe(0.5)
    expect(secondPropertyRate([])).toBeNull()
  })

  it('activación: análisis completo más una acción significativa', () => {
    const events = [
      ev('analysis_completed', 's1'), ev('nba_clicked', 's1'), ev('analysis_completed', 's2'),
    ]
    expect(activationRate(events)).toBe(0.5)
  })
})
