import { tryCreateClient } from './client'

export interface WorkflowOverride {
  ruleId: string
  enabled: boolean
}

export async function fetchWorkflowOverrides(): Promise<WorkflowOverride[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('workflow_rule_overrides')
    .select('rule_id, enabled')
  return (data ?? []).map(r => ({ ruleId: r.rule_id, enabled: r.enabled }))
}

export async function upsertWorkflowOverride(ruleId: string, enabled: boolean): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('workflow_rule_overrides')
    .upsert(
      { user_id: user.id, rule_id: ruleId, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,rule_id' },
    )
  return !error
}
