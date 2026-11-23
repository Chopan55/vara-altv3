import { FAQS } from '@/lib/faq/faq'

/** Las mismas respuestas del asistente, a la vista: quien no quiere escribir igual las lee. */
export function FaqList() {
  return (
    <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
      {FAQS.map(f => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {f.q}
            <span aria-hidden="true" className="text-xl text-ink-soft transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  )
}
