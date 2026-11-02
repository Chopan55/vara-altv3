'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Workflow, Zap, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Info, Loader2,
} from 'lucide-react'
import {
  BUILT_IN_RULES, CATEGORY_LABELS, TRIGGER_LABELS, ACTION_LABELS,
  type WorkflowRule,
} from '@/lib/workflowEngine'
import { fetchWorkflowOverrides } from '@/lib/supabase/workflowOverrides'
import { cn } from '@/lib/utils'

const CATEGORY_ORDER: WorkflowRule['category'][] = [
  'documentacion', 'negociacion', 'escritura', 'general',
]

const CATEGORY_COLORS: Record<WorkflowRule['category'], string> = {
  documentacion: 'bg-blue-50 text-blue-700',
  negociacion: 'bg-amber-50 text-amber-700',
  escritura: 'bg-purple-50 text-purple-700',
  general: 'bg-slate-100 text-slate-600',
}

const ACTION_COLORS: Record<WorkflowRule['action'], string> = {
  CREATE_FOLLOW_UP_TASK: 'bg-brand-50 text-brand-700',
  SEND_ALERT: 'bg-red-50 text-red-700',
  SUGGEST_NEXT_STEP: 'bg-emerald-50 text-emerald-700',
  NOTIFY_PARTY: 'bg-indigo-50 text-indigo-700',
  ESCALATE: 'bg-orange-50 text-orange-700',
}

function RuleCard({
  rule,
  onToggle,
}: {
  rule: WorkflowRule
  onToggle: (id: string, enabled: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-card overflow-hidden transition-colors',
      rule.enabled ? 'border-slate-200/70' : 'border-slate-100 opacity-60',
    )}>
      <div className="p-4 flex items-start gap-3">
        {/* Toggle */}
        <button
          onClick={() => onToggle(rule.id, !rule.enabled)}
          className="mt-0.5 flex-shrink-0"
          aria-label={rule.enabled ? 'Desactivar regla' : 'Activar regla'}
        >
          {rule.enabled
            ? <ToggleRight size={22} className="text-brand-500" />
            : <ToggleLeft size={22} className="text-slate-300" />
          }
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight">{rule.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{rule.description}</p>
            </div>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex-shrink-0 mt-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
            </button>
          </div>

          {/* Trigger / Action badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
              Si: {TRIGGER_LABELS[rule.trigger]}
            </span>
            <span className="text-[10px] font-semibold text-slate-300">→</span>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', ACTION_COLORS[rule.action])}>
              {ACTION_LABELS[rule.action]}
            </span>
            {rule.operationType !== 'BOTH' && (
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-200">
                Solo {rule.operationType === 'SELL' ? 'venta' : 'compra'}
              </span>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          <div className="mt-3 space-y-2">
            {rule.triggerConfig.daysThreshold && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold w-20 flex-shrink-0">Umbral</span>
                <span className="text-xs text-slate-600">{rule.triggerConfig.daysThreshold} días antes</span>
              </div>
            )}
            {rule.triggerConfig.taskKeys && rule.triggerConfig.taskKeys.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-slate-400 font-semibold w-20 flex-shrink-0">Tareas</span>
                <span className="text-xs text-slate-600">{rule.triggerConfig.taskKeys.join(', ')}</span>
              </div>
            )}
            {rule.actionConfig.message && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-slate-400 font-semibold w-20 flex-shrink-0">Mensaje</span>
                <span className="text-xs text-slate-600 italic">&ldquo;{rule.actionConfig.message}&rdquo;</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkflowsPage() {
  const [rules, setRules] = useState<WorkflowRule[]>(BUILT_IN_RULES)
  const [saving, setSaving] = useState(false)
  const [loadingOverrides, setLoadingOverrides] = useState(true)

  useEffect(() => {
    fetchWorkflowOverrides()
      .then(overrides => {
        if (overrides.length === 0) return
        setRules(prev => prev.map(r => {
          const ov = overrides.find(o => o.ruleId === r.id)
          return ov ? { ...r, enabled: ov.enabled } : r
        }))
      })
      .finally(() => setLoadingOverrides(false))
  }, [])

  const enabledCount = rules.filter(r => r.enabled).length

  const grouped = useMemo(
    () => CATEGORY_ORDER.map(cat => ({
      cat,
      rules: rules.filter(r => r.category === cat),
    })).filter(g => g.rules.length > 0),
    [rules],
  )

  function handleToggle(id: string, enabled: boolean) {
    setSaving(true)
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r))
    fetch(`/api/workflow-rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight flex items-center gap-2">
              <Workflow size={18} className="text-brand-500" />
              Automatizaciones
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {enabledCount} de {rules.length} reglas activas
              {saving && (
                <span className="ml-2 inline-flex items-center gap-1 text-brand-500">
                  <Loader2 size={10} className="animate-spin" /> Guardando…
                </span>
              )}
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            Beta
          </span>
        </div>

        {/* Explicación */}
        <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4 mb-6">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-brand-700 mb-1">Qué son las automatizaciones</p>
              <p className="text-xs text-brand-600 leading-relaxed">
                Reglas del tipo <strong>Si X pasa → hacé Y</strong>. VARA evalúa el estado de tus
                operaciones y activa la acción automáticamente. Activá o desactivá cada regla
                según tu estilo de trabajo.
              </p>
            </div>
          </div>
        </div>

        {/* Reglas por categoría */}
        <div className="space-y-6">
          {loadingOverrides && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 size={14} className="animate-spin text-slate-300" />
              <span className="text-xs text-slate-400">Cargando configuración…</span>
            </div>
          )}
          {!loadingOverrides && grouped.map(({ cat, rules: catRules }) => (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', CATEGORY_COLORS[cat])}>
                  {CATEGORY_LABELS[cat]}
                </span>
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[10px] text-slate-400">
                  {catRules.filter(r => r.enabled).length}/{catRules.length} activas
                </span>
              </div>
              <div className="space-y-3">
                {catRules.map(rule => (
                  <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Reglas custom — coming soon */}
        <div className="mt-6 bg-slate-900 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-brand-400" />
            <p className="text-xs font-bold text-white uppercase tracking-wide">Reglas personalizadas</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            Próximamente podrás crear tus propias reglas: elegir el trigger, la condición y la
            acción. La base técnica ya está lista.
          </p>
          <Link
            href="/asistente"
            className="flex items-center justify-center gap-2 w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-3 rounded-xl transition-colors"
          >
            <Zap size={13} /> Pedirle a VARA una automatización
          </Link>
        </div>

        {/* Link a VARA Labs */}
        <div className="mt-4 flex items-center justify-center">
          <Link
            href="/vara-labs"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Ver hoja de ruta completa <ChevronRight size={12} />
          </Link>
        </div>

      </div>
    </div>
  )
}
