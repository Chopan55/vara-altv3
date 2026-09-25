# MVP_FUNCTIONAL_AUDIT — VARA

**Fecha:** 2026-09-18  
**Estado del build:** ✅ Verde (17 rutas)

---

## RESUMEN EJECUTIVO

VARA tiene una base sólida: design system consistente, motor regulatorio real (el corazón del producto) y API de IA funcional. El problema central es que **todo el estado de operación es un mock estático** (`mockTransaction` hardcodeado) y **los flujos más importantes terminan en dead ends silenciosos**.

Un usuario real que "publique" su propiedad, "contacte" un profesional, o "envíe" una solicitud VARA Visit no genera absolutamente nada en el mundo real.

---

## ✅ KEEP — Funciona correctamente

| Archivo | Estado |
|---|---|
| `src/lib/regulations.ts` | Motor regulatorio con fuentes oficiales verificadas |
| `src/data/regulations/provinces.ts` | CABA y Buenos Aires verificados (ARBA/AGIP, 2026-09-13) |
| `src/app/api/chat/route.ts` | GPT-4o real — funciona si OPENAI_API_KEY configurado |
| `src/app/api/transform/route.ts` | GPT-4o Vision + DALL-E 3 real |
| `src/hooks/useVaraState.ts` | localStorage correcto con try/catch, acciones setter |
| `src/app/onboarding/page.tsx` | Flujo 4 pasos completo, persiste en localStorage |
| `src/app/operacion/[id]/page.tsx` | Tabs tareas/riesgos/documentos/costos/timeline bien modelados |
| `src/lib/guidanceEngine.ts` | NBA determinístico |
| `src/components/guidance/*` | GuiameButton + GuidanceBanner + GuidancePanel funcionales |
| `src/app/vara-visit/page.tsx` | Home con pilot mode honesto |

---

## 🔴 BROKEN — Roto ahora mismo

| # | Archivo:Línea | Problema |
|---|---|---|
| 1 | `costos/page.tsx:14` | `useState(185000)` — precio no editable, nunca cambia |
| 2 | `publicar/page.tsx:75` | handlePublish solo setea estado local — no publica nada |
| 3 | `publicar/page.tsx:264` | Botón fotos sin handler — no funciona |
| 4 | `profesionales/page.tsx:142` | Botón "Contactar" sin onClick — dead end silencioso |
| 5 | `visitas/page.tsx` | Checklist no persiste — se reinicia al refrescar |
| 6 | `asistente/page.tsx` | Historial de chat en useState — se pierde al navegar |
| 7 | `propiedades/[id]/page.tsx:33` | Fallback silencioso a prop-001 si ID no existe |
| 8 | `vara-visit/solicitar/page.tsx:71` | "Enviar solicitud" no envía nada |

---

## 🟡 HARDCODED — Valores dispersos que deben centralizarse

| Archivo:Línea | Valor hardcodeado | Correcto sería |
|---|---|---|
| `costos/page.tsx:14` | `185000` | `property.price` o input del usuario |
| `financiamiento/page.tsx:23` | `185000` | Mismo price que costos |
| `financiamiento/page.tsx:36` | `price * 0.035` | `generateChecklist` de regulations |
| `propiedades/[id]/page.tsx:64` | `price * 0.035` | `generateChecklist` de regulations |
| `onboarding/page.tsx:46` | `185000` en generateChecklist | Valor de referencia con disclaimer visible |
| `dashboard/page.tsx:243` | `'USD 1.200 – 2.100 / m²'` | Dato real o "No disponible" |
| `dashboard/page.tsx:535` | `'30–60 días'` | Calculado del estado real de la operación |
| `dashboard/page.tsx:589` | `'5 disponibles'`, `'6 en análisis'` | Dato real o eliminar la sección |
| `financiamiento/page.tsx:11-14` | Tasas bancarias fijas sin fecha | Agregar "última actualización" visible |

---

## 🟠 MOCK — Datos ficticios (permitidos, deben ser centralizados y explícitos)

| Entidad | Archivo | Nota |
|---|---|---|
| 6 propiedades | `src/data/mock.ts` | `isMock: true` explícito — OK mientras sea claro |
| 5 profesionales | `src/data/mock.ts` | `isMock: true`, ratings inventados |
| `mockTransaction` (txn-001) | `src/data/mock.ts` | Toda la operación demo — OK para MVP |
| 3 visit partners | `src/types/visitTypes.ts` | `DEMO_VISIT_PARTNERS`, marcado en UI — OK |
| Timeline con fechas | `src/data/mock.ts:103-110` | Fechas 2026-08-15 a 2026-09-12 fijas |

---

## ❌ MISSING — Flujos que no existen

| # | Flujo faltante | Impacto |
|---|---|---|
| 1 | Crear operación nueva | Usuario no puede iniciar su propia operación |
| 2 | Auth / login / sesión | Cualquier persona ve los mismos datos demo |
| 3 | Enviar solicitud VARA Visit a backend real | Parece funcionar pero no hace nada |
| 4 | Persistir checklist de visita | Trabajo del usuario se pierde |
| 5 | Persistir historial del asistente | UX de chat degradada |
| 6 | Error states descriptivos | Casi no existen mensajes de error útiles |
| 7 | Empty states productivos con CTA | Mayoría son texto vacío |
| 8 | Returning user experience | Dashboard genérico, no reconstruye contexto |

---

## ⚡ DISCONNECTED — No comparten data source

| Módulos | Problema |
|---|---|
| `costos/` y `mockTransaction.property.price` | Ambos son 185000 por coincidencia, no conexión |
| `visitas/` y `operacion/[id]` | Visitas no saben qué propiedad se está visitando |
| `financiamiento/` y estado compartido | Precio inicial no viene de ningún contexto |
| `useVaraState.operationId` y carga de transacción | operationId se persiste pero no se usa para cargar datos |

---

## 🐛 BUG

- `onboarding/page.tsx:18`: `'Rosario'` en lista de provincias. `resolveProvinceCode` la mapea silenciosamente a `BUENOS_AIRES`. Debería ser `'Santa Fe'`.

---

## DEUDA TÉCNICA ARQUITECTÓNICA

```
src/types/index.ts:61 → isMock: true como campo requerido en Property
  Significa que NUNCA puede existir una propiedad real sin cambiar el tipo.

useVaraState.operationId existe pero ninguna página lo usa para cargar datos.
  Todas las páginas importan mockTransaction directamente.

No hay contexto/store global.
  Cada página reimporta mockTransaction independientemente.
  Cambios de estado en una página no se propagan a otras.
```

---

## ESTADO GLOBAL

| Dimensión | Estado |
|---|---|
| Build & TypeScript | ✅ DONE |
| Design System | ✅ DONE |
| Motor regulatorio | ✅ DONE |
| VARA AI (chat) | ✅ DONE |
| Onboarding | ✅ DONE |
| Guided Journey (NBA) | ✅ DONE |
| Operación [id] | 🟡 PARTIAL |
| Dashboard | 🟡 PARTIAL |
| Propiedades | 🟡 PARTIAL |
| Costos | 🔴 BROKEN |
| Financiamiento | 🟡 PARTIAL |
| Visitas | 🔴 BROKEN |
| Publicar | 🔴 BROKEN |
| Profesionales | 🔴 BROKEN |
| VARA Visit | 🟡 PILOT |
| Auth / Sesiones | ❌ MISSING |
| Persistencia real | ❌ MISSING |
| Error states | ❌ MISSING |
| Empty states productivos | 🟡 PARTIAL |
