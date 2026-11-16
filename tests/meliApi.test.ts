import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchMeliExtras, fetchMeliItem, getMeliToken, isMeliBlockPage, meliItemToScraped, meliSignals, resetMeliToken } from '@/lib/meli/api'
import type { MeliItem } from '@/lib/comparables/model'

const ITEM: MeliItem = {
  id: 'MLA1234567890',
  title: 'Casa en venta en Estancias del Pilar',
  price: 320000,
  currency_id: 'USD',
  permalink: 'https://casa.mercadolibre.com.ar/MLA-1234567890-casa-_JM',
  attributes: [
    { id: 'TOTAL_AREA', value_struct: { number: 1000, unit: 'm²' }, value_name: '1000 m²' },
    { id: 'COVERED_AREA', value_name: '280 m²' },
    { id: 'ROOMS', value_name: '5' },
    { id: 'BEDROOMS', value_struct: { number: 4 } },
    { id: 'FULL_BATHROOMS', value_name: '3' },
    { id: 'PROPERTY_TYPE', value_name: 'Casa' },
  ],
  location: {
    address_line: 'Estancias del Pilar 123',
    neighborhood: { name: 'Estancias del Pilar' },
    city: { name: 'Pilar' },
    state: { name: 'Bs.As. G.B.A. Norte' },
  },
  pictures: [{ secure_url: 'https://http2.mlstatic.com/a.jpg' }, { url: 'http://inseguro/b.jpg' }],
}

describe('meliItemToScraped', () => {
  it('lleva precio, superficie, ambientes, ubicación y fotos del item', () => {
    const { data, photos } = meliItemToScraped(ITEM)
    expect(data).toMatchObject({
      title: 'Casa en venta en Estancias del Pilar', price: 320000, currency: 'USD',
      totalM2: 1000, coveredM2: 280, rooms: 5, bedrooms: 4, bathrooms: 3, propertyType: 'Casa',
      address: 'Estancias del Pilar 123', neighborhood: 'Estancias del Pilar', city: 'Pilar',
    })
    expect(photos).toEqual(['https://http2.mlstatic.com/a.jpg'])
  })

  it('no inventa lo que el item no trae', () => {
    const { data } = meliItemToScraped({ id: 'MLA1', title: 'Lote' })
    expect(data).toEqual({ title: 'Lote' })
  })
})

describe('señales del aviso', () => {
  const now = new Date('2026-11-16T12:00:00Z')

  it('días publicado, baja de precio y cocheras salen del item', () => {
    const item: MeliItem = {
      ...ITEM, start_time: '2026-05-20T12:00:00Z', original_price: 350000,
      attributes: [...(ITEM.attributes ?? []), { id: 'PARKING_LOTS', value_name: '2' }],
    }
    const { data } = meliItemToScraped(item, now)
    expect(data.features).toEqual([
      'Cocheras: 2',
      'Publicado hace 180 días en MercadoLibre',
      'Bajó de precio: de USD 350.000 a USD 320.000',
    ])
  })

  it('sin fecha ni precio original no inventa señales', () => {
    expect(meliSignals({ id: 'MLA1', price: 100 }, now)).toEqual([])
    expect(meliSignals({ id: 'MLA1', price: 100, original_price: 90, start_time: 'x' }, now)).toEqual([])
  })
})

describe('fetchMeliExtras', () => {
  beforeEach(() => resetMeliToken())

  it('suma descripción, tipo de vendedor y visitas', async () => {
    const f = vi.fn(async (u: string) => {
      if (u.endsWith('/description')) return new Response(JSON.stringify({ plain_text: 'Casa luminosa con pileta.' }), { status: 200 })
      if (u.includes('/users/')) return new Response(JSON.stringify({ user_type: 'real_estate_agency' }), { status: 200 })
      if (u.includes('/visits/items')) return new Response(JSON.stringify({ MLA1234567890: 1543 }), { status: 200 })
      return new Response('', { status: 404 })
    })
    const r = await fetchMeliExtras({ ...ITEM, seller_id: 99 }, { env: {}, fetchImpl: f })
    expect(r.description).toBe('Casa luminosa con pileta.')
    expect(r.features).toEqual(['Lo publica una inmobiliaria', '1.543 visitas en MercadoLibre'])
  })

  it('si MeLi no da nada, no agrega nada', async () => {
    const r = await fetchMeliExtras({ ...ITEM, seller_id: 99 }, { env: {}, fetchImpl: async () => new Response('', { status: 403 }) })
    expect(r).toEqual({ features: [] })
  })
})

describe('fetchMeliItem', () => {
  beforeEach(() => resetMeliToken())

  it('sin credenciales pide el item sin token', async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify(ITEM), { status: 200 }))
    const r = await fetchMeliItem('MLA1234567890', { env: {}, fetchImpl: f })
    expect(r.status).toBe('ok')
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toBe('https://api.mercadolibre.com/items/MLA1234567890')
    expect((f.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('con credenciales usa el token de aplicación y lo reutiliza', async () => {
    const f = vi.fn(async (u: string, _i?: RequestInit) =>
      u.endsWith('/oauth/token')
        ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 21600 }), { status: 200 })
        : new Response(JSON.stringify(ITEM), { status: 200 }))
    const env = { MELI_CLIENT_ID: 'id', MELI_CLIENT_SECRET: 'secret' }
    await fetchMeliItem('MLA1', { env, fetchImpl: f })
    await fetchMeliItem('MLA2', { env, fetchImpl: f })
    const tokenCalls = f.mock.calls.filter(c => c[0].endsWith('/oauth/token'))
    expect(tokenCalls).toHaveLength(1)
    const itemCall = f.mock.calls.find(c => c[0].endsWith('/MLA2'))
    expect((itemCall?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('distingue aviso dado de baja, rechazo y falla de red', async () => {
    expect(await fetchMeliItem('MLA1', { env: {}, fetchImpl: async () => new Response('', { status: 404 }) }))
      .toEqual({ status: 'not_found' })
    expect(await fetchMeliItem('MLA1', { env: {}, fetchImpl: async () => new Response('', { status: 403 }) }))
      .toEqual({ status: 'rejected', httpStatus: 403 })
    expect(await fetchMeliItem('MLA1', { env: {}, fetchImpl: async () => { throw new Error('red') } }))
      .toEqual({ status: 'error' })
  })

  it('un token rechazado no rompe: sigue sin token', async () => {
    expect(await getMeliToken({ MELI_CLIENT_ID: 'a', MELI_CLIENT_SECRET: 'b' }, async () => new Response('', { status: 401 })))
      .toBeNull()
  })
})

describe('isMeliBlockPage', () => {
  it('reconoce la página genérica y la verificación de cuenta', () => {
    expect(isMeliBlockPage('<html><head><title>Mercado Libre</title></head></html>')).toBe(true)
    expect(isMeliBlockPage('<html><head><title>Mercado Libre Argentina</title></head></html>')).toBe(true)
    expect(isMeliBlockPage('<script>location="https://www.mercadolibre.com.ar/gz/account-verification?go=x"</script>')).toBe(true)
  })

  it('no confunde un aviso real', () => {
    expect(isMeliBlockPage('<title>Casa En Venta Estancias Del Pilar | Mercado Libre</title>')).toBe(false)
  })
})

describe('scrape-property con un link de MeLi', () => {
  const original = { ...process.env }
  afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); vi.resetModules() })

  it('trae los datos de la API aunque la página esté bloqueada', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.MELI_CLIENT_ID
    vi.doMock('@/lib/api/aiAccess', () => ({ requireAiAccess: async () => ({ error: 'no' }) }))
    vi.stubGlobal('fetch', vi.fn(async (u: string) =>
      u.startsWith('https://api.mercadolibre.com/items/')
        ? new Response(JSON.stringify(ITEM), { status: 200 })
        : new Response('<title>Mercado Libre</title>', { status: 200 })))
    const { POST } = await import('@/app/api/scrape-property/route')
    const req = new Request('http://x/api/scrape-property', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://casa.mercadolibre.com.ar/MLA-1234567890-casa-en-estancias-del-pilar-_JM' }),
    })
    const res = await POST(req as never)
    const body = await res.json()
    expect(body.status).toBe('success')
    expect(body.data).toMatchObject({ price: 320000, totalM2: 1000, rooms: 5, title: 'Casa en venta en Estancias del Pilar' })
  })

  it('si la API también falla y la página es de bloqueo, no guarda basura: pide pegar el texto', async () => {
    delete process.env.OPENAI_API_KEY
    vi.doMock('@/lib/api/aiAccess', () => ({ requireAiAccess: async () => ({ error: 'no' }) }))
    vi.stubGlobal('fetch', vi.fn(async (u: string) =>
      u.startsWith('https://api.mercadolibre.com/') ? new Response('', { status: 403 })
        : u.startsWith('https://r.jina.ai/') ? new Response('Title: Mercado Libre\n\n' + 'x'.repeat(300), { status: 200 })
          : new Response('<title>Mercado Libre</title>', { status: 200 })))
    const { POST } = await import('@/app/api/scrape-property/route')
    const req = new Request('http://x/api/scrape-property', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://casa.mercadolibre.com.ar/MLA-1234567890-casa-en-estancias-del-pilar-_JM' }),
    })
    const body = await (await POST(req as never)).json()
    expect(body.status).toBe('blocked')
    expect(body.data.title).toBeUndefined()
  })
})
