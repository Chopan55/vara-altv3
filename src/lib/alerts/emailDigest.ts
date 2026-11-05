/**
 * Resumen diario por email: qué está vencido, qué vence pronto y qué documento
 * hay que reemplazar. Funciones puras: el cron junta los datos y envía.
 *
 * Reglas para no molestar:
 * - Solo se manda si hay algo urgente (vencido, vence en ≤ 3 días, documento
 *   vencido o rechazado). Lo que vence en 4–10 días va dentro, pero no dispara.
 * - Nunca dos veces en menos de 20 horas.
 * - Si los urgentes son los mismos que en el último envío, se repite cada 3 días.
 */

import { buildOpDocStatus, mergeAndRankAlerts, type AlertDoc, type DocAlert } from '@/lib/docAlerts'
import type { SellerTaskState } from '@/lib/supabase/sellerTasks'

export interface DigestOperation {
  id: string
  title: string
  type: 'BUY' | 'SELL'
  tasks: SellerTaskState[]
  docs: AlertDoc[]
}

export interface Digest {
  subject: string
  html: string
  text: string
  /** Identifica el conjunto de urgentes, para no repetir el mismo email todos los días. */
  key: string
  urgent: number
}

const MAX_ITEMS = 12
const MIN_GAP_MS = 20 * 3600_000
const REPEAT_SAME_MS = 3 * 86400_000

export function isUrgent(a: DocAlert): boolean {
  return a.severity === 'CRITICAL' || a.severity === 'HIGH'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function opTitle(t: string): string {
  return t.trim() || 'Tu operación'
}

export function buildDigest(
  ops: DigestOperation[],
  links: { appUrl: string; unsubscribeUrl: string },
): Digest | null {
  const statuses = ops.map(o => buildOpDocStatus(o.id, opTitle(o.title), o.type, o.tasks, o.docs))
  const alerts = mergeAndRankAlerts(statuses).filter(a => a.severity !== 'INFO')
  const urgent = alerts.filter(isUrgent)
  if (urgent.length === 0) return null

  const key = urgent.map(a => `${a.operationId}:${a.taskKey}:${a.reason}`).sort().join('|')
  const shown = alerts.slice(0, MAX_ITEMS)
  const rest = alerts.length - shown.length
  const subject = urgent.length === 1
    ? `VARA: ${urgent[0].taskTitle} — ${urgent[0].message.toLowerCase()}`
    : `VARA: ${urgent.length} temas urgentes en tus operaciones`

  const alertsUrl = `${links.appUrl}/alertas`
  const textLines = [
    'Esto es lo que necesita tu atención hoy:',
    '',
    ...shown.map(a => `- ${a.taskTitle} (${a.operationTitle}): ${a.message}`),
    ...(rest > 0 ? [`- y ${rest} más`] : []),
    '',
    `Ver todo: ${alertsUrl}`,
    '',
    `No querés recibir más este resumen: ${links.unsubscribeUrl}`,
  ]

  const color = (a: DocAlert) => (a.severity === 'CRITICAL' ? '#b91c1c' : a.severity === 'HIGH' ? '#b45309' : '#475569')
  const rows = shown.map(a => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:600;color:#0f172a">${escapeHtml(a.taskTitle)}</div>
          <div style="font-size:13px;color:#64748b">${escapeHtml(a.operationTitle)}</div>
          <div style="font-size:13px;color:${color(a)};margin-top:2px">${escapeHtml(a.message)}</div>
        </td>
      </tr>`).join('')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;color:#0f172a;margin:0 0 4px">Tu resumen de VARA</h1>
      <p style="font-size:14px;color:#475569;margin:0 0 16px">Esto es lo que necesita tu atención hoy.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}
      </table>
      ${rest > 0 ? `<p style="font-size:13px;color:#64748b">Y ${rest} más.</p>` : ''}
      <p style="margin:20px 0 0"><a href="${escapeHtml(alertsUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">Ver todas las alertas</a></p>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center">
      Recibís este email porque activaste el resumen diario en VARA.
      <a href="${escapeHtml(links.unsubscribeUrl)}" style="color:#64748b">Dejar de recibirlo</a>.
    </p>
  </div>
</body></html>`

  return { subject, html, text: textLines.join('\n'), key, urgent: urgent.length }
}

export function shouldSend(
  prev: { lastSentAt: string | null; lastKey: string | null },
  key: string,
  now: Date,
): boolean {
  if (!prev.lastSentAt) return true
  const elapsed = now.getTime() - new Date(prev.lastSentAt).getTime()
  if (!(elapsed >= MIN_GAP_MS)) return false
  if (prev.lastKey !== key) return true
  return elapsed >= REPEAT_SAME_MS
}

/** Tipo de operación de la base → el de las alertas. */
export function alertOperationType(dbType: string): 'BUY' | 'SELL' {
  return dbType === 'SELL_PROPERTY' ? 'SELL' : 'BUY'
}
