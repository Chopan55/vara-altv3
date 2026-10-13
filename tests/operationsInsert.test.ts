import { describe, it, expect } from 'vitest'
import { isMissingColumnError } from '@/lib/supabase/operations'
import { messageOf } from '@/lib/observability/logger'

describe('inserción de operaciones', () => {
  const pgrst = { code: 'PGRST204', message: "Could not find the 'country' column of 'operations' in the schema cache" }

  it('detecta cuando falta la columna country en la base', () => {
    expect(isMissingColumnError(pgrst, 'country')).toBe(true)
  })

  it('no confunde otras columnas ni otros errores', () => {
    expect(isMissingColumnError(pgrst, 'locale')).toBe(false)
    expect(isMissingColumnError({ code: '42501', message: "permission denied for 'country'" }, 'country')).toBe(false)
    expect(isMissingColumnError(null, 'country')).toBe(false)
    expect(isMissingColumnError('texto', 'country')).toBe(false)
  })

  it('el log muestra la causa real y no "Error desconocido Object"', () => {
    expect(messageOf(pgrst)).toContain('PGRST204')
    expect(messageOf(pgrst)).toContain("'country'")
  })
})
