import { describe, it, expect } from 'vitest'
import { pickNewer, type SavedVisitChecklist } from '@/lib/supabase/visitChecklist'

const at = (updatedAt: string, checked: string[] = []): SavedVisitChecklist => ({ checked, notes: {}, updatedAt })

describe('pickNewer', () => {
  it('sin versión en la cuenta, se queda con la del dispositivo', () => {
    expect(pickNewer(at('2026-11-04T10:00:00Z'), null)?.updatedAt).toBe('2026-11-04T10:00:00Z')
  })
  it('sin versión en el dispositivo (celular nuevo), usa la de la cuenta', () => {
    expect(pickNewer(null, at('2026-11-01T10:00:00Z', ['a']))?.checked).toEqual(['a'])
  })
  it('gana la más reciente', () => {
    expect(pickNewer(at('2026-11-04T10:00:00Z', ['local']), at('2026-11-03T10:00:00Z', ['remota']))?.checked).toEqual(['local'])
    expect(pickNewer(at('2026-11-03T10:00:00Z', ['local']), at('2026-11-04T10:00:00Z', ['remota']))?.checked).toEqual(['remota'])
  })
  it('sin ninguna, nada', () => {
    expect(pickNewer(null, null)).toBeNull()
  })
})
