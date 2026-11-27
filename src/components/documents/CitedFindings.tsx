'use client'

import { FileText, ShieldAlert } from 'lucide-react'
import type { CitedSummary } from '@/lib/documents/citations'
import { CITED_DISCLAIMER, KIND_LABELS, groupFindings, summaryNotices } from '@/lib/documents/citedView'

const TONE = {
  rose: { title: 'text-rose-600', text: 'text-rose-800', chip: 'bg-rose-50 text-rose-700' },
  amber: { title: 'text-amber-700', text: 'text-amber-900', chip: 'bg-amber-50 text-amber-800' },
  slate: { title: 'text-slate-500', text: 'text-slate-800', chip: 'bg-slate-100 text-slate-600' },
} as const

/** Resultado de leer un documento: cada dato con su página y la frase textual de donde sale. */
export function CitedFindings({ summary, onClose }: { summary: CitedSummary; onClose: () => void }) {
  const groups = groupFindings(summary)
  const notices = summaryNotices(summary)
  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3" data-testid="cited-findings">
      <div className="flex items-center gap-1.5">
        <FileText size={11} className="text-brand-600" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Lo que dice el documento</p>
      </div>

      {groups.map(g => {
        const t = TONE[g.tone]
        return (
          <div key={g.title}>
            <p className={`text-[11px] font-semibold mb-1 ${t.title}`}>{g.title}</p>
            <ul className="space-y-2">
              {g.findings.map((f, i) => (
                <li key={`${f.page}-${i}`} className="text-xs">
                  <div className="flex items-start gap-1.5">
                    {g.tone === 'rose' && <ShieldAlert size={11} className="mt-0.5 flex-shrink-0 text-rose-500" />}
                    <span className={`font-semibold ${t.text}`}>{KIND_LABELS[f.kind]}</span>
                    <span className={`ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.chip}`}>Pág. {f.page}</span>
                  </div>
                  <blockquote className="mt-1 border-l-2 border-slate-200 pl-2 text-[11px] italic text-slate-600">«{f.quote}»</blockquote>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {notices.map((n, i) => (
        <p key={i} role="note" className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-700">{n}</p>
      ))}

      <p className="text-[11px] text-slate-500">{CITED_DISCLAIMER}</p>
      <button onClick={onClose} className="text-[10px] text-slate-400 hover:text-slate-600">Cerrar</button>
    </div>
  )
}
