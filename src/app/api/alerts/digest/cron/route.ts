export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cronAuthorized } from '@/lib/cron/auth'
import { resolveBaseUrl } from '@/lib/config/env'
import { emailConfig, sendEmail } from '@/lib/alerts/sendEmail'
import { alertOperationType, buildDigest, shouldSend, type DigestOperation } from '@/lib/alerts/emailDigest'
import type { AlertDoc } from '@/lib/docAlerts'
import { log } from '@/lib/observability/logger'

/**
 * Resumen diario por email (Vercel Cron, una vez por día).
 *
 * APAGADO salvo `ALERTS_EMAIL_ENABLED=1`. Además necesita `CRON_SECRET`, la clave
 * secreta de Supabase (lee las operaciones de quienes activaron el resumen) y
 * Resend (`RESEND_API_KEY`, `ALERTS_FROM_EMAIL`). Solo recibe quien lo activó.
 */

const MAX_USERS = 200

export async function GET(req: Request) {
  if (process.env.ALERTS_EMAIL_ENABLED !== '1') return NextResponse.json({ status: 'disabled' })
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const mail = emailConfig()
  const appUrl = resolveBaseUrl()
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !secret && 'SUPABASE_SECRET_KEY',
    !mail && 'RESEND_API_KEY / ALERTS_FROM_EMAIL',
    !appUrl && 'APP_BASE_URL',
  ].filter(Boolean)
  if (missing.length > 0 || !url || !secret || !mail || !appUrl) {
    return NextResponse.json({ error: 'Falta configuración.', missing }, { status: 503 })
  }

  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const now = new Date()
  const counts = { users: 0, sent: 0, nothing: 0, skipped: 0, failed: 0 }

  const prefs = await db.from('alert_preferences')
    .select('user_id, unsubscribe_token, last_sent_at, last_digest_key')
    .eq('email_digest', true)
    .limit(MAX_USERS)
  if (prefs.error) {
    log.error('alerts.digest.prefs_failed', { code: prefs.error.code ?? 'unknown' })
    return NextResponse.json({ error: 'No se pudieron leer las preferencias.' }, { status: 500 })
  }

  for (const p of prefs.data ?? []) {
    counts.users++
    try {
      const ops = await loadOperations(db, p.user_id)
      const digest = buildDigest(ops, {
        appUrl,
        unsubscribeUrl: `${appUrl}/api/alerts/unsubscribe?token=${p.unsubscribe_token}`,
      })
      if (!digest) { counts.nothing++; continue }

      const key = createHash('sha256').update(digest.key).digest('hex')
      if (!shouldSend({ lastSentAt: p.last_sent_at, lastKey: p.last_digest_key }, key, now)) { counts.skipped++; continue }

      const user = await db.auth.admin.getUserById(p.user_id)
      const email = user.data.user?.email
      if (!email || !user.data.user?.email_confirmed_at) { counts.skipped++; continue }

      const ok = await sendEmail(mail, {
        to: email, subject: digest.subject, html: digest.html, text: digest.text,
        unsubscribeUrl: `${appUrl}/api/alerts/unsubscribe?token=${p.unsubscribe_token}`,
      })
      if (!ok) { counts.failed++; continue }
      counts.sent++
      await db.from('alert_preferences')
        .update({ last_sent_at: now.toISOString(), last_digest_key: key })
        .eq('user_id', p.user_id)
    } catch {
      counts.failed++
    }
  }

  log.info('alerts.digest.done', counts)
  return NextResponse.json(counts)
}

async function loadOperations(db: SupabaseClient, userId: string): Promise<DigestOperation[]> {
  const ops = await db.from('operations').select('id, title, type').eq('user_id', userId).eq('status', 'ACTIVE')
  if (ops.error) throw new Error('operations')
  const list = (ops.data ?? []) as { id: string; title: string; type: string }[]
  if (list.length === 0) return []
  const ids = list.map(o => o.id)

  const [tasks, docs] = await Promise.all([
    db.from('operation_tasks').select('id, operation_id, task_key, title, status, due_date')
      .in('operation_id', ids).not('status', 'in', '(DONE,NOT_APPLICABLE)'),
    db.from('operation_documents').select('id, operation_id, name, status')
      .in('operation_id', ids).in('status', ['EXPIRED', 'REJECTED']),
  ])
  if (tasks.error || docs.error) throw new Error('tasks/docs')

  type TaskRow = { id: string; operation_id: string; task_key: string; title: string; status: string; due_date: string | null }
  type DocRow = { id: string; operation_id: string; name: string; status: AlertDoc['status'] }
  const taskRows = (tasks.data ?? []) as TaskRow[]
  const docRows = (docs.data ?? []) as DocRow[]

  return list.map(o => ({
    id: o.id,
    title: o.title,
    type: alertOperationType(o.type),
    tasks: taskRows.filter(t => t.operation_id === o.id).map(t => ({
      id: t.id, key: t.task_key, title: t.title, description: '', done: false, dueDate: t.due_date ?? undefined,
    })),
    docs: docRows.filter(d => d.operation_id === o.id).map(d => ({ id: d.id, name: d.name, status: d.status })),
  }))
}
