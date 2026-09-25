# VARA_ALT_PRODUCT_PLAN.md

Plan de ejecución sobre `vara-altv2`.
Fecha: 2026-09-24 · Basado en `VARA_ALT_MASTER_AUDIT.md`

Regla de priorización: **primero dejar de mentir, después dejar de frustrar,
después construir moat.** Un producto que da consejos ficticios no mejora
agregándole features.

---

## P0 — Bloquea usuarios reales

| # | Qué | Por qué es P0 | Alcance | Riesgo |
|---|---|---|---|---|
| **P0-1** | Desconectar `mockTransaction` de producción | VARA le da consejos ficticios a usuarios reales en todas las pantallas | `useGuidance.ts`, `profesionales/page.tsx`, `dashboard/page.tsx` | Bajo — las pantallas pasan a estado vacío honesto |
| **P0-2** | Next Best Action Engine real | Sin esto, el punto anterior deja un hueco: hay que reemplazar el consejo falso por uno verdadero | `lib/nba/` nuevo, alimentado por operación + documentos + riesgos reales | Medio |
| **P0-3** | Property Candidate ≠ Transaction | El usuario no puede analizar sin comprometerse. Rompe el journey completo del comprador | Migración aditiva en `properties` + Decision Center en `/propiedades` | Medio |
| **P0-4** | Subida real de documentos | Se muestran documentos requeridos que no se pueden cargar | Supabase Storage (ya usado para fotos) + estados | Bajo |
| **P0-5** | Entidad `Offer` + flujo de oferta | "Hacer una oferta" es el momento de verdad del producto y no existe | Tabla + estados + UI en la operación | Medio |
| **P0-6** | Sacar los comparables inventados de `/precios` | Afirmación falsa sobre el mercado real | Ocultar la pantalla hasta tener datos | Bajo |
| **P0-7** | Costos sin precio inventado | `185000` hardcodeado cuando no hay propiedad | `onboarding:151`, `operacion:459` | Bajo |

## P1 — Fricción alta

| # | Qué | Por qué |
|---|---|---|
| P1-1 | Activity Ledger por operación | El usuario que vuelve no sabe qué cambió |
| P1-2 | Transaction Room completo (participantes, actividad, deadlines, ofertas) | Es el centro operativo y está a medias |
| P1-3 | Riesgos con evidencia y estado | Hoy dice qué y por qué, no con qué evidencia |
| P1-4 | Unificar `/costos` + `/precios` + `/financiamiento` | Tres destinos de plata que el usuario no distingue |
| P1-5 | Renombrar `/visitas` vs `/mis-visitas` | Dos cosas distintas con nombres casi iguales |
| P1-6 | Visual Intelligence visible donde se necesita | Funciona de verdad y está enterrado |
| P1-7 | Observabilidad mínima | Hoy no se sabe qué falla |
| P1-8 | Fotos en el reporte de visita | `photoPaths` se guarda vacío |
| P1-9 | Tests del core | 80 tests cubren solo VARA Visit |

## P2 — Escala y moat

| # | Qué |
|---|---|
| P2-1 | Event Engine de dominio (más allá de `visit_events`) |
| P2-2 | Document Intelligence (extracción, validación cruzada, inconsistencias) |
| P2-3 | Shared Transaction State con participantes y roles |
| P2-4 | Multi-operación con `OperationRelation` activo y detección de dependencias |
| P2-5 | Feature flags |
| P2-6 | Separación Core / Jurisdiction Pack |

## P3 — Infraestructura futura

APIs públicas · White label · Integraciones enterprise · Packs internacionales ·
Inteligencia predictiva.

**No se toca nada de P3 en esta iteración.**

---

## Orden exacto de implementación

Cada fase deja el producto desplegable y testeado. No se acumulan cambios sin probar.

**Fase A — Dejar de mentir** (P0-1, P0-6, P0-7)
La más rápida y la de mayor impacto en confianza. Desconectar el mock deja
huecos; los huecos se llenan con estados vacíos honestos hasta la Fase B.
→ Verificación: `grep -rn "mockTransaction" src/app src/hooks` vuelve vacío.

**Fase B — Next Best Action real** (P0-2)
Motor determinístico que lee la operación real. Llena los huecos de la Fase A.
→ Verificación: tests unitarios del motor; el consejo cambia al cambiar el estado.

**Fase C — Decision Center** (P0-3)
Candidate vs Transaction, estados, comparación, promoción.
→ Verificación: se pueden cargar 3 propiedades, compararlas y promover una.

**Fase D — Ejecutar, no solo mirar** (P0-4, P0-5)
Subida de documentos y entidad `Offer`.
→ Verificación: subir un PDF y hacer una oferta de punta a punta.

**Fase E — Memoria** (P1-1, P1-2)
Activity Ledger y Transaction Room completo.

**Fase F — Coherencia** (P1-4, P1-5, P1-6)
Unificaciones de IA y renombres.

**Fase G — Solidez** (P1-7, P1-9)
Observabilidad y tests del core.

**Fase H — Auditoría final** (UX + QA + regresión)

---

## Qué NO voy a hacer, y por qué

| No hago | Razón |
|---|---|
| Microservicios | El brief mismo pide modular monolith (§47). |
| Jurisdiction Packs completos | Hay un solo país. Separar antes de tener el segundo es adivinar. |
| APIs públicas / B2B | El brief lo pone en P3 y dice "construir para el presente" (§99). |
| Rediseñar lo que funciona | `/costos`, Visit Mode y la Guía son lo mejor del producto. Se tocan solo para conectarlos mejor. |
| Refactor gigante de dominios | Se mueve lógica de páginas a dominios **cuando se toca esa página**, no en un big bang. |

---

## Definición de terminado por fase

Una fase está terminada cuando:

- `tsc --noEmit` limpio
- tests en verde (incluidos los nuevos de esa fase)
- `npm run build` OK
- deploy a `vara-altv2.vercel.app` + smoke test de rutas
- cero `console.error` en el golden path afectado
- ninguna pantalla nueva muestra un dato que no exista
