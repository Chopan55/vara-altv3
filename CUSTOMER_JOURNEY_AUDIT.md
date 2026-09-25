# CUSTOMER JOURNEY AUDIT — VARA MVP
> FASE 0 · Auditoría como usuario real, no como desarrollador.
> Generado: 2026-09-17 · Por: Claude (instrucción: VARA Product & UX Evolution V2)

---

## Metodología

Recorrido completo de VARA como:
1. **Primera persona compradora** — llegando por primera vez, sin conocer la app
2. **Primera persona vendedora** — queriendo poner una propiedad en el mercado

Para cada journey: qué encontraron, qué falta, qué rompe el flujo, qué genera confianza o fricción.

---

## JOURNEY 1: COMPRADOR PRIMERA VEZ

### Punto de entrada: Landing page `/`

**Lo que ve:**
- Hero oscuro premium con tagline "sin sorpresas"
- Stats: 24 regulaciones / 6 etapas / IA / 0 sorpresas
- 3 feature cards (Motor Regulatorio / Risk Engine / Visualizá el potencial)
- CTA: "Empezar gratis" → `/onboarding`

**Problemas:**
- ❌ No hay contexto de PARA QUÉ sirve VARA exactamente (¿para comprar? ¿para vender? ¿para buscar propiedades?)
- ❌ "Empezar gratis" lleva a onboarding pero no hay login/auth — el usuario llega al dashboard de otra persona (Francisco, demo)
- ❌ No hay social proof real (reviews, casos de uso reales)
- ❌ CTA secundario a `/vara-labs` confunde — un nuevo usuario no sabe qué es Labs

---

### `/onboarding`

**Lo que ve:**
- Paso 1: ¿Qué querés hacer? (Comprar / Vender / Alquilar)
- Paso 2: ¿En qué provincia?
- Paso 3: GPS listo — checklist regulatorio + costos estimados

**Lo que funciona:**
- ✅ Flujo lineal claro, 3 pasos
- ✅ Datos regulatorios reales (sellos, honorarios por provincia)
- ✅ Label de confianza de dato (VERIFIED / PARTIAL / ESTIMATED)
- ✅ Warnings específicos por provincia

**Problemas:**
- ❌ Paso 1 → Paso 2 avanza automáticamente al hacer click (no hay confirmación visual antes de avanzar)
- ❌ No hay campo para URL de propiedad / dirección — el usuario ya puede tener algo en mente
- ❌ El "GPS listo" del Paso 3 muestra checklist hardcodeado con $185.000 (no el valor real de la propiedad del usuario)
- ❌ "Empezar mi operación" va a `/dashboard` que muestra datos de Francisco — ROMPIMIENTO TOTAL DE ILUSIÓN
- ❌ No pide nombre, no guarda estado — si el usuario cierra y vuelve, vuelve a cero
- ❌ Alquiler está como opción pero no existe flujo de alquiler en el resto del producto

---

### `/dashboard`

**Lo que ve:**
- Header: "Buenos días, Francisco" (hardcoded)
- Operación activa: "Compra – Departamento Palermo" (mock)
- Progress 40%, stage: "Documentación preescritura"
- NBA: próxima acción
- Risks expandibles
- Costos calculados
- Docs snapshot (4 documentos)
- Timeline estimate: 30-60 días
- Qué cambió (timeline events)
- Quick access: Calculadora / Asistente / Profesionales / Propiedades
- Bottom nav: Inicio / Operación / Propiedades / Red / Labs

**Lo que funciona:**
- ✅ NBA (Next Best Action) — concepto correcto, bien destacado
- ✅ Costos por provincia calculados dinámicamente
- ✅ Risk Intelligence con severidad HIGH/MEDIUM
- ✅ "Qué cambió" — timeline events, concepto V2
- ✅ Estructura de Operation Home es sólida

**Problemas críticos:**
- ❌❌ TODO EL DASHBOARD ES DEMO — usuario nuevo ve datos de otro ("Buenos días, Francisco", Palermo mock)
- ❌ No hay camino para que el usuario cree SU operación — solo se ve la mock
- ❌ Sin auth = sin persistencia = todo lo que haga se pierde al cerrar
- ❌ Bottom nav en desktop se ve raro — es un patrón mobile forzado en pantallas grandes
- ❌ Quick access links a `/profesionales` y `/asistente` son destinos con contenido limitado

---

### `/operacion/txn-001`

**Lo que ve:**
- Header con propiedad, estado, progreso
- 6 tabs: tareas / documentos / costos / timeline / participantes / riesgos
- TaskCard expandibles con descripción, por qué importa, warnings, recommendations

**Lo que funciona:**
- ✅ Tab structure — bien pensado para una operación compleja
- ✅ TaskCard con "Por qué importa" — educa al usuario
- ✅ Documentos con status badges
- ✅ Costos desglosados por ítem
- ✅ Risk panel con severidad

**Problemas:**
- ❌ Todo es mock estático (mockTransaction) — no hay operación real
- ❌ Los tabs de participantes y costos tienen datos hardcodeados
- ❌ No se puede crear una nueva operación desde aquí
- ❌ Sin Negotiation Intelligence (P0 en V2) — no hay nada sobre negociación

---

### `/propiedades`

**Propósito declarado:** explorar propiedades para analizar

**Problemas:**
- ❌ Contiene lista de propiedades mock
- ❌ No hay input real (URL de MercadoLibre / Zonaprop / etc.)
- ❌ Botón "Visualizá el potencial" lleva a `/propiedades/[id]` con AI staging pero es una feature separada del journey

---

### `/propiedades/[id]`

**Lo que funciona:**
- ✅ OpenAI GPT-4o Vision para análisis de imagen
- ✅ DALL-E 3 para render "potencial"
- ✅ Before/After comparación
- ✅ True Acquisition Cost calculator

**Problemas:**
- ❌ Página desconectada del journey principal — no hay "agregar a mi operación"
- ❌ El análisis no persiste — si navegás para otro lado, se pierde
- ❌ Diseño inconsistente con el resto (mezcla de colores)

---

### `/costos`

**Lo que funciona:**
- ✅ Calculadora con múltiples provincias
- ✅ Datos reales de sellos, honorarios, certificados
- ✅ Label de confianza (VERIFIED / PARTIAL / ESTIMATED)

**Problemas:**
- ❌ Standalone sin conexión a una operación activa
- ❌ No se puede guardar el cálculo ni exportar

---

### `/asistente`

**Lo que funciona:**
- ✅ Knowledge base con respuestas sobre escritura, reserva, costos, plazos
- ✅ Cálculo dinámico de costos en respuestas (usa regulations engine)
- ✅ Expandible por provincia

**Problemas:**
- ❌❌ Solo keyword matching — respuestas hardcodeadas, no IA real
- ❌ Sin contexto de la operación activa del usuario
- ❌ En V2 esto debe ser VARA AI contextual integrado en cada pantalla, no una página separada

---

### `/profesionales`

**Problemas:**
- ❌ Lista de profesionales mock (sin datos reales)
- ❌ Sin filtro por zona / especialidad
- ❌ Sin sistema de contacto real
- ❌ Sin ratings / reviews

---

### `/vara-labs`

**Lo que funciona:**
- ✅ Presentación de 10 features en desarrollo (Available / En desarrollo / Investigando)
- ✅ Dark design premium

**Problemas:**
- ❌ Para usuario nuevo, es confuso — ¿estas features están disponibles o no?
- ❌ No hay acceso directo desde el journey natural del usuario

---

### `/financiamiento`

**Lo que funciona:**
- ✅ Calculadora hipotecaria con 4 bancos
- ✅ LTV checker
- ✅ CASH / MORTGAGE / MIXED

**Problemas:**
- ❌ No aparece en ninguna navegación principal (bottom nav, dashboard quick access)
- ❌ Disconnected del journey comprador — debería aparecer como step natural cuando el usuario necesita financiamiento

---

## JOURNEY 2: VENDEDOR PRIMERA VEZ

### Estado actual: **INEXISTENTE**

El onboarding pregunta "¿Quiero vender?" pero después de seleccionar:
- El dashboard muestra una operación de COMPRA mock
- No hay flujo de alta de propiedad
- No hay Seller Pricing Intelligence
- No hay herramientas para el vendedor
- No hay flujo de publicación

**Gap crítico:** El journey del vendedor está 0% implementado en el MVP.

---

## RESUMEN: GAP ANALYSIS

### Rutas existentes — Clasificación V2

| Ruta | Estado actual | Clasificación V2 |
|------|--------------|-----------------|
| `/` | ✅ Dark premium landing | IMPROVE — más claro sobre qué es VARA |
| `/onboarding` | ⚠️ Flujo sin persistencia | EXTEND — agregar intent + URL propiedad |
| `/dashboard` | ⚠️ Todo mock, sin auth | EXTEND — multi-operation, real state |
| `/operacion/[id]` | ⚠️ Mock estático, 6 tabs sólidos | EXTEND — conectar a datos reales |
| `/propiedades` | ❌ Lista mock | REFACTOR — input URL real |
| `/propiedades/[id]` | ✅ AI staging funcionando | EXTEND — conectar a operación |
| `/costos` | ✅ Calculadora sólida | KEEP — minor improvements |
| `/asistente` | ❌ Solo keyword matching | REFACTOR → contextual AI panel |
| `/profesionales` | ❌ Lista mock sin función | REMOVE temporalmente o dejar placeholder |
| `/vara-labs` | ✅ Design premium | KEEP — clarificar qué está disponible |
| `/financiamiento` | ✅ Calculadora hipotecaria | EXTEND — conectar a journey comprador |

### Gaps críticos vs V2 (P0)

| Feature V2 P0 | Estado |
|--------------|--------|
| App Shell / Sidebar desktop | ❌ MISSING — solo bottom nav mobile |
| Auth / persistencia de sesión | ❌ MISSING — todo es demo sin estado |
| Buyer Golden Path end-to-end | ⚠️ Parcial — sin datos reales |
| Seller Golden Path end-to-end | ❌ MISSING — 0% implementado |
| Negotiation Intelligence | ❌ MISSING |
| Progressive onboarding con URL | ❌ MISSING |
| Next Best Action como motor | ⚠️ Existe en dashboard mock, no como motor real |
| Contextual VARA AI | ❌ MISSING — solo asistente standalone con keywords |
| Multi-operation support | ❌ MISSING — solo 1 mock hardcoded |
| Resume Experience | ❌ MISSING |
| Zero dead ends / empty states | ❌ MISSING — pantallas sin guía post-auth |
| Document Intelligence real | ❌ MISSING — solo display de docs mock |
| Risk Intelligence real | ⚠️ Calculado desde mock, no desde datos reales |

---

## DECISIONES DE IMPLEMENTACIÓN

### Orden sugerido (basado en customer impact):

1. **INMEDIATO:** Sidebar desktop V2 + responsive drawer mobile (FASE 6)
2. **INMEDIATO:** Progressive onboarding con campo URL + intent BUY vs SELL (FASE 7/8)
3. **CORTO PLAZO:** State management real (localStorage/DB) para persistir operación del usuario
4. **CORTO PLAZO:** Buyer Golden Path con datos del usuario (FASE 7)
5. **MEDIO PLAZO:** VARA AI contextual reemplazando `/asistente` (FASE 10)
6. **MEDIO PLAZO:** Seller Golden Path básico (FASE 8)
7. **LARGO PLAZO:** Negotiation Intelligence (FASE 10)

### Lo que NO tocar aún:
- Regulations engine (`/lib/regulations`) — sólido, bien estructurado
- Cost Intelligence calculations — funcionan correctamente
- OpenAI integration (`/api/transform`) — funciona, solo falta conectar al journey
- `/vara-labs` design — mantener como está

---

## PRÓXIMO PASO: FASE 6 — APP SHELL V2

Implementar el sidebar desktop antes de cualquier otra feature porque:
- Es la base de la navegación para todas las fases siguientes
- Los tabs contextuales de operación dependen del sidebar
- Sin sidebar, implementar BUY journey con 7+ sub-pantallas en bottom nav es imposible

Ver: CUSTOMER_JOURNEY_V2.md para los journeys completos V2.
