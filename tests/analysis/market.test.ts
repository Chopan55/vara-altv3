import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  BrightDataError, clampSweep, downloadSweep, startSweep, sweepProgress, SWEEP_LIMITS, ZONAPROP_DATASET_ID,
} from '@/lib/analysis/market/brightdata'
import { createFileStore, matchesZone, mergeListing } from '@/lib/analysis/market/store'
import { listingFromZonaprop, listingsFromZonaprop, parseZonapropDate } from '@/lib/analysis/market/zonaprop'
import { detectCommunity } from '@/lib/analysis/normalize'
import { analyzeProperty } from '@/lib/analysis/run'
import { NOW, scrape } from './fixtures'

/** Registro SINTÉTICO con la forma real que devuelve el scraper (valores inventados). */
const rec = (over: Record<string, unknown> = {}) => ({
  url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclcain-casa-en-venta-en-comunidad-test-90000001.html',
  Title: 'Casa en Venta en Comunidad Test Cc, Pilar, G. B. a. Zona Norte',
  Precio: 500000, Currency: 'USD', Fecha_de_publicacion: '10/15/26',
  Dimension_terreno: '1000', Dimension_propiedad: '300',
  Ambientes: 6, Banos: 3, Dormitorios: 4, Tipo: 'Casa', Nueva_usada: '12 años',
  Operacion: 'venta', Zona: 'GBA Norte', Zona2: 'Pilar', Zona3: 'Barrio Test',
  latitude: -34.43, longitude: -58.87, address: 'Comunidad Test 0, Barrio Test, Pilar',
  expenses: 900000, estatus: 'online', posting_id: '90000001',
  Phone1: '+54 11 5555-0000', Phone2: '+54 11 5555-0001', Seller_name: 'Inmobiliaria Test',
  Seller_ID: '123', Seller_url: 'https://www.zonaprop.com.ar/inmobiliarias/test',
  Imagenes: ['https://imgar.zonapropcdn.com/avisos/1/00/00/foto-aaaaaaaa.jpg'],
  ...over,
})

describe('registro de Zonaprop → ListingFacts', () => {
  it('mapea los campos que sirven para comparar', () => {
    const l = listingFromZonaprop(rec(), NOW)!
    expect(l).toMatchObject({
      id: 'zp-90000001', source: 'Zonaprop', city: 'Pilar', neighborhood: 'Barrio Test', kind: 'house',
      price: 500000, currency: 'USD', priceProvenance: 'ASKING_PRICE', bedrooms: 4, bathrooms: 3,
      coveredArea: 300, landArea: 1000, ageYears: 12, expenses: 900000, status: 'active',
    })
    expect(l.lat).toBeCloseTo(-34.43)
  })

  it('nunca incluye teléfonos ni datos del vendedor', () => {
    const json = JSON.stringify(listingFromZonaprop(rec(), NOW))
    expect(json).not.toMatch(/5555|Inmobiliaria Test|Seller|Phone|inmobiliarias\/test/i)
  })

  it('un 0 en baños o dormitorios es dato ausente, no un cero', () => {
    const l = listingFromZonaprop(rec({ Banos: 0, Dormitorios: 0 }), NOW)!
    expect(l.bathrooms).toBeUndefined()
    expect(l.bedrooms).toBeUndefined()
  })

  it('la fecha del portal se usa como última actualización, no como publicación', () => {
    const l = listingFromZonaprop(rec(), NOW)!
    expect(l.lastUpdatedAt).toBe('2026-10-15T00:00:00.000Z')
    expect(l.publishedAt).toBeUndefined()
    expect(parseZonapropDate('13/45/26')).toBeUndefined()
    expect(parseZonapropDate('basura')).toBeUndefined()
  })

  it('"En construcción" no inventa antigüedad y "A estrenar" es nueva', () => {
    expect(listingFromZonaprop(rec({ Nueva_usada: 'En construcción' }), NOW)!.ageYears).toBeUndefined()
    const n = listingFromZonaprop(rec({ Nueva_usada: 'A estrenar' }), NOW)!
    expect(n.ageYears).toBe(0)
    expect(n.condition).toBe('new')
  })

  it('sin moneda reconocida no hay precio comparable', () => {
    const l = listingFromZonaprop(rec({ Currency: 'EUR' }), NOW)!
    expect(l.price).toBeUndefined()
    expect(l.priceProvenance).toBe('UNKNOWN')
  })

  it('descarta registros que no son de Zonaprop', () => {
    expect(listingFromZonaprop(rec({ url: 'https://evil.test/x' }), NOW)).toBeNull()
    expect(listingsFromZonaprop([rec(), rec({ url: 'javascript:alert(1)' })], NOW)).toHaveLength(1)
  })

  it('detecta la comunidad en los títulos reales de Zonaprop', () => {
    expect(detectCommunity('Casa en Venta en Mayling Cc, Pilar, G. B. a. Zona Norte')).toBe('Mayling')
    expect(detectCommunity('Casa en Venta Highland Park Cc, Pilar')).toBe('Highland Park')
    expect(detectCommunity('Casa en Venta - Mayling Club de Campo - Hirusta Propiedades')).toBe('Mayling')
    expect(detectCommunity('Casa en Club de Campo Pueyrredon')).toBe('Pueyrredon')
    expect(detectCommunity('Casa en Estancias Del Pilar en el barrio La Paz')).toBeUndefined()
  })
})

describe('store: primera vez vista y cambios de precio', () => {
  const a = listingFromZonaprop(rec(), NOW)!

  it('un aviso nuevo guarda cuándo lo vimos por primera vez', () => {
    const { stored, priceChanged } = mergeListing(undefined, a, NOW)
    expect(stored.firstSeenAt).toBe(NOW.toISOString())
    expect(priceChanged).toBe(false)
  })

  it('si el precio cambia entre barridos, queda registrado y es la actividad más reciente', () => {
    const t1 = new Date('2026-10-22T12:00:00Z')
    const first = mergeListing(undefined, a, NOW).stored
    const { stored, priceChanged } = mergeListing(first, { ...a, price: 470000 }, t1)
    expect(priceChanged).toBe(true)
    expect(stored.firstSeenAt).toBe(NOW.toISOString())
    expect(stored.facts.priceChangedAt).toBe(t1.toISOString())
    expect(stored.priceHistory.map(p => p.price)).toEqual([500000, 470000])
  })

  it('un precio igual no genera cambio', () => {
    const first = mergeListing(undefined, a, NOW).stored
    expect(mergeListing(first, a, new Date('2026-10-22T12:00:00Z')).priceChanged).toBe(false)
  })

  it('persiste en archivo, consulta por zona y no duplica en el segundo barrido', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vara-market-'))
    try {
      const store = createFileStore(dir)
      const other = listingFromZonaprop(rec({ posting_id: '90000002', url: 'https://www.zonaprop.com.ar/propiedades/clasificado/x-90000002.html', Zona2: 'Escobar', Zona3: 'Otro' }), NOW)!
      expect(await store.upsert([a, other], NOW)).toEqual({ added: 2, updated: 0, priceChanges: 0 })
      expect(await store.upsert([a, other], new Date('2026-10-22T00:00:00Z'))).toEqual({ added: 0, updated: 2, priceChanges: 0 })

      const pilar = await store.query({ city: 'pilar' })
      expect(pilar.map(l => l.id)).toEqual(['zp-90000001'])
      expect(await store.query({})).toEqual([])
      expect((await store.stats()).total).toBe(2)
      expect(matchesZone(a, { neighborhood: 'BARRIO TEST' })).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('cliente de Bright Data: protege el crédito y la clave', () => {
  const KEY = 'clave-de-prueba-123456'
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('arma el pedido de descubrimiento con tope por zona', async () => {
    const calls: { url: string; body?: string }[] = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string })
      return json({ snapshot_id: 'sd_abc123' })
    }
    const r = await startSweep({ apiKey: KEY, fetchImpl }, {
      zoneUrls: ['https://www.zonaprop.com.ar/casas-venta-pilar.html'], limitPerZone: 50,
    })
    expect(r).toEqual({ snapshotId: 'sd_abc123', zones: 1, limitPerZone: 50 })
    expect(calls[0].url).toContain(`dataset_id=${ZONAPROP_DATASET_ID}`)
    expect(calls[0].url).toContain('discover_by=domain')
    expect(calls[0].url).toContain('limit_per_input=50')
    expect(JSON.parse(calls[0].body!)).toEqual([{ url: 'https://www.zonaprop.com.ar/casas-venta-pilar.html' }])
  })

  it('los topes impiden gastar de más', () => {
    const z = 'https://www.zonaprop.com.ar/casas-venta-pilar.html'
    expect(clampSweep({ zoneUrls: [z], limitPerZone: 99999 }).limitPerZone).toBe(SWEEP_LIMITS.maxPerZone)
    expect(() => clampSweep({ zoneUrls: [] })).toThrow(BrightDataError)
    expect(() => clampSweep({ zoneUrls: ['https://otro-sitio.test/x'] })).toThrow(/zonaprop/)
    const many = Array.from({ length: 5 }, (_, i) => `https://www.zonaprop.com.ar/zona-${i}.html`)
    expect(() => clampSweep({ zoneUrls: many, limitPerZone: 300 })).toThrow(/tope/)
  })

  it('consulta el progreso y descarga solo con ids válidos', async () => {
    const fetchImpl = async (url: string) =>
      url.includes('/progress/') ? json({ status: 'ready', records: 5, errors: 0 }) : json([{ url: 'x' }])
    const cfg = { apiKey: KEY, fetchImpl }
    expect(await sweepProgress(cfg, 'sd_abc123')).toEqual({ status: 'ready', records: 5, errors: 0 })
    expect(await downloadSweep(cfg, 'sd_abc123')).toHaveLength(1)
    await expect(sweepProgress(cfg, '../../etc/passwd')).rejects.toThrow(/inválido/)
  })

  it('un error de la API no filtra la clave ni el cuerpo de la respuesta', async () => {
    const fetchImpl = async () => new Response(`error con ${KEY}`, { status: 401 })
    const err = await startSweep({ apiKey: KEY, fetchImpl }, { zoneUrls: ['https://www.zonaprop.com.ar/a.html'] }).catch(e => e)
    expect(err).toBeInstanceOf(BrightDataError)
    expect(String(err.message)).not.toContain(KEY)
    expect(err.status).toBe(401)
  })
})

describe('de punta a punta con avisos de mercado', () => {
  it('los avisos barridos alimentan el análisis y el precio sale con confianza', async () => {
    const market = [480000, 495000, 505000, 515000, 520000, 530000].map((price, i) =>
      listingFromZonaprop(rec({
        posting_id: `9100000${i}`, url: `https://www.zonaprop.com.ar/propiedades/clasificado/t-9100000${i}.html`,
        Title: `Residencia ${['alfa', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'][i]} luminosa ${['norte', 'sur', 'este', 'oeste', 'centro', 'fondo'][i]}`,
        Precio: price, Dimension_propiedad: String(285 + i * 6), Dimension_terreno: String(950 + i * 40),
        Imagenes: [`https://img.test/a/foto-${i}-xxxxxxxx.jpg`],
      }), NOW)!,
    )
    const a = await analyzeProperty({
      scrape: scrape({ price: 540000, coveredM2: 300, neighborhood: 'Barrio Test', city: 'Pilar', title: 'Casa 4 dormitorios en Comunidad Test Cc' }),
      providers: [{ name: 'Avisos de Zonaprop', fetch: async () => market }],
      now: NOW,
    })
    expect(a.comparableEvidence.strongMatches).toBeGreaterThanOrEqual(5)
    expect(a.pricePositioning.confidence).not.toBe('INSUFFICIENT')
    expect(a.pricePositioning.comparableListingRange?.basis).toBe('ASKING_PRICE')
    expect(JSON.stringify(a)).not.toMatch(/5555|Seller|Phone/i)
  })
})
