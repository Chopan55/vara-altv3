import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { WEBHOOK_EVENTS } from '@/lib/supabase/developerEvents'

/** La documentación pública no puede prometer eventos que la base no emite. */
describe('documentación de la API', () => {
  const sql = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n')

  it('cada evento de webhook existe en el enum activity_kind', () => {
    for (const e of WEBHOOK_EVENTS) expect(sql, e.value).toContain(`'${e.value}'`)
  })

  it('la firma documentada es la misma que calcula la base', () => {
    const page = readFileSync('src/app/vara-pro/api/page.tsx', 'utf8')
    expect(page).toContain("'sha256=' + createHmac('sha256', secret)")
    expect(sql).toContain("'sha256=' || encode(hmac(payload.body, w.secret, 'sha256'), 'hex')")
    expect(sql).toContain("'X-Vara-Signature'")
    expect(sql).toContain("'X-Vara-Event'")
  })
})
