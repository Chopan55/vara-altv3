/**
 * Proveedor de comparables que lee el store de mercado.
 *
 * Es el único de los proveedores que trae avisos que la persona no cargó:
 * vienen del barrido de Zonaprop. Se consulta una sola vez por análisis y se
 * reutiliza entre alcances; el filtrado por alcance lo hace el retrieval.
 */

import type { ComparableProvider } from '../retrieval'
import type { ListingFacts } from '../types'

export function marketProvider(fetchImpl: typeof fetch = fetch): ComparableProvider {
  let cached: Promise<ListingFacts[]> | null = null

  return {
    name: 'Avisos de Zonaprop',
    fetch: ({ subject }) => {
      cached ??= (async () => {
        const q = new URLSearchParams()
        if (subject.city) q.set('city', subject.city)
        if (subject.neighborhood) q.set('neighborhood', subject.neighborhood)
        if (subject.community) q.set('community', subject.community)
        if ([...q.keys()].length === 0) return []
        const res = await fetchImpl(`/api/v3/market?${q}`)
        if (!res.ok) throw new Error(`market ${res.status}`)
        const json = (await res.json()) as { listings?: ListingFacts[] }
        return Array.isArray(json.listings) ? json.listings : []
      })()
      return cached
    },
  }
}
