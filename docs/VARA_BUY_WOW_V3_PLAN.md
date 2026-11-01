# VARA Buy WOW V3 — Plan por slices

Flag: `buyWowV3` (env `NEXT_PUBLIC_FLAGS=buyWowV3` o `?v3=1` en preview). El flujo actual no se toca.
Todo el motor es TypeScript puro en `src/lib/analysis/` con tests en `tests/analysis/`. La UI solo consume `PropertyAnalysis`.

## Decisión de fuentes (bloqueo real, ver AUDIT §8)
No hay búsqueda automática de comparables. El motor se construye sobre `ComparableProvider`. Proveedores reales hoy: avisos que pega la persona, MeLi por link, candidatos propios. Sin evidencia suficiente la salida es INSUFICIENTE y lo dice. Los datos sintéticos viven solo en `tests/analysis/fixtures`.

## Slices
| # | Slice | Módulo | Hecho cuando |
|---|---|---|---|
| 1 | Contrato | `analysis/types.ts` | `PropertyAnalysis`, `Field<T>` con estado y procedencia, enums de precio |
| 2 | Extracción | `analysis/normalize.ts` | `ScrapeResult` → `SubjectProperty`; UNKNOWN se mantiene |
| 3 | Retrieval | `analysis/retrieval.ts` | Alcance por capas (misma entidad → barrio → localidad), registra `searchScope` y `searchExpansionReason` |
| 4 | Deduplicación | `analysis/dedupe.ts` | 3 URLs de la misma propiedad = 1 evidencia; baja la confianza si es ambiguo |
| 5 | Similitud | `analysis/similarity.ts` | Puntaje configurable con razones, diferencias y campos faltantes |
| 6 | Frescura | `analysis/freshness.ts` | Peso por edad; el aviso viejo se pondera, no se descarta |
| 7 | Precio y confianza | `analysis/priceIntelligence.ts`, `confidence.ts` | Mediana ponderada y banda robusta; ALTA/MEDIA/BAJA/INSUFICIENTE con umbrales explícitos |
| 8 | Fit | `analysis/userFit.ts` | MUST_HAVE…DEAL_BREAKER; el DEAL_BREAKER anula el puntaje |
| 9 | Costo total | `analysis/cost.ts`, `analysis/costProviders/ar.ts` | KNOWN / ESTIMATED / NOT_INCLUDED con rangos; proveedor por país |
| 10 | Faltantes y riesgos | `analysis/missing.ts`, `risks.ts` | Máximo 3 prioridades con evidencia; mensaje listo para copiar |
| 11 | Conclusión y NBA | `analysis/conclusion.ts`, `nba.ts` | Una acción primaria; plantillas determinísticas, la IA solo redacta |
| 12 | Orquestador | `analysis/run.ts` | `analyzeProperty()` emite etapas progresivas y mide latencias |
| 13 | API | `api/v3/analyze` | Sin login; streaming por etapas; errores sin detalle interno |
| 14 | UI | `components/buy-v3/*`, ruta `/analizar` | Jerarquía: conclusión → por qué → evidencia → incertidumbre → acción |
| 15 | Compartir | `analysis/share.ts`, `/compartido/[token]` | Versión sin datos privados; si no alcanza, solo arquitectura |
| 16 | Analítica | `analysis/events.ts` | Los 13 eventos y las 4 latencias; tasa de segunda propiedad |
| 17 | Evaluación | `tests/analysis/eval/` | Casos A–G del prompt más umbrales de regresión |
| 18 | QA | — | `vitest`, `tsc`, `next build`, prueba en navegador móvil y de escritorio |

## Reglas transversales
- Ningún número lo produce un LLM. La IA solo redacta sobre campos ya calculados.
- "Rango de publicación comparable"; nunca "valor de mercado".
- Sin datos inventados fuera de `tests/`.
- Cada slice termina con tests en verde antes de seguir.
