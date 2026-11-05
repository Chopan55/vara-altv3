import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildDigest, shouldSend, alertOperationType, type DigestOperation } from '@/lib/alerts/emailDigest'
import { sendEmail } from '@/lib/alerts/sendEmail'
import { cronAuthorized } from '@/lib/cron/auth'
import { GET as digestCron } from '@/app/api/alerts/digest/cron/route'

const links = { appUrl: 'https://vara.test', unsubscribeUrl: 'https://vara.test/api/alerts/unsubscribe?token=t' }

function isoIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function op(over: Partial<DigestOperation> = {}): DigestOperation {
  return { id: 'op1', title: 'Casa en Pilar', type: 'SELL', tasks: [], docs: [], ...over }
}

const task = (key: string, title: string, dueDate?: string) => ({ id: key, key, title, description: '', done: false, dueDate })

describe('buildDigest', () => {
  it('sin nada urgente no hay email (lo que vence en 4–10 días no dispara)', () => {
    expect(buildDigest([op({ tasks: [task('t1', 'Tasación', isoIn(7))] })], links)).toBeNull()
    expect(buildDigest([op({ tasks: [task('docs', 'Documentación')] })], links)).toBeNull()
    expect(buildDigest([], links)).toBeNull()
  })

  it('una tarea vencida dispara el resumen, con baja y link a alertas', () => {
    const d = buildDigest([op({ tasks: [task('t1', 'Firmar reserva', isoIn(-2)), task('t2', 'Tasación', isoIn(7))] })], links)!
    expect(d).not.toBeNull()
    expect(d.urgent).toBe(1)
    expect(d.subject).toContain('Firmar reserva')
    expect(d.text).toContain('Tasación') // lo no urgente va dentro
    expect(d.html).toContain(links.unsubscribeUrl.replace(/&/g, '&amp;'))
    expect(d.html).toContain('https://vara.test/alertas')
    expect(d.text).toContain(links.unsubscribeUrl)
  })

  it('documentos vencidos o rechazados son urgentes', () => {
    const d = buildDigest([op({ docs: [{ id: 'd1', name: 'Informe de dominio', status: 'EXPIRED' }] })], links)!
    expect(d.urgent).toBe(1)
    expect(d.text).toContain('Informe de dominio')
  })

  it('escapa el HTML de títulos que escribe el usuario', () => {
    const d = buildDigest([op({ title: '<script>x</script>', tasks: [task('t1', 'A & B', isoIn(0))] })], links)!
    expect(d.html).not.toContain('<script>x')
    expect(d.html).toContain('&lt;script&gt;')
    expect(d.html).toContain('A &amp; B')
  })

  it('la clave no depende del texto que cambia cada día', () => {
    const a = buildDigest([op({ tasks: [task('t1', 'X', isoIn(-1))] })], links)!
    const b = buildDigest([op({ tasks: [task('t1', 'X', isoIn(-3))] })], links)!
    expect(a.key).toBe(b.key)
  })
})

describe('shouldSend', () => {
  const now = new Date('2026-11-05T13:00:00Z')
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()
  it('primer envío: sí', () => expect(shouldSend({ lastSentAt: null, lastKey: null }, 'k', now)).toBe(true))
  it('nunca dos en menos de 20 horas', () => expect(shouldSend({ lastSentAt: ago(5), lastKey: 'otra' }, 'k', now)).toBe(false))
  it('cambió lo urgente: al día siguiente sí', () => expect(shouldSend({ lastSentAt: ago(24), lastKey: 'otra' }, 'k', now)).toBe(true))
  it('lo mismo de siempre: cada 3 días', () => {
    expect(shouldSend({ lastSentAt: ago(48), lastKey: 'k' }, 'k', now)).toBe(false)
    expect(shouldSend({ lastSentAt: ago(72), lastKey: 'k' }, 'k', now)).toBe(true)
  })
})

describe('alertOperationType', () => {
  it('mapea los tipos de la base', () => {
    expect(alertOperationType('SELL_PROPERTY')).toBe('SELL')
    expect(alertOperationType('BUY_PROPERTY')).toBe('BUY')
  })
})

describe('sendEmail', () => {
  it('manda a Resend con baja en un clic y sin exponer la clave en el cuerpo', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    const ok = await sendEmail({ apiKey: 'test-key', from: 'VARA <alertas@vara.test>' },
      { to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't', unsubscribeUrl: links.unsubscribeUrl }, fetchImpl as unknown as typeof fetch)
    expect(ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    const body = JSON.parse(String(init.body))
    expect(body.to).toEqual(['a@b.test'])
    expect(body.headers['List-Unsubscribe']).toBe(`<${links.unsubscribeUrl}>`)
    expect(String(init.body)).not.toContain('test-key')
  })

  it('un error del proveedor devuelve false', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 422 }))
    expect(await sendEmail({ apiKey: 'k', from: 'f' },
      { to: 'a', subject: 's', html: 'h', text: 't', unsubscribeUrl: 'u' }, fetchImpl as unknown as typeof fetch)).toBe(false)
  })
})

describe('cron del resumen', () => {
  const original = { ...process.env }
  afterEach(() => { process.env = { ...original } })

  it('apagado por defecto', async () => {
    delete process.env.ALERTS_EMAIL_ENABLED
    const res = await digestCron(new Request('http://x/api/alerts/digest/cron'))
    expect(await res.json()).toEqual({ status: 'disabled' })
  })

  it('encendido, sin el secreto correcto: 401', async () => {
    process.env.ALERTS_EMAIL_ENABLED = '1'
    process.env.CRON_SECRET = 'a-very-long-test-secret-value'
    const res = await digestCron(new Request('http://x/api/alerts/digest/cron', { headers: { authorization: 'Bearer otro' } }))
    expect(res.status).toBe(401)
  })

  it('autorizado pero sin configuración: 503 con los nombres que faltan, nunca los valores', async () => {
    process.env.ALERTS_EMAIL_ENABLED = '1'
    process.env.CRON_SECRET = 'a-very-long-test-secret-value'
    delete process.env.RESEND_API_KEY
    delete process.env.ALERTS_FROM_EMAIL
    const res = await digestCron(new Request('http://x/api/alerts/digest/cron', {
      headers: { authorization: 'Bearer a-very-long-test-secret-value' } }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.missing).toContain('RESEND_API_KEY / ALERTS_FROM_EMAIL')
    expect(JSON.stringify(body)).not.toContain('a-very-long-test-secret-value')
  })

  it('cronAuthorized rechaza secretos cortos aunque coincidan', () => {
    process.env.CRON_SECRET = 'corto'
    expect(cronAuthorized(new Request('http://x', { headers: { authorization: 'Bearer corto' } }))).toBe(false)
  })
})
