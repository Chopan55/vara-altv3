'use client'

import { useId, useState } from 'react'

type Entry = { title: string; href: string; terms: string }

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

const commonWords = new Set(['a', 'como', 'de', 'donde', 'el', 'en', 'es', 'la', 'le', 'lo', 'los', 'me', 'mi', 'no', 'para', 'por', 'puedo', 'que', 'se', 'un', 'una'])

export function HelpSearch({ entries }: { entries: Entry[] }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useId()
  const words = normalize(query).match(/[a-z0-9]+/g) ?? []
  const keywords = words.filter(word => !commonWords.has(word))
  const results = keywords.length ? entries.filter(entry => {
    const text = normalize(entry.title + ' ' + entry.terms)
    return keywords.every(word => text.includes(word))
  }).slice(0, 8) : []

  const open = results.length > 0 && query.trim().length > 0

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
      setActiveIndex(-1)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      window.location.href = results[activeIndex].href
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-5 print:hidden">
      <label htmlFor="help-search" className="font-bold text-brand-900">¿Qué necesitás hacer?</label>
      <input id="help-search" aria-controls={listboxId} aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-expanded={open} role="combobox" type="search" value={query}
        onChange={event => { setQuery(event.target.value); setActiveIndex(-1) }} onKeyDown={onKeyDown}
        placeholder="Por ejemplo, copiar el link"
        className="mt-2 block min-h-12 w-full rounded-xl border border-slate-400 bg-white px-4 text-ink focus-visible:outline-2 focus-visible:outline-brand-700" />
      <p role="status" className="mt-3 text-sm text-ink-soft">
        {query.trim() && (results.length ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}` : 'No encontramos resultados. Probá con «aviso», «costos» o «visita».')}
      </p>
      <ul id={listboxId} role="listbox" aria-label="Resultados de ayuda" hidden={!open} className="mt-2 divide-y divide-slate-100">
        {results.map((entry, index) => <li key={entry.href} id={`${listboxId}-option-${index}`} role="option" aria-selected={activeIndex === index}>
          <a className="block py-3 font-semibold text-brand-800 underline focus-visible:bg-brand-50 focus-visible:outline-none" href={entry.href}
            onMouseEnter={() => setActiveIndex(index)}>{entry.title}</a>
        </li>)}
      </ul>
    </div>
  )
}
