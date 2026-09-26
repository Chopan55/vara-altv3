'use client'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ExternalLink, Info, MessageSquare } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { useOperations } from '@/hooks/useOperations'
import type { Transaction, CountryCode } from '@/types'
import { getProfessionalLabel } from '@/lib/utils'
import { useJurisdiction } from '@/hooks/useJurisdiction'
import { useMemo } from 'react'

const specialtyEmoji: Record<string, string> = {
  ESCRIBANO: '📜', ABOGADO: '⚖️', AGRIMENSOR: '📐', TASADOR: '🏠', GESTOR: '📋',
}

/**
 * Qué especialidad necesita LA OPERACION DEL USUARIO.
 *
 * Antes esto leia `mockTransaction`: la pantalla decia "tu operacion necesita
 * un escribano" derivandolo de una casa inventada en Pilar. Se veia
 * personalizada y no lo era (P0-1 de VARA_ALT_MASTER_AUDIT.md).
 *
 * Sin operacion devuelve vacio y la seccion no se muestra. Es preferible no
 * decir nada a decir algo que no es de esta persona.
 */
function getOperationNeeds(txn: Transaction | null): string[] {
  if (!txn) return []
  const allTasks = txn.stages.flatMap(s => s.tasks ?? [])
  const docs = txn.documents ?? []
  const needs: string[] = []
  if (docs.some(d => d.category === 'ESCRITURA' && d.status === 'PENDING')
      || allTasks.some(t => t.status === 'BLOCKED')) needs.push('ESCRIBANO')
  if (docs.some(d => d.category === 'PLANOS' && d.status === 'PENDING')) needs.push('AGRIMENSOR')
  if (docs.some(d => d.category === 'IMPUESTOS' && d.status === 'PENDING')) needs.push('GESTOR')
  return needs
}

/** Registros públicos oficiales — fuentes reales, no un directorio inventado. */
const OFFICIAL_REGISTRIES: { specialty: string; org: string; url: string; note: string }[] = [
  {
    specialty: 'ESCRIBANO',
    org: 'Colegio de Escribanos de la Provincia de Buenos Aires',
    url: 'https://www.colescba.org.ar',
    note: 'Verificá matrícula y buscá escribanos por partido.',
  },
  {
    specialty: 'ESCRIBANO',
    org: 'Colegio de Escribanos de la Ciudad de Buenos Aires',
    url: 'https://www.colegio-escribanos.org.ar',
    note: 'Registro oficial para operaciones en CABA.',
  },
  {
    specialty: 'AGRIMENSOR',
    org: 'Colegio de Agrimensores de la Provincia de Buenos Aires',
    url: 'https://www.colegiodeagrimensores.org.ar',
    note: 'Mensuras, planos y unificaciones catastrales.',
  },
  {
    specialty: 'ABOGADO',
    org: 'Colegio de Abogados de San Isidro',
    url: 'https://www.casi.com.ar',
    note: 'Jurisdicción que cubre buena parte de GBA Norte.',
  },
]

export default function ProfesionalesPage() {
  const { activeTransactionData } = useOperations()
  const operationNeeds = getOperationNeeds(activeTransactionData)

  const country = useMemo<CountryCode>(() => {
    try { return (localStorage.getItem('vara_country') as CountryCode) || 'AR' } catch { return 'AR' }
  }, [])
  const j = useJurisdiction(country)

  const closingProfLabel = j.professionalLabels.CLOSING_PROFESSIONAL
  const legalLabel = j.professionalLabels.LEGAL_ADVISOR
  const surveyorLabel = j.professionalLabels.SURVEYOR

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Profesionales</h1>
          <p className="text-sm text-slate-500 mt-1">Qué especialista necesitás y dónde verificarlo</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4 pb-10">

        {/* Estado honesto de la feature */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
              <Info size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm mb-1">Todavía no tenemos red propia de profesionales</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Preferimos no listar gente que no verificamos. Mientras armamos la red, VARA te dice
                qué especialista necesita tu operación y te lleva a los registros oficiales donde
                podés chequear matrícula.
              </p>
            </div>
          </div>
        </div>

        {/* Qué necesita la operación — lógica real */}
        {operationNeeds.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-brand-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Tu operación necesita</h2>
            </div>
            <div className="space-y-2">
              {operationNeeds.map(need => (
                <div key={need} className="flex items-center gap-3 bg-brand-50 rounded-xl px-3 py-2.5">
                  <span className="text-base">{specialtyEmoji[need] ?? '👤'}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {need === 'ESCRIBANO' ? closingProfLabel : need === 'ABOGADO' ? legalLabel : need === 'AGRIMENSOR' ? surveyorLabel : getProfessionalLabel(need)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {need === 'ESCRIBANO' && 'Hay documentación de escritura pendiente o tareas bloqueadas.'}
                      {need === 'AGRIMENSOR' && 'Faltan planos o mensura de la propiedad.'}
                      {need === 'GESTOR' && 'Hay trámites impositivos pendientes.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registros oficiales */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-800 text-sm">Registros oficiales</h2>
            <p className="text-xs text-slate-400 mt-0.5">Colegios profesionales donde verificar matrícula</p>
          </div>
          <div className="divide-y divide-slate-50">
            {OFFICIAL_REGISTRIES.map(r => (
              <a key={r.org} href={r.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <span className="text-base flex-shrink-0 mt-0.5">{specialtyEmoji[r.specialty] ?? '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{r.org}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.note}</p>
                </div>
                <ExternalLink size={13} className="text-slate-300 flex-shrink-0 mt-1" />
              </a>
            ))}
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              Enlaces a organismos públicos. VARA no tiene relación comercial con ellos ni recibe comisiones.
            </p>
          </div>
        </div>

        <Link href="/asistente"
          className="flex items-center justify-between bg-slate-900 rounded-2xl p-5 hover:bg-slate-800 transition-colors">
          <div>
            <p className="font-bold text-white text-sm mb-0.5">¿No sabés a quién necesitás?</p>
            <p className="text-xs text-slate-400">Contale tu situación al asistente y te orienta.</p>
          </div>
          <MessageSquare size={18} className="text-brand-400 flex-shrink-0" />
        </Link>

      </div>
    </div>
  )
}
