import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanProps, refFromSearch, anonId, trackDailyVisit } from '@/lib/funnel/track'
import { funnelRows, pct, viral, weekReturn } from '@/lib/funnel/report'
import type { FunnelSummary } from '@/lib/supabase/types'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

describe('medición del embudo: qué se manda', () => {
  it('las props no llevan nada que parezca un dato personal', () => {
    expect(cleanProps({ ref: 'share', country: 'MX', n: 3, ok: true })).toEqual({ ref: 'share', country: 'MX', n: 3, ok: true })
    expect(cleanProps({ email: 'ana@mail.com' })).toEqual({})
    expect(cleanProps({ phone: '1155554444' })).toEqual({})
    expect(cleanProps({ 'Mal Nombre': 'x', ['a'.repeat(40)]: 'x' })).toEqual({})
    expect(cleanProps({ long: 'x'.repeat(100) }).long).toHaveLength(40)
    expect(cleanProps({ nan: Number.NaN })).toEqual({})
  })

  it('el origen solo acepta valores conocidos', () => {
    expect(refFromSearch('?ref=share')).toBe('share')
    expect(refFromSearch('?utm_source=whatsapp')).toBe('wa')
    expect(refFromSearch('?ref=<script>')).toBeNull()
    expect(refFromSearch('')).toBeNull()
  })
})

describe('medición del embudo: navegador', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('window', { location: { search: '?ref=share', pathname: '/' } })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('el id anónimo es un uuid estable en el navegador', () => {
    const a = anonId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/i)
    expect(anonId()).toBe(a)
  })

  it('una visita por día: la segunda vez el mismo día no cuenta', () => {
    const day = new Date('2026-11-08T12:00:00Z')
    expect(trackDailyVisit(day)).toBe(true)
    expect(trackDailyVisit(day)).toBe(false)
    expect(trackDailyVisit(new Date('2026-11-09T12:00:00Z'))).toBe(true)
  })
})

describe('lectura del embudo', () => {
  const s: FunnelSummary = {
    days: 30, visitors: 200, analyzed: 50, operations: 10, invited: 2,
    shares: 8, shared_views: 20, from_share: 6, cohort_7d: 40, returned_7d: 10,
  }

  it('conversión paso a paso y sobre las visitas', () => {
    const rows = funnelRows(s)
    expect(rows.map(r => r.count)).toEqual([200, 50, 10, 2])
    expect(rows[1]).toMatchObject({ fromPrevious: 25, fromVisitors: 25 })
    expect(rows[2]).toMatchObject({ fromPrevious: 20, fromVisitors: 5 })
    expect(rows[0].fromPrevious).toBeNull()
  })

  it('sin datos no inventa porcentajes', () => {
    const zero = funnelRows({ ...s, visitors: 0, analyzed: 0, operations: 0, invited: 0 })
    expect(zero.every(r => r.fromVisitors === null)).toBe(true)
    expect(pct(1, 0)).toBeNull()
    expect(weekReturn({ ...s, cohort_7d: 0, returned_7d: 0 }).rate).toBeNull()
  })

  it('vuelta a la semana y efecto de compartir', () => {
    expect(weekReturn(s)).toEqual({ returned: 10, cohort: 40, rate: 25 })
    expect(viral(s)).toEqual({ shares: 8, views: 20, arrivals: 6, arrivalsPerShare: 0.75 })
  })
})
