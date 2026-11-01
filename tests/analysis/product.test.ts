import { describe, it, expect } from 'vitest'
import { analyzeProperty } from '@/lib/analysis/run'
import { buildSharedAnalysis, decodeShared, encodeShared, SHARE_VERSION } from '@/lib/analysis/share'
import { buildPreferences } from '@/lib/analysis/prefs'
import { listingFromCandidate } from '@/lib/analysis/providers'
import { applyUserOverrides, subjectFromScrape } from '@/lib/analysis/normalize'
import { track, setAnalyticsSink, funnel, type AnalyticsEvent } from '@/lib/analysis/events'
import type { PropertyCandidate } from '@/lib/candidates/model'
import { NOW, provider, scrape, strongSet } from './fixtures'

const analyze = (over: Parameters<typeof analyzeProperty>[0] extends infer T ? Partial<T> : never = {}) =>
  analyzeProperty({ scrape: scrape(), providers: [provider(strongSet())], now: NOW, ...over })

describe('compartir sin datos privados', () => {
  const prefs = buildPreferences({ budget: 123_456, location: 'Zona Test', bedrooms: 5, mustHaves: ['pool'] })

  it('no incluye preferencias, encaje ni presupuesto', async () => {
    const a = await analyze({ preferences: prefs })
    expect(a.userFit.state).toBe('EVALUATED')
    const json = JSON.stringify(buildSharedAnalysis(a))
    expect(json).not.toContain('123456')
    expect(json).not.toMatch(/Cumple \d de \d|no negociable|Encaje|prioridades/i)
    expect(json).not.toMatch(/budget|preferences|userFit|dealBreaker/)
  })

  it('no filtra el riesgo de incumplir un no negociable', async () => {
    const hit = buildPreferences({ budget: 1_000, mustHaves: [] })!
    hit.rules[0].importance = 'DEAL_BREAKER'
    const a = await analyze({ preferences: hit })
    expect(a.userFit.dealBreakerHit).toBe(true)
    const shared = buildSharedAnalysis(a)
    expect(JSON.stringify(shared)).not.toMatch(/no negociable|tope/i)
  })

  it('el titular compartido no menciona lo que busca la persona', async () => {
    const a = await analyze({ preferences: prefs })
    expect(a.conclusion.headline.length).toBeGreaterThan(0)
    expect(buildSharedAnalysis(a).headline).not.toMatch(/para vos|buscás/i)
  })

  it('ida y vuelta sin pérdida', async () => {
    const shared = buildSharedAnalysis(await analyze())
    const encoded = encodeShared(shared)!
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeShared(encoded)).toEqual(shared)
  })

  it('un link adulterado se rechaza o se sanea', () => {
    expect(decodeShared('no-es-base64-válido')).toBeNull()
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    expect(decodeShared(enc({ v: 99, title: 'x', headline: 'y' }))).toBeNull()

    const evil = decodeShared(enc({
      v: SHARE_VERSION, title: 'A'.repeat(5000), headline: 'ok', position: 'HACK', confidence: 'HACK',
      matches: [{ score: 9999, url: 'javascript:alert(1)', reasons: ['<img src=x onerror=alert(1)>'] }],
    }))!
    expect(evil.title.length).toBeLessThanOrEqual(500)
    expect(evil.position).toBe('UNKNOWN')
    expect(evil.confidence).toBe('INSUFFICIENT')
    expect(evil.matches[0].score).toBe(100)
    expect(evil.matches[0].url).toBeUndefined()
  })

  it('incluye los comparables y las preguntas para que se pueda discutir', async () => {
    const a = await analyze({ scrape: scrape({ description: undefined }) })
    const s = buildSharedAnalysis(a)
    expect(s.matches.length).toBeGreaterThan(0)
    expect(s.question).toMatch(/antigüedad/)
    expect(s.range).toBeTruthy()
  })
})

describe('perfilado progresivo', () => {
  it('sin respuestas no hay perfil', () => {
    expect(buildPreferences({})).toBeNull()
    expect(buildPreferences({ location: '  ' })).toBeNull()
  })

  it('cada respuesta es una regla imprescindible', () => {
    const p = buildPreferences({ budget: 300_000, location: 'Pilar', bedrooms: 3, mustHaves: ['garden', 'study'] })!
    expect(p.rules.map(r => r.key)).toEqual(['budget', 'location', 'bedrooms', 'garden', 'study'])
    expect(p.rules.every(r => r.importance === 'MUST_HAVE')).toBe(true)
  })
})

describe('proveedores reales', () => {
  const cand = (over: Partial<PropertyCandidate> = {}) => ({
    id: 'c1', type: 'HOUSE', operationType: 'sale', price: 300_000, currency: 'USD', title: 'Casa en barrio cerrado Comunidad Uno',
    address: '', neighborhood: 'Zona Test', city: 'Ciudad Test', province: '', surface: 600, coveredSurface: 220,
    rooms: 5, bedrooms: 4, bathrooms: 3, garage: false, description: 'Con pileta', images: [], features: [],
    status: 'ANALYZING', addedAt: NOW.getTime(), incompleteFields: [], source: 'imported',
    ...over,
  }) as unknown as PropertyCandidate

  it('una propiedad guardada se convierte en aviso comparable con precio pedido', () => {
    const l = listingFromCandidate(cand(), NOW)!
    expect(l.priceProvenance).toBe('ASKING_PRICE')
    expect(l.community).toBe('Comunidad Uno')
    expect(l.pool).toBe(true)
    expect(l.kind).toBe('house')
  })

  it('los datos de demostración nunca entran como evidencia', () => {
    expect(listingFromCandidate(cand({ isMock: true }), NOW)).toBeNull()
  })

  it('sin moneda declarada no hay precio comparable', () => {
    const l = listingFromCandidate(cand({ currency: 'MXN' }), NOW)!
    expect(l.price).toBeUndefined()
    expect(l.priceProvenance).toBe('UNKNOWN')
  })
})

describe('datos confirmados por la persona', () => {
  it('"Lo sé" pasa el dato a CONFIRMED con procedencia usuario y cierra el faltante', async () => {
    const base = await analyze({ scrape: scrape({ description: undefined }) })
    expect(base.missingInformation.items.some(i => i.field === 'ageYears')).toBe(true)

    const s = applyUserOverrides(subjectFromScrape(scrape({ description: undefined }), NOW), { ageYears: 12 }, NOW)
    expect(s.fields.ageYears).toMatchObject({ value: 12, status: 'CONFIRMED' })
    expect(s.fields.ageYears?.provenance?.method).toBe('user')

    const after = await analyze({ scrape: scrape({ description: undefined }), overrides: { ageYears: 12 } })
    expect(after.missingInformation.items.some(i => i.field === 'ageYears')).toBe(false)
    expect(after.nextBestAction.type).toBe('VISIT')
  })

  it('un precio sin moneda no se compara con el rango', async () => {
    const a = await analyze({ scrape: scrape({ currency: undefined }) })
    expect(a.pricePositioning.position).toBe('UNKNOWN')
    expect(a.prioritizedRisks.some(r => r.id === 'currency-unclear')).toBe(true)
  })
})

describe('extracción defensiva', () => {
  it('si el importador no leyó los dormitorios, se infieren del texto y quedan marcados INFERRED', () => {
    const s = subjectFromScrape(
      scrape({
        bedrooms: undefined, title: 'Casa en barrio cerrado Comunidad Uno',
        description: 'Casa en venta Amplios ambientes, 5 dormitorios y excelente sector exterior',
      }), NOW,
    )
    expect(s.fields.bedrooms).toMatchObject({ value: 5, status: 'INFERRED' })
  })

  it('un dato leído por el importador manda sobre la inferencia del texto', () => {
    const s = subjectFromScrape(scrape({ bedrooms: 3, description: '5 dormitorios' }), NOW)
    expect(s.fields.bedrooms).toMatchObject({ value: 3, status: 'EXTRACTED' })
  })

  it('sin dormitorios en ninguna parte quedan desconocidos y se piden', async () => {
    const a = await analyze({
      scrape: scrape({ bedrooms: undefined, description: undefined, title: 'Casa en barrio cerrado Comunidad Uno' }),
    })
    expect(a.subjectProperty.fields.bedrooms?.status).toBe('UNKNOWN')
    expect(a.missingInformation.items.some(i => i.field === 'bedrooms')).toBe(true)
  })

  it('sin ningún aviso para comparar no inventa una "ampliación"', async () => {
    const a = await analyze({ providers: [provider([])] })
    expect(a.comparableEvidence.retrieval.searchExpansionReason).toBeNull()
    expect(a.pricePositioning.confidence).toBe('INSUFFICIENT')
    expect(a.nextBestAction.type).not.toBe('VISIT')
  })
})

describe('recomendación con referencia débil', () => {
  it('con confianza BAJA y datos por confirmar no manda a visitar: pide completar primero', async () => {
    // Una zona más amplia y avisos de otro barrio dejan la referencia en confianza baja.
    const weak = strongSet({ community: undefined, neighborhood: 'Otra Zona' }).slice(0, 3)
    const a = await analyze({ scrape: scrape({ description: undefined }), providers: [provider(weak)] })
    expect(['LOW', 'INSUFFICIENT']).toContain(a.pricePositioning.confidence)
    expect(a.nextBestAction.type).not.toBe('VISIT')
  })
})

describe('analítica', () => {
  it('registra eventos sin romper si el destino falla', () => {
    const seen: AnalyticsEvent[] = []
    setAnalyticsSink(e => seen.push(e))
    track('listing_submitted', 's1', { listingKey: 'a' }, NOW)
    expect(seen[0]).toMatchObject({ name: 'listing_submitted', sessionId: 's1' })

    setAnalyticsSink(() => { throw new Error('caído') })
    expect(() => track('analysis_completed', 's1')).not.toThrow()
    setAnalyticsSink(null)
  })

  it('el embudo cuenta sesiones, no eventos', () => {
    const mk = (name: AnalyticsEvent['name'], sessionId: string): AnalyticsEvent => ({ name, sessionId, at: NOW.toISOString() })
    const f = funnel([mk('listing_submitted', 'a'), mk('listing_submitted', 'a'), mk('listing_submitted', 'b'), mk('analysis_completed', 'a')])
    expect(f.find(x => x.step === 'listing_submitted')?.sessions).toBe(2)
    expect(f.find(x => x.step === 'analysis_completed')?.sessions).toBe(1)
  })
})
