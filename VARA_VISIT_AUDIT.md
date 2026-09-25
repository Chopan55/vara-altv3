# VARA_VISIT_AUDIT.md

Auditoría del MVP actual antes de construir VARA Visit.
Fecha: 2026-09-21 · Repo: `Plataforma Real State` (deploy: `vara-mvp.vercel.app`)

Criterio de lectura: *mañana una familia real deja entrar a un desconocido a su casa por esta plataforma.*
Todo lo marcado **P0** es bloqueante antes de la primera visita real.

---

## 0. Resumen ejecutivo

Hay **más base reutilizable de la que esperaba** y **menos VARA Visit del que aparenta**.

Lo que existe hoy bajo el nombre "VARA Visit" son dos páginas de marketing y un formulario de 4 pasos
que no persiste nada relevante, elige entre tres personas inventadas y no tiene check-in, ni PIN, ni
reporte, ni trazabilidad. **No hay un solo registro de quién estuvo dónde.**

En cambio, la infraestructura general sí sirve: hay Supabase con RLS por `auth.uid()`, un patrón de
acceso a datos limpio (`src/lib/supabase/*`), un motor de guía (`guidanceEngine`) que ya sabe
recomendar VARA Visit, y un checklist de visita real en `/visitas` que se puede reusar como fuente
del checklist de Visit Mode.

**Decisión arquitectónica central:** no construyo un módulo paralelo. Extiendo el esquema existente
con tablas nuevas siguiendo exactamente el patrón de `operations`/`operation_tasks`, y reuso
`tryCreateClient()`, el tipo `Database`, y la convención `Row`/`Tbl<Row, Req>`.

**Hallazgo más grave:** la tabla `visit_requests` que ya existe **no es** VARA Visit. Modela otra cosa
(un comprador pidiéndole una visita al vendedor). Reutilizarla sería un error de modelado que se
paga caro después. Ver §3.

---

## 1. Inventario y clasificación

### 1.1 VARA Visit (lo que existe hoy)

| Pieza | Clasificación | Detalle |
|---|---|---|
| `src/types/visitTypes.ts` → `DEMO_VISIT_PARTNERS` | **MOCK · P0** | Tres personas inventadas con rating 4.9, "87 visitas" y badge "Verificado". Es exactamente lo que el producto promete que no hace. **Eliminar.** |
| `src/types/visitTypes.ts` → `VisitPartner` | **IMPROVE** | 12 campos. Falta todo lo que sostiene la confianza: verificaciones separadas, métricas de cumplimiento, zona con radio, disponibilidad, precio, onboarding/certificación. Sin separación público/privado/compliance. |
| `src/types/visitTypes.ts` → `VisitJob` | **REFACTOR** | Mezcla en un objeto la solicitud, la asignación, la sesión (check-in/out) y el reporte. Cuatro ciclos de vida distintos en una estructura. Separar. |
| `src/types/visitTypes.ts` → `VisitJobStatus` | **EXTEND** | 8 estados. Faltan `SEARCHING_PARTNER`, `PARTNER_EN_ROUTE`, `ARRIVED`, `INCIDENT_REVIEW`. Sin ellos no hay seguimiento real. |
| `src/types/visitTypes.ts` → `VISIT_PACKS` | **HARDCODED** | Precios USD 25/20/16 fijos en el código. Debe ir a configuración central con bandas por duración. |
| `src/types/visitTypes.ts` → `VisitReport` | **IMPROVE** | Campos razonables pero sin checklist estructurado, sin fotos, sin separación hecho/inferencia. |
| `src/app/vara-visit/page.tsx` | **IMPROVE** | Landing del servicio. Útil. Renderiza los partners ficticios (**P0**). `SERVICE_AVAILABILITY` es una constante hardcodeada en el archivo, no un estado real por zona. |
| `src/app/vara-visit/solicitar/page.tsx` | **REFACTOR · P0** | Flujo de 4 pasos. Paso "Elegí tu partner" lista personas inventadas. Guarda en `localStorage['vara_visit_requests']` un objeto sin `id`, sin propiedad, sin estado, sin precio. No hay confirmación, ni asignación, ni check-in. **No es un booking, es una encuesta.** |
| `VerificationBadge` (inline en `vara-visit/page.tsx`) | **EXTEND** | Buena idea, mal lugar. Debe ser componente compartido y mapear verificaciones reales, no un enum de 3 valores. |

### 1.2 Visitas (lo que ya funciona y sirve de base)

| Pieza | Clasificación | Detalle |
|---|---|---|
| `src/app/visitas/page.tsx` | **KEEP · EXTEND** | Checklist de visita del comprador, con secciones, notas y persistencia en `localStorage`. Es material real y bien pensado. **Se reusa como fuente del checklist de Visit Mode.** |
| `mockVisitChecklist` (`src/data/mock.ts`) | **KEEP** | Es contenido (qué mirar en una visita), no datos de usuario falsos. Válido. |
| `src/app/visitas-vendedor/page.tsx` | **IMPROVE** | Arranca vacío y ofrece un ejemplo opt-in con banner — patrón correcto, ya corregido en una pasada anterior. Debe pasar a leer solicitudes reales de VARA Visit. |
| `MOCK_SOLICITUDES` | **MOCK (aceptable)** | Opt-in explícito y marcado `isMockData: true`. No engaña. Mantener hasta que haya datos reales. |
| `localStorage['vara_visit_requests']` | **BROKEN** | Dos páginas escriben la misma clave con **formas distintas**: `solicitar` guarda `{packId, date, time, timestamp}` y `visitas-vendedor` guarda `SolicitudVisita[]` con otros campos. Se pisan. Nadie lo notó porque ninguna lee lo que escribe la otra. |

### 1.3 Infraestructura reutilizable

| Pieza | Clasificación | Por qué sirve |
|---|---|---|
| `src/lib/supabase/client.ts` | **KEEP** | `tryCreateClient()` devuelve `null` sin config → toda la app convive con modo localStorage. Patrón a respetar en Visit. |
| `src/lib/supabase/types.ts` → `Database`, `Tbl<R, Req>` | **KEEP · EXTEND** | Convención ya resuelta (rows como `type` no `interface`, `Relationships: []`, `Insert<T,Req>`). Las tablas nuevas entran acá. |
| `supabase/migrations/*.sql` | **KEEP · EXTEND** | Migraciones idempotentes, RLS por `auth.uid() = user_id` en las 10 tablas. Storage separado por permisos de owner. Patrón correcto, lo sigo. |
| `src/lib/supabase/operations.ts` / `photos.ts` | **KEEP** | Patrón de acceso: `rowTo*()` + `fetch/insert/update`. Lo replico. |
| `src/lib/userOperations.ts` | **KEEP** | Routing localStorage ↔ Supabase con migración transparente. Mismo patrón para Visit. |
| `src/lib/regulations.ts` → `generateChecklist()` | **KEEP** | Motor regulatorio. Fuente de verdad de costos. **Regla del proyecto: los costos nunca se hardcodean.** Aplica también a Visit. |
| `src/lib/guidanceEngine.ts` | **EXTEND** | Ya tiene `open_vara_visit` como tipo de acción y lo recomienda en 2 puntos. Es el enganche natural para que el reporte de visita alimente el Next Best Action. |
| `src/app/api/chat/route.ts` | **EXTEND** | Acepta `context` (string) y lo inyecta al system prompt. El reporte de visita entra por ahí. |
| `src/components/ui/InfoTip.tsx` | **KEEP** | Tooltip accesible (hover + tap). Reusar para explicar verificaciones. |
| `src/middleware.ts` | **KEEP** | Refresh de token. No-op sin env vars. |

### 1.4 Lo que falta por completo

| Pieza | Clasificación | Impacto |
|---|---|---|
| Tablas de partner, verificación, asignación, sesión, reporte, review, incidente, training | **MISSING · P0** | Sin esto no hay trazabilidad. Es el corazón del producto. |
| Sistema de roles y permisos | **MISSING · P0** | Hoy todo usuario es igual. No hay `client` / `partner` / `admin`. RLS no puede separar lo que no existe. |
| Onboarding de partner | **MISSING · P0** | No hay forma de dar de alta a nadie. |
| Check-in / check-out / PIN | **MISSING · P0** | No se registra quién entró ni cuándo salió. |
| Reporte estructurado de visita | **MISSING** | El `VisitReport` del tipo no se genera en ninguna parte. |
| Reviews bilaterales | **MISSING** | `clientRating`/`partnerRating` existen como número suelto, sin dimensiones ni flags de seguridad. |
| Incidentes / Trust & Safety | **MISSING · P0** | No hay forma de reportar ni de suspender a nadie. |
| Panel admin | **MISSING** | Todo el onboarding tiene que ser aprobable a mano en el piloto. |
| Configuración central de precios | **MISSING** | Ver `VISIT_PACKS` hardcodeado. |
| Tests | **MISSING** | `package.json` no tiene runner. Cero tests en el repo. |
| Instrumentación / eventos | **MISSING** | No hay forma de medir fill rate, time-to-assignment, etc. |

---

## 2. Problemas P0 encontrados (bloqueantes)

Ordenados por gravedad en el escenario "la familia deja entrar al desconocido".

**P0-1 · Personas inventadas presentadas como verificadas.**
`DEMO_VISIT_PARTNERS` muestra nombre, iniciales, "✓ Verificado", 4.9★ y 87 visitas.
Un usuario puede reservar hoy creyendo que eligió a una persona real. Es el peor fallo posible
para un producto cuya promesa es la confianza.
→ Eliminar. Estados reales de marketplace vacío.

**P0-2 · Cero trazabilidad.**
No se registra check-in, check-out, ubicación ni identidad. Si algo pasa en una visita, VARA no
puede decir quién estuvo, cuándo entró ni cuándo salió.
→ `visit_sessions` con check-in/out y PIN obligatorio.

**P0-3 · No existe verificación de identidad.**
`VerificationLevel` es un enum de tres valores que se asigna a mano en un array literal. No hay
documento, ni selfie, ni teléfono, ni proceso, ni quién aprobó.
→ Tabla `partner_verifications` separada, con `reviewed_by` y `reviewed_at`.

**P0-4 · No hay forma de suspender a nadie.**
No hay estado de suspensión efectivo ni incidentes. Un partner con un problema grave seguiría
recibiendo visitas.
→ `safety_incidents` + `status` del partner chequeado en el matching.

**P0-5 · No hay roles.**
Cualquier usuario autenticado tendría el mismo acceso. Un cliente podría leer datos de compliance
de un partner si esas tablas se crean con el RLS genérico `auth.uid() = user_id`.
→ Roles + políticas RLS específicas por tabla, con las de compliance cerradas a admin.

**P0-6 · Habilitación automática por subir documentos.**
El modelo actual no distingue "subió el DNI" de "está aprobado para entrar a una casa".
→ `onboarding_status` con paso de entrevista, capacitación y visitas supervisadas obligatorias.

---

## 3. Decisión: `visit_requests` no se reutiliza

La tabla existente:

```sql
visit_requests (id, user_id, property_id, buyer_name, buyer_phone, buyer_email,
                visit_date, visit_time, message, status, agent, ...)
status: 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA' | 'REALIZADA'
```

Modela **un comprador que le pide al vendedor ver la propiedad**. Los datos del visitante son texto
libre (`buyer_name`, `buyer_phone`) porque el visitante no es usuario de VARA.

VARA Visit es otra cosa: **un cliente de VARA contrata a un partner de VARA**. Ambas partes son
usuarios con identidad verificada, hay precio, asignación, sesión y reporte.

Meter los dos casos en una tabla obligaría a que la mitad de las columnas sean `null` según el caso
y a que `status` signifique cosas distintas según quién lo lea. Se deja intacta; VARA Visit usa
tablas propias con prefijo `visit_partner*` / `visit_bookings`.

**Reversible:** si mañana se quiere unificar, se puede, con una vista. Al revés (desenredar una tabla
sobrecargada con datos productivos) es mucho más caro.

---

## 4. Decisiones de producto dudosas — documentadas

Siguiendo la instrucción: donde hay duda, elijo lo **más simple, seguro y reversible**.

| Duda | Opciones | Elijo | Por qué |
|---|---|---|---|
| ¿Geolocalización obligatoria en check-in? | GPS estricto / registrar si está disponible / nada | **Registrar si el navegador la da, nunca bloquear** | Bloquear por GPS deja a un partner honesto afuera de una visita real en un subsuelo sin señal. Se guarda ubicación y precisión; el geofencing estricto queda preparado pero apagado. |
| ¿Pago dentro de la plataforma? | Stripe / MercadoPago / fuera de plataforma | **Fuera de plataforma en el piloto** | Un proveedor de pagos es una integración externa con KYC propio. El precio se muestra y se registra; el cobro se coordina a mano. Marcado `MANUAL`. |
| ¿Matching automático o manual? | Algoritmo / admin asigna | **Algoritmo que propone, admin confirma en piloto** | El ranking está implementado y es auditable, pero con poca oferta un humano decide mejor. Flag central para automatizarlo. |
| ¿Antecedentes penales? | Guardar documento / solo estado | **Solo estado (`background_eligibility_status`) + proveedor + fechas** | Dato sensible bajo Ley 25.326 (AR). Guardar el certificado sin base legal es un riesgo real. Marcado `LEGAL REVIEW REQUIRED`. |
| ¿Teléfono del partner visible? | Siempre / después de asignar / nunca | **Solo después de asignación confirmada, y de ambos lados** | Es el mínimo para coordinar sin exponer datos a cualquiera que mire el marketplace. |
| ¿Niveles (Verified/Pro/Expert/Elite)? | Score opaco / niveles con criterios | **Niveles con criterios publicados y métricas crudas visibles** | El pedido es explícito: nada de números arbitrarios sin explicación. |
| ¿Quién ve el reporte de visita? | Cliente / cliente + partner / público | **Cliente dueño de la operación y el partner autor** | El reporte puede contener observaciones sobre la propiedad de terceros. |

---

## 5. Plan de ataque (orden de ejecución)

Sigo el orden pedido. Cada etapa deja el producto en estado desplegable.

1. **Modelo de datos** — tipos TS + migración SQL con RLS.
2. **Roles y permisos** — `profiles.role`, políticas por tabla.
3. **Onboarding de partner** — 7 pasos, estado persistido.
4. **Perfil público** — separación público/privado/compliance.
5. **Marketplace + matching** — con estados de oferta vacía reales.
6. **Booking** — request → asignación → confirmación.
7. **Visit Mode + check-in/PIN/check-out** — mobile-first.
8. **Reporte** — hechos, no inferencias.
9. **Reviews bilaterales + flags privados.**
10. **Integración con VARA AI / guidance.**
11. **Dashboard del partner.**
12. **Admin / Trust & Safety Center.**
13. **Tests + auditoría final.**

---

## 6. Qué preservo explícitamente

- El patrón localStorage ↔ Supabase con degradación: la app tiene que seguir funcionando sin base.
- `generateChecklist()` como única fuente de costos regulatorios.
- El checklist de `/visitas` como contenido real reutilizable.
- La navegación y el shell actuales: VARA Visit entra donde ya está, no crea un universo aparte.
- El criterio de estados vacíos honestos ya aplicado en `/profesionales`, `/ofertas` y `/visitas-vendedor`.
