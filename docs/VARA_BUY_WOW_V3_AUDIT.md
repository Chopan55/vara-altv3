# VARA Buy WOW V3 — Auditoría (2026-10-15)

Rama: `buy-wow-v3` (desde `vara-visit-platform`). Sin deploy a producción.

## 1. Flujo actual
Home (`src/app/page.tsx`, `HeroInteractive`) → onboarding (`/onboarding`: nombre, tipo de viaje, provincia, URL; guarda en localStorage) → importa propiedad → candidato (`src/lib/candidates`) → `/propiedades/[id]` (564 líneas, mezcla UI + lectura de datos + análisis) → operación.
Hay fricción previa al valor: el onboarding pide datos antes de mostrar nada.

## 2. Importación (`src/app/api/scrape-property/route.ts`)
Capas: JSON-LD → meta/OG → Jina Reader → LLM (gpt-4o-mini) → texto pegado. Detecta muro anti-bot. Reutilizable tal cual como proveedor de extracción.
Gaps: devuelve valores planos sin procedencia por campo; no extrae antigüedad, condición, pileta, comodidades estructuradas, fecha de publicación, historial de precio, barrio cerrado. Sin streaming: el usuario espera la respuesta completa (hasta 45 s). `ScrapedData` no distingue CONFIRMED/EXTRACTED/INFERRED/UNKNOWN.

## 3. Motor de comparables actual (`src/lib/comparables/model.ts`)
Puro y bien documentado. Hace: normalizar aviso de MeLi o pegado → mediana de USD/m² → veredicto ±10 %. MIN_COMPARABLES = 5.
Gaps contra el spec: sin recuperación geográfica por capas; sin similitud (solo filtra moneda y presencia de m²); sin deduplicación; sin frescura; sin ponderación; sin outliers; sin confianza; el titular es USD/m²; `Comparable` no tiene tipo, dormitorios obligatorios, terreno, antigüedad, condición ni fecha. `priceReference.ts` usa rangos USD/m² por provincia hardcodeados "2024–2025": referencia estática no verificable; no debe usarse como evidencia de comparables.

## 4. Cálculo de precio
`analyzeMarketPosition` (mediana ±10 %) + `analyzePricePosition` (rango provincial estático). Ya llama a los precios "precios pedidos", bien. Falta procedencia de precio (ASKING / CLOSED) como tipo.

## 5. User-fit
No existe. `scoreCandidates` pondera precio/m², superficie, ambientes (min-max entre candidatos): compara candidatos entre sí, no contra necesidades de la persona. No hay perfil de preferencias (MUST_HAVE / DEAL_BREAKER). El onboarding solo guarda nombre, provincia y tipo de viaje.

## 6. NBA (`src/lib/nba/engine.ts`)
Determinístico, con evidencia por acción. Opera sobre una `Transaction` (operación ya creada); para una propiedad recién analizada no hay NBA. Hay que agregar un NBA de pre-operación que salga de `PropertyAnalysis`, sin duplicar el motor existente.

## 7. Riesgos (`src/lib/risks/engine.ts`) y costos
Riesgos: derivados de una operación (documental, dominial…), no de un aviso. Costos: `CostosPanel` + `generateChecklist` (`src/lib/regulations.ts`, `src/data/regulations/*`) con sellos, escribano y registro por provincia, con `DataConfidence`. Reutilizable para el costo total, pero hoy vive detrás de un componente React; falta una función pura que devuelva rangos KNOWN / ESTIMATED / NOT_INCLUDED.

## 8. Proveedores de datos — medido
| Fuente | Resultado |
|---|---|
| MercadoLibre `/sites/MLA/search` | 403 con token de aplicación (medido antes, ver `api/comparables/route.ts`) |
| MercadoLibre `/items/{id}` | Abierto; lectura de un aviso puntual por link |
| Zonaprop | Cloudflare, 403 desde Node (memoria, 2026-09-19) |
| Argenprop | 2026-10-15: búsqueda y `robots.txt` devuelven 403 de CloudFront desde esta máquina. Antes respondía. |
| Properati / otros | Sin probar; sin credenciales |

**Conclusión: hoy no hay forma de buscar comparables por zona automáticamente.** Fuentes reales disponibles: avisos que pega la persona (URL o texto), avisos de MeLi por link y las otras propiedades que la persona ya analizó (candidatos).

## 9. Modelo de datos
Cliente: localStorage + IndexedDB (fotos) + Supabase parcial (`property_candidates`). `Property` (`src/types`) tiene campos planos sin procedencia. No hay tabla de análisis ni de eventos.

## 10. Analítica
No existe. Solo `observability/logger.ts` (logs con redacción de contexto, sink inyectable). Se reutiliza como base para eventos y latencias.

## 11. UI reutilizable
`MarketComparison.tsx` (341 líneas), `Badge`, `AppShell`, `HeroInteractive`. El resultado actual es una grilla de tarjetas; el spec pide jerarquía de decisión. Se construye un componente nuevo detrás del flag, sin tocar el actual.

## 12. Deuda técnica que afecta
- `propiedades/[id]/page.tsx` mezcla fetch, análisis y presentación.
- `requireAuth` en `/api/comparables` rompe el uso sin cuenta (memoria `vara-auth-regression`): el flujo V3 no debe exigir login.
- `Property.surface` único: no separa cubierta, total y terreno.
- Flags en `NEXT_PUBLIC_FLAGS`, sin override por query para preview.

## 13. Gaps reales de datos (no se resuelven con código)
1. No hay fuente de comparables por zona. Sin ella, en producción casi todo resultado será INSUFICIENTE salvo que la persona aporte avisos.
2. Sin fecha de publicación ni historial de precio confiables (depende de cada portal).
3. Sin datos de transacciones cerradas.
4. Sin geocodificación: "1–3 cuadras" requiere coordenadas; hoy solo se puede escalar barrio cerrado → barrio → localidad.
