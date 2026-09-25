# VARA_ALT_MASTER_AUDIT.md

Auditoría de VARA antes de ejecutar el brief maestro.
Fecha: 2026-09-24 · Base: `vara-altv2` (fusión de `vara-mvp` + `vara-alt`)

Todo lo que sigue está verificado con `grep` sobre el repositorio, no con memoria
ni con lo que se ve en pantalla. Donde afirmo algo, cito archivo y línea.

---

## 0. Lo primero: el repositorio estaba partido en dos

Antes de auditar nada hubo que resolver esto, porque determinaba qué se estaba
auditando.

| | `vara-mvp` | `vara-alt` |
|---|---|---|
| Diseño índigo claro (16 pantallas) | ❌ | ✅ |
| VARA Visit completo (14 tablas, matching, Visit Mode, PIN, portal, admin) | ✅ | ❌ |
| Partners inventados eliminados | ❌ | ✅ |
| Tests (80) | ✅ | ❌ |

Ninguno de los dos era "el proyecto actual". `vara-altv2` es la fusión: base
funcional de `vara-mvp` + capa de diseño de `vara-alt`, con `visitTypes.ts`
(que contenía `DEMO_VISIT_PARTNERS`) eliminado del árbol.

Verificación tras la fusión: `tsc --noEmit` limpio, 80/80 tests, build OK,
10 rutas devolviendo 200.

---

## 1. EL HALLAZGO PRINCIPAL

**El motor de guía de VARA corre sobre datos ficticios, siempre.**

```
src/hooks/useGuidance.ts:17
  const txn = mockTransaction
```

`useGuidance` alimenta a `GuidanceBanner` y a `GuiameButton`, que están montados
en el `AppShell` — es decir, **en todas las pantallas**. El "próximo paso" que
VARA le recomienda a un usuario real se calcula sobre `mockTransaction`
(`src/data/mock.ts:51`), una operación inventada de una casa en Pilar de
USD 185.000.

Esto es peor que un dato falso en una tabla. Es un **consejo falso**: VARA le
dice a una persona qué hacer con su compra basándose en el estado de una
operación que no existe. Si el usuario lo sigue, actúa sobre información que no
tiene nada que ver con su caso.

Mismo patrón, dos lugares más:

```
src/app/profesionales/page.tsx:14-18
  const allTasks = mockTransaction.stages.flatMap(s => s.tasks)
  if (mockTransaction.documents.some(...)) needs.push('ESCRIBANO')
```
→ "Tu operación necesita: Escribano / Agrimensor / Gestor" se deriva de la
operación ficticia, no de la del usuario. La pantalla se ve personalizada y no lo es.

```
src/app/dashboard/page.tsx:578
  const txn = activeTxnData ?? mockTransaction
```
→ El dashboard cae a la operación ficticia cuando no hay datos reales.

**Clasificación: BROKEN · P0.** Es exactamente la categoría "features que
parecen funcionar pero no funcionan realmente" que el brief pide identificar (§92 G).

---

## 2. Inventario por área

### 2.1 Core del producto

| Área | Clasificación | Evidencia / detalle |
|---|---|---|
| **Guidance Engine** | **BROKEN · P0** | `useGuidance.ts:17` — corre sobre `mockTransaction` siempre. Ver §1. |
| **Next Best Action** | **MISSING · P0** | No existe como motor. Hoy es `guidanceEngine.getNextGuidanceStep()` alimentado por mock. No toma documentos reales, riesgos reales, deadlines ni relaciones entre operaciones. |
| **Dashboard** | **REFACTOR · P0** | Tiene columna derecha con "Qué requiere atención hoy" y "Próximos pasos" (buena base), pero el fallback a `mockTransaction` contamina. No es un Command Center: no dice qué cambió desde la última visita. |
| **Transaction Room** | **IMPROVE · P0** | `operacion/[id]` ya existe con 6 pestañas y `?tab=` deep-linkable. Falta: participantes, actividad, deadlines, ofertas. Es lo más cercano a un Transaction Room que hay. |
| **Decision Center** | **MISSING · P1** | `/propiedades` lista propiedades reales pero no distingue **Property Candidate** de **Transaction**. No hay estados `ANALYZING/FAVORITE/VISITED/DISCARDED/PROMOTED`. No hay comparación. |
| **Property Candidate ≠ Transaction** | **MISSING · P0** | El modelo no separa ambos conceptos (brief §12). Hoy una propiedad importada y una operación son entidades sueltas sin promoción explícita. |
| **Activity Ledger** | **MISSING · P1** | No existe. Hay `visit_events` (solo VARA Visit). No hay historial por operación. |
| **Structured Offers** | **MISSING · P1** | `/ofertas` usa `mockOfertas.ts` con `isMockData: true` (opt-in, honesto) pero **no existe la entidad `Offer`**: ni precio+condiciones, ni estados, ni contraofertas persistidas. |
| **Cost Engine** | **IMPROVE · P1** | `generateChecklist()` es fuente única y se usa en 6 lugares. Bien. Problema: `onboarding:151` y `operacion:459` pasan `185000` hardcodeado como precio cuando no hay propiedad. Un costo "estimado" con precio inventado se muestra como si fuera del usuario. |
| **Risk Engine** | **IMPROVE · P1** | Los riesgos existen en `operacion/[id]` con severidad y recomendación. Falta: `evidence`, `source`, `status`. Se muestra el qué y el porqué, no la evidencia. |
| **Document Intelligence** | **MISSING · P2** | Los documentos tienen estado pero no hay extracción, ni validación cruzada, ni detección de inconsistencias. |

### 2.2 VARA Visit

Construido completo en la iteración anterior. Estado real:

| Pieza | Clasificación |
|---|---|
| Modelo de datos (14 tablas, 3 planos de privacidad, RLS) | **KEEP** |
| Matching (filtros duros + ranking auditable, 27 tests) | **KEEP** |
| Precios (bandas centrales, suplementos, 22 tests) | **KEEP** |
| Visit Mode (check-in, PIN, checklist, check-out, 31 tests) | **KEEP** |
| Reporte de hechos | **KEEP** |
| Portal del partner + onboarding de 7 pasos | **KEEP** |
| Trust & Safety admin | **KEEP** |
| Reviews bilaterales + flags privados | **KEEP** |
| Subida de fotos en el reporte | **MISSING · P2** — `photoPaths` se guarda vacío |
| Contacto partner↔cliente tras asignación | **MANUAL** — lo coordina VARA; RLS cerrado a dueño+admin |
| Verificación de identidad | **MANUAL · P0 para lanzar** — no hay carga de DNI; se hace fuera de la plataforma |
| Envío de pedidos de referencia | **MANUAL** — no hay mails automáticos |
| Pagos | **FUTURE** — requiere proveedor externo |

### 2.3 Datos ficticios restantes

| Archivo | Clasificación | Nota |
|---|---|---|
| `src/data/mock.ts` | **MOCK · P0 parcial** | `mockTransaction` se usa en 4 paths de producción (§1). `mockVisitChecklist` es contenido legítimo, no dato falso. |
| `src/data/mockOfertas.ts` | **MOCK (aceptable)** | Opt-in con `isMockData: true` y banner. No engaña. |
| `src/data/mockPreciosMercado.ts` | **MOCK · P1** | Comparables de mercado inventados. `/precios` los presenta como referencia — es una afirmación sobre el mercado real. |
| `visitas-vendedor` MOCK_SOLICITUDES | **MOCK (aceptable)** | Opt-in explícito. |
| `mockProfessionals` | **REMOVE** | Ya no se renderiza (se reemplazó por registros oficiales) pero sigue en el árbol. |

### 2.4 Arquitectura e internacionalización

| Área | Clasificación | Detalle |
|---|---|---|
| Jurisdicción | **REFACTOR · P2** | `src/lib/regulations.ts` mezcla core y Argentina. `src/lib/utils.ts` formatea en es-AR. `varaVisit.ts` tiene `EMERGENCY_NUMBERS` argentinos y `buildVisitCode` con `VIS-AR-` fijo. No hay separación Core / Jurisdiction Pack (brief §50). |
| Dominios | **IMPROVE · P2** | Hay separación razonable (`lib/varaVisit/*`, `lib/supabase/*`, `lib/regulations.ts`) pero lógica de negocio todavía vive en páginas: `profesionales/page.tsx` calcula necesidades, `dashboard/page.tsx` computa inteligencia. |
| Event Engine | **MISSING · P2** | Solo `visit_events`. No hay eventos de dominio generales. |
| Feature flags | **MISSING · P2** | No existen. |
| Permisos / roles | **KEEP** | `profiles.role` + `is_admin()` + RLS por tabla. Sólido. Cubre solo VARA Visit; las operaciones siguen siendo single-user. |
| Shared Transaction State | **MISSING · P2** | Una operación pertenece a un `user_id`. No hay participantes con roles. |
| Observabilidad | **MISSING · P1** | Cero instrumentación fuera de `visit_events`. No se sabe qué falla. |
| Tests | **IMPROVE** | 80 tests, todos de VARA Visit. Cero tests del core (operaciones, costos, documentos, riesgos). |

### 2.5 Alquiler

**No existe.** `grep -i "alquiler|rental|rent"` no devuelve funcionalidad.
Nada que ocultar ni remover. El brief (§11) se cumple por omisión.

---

## 3. Los 10 problemas concretos

Ordenados por daño real al usuario.

1. **El consejo de VARA es ficticio** — `useGuidance.ts:17`. Todas las pantallas.
2. **"Tu operación necesita X profesional" es ficticio** — `profesionales/page.tsx:14`.
3. **No hay Next Best Action real** — no existe motor que lea estado real.
4. **Property Candidate y Transaction son lo mismo** — no se puede analizar sin comprometerse.
5. **Las ofertas no existen como entidad** — `/ofertas` muestra ejemplos; no se puede hacer una oferta.
6. **Los costos usan USD 185.000 inventado** cuando no hay propiedad cargada.
7. **Los comparables de precio son inventados** — `mockPreciosMercado.ts` en `/precios`.
8. **Sin historial de actividad** — el usuario que vuelve a los 10 días no sabe qué cambió.
9. **Sin observabilidad** — si algo falla, nadie se entera.
10. **Sin tests del core** — los 80 tests cubren solo VARA Visit.

---

## 4. Qué mantengo, qué elimino, qué unifico

### KEEP (funciona y no se toca)
- Motor regulatorio `generateChecklist()` como fuente única de costos.
- Todo VARA Visit (modelo, matching, Visit Mode, portal, admin, tests).
- Patrón `tryCreateClient()` → degradación a localStorage.
- RLS por tabla con `is_admin()` en SECURITY DEFINER.
- Checklist de visita de `/visitas` (contenido real).
- Guía y base de conocimiento (`data/knowledge.ts`, 14 entradas).

### REMOVE
- `mockTransaction` de los 4 paths de producción.
- `mockProfessionals` (huérfano).
- `mockPreciosMercado` como fuente de comparables presentados como reales.

### UNIFICAR
- `/visitas` (checklist del comprador) + `/mis-visitas` (visitas contratadas) →
  hoy son dos cosas distintas con el mismo nombre. Confunde.
- `/ofertas` + negociación + la futura entidad `Offer` → una sola pantalla.
- `/precios` + `/costos` + `/financiamiento` → tres pantallas de plata separadas
  que el usuario no distingue.
- `computeIntelligence` (dashboard) y `computeOperationIntel` (operación) →
  cálculo duplicado que puede divergir.

---

## 5. Decisiones de producto dudosas — documentadas

Siguiendo la instrucción del brief: donde hay duda, elijo lo más simple,
seguro y reversible.

| Duda | Elijo | Por qué |
|---|---|---|
| ¿Borrar `mockTransaction` o desconectarlo? | **Desconectarlo de producción, dejarlo para tests** | Es un fixture útil. El daño es que se use como fallback, no que exista. |
| ¿Property Candidate como tabla nueva o estado en `properties`? | **Estado en `properties` + `promoted_to_operation_id`** | Migración aditiva y reversible. Una tabla nueva obliga a migrar datos existentes. |
| ¿Comparables de precio? | **Ocultar `/precios` hasta tener datos reales** | Afirmar un precio de mercado con datos inventados es lo mismo que inventar un partner. |
| ¿Unificar las 3 pantallas de plata ahora? | **No en esta fase** | Refactor de UI sin ganancia funcional inmediata. Va a P1. |
| ¿Jurisdiction Packs ahora? | **No** | El brief mismo dice "diseñar para el futuro, construir para el presente" (§99). Hoy hay un país. |

---

## 6. Qué es verdad hoy sobre el producto

| Capability | Estado real |
|---|---|
| Importar propiedad de un portal | **LIVE parcial** — Zonaprop bloquea por Cloudflare; hay fallback de pegar texto con extracción por IA |
| Costos por provincia | **LIVE** — motor regulatorio real |
| Guía del proceso | **LIVE** — 14 entradas reales |
| Asistente IA | **LIVE** — acotado a VARA, con base de conocimiento |
| Transformar fotos con IA | **LIVE** — `gpt-image-1` sobre la foto real |
| Operaciones y tareas | **LIVE** — generadas por el motor regulatorio, persistidas en Supabase |
| Documentos | **LIVE parcial** — se listan y marcan estado; no se suben ni analizan |
| Riesgos | **LIVE** — derivados de tareas y documentos |
| Next Best Action | **MOCK** — ver §1 |
| Profesionales | **LIVE parcial** — registros oficiales reales; "tu operación necesita" es MOCK |
| Ofertas / negociación | **DEMO** — ejemplo opt-in |
| Comparables de precio | **MOCK** |
| Publicar en portales | **MANUAL** — no hay API de portales |
| VARA Visit | **PILOT** — el software está completo; la red de partners está vacía y la verificación de identidad es manual |
| Pagos | **FUTURE** |
