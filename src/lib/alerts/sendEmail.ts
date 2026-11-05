/**
 * Envío de emails con Resend (API HTTP, sin dependencias). SOLO servidor.
 * Sin RESEND_API_KEY o sin remitente no se envía nada.
 */

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  unsubscribeUrl: string
}

export interface EmailConfig {
  apiKey: string
  from: string
}

export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERTS_FROM_EMAIL
  return apiKey && from ? { apiKey, from } : null
}

export async function sendEmail(cfg: EmailConfig, msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: {
        'List-Unsubscribe': `<${msg.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  return res.ok
}
