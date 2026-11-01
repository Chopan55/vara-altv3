import { describe, it, expect } from 'vitest'
import { MAX_AUDIO_BYTES, MUSIC_STYLES, audioFileProblem, buildEvents, midiToFreq } from '@/lib/video/music'

describe('música de fondo', () => {
  it('ofrece 4 estilos distintos', () => {
    expect(MUSIC_STYLES).toHaveLength(4)
    expect(new Set(MUSIC_STYLES.map(s => s.id)).size).toBe(4)
    for (const s of MUSIC_STYLES) expect(s.description.length).toBeGreaterThan(10)
  })

  it('convierte notas MIDI a frecuencia', () => {
    expect(midiToFreq(69)).toBeCloseTo(440)
    expect(midiToFreq(57)).toBeCloseTo(220)
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1)
  })

  it('cada estilo cubre la duración sin pasarse del final', () => {
    for (const s of MUSIC_STYLES) {
      const total = 30
      const ev = buildEvents(s, total)
      expect(ev.length).toBeGreaterThan(20)
      expect(Math.min(...ev.map(e => e.start))).toBe(0)
      expect(Math.max(...ev.map(e => e.start))).toBeLessThan(total)
      expect(Math.max(...ev.map(e => e.start + e.dur))).toBeLessThanOrEqual(total + 0.5)
      for (const e of ev) {
        expect(e.freq).toBeGreaterThan(60)
        expect(e.freq).toBeLessThan(2500)
        expect(e.gain).toBeGreaterThan(0)
        expect(e.gain).toBeLessThan(0.2)
      }
    }
  })

  it('no genera notas para una duración vacía', () => {
    expect(buildEvents(MUSIC_STYLES[0], 0)).toEqual([])
    expect(buildEvents(MUSIC_STYLES[0], -5)).toEqual([])
  })

  it('el volumen total no satura: pocas voces a la vez', () => {
    const s = MUSIC_STYLES[0]
    const ev = buildEvents(s, 20)
    const at = 10.01
    const sounding = ev.filter(e => e.start <= at && e.start + e.dur >= at)
    const sum = sounding.reduce((a, e) => a + e.gain, 0)
    expect(sum).toBeLessThan(0.9)
  })

  it('valida el archivo MP3 antes de leerlo', () => {
    expect(audioFileProblem({ name: 'tema.mp3', type: 'audio/mpeg', size: 1000 })).toBeNull()
    expect(audioFileProblem({ name: 'tema.MP3', type: '', size: 1000 })).toBeNull()
    expect(audioFileProblem({ name: 'foto.jpg', type: 'image/jpeg', size: 1000 })).toContain('MP3')
    expect(audioFileProblem({ name: 'tema.mp3', type: 'audio/mpeg', size: MAX_AUDIO_BYTES + 1 })).toContain('15 MB')
    expect(audioFileProblem({ name: 'tema.mp3', type: 'audio/mpeg', size: 0 })).toContain('vacío')
  })
})
