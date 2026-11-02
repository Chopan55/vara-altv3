export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { BUILT_IN_RULES } from '@/lib/workflowEngine'

/**
 * PATCH /api/workflow-rules/:id
 * Body: { enabled: boolean }
 *
 * Guarda el override de una regla del Workflow Engine para el usuario autenticado.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ruleId } = await params
  const body = await req.json().catch(() => ({})) as { enabled?: boolean }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'missing_enabled' }, { status: 400 })
  }

  const knownRule = BUILT_IN_RULES.find(r => r.id === ruleId)
  if (!knownRule) {
    return NextResponse.json({ error: 'unknown_rule' }, { status: 404 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { error } = await supabase
    .from('workflow_rule_overrides')
    .upsert(
      { user_id: user.id, rule_id: ruleId, enabled: body.enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,rule_id' },
    )

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
