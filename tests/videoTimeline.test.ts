import { describe, it, expect } from 'vitest'
import { frameAt, planTimeline, MAX_PHOTOS } from '@/lib/video/timeline'

describe('línea de tiempo del video', () => {
  it('sin fotos no hay video', () => {
    expect(planTimeline(0)).toEqual({ segments: [], total: 0 })
    expect(frameAt(1, 0).next).toBeNull()
  })

  it('cada foto dura lo mismo y se limita la cantidad', () => {
    const p = planTimeline(4)
    expect(p.total).toBe(12)
    expect(p.segments[2]).toEqual({ index: 2, start: 6, end: 9 })
    expect(planTimeline(50).segments).toHaveLength(MAX_PHOTOS)
  })

  it('elige la foto según el segundo y cruza al final de cada una', () => {
    expect(frameAt(0.5, 3).current).toBe(0)
    expect(frameAt(0.5, 3).next).toBeNull()
    const f = frameAt(2.8, 3)
    expect(f.current).toBe(0)
    expect(f.next).toBe(1)
    expect(f.mix).toBeGreaterThan(0)
    expect(frameAt(4, 3).current).toBe(1)
  })

  it('la última foto no cruza con nada y el tiempo se acota', () => {
    expect(frameAt(8.9, 3).next).toBeNull()
    expect(frameAt(999, 3).current).toBe(2)
    expect(frameAt(-5, 3).current).toBe(0)
  })

  it('el zoom crece suavemente dentro de cada foto', () => {
    expect(frameAt(0, 2).zoom).toBeCloseTo(1)
    expect(frameAt(1.5, 2).zoom).toBeCloseTo(1.04)
  })
})
