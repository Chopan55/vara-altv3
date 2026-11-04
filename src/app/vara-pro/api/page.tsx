import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { WEBHOOK_EVENTS } from '@/lib/supabase/developerEvents'

export const metadata: Metadata = {
  title: 'API de VARA — Documentación',
  description: 'Cómo leer tus operaciones desde tu sistema y recibir eventos firmados.',
}

/**
 * Referencia pública de la API v1. Todo lo que dice esta página tiene que
 * coincidir con src/app/api/v1 y la migración 20261105000002_public_api:
 * si cambia una, cambia la otra (tests/apiV1Routes.test.ts cubre el contrato).
 */

const OPERATION_FIELDS: [string, string, string][] = [
  ['id', 'uuid', 'Identificador de la operación.'],
  ['title', 'string', 'Nombre que le puso el usuario.'],
  ['type', 'string', 'BUY_PROPERTY · SELL_PROPERTY · LAND_PURCHASE · COMMERCIAL_PROPERTY'],
  ['status', 'string', 'ACTIVE · PAUSED · COMPLETED · DRAFT'],
  ['province_code', 'string', 'Jurisdicción de la operación (ej. CABA, BUENOS_AIRES, CDMX).'],
  ['created_at', 'timestamp', 'ISO 8601, UTC.'],
  ['updated_at', 'timestamp', 'ISO 8601, UTC.'],
]

const ERRORS: [string, string, string][] = [
  ['401', 'unauthenticated', 'Falta la clave, es inválida o fue revocada.'],
  ['403', 'disabled', 'La API no está habilitada en esta instancia de VARA.'],
  ['404', 'not_found', 'La operación no existe o no es tuya. No se distingue a propósito.'],
  ['500', 'internal', 'Error nuestro. Reintentá más tarde.'],
  ['503', 'not_ready', 'La base todavía no tiene la API instalada.'],
]

const LIST_EXAMPLE = `curl https://TU-DOMINIO-VARA/api/v1/operations \\
  -H "Authorization: Bearer vara_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`

const LIST_RESPONSE = `{
  "data": [
    {
      "id": "8f2c1a9e-3b4d-4e5f-9a1b-2c3d4e5f6a7b",
      "title": "Cabello 1234, CABA",
      "type": "SELL_PROPERTY",
      "status": "ACTIVE",
      "province_code": "CABA",
      "created_at": "2026-10-28T10:12:00Z",
      "updated_at": "2026-11-02T14:30:00Z"
    }
  ]
}`

const WEBHOOK_BODY = `{
  "id": "3c1f…",
  "event": "OFFER_CREATED",
  "operation_id": "8f2c1a9e-…",
  "summary": "Nueva oferta de USD 410.000",
  "created_at": "2026-11-04T12:00:00.000000+00:00"
}`

const VERIFY_NODE = `import { createHmac, timingSafeEqual } from 'node:crypto'

// rawBody: el cuerpo tal cual llegó (Buffer o string), antes de parsear el JSON.
export function isFromVara(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}`

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-[12px] leading-relaxed text-slate-100"><code>{children}</code></pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="mb-8 scroll-mt-20">
      <h2 id={`${id}-t`} className="mb-3 text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>{head.map(h => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r[0] + r[1]}>
              {r.map((c, i) => <td key={i} className={i === 0 ? 'px-3 py-2 font-mono text-slate-800' : 'px-3 py-2 text-slate-600'}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/vara-pro" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} aria-hidden="true" /> VARA Pro
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">API de VARA</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Leé las operaciones de tu cuenta desde tu CRM o tu sistema, y recibí un aviso firmado cada vez que algo cambia.
          Versión 1, en preview: solo lectura.
        </p>

        <nav aria-label="Contenido" className="mb-8 flex flex-wrap gap-2 text-xs">
          {[['auth', 'Autenticación'], ['operaciones', 'Operaciones'], ['errores', 'Errores'], ['webhooks', 'Webhooks'], ['limites', 'Límites']].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 hover:border-brand-300">{label}</a>
          ))}
        </nav>

        <Section id="auth" title="Autenticación">
          <p>
            Cada pedido lleva una clave de API en el header <code>Authorization</code>. Las claves se crean y se revocan
            en <Link href="/vara-pro" className="font-semibold text-brand-700 underline">VARA Pro → Tus claves y webhooks</Link>.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>La clave se muestra una sola vez. VARA guarda solo su huella (SHA-256): si la perdés, creá otra.</li>
            <li>Una clave ve únicamente las operaciones de la cuenta que la creó.</li>
            <li>Usala solo desde un servidor. Nunca la pongas en una página web, una app ni un repositorio.</li>
            <li>Si se filtra, revocala: deja de funcionar al instante.</li>
          </ul>
          <Code>{'Authorization: Bearer vara_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}</Code>
        </Section>

        <Section id="operaciones" title="Operaciones">
          <h3 className="font-semibold text-slate-800"><code>GET /api/v1/operations</code></h3>
          <p>Todas tus operaciones, de la más nueva a la más vieja.</p>
          <Code>{LIST_EXAMPLE}</Code>
          <Code>{LIST_RESPONSE}</Code>
          <h3 className="pt-2 font-semibold text-slate-800"><code>GET /api/v1/operations/{'{id}'}</code></h3>
          <p>Una operación. Responde <code>{'{ "data": { … } }'}</code> con los mismos campos.</p>
          <h3 className="pt-2 font-semibold text-slate-800">El objeto operación</h3>
          <Table head={['Campo', 'Tipo', 'Descripción']} rows={OPERATION_FIELDS} />
          <p className="text-xs text-slate-500">
            La API no expone documentos, montos de ofertas ni datos personales de las partes.
          </p>
        </Section>

        <Section id="errores" title="Errores">
          <p>Los errores responden <code>{'{ "error": "<código>" }'}</code> con este status:</p>
          <Table head={['Status', 'Código', 'Qué significa']} rows={ERRORS} />
        </Section>

        <Section id="webhooks" title="Webhooks">
          <p>
            Registrás una URL <code>https://</code> y VARA le hace un <code>POST</code> con cada evento de tus operaciones.
            Podés elegir qué eventos recibir; sin elegir ninguno, recibís todos.
          </p>
          <Table head={['Evento', 'Cuándo']} rows={WEBHOOK_EVENTS.map(e => [e.value, e.label])} />
          <p>Cuerpo del pedido:</p>
          <Code>{WEBHOOK_BODY}</Code>
          <p>Headers:</p>
          <Table
            head={['Header', 'Valor']}
            rows={[
              ['Content-Type', 'application/json'],
              ['X-Vara-Event', 'El tipo de evento, igual a "event" en el cuerpo.'],
              ['X-Vara-Signature', 'sha256=<HMAC-SHA256 del cuerpo, en hex, con el secreto del webhook>'],
            ]}
          />
          <h3 className="pt-2 font-semibold text-slate-800">Verificar la firma</h3>
          <p>
            Antes de confiar en un evento, calculá la firma sobre el cuerpo <strong>tal cual llegó</strong> (sin parsearlo
            ni reformatearlo) y comparala con el header. El secreto se copia desde el panel.
          </p>
          <Code>{VERIFY_NODE}</Code>
        </Section>

        <Section id="limites" title="Límites de esta versión">
          <ul className="list-disc space-y-1 pl-5">
            <li>Solo lectura: no se pueden crear ni modificar operaciones por API.</li>
            <li>Los webhooks se envían una vez, sin reintentos. Si tu servidor estaba caído, consultá <code>GET /api/v1/operations</code> para ponerte al día.</li>
            <li>El orden de llegada de los webhooks no está garantizado: usá <code>created_at</code>.</li>
            <li>Respondé rápido (en menos de 5 segundos) y procesá en segundo plano.</li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
