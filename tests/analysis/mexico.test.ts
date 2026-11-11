import { describe, it, expect } from 'vitest'
import { analyzeProperty, costJurisdiction } from '@/lib/analysis/run'
import { detectMxState, isMexicanUrl, listingCountry } from '@/lib/analysis/country'
import { sellerQuestions, sellerQuestionsMessage } from '@/lib/analysis/sellerQuestions'
import { buildSharedAnalysis, decodeShared, encodeShared, isPortalUrl, scrub } from '@/lib/analysis/share'
import type { ListingFacts } from '@/lib/analysis/types'
import { NOW, provider, scrape, strongSet } from './fixtures'

const mxScrape = (over: Parameters<typeof scrape>[0] = {}) => ({
  ...scrape({
    title: 'Departamento en venta en Polanco',
    description: '2 recámaras, 5 años de antigüedad',
    price: 4_500_000,
    currency: 'MXN',
    neighborhood: 'Polanco',
    city: 'Miguel Hidalgo, Ciudad de México',
    propertyType: 'Departamento',
    ...over,
  }),
  url: 'https://www.inmuebles24.com/propiedades/departamento-polanco-123.html',
  portal: 'Inmuebles24',
})

describe('país del aviso', () => {
  it('el portal manda: Inmuebles24 o un .mx es México', () => {
    expect(isMexicanUrl('https://www.inmuebles24.com/x')).toBe(true)
    expect(isMexicanUrl('https://casas.mercadolibre.com.mx/x')).toBe(true)
    expect(isMexicanUrl('https://www.zonaprop.com.ar/x')).toBe(false)
    expect(listingCountry('https://www.zonaprop.com.ar/x', 'USD')).toBe('AR')
    expect(listingCountry('https://inmobiliaria.test/x', 'MXN')).toBe('MX')
  })

  it('reconoce el estado solo si no hay dudas', () => {
    expect(detectMxState('Polanco, Miguel Hidalgo, CDMX')).toBe('CDMX')
    expect(detectMxState('Zapopan, Jalisco')).toBe('JALISCO')
    expect(detectMxState('Interlomas, Huixquilucan, Estado de México')).toBe('ESTADO_DE_MEXICO')
    expect(detectMxState('San Pedro Garza García, Nuevo León')).toBe('NUEVO_LEON')
    expect(detectMxState('Guadalajara o Monterrey')).toBeUndefined()
    expect(detectMxState('Pilar, Buenos Aires')).toBeUndefined()
  })

  it('nunca cruza provincias y estados', () => {
    const mx = { country: 'MX', city: 'Zapopan, Jalisco' } as ListingFacts
    const ar = { country: 'AR', city: 'Pilar' } as ListingFacts
    expect(costJurisdiction(mx, 'BUENOS_AIRES')).toBe('JALISCO')
    expect(costJurisdiction({ country: 'MX' } as ListingFacts, 'BUENOS_AIRES')).toBeUndefined()
    expect(costJurisdiction({ country: 'MX' } as ListingFacts, 'QUERETARO')).toBe('QUERETARO')
    expect(costJurisdiction(ar, 'CDMX')).toBeUndefined()
    expect(costJurisdiction(ar, 'CABA')).toBe('CABA')
  })
})

describe('un aviso de México se analiza con reglas de México', () => {
  it('costos en MXN con ISAI, notario y RPP; nada de sellos ni escribano', async () => {
    const a = await analyzeProperty({ scrape: mxScrape(), providers: [provider(strongSet())], now: NOW, provinceCode: 'BUENOS_AIRES' })
    expect(a.subjectProperty.country).toBe('MX')
    const c = a.estimatedTransactionCost
    expect(c.jurisdiction).toBe('MX')
    expect(c.region).toBe('CDMX')
    expect(c.totalRange?.currency).toBe('MXN')
    expect(c.totalRange!.min).toBeGreaterThan(4_500_000)
    const labels = c.lines.map(l => l.label).join(' | ')
    expect(labels).toMatch(/ISAI/)
    expect(labels).toMatch(/notario/i)
    expect(labels).toMatch(/Registro Público/)
    expect(labels).not.toMatch(/sellos|escriban/i)
    // El único monto fijo está en USD: con precio en pesos se deja afuera y se dice.
    expect(c.lines.some(l => l.id === 'certificates')).toBe(false)
    expect(c.notIncluded.join(' ')).toMatch(/Avalúo/)
    expect(c.lines.every(l => l.currency === 'MXN')).toBe(true)
  })

  it('no se compara con avisos de Argentina', async () => {
    const a = await analyzeProperty({ scrape: mxScrape(), providers: [provider(strongSet())], now: NOW })
    expect(a.comparableEvidence.matches).toHaveLength(0)
    expect(a.pricePositioning.position).toBe('UNKNOWN')
  })

  it('con precio en USD suma el avalúo y los certificados', async () => {
    const a = await analyzeProperty({ scrape: mxScrape({ price: 250_000, currency: 'USD' }), providers: [], now: NOW })
    expect(a.estimatedTransactionCost.totalRange?.currency).toBe('USD')
    expect(a.estimatedTransactionCost.lines.some(l => l.id === 'certificates')).toBe(true)
  })

  it('habla de cuota de mantenimiento, no de expensas', async () => {
    const a = await analyzeProperty({ scrape: mxScrape(), providers: [], now: NOW })
    const text = JSON.stringify([a.missingInformation, a.prioritizedRisks])
    expect(text).toMatch(/cuota de mantenimiento/i)
    expect(text).not.toMatch(/expensas/i)
  })

  it('un aviso argentino sigue con reglas de Argentina', async () => {
    const a = await analyzeProperty({ scrape: scrape(), providers: [provider(strongSet())], now: NOW, provinceCode: 'CDMX' })
    expect(a.subjectProperty.country).toBe('AR')
    expect(a.estimatedTransactionCost.jurisdiction).toBe('AR')
    expect(a.estimatedTransactionCost.lines.map(l => l.label).join(' ')).toMatch(/sellos/i)
  })
})

describe('las tres preguntas al vendedor', () => {
  it('México: no adeudo, libertad de gravamen y cónyuge', () => {
    const q = sellerQuestions({ country: 'MX', hasCommonCharges: true })
    expect(q).toHaveLength(3)
    const all = q.map(x => `${x.question} ${x.why}`).join(' ')
    expect(all).toMatch(/predial/)
    expect(all).toMatch(/cuotas de mantenimiento/)
    expect(all).toMatch(/libertad de gravamen/)
    expect(all).toMatch(/mancomunados/)
    expect(all).not.toMatch(/escriban|expensas|inhibici/i)
  })

  it('Argentina: deudas, titulares e inhibición', () => {
    const q = sellerQuestions({ country: 'AR', hasCommonCharges: false })
    const all = q.map(x => `${x.question} ${x.why}`).join(' ')
    expect(all).toMatch(/inhibici/)
    expect(all).toMatch(/titulares/)
    expect(all).not.toMatch(/expensas/)
    expect(all).not.toMatch(/notario|predial/)
  })

  it('el mensaje está listo para mandar', () => {
    const msg = sellerQuestionsMessage(sellerQuestions({ country: 'AR' }), 'Casa en Pilar')
    expect(msg).toMatch(/^Hola/)
    expect(msg).toContain('"Casa en Pilar"')
    expect(msg).toMatch(/1\. .*\n2\. .*\n3\. /)
  })
})

describe('compartir: quien abre el link no recibe nada peligroso', () => {
  it('saca links, emails y teléfonos pero deja los montos', () => {
    expect(scrub('Llamá al +54 9 11 5555-4444 ya')).toBe('Llamá al ya')
    expect(scrub('Escribí a estafa@mail.com')).toBe('Escribí a')
    expect(scrub('Entrá a https://evil.example/pago o www.evil.example')).toBe('Entrá a o')
    expect(scrub('Pedís USD 1.250.000 y MXN 4,500,000')).toBe('Pedís USD 1.250.000 y MXN 4,500,000')
  })

  it('solo links a portales de avisos', () => {
    expect(isPortalUrl('https://www.zonaprop.com.ar/propiedades/x.html')).toBe(true)
    expect(isPortalUrl('https://departamento.mercadolibre.com.mx/MLM-1')).toBe(true)
    expect(isPortalUrl('https://zonaprop.com.ar.evil.example/x')).toBe(false)
    expect(isPortalUrl('javascript:alert(1)')).toBe(false)
  })

  it('el país y el estado viajan para recalcular costos; el total no', async () => {
    const a = await analyzeProperty({ scrape: mxScrape(), providers: [], now: NOW })
    const shared = buildSharedAnalysis(a)
    expect(shared).toMatchObject({ country: 'MX', prov: 'CDMX', common: true, price: { a: 4_500_000, c: 'MXN' } })
    expect(JSON.stringify(shared)).not.toMatch(/totalRange|ISAI/)
    expect(decodeShared(encodeShared(shared)!)).toEqual(shared)
  })

  it('un link adulterado no puede meter un estado inventado', () => {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const d = decodeShared(enc({ v: 1, title: 'x', headline: 'y', country: 'XX', prov: '<script>' }))!
    expect(d.country).toBeUndefined()
    expect(d.prov).toBeUndefined()
  })
})
