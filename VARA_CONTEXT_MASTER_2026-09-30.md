# VARA — CONTEXT MASTER
## Documento de Migración y Memoria Operativa
**Versión:** 1.0  
**Fecha:** 2026-09-30  
**Generado por:** Claude Code (claude-sonnet-4-6) sobre el repositorio `vara-altv3`  
**Propósito:** Memoria operativa completa para continuar el desarrollo de VARA en cualquier sesión de IA (Claude, ChatGPT, Codex, etc.) sin necesidad de contexto previo.

---

> **CONVENCIÓN DE ETIQUETAS** usada en todo el documento:
> - `[VERIFIED]` — Existe en el código y funciona. Verificado con grep/read sobre el repo.
> - `[IMPLEMENTED-NEEDS-VALIDATION]` — Existe en el código pero tiene bugs conocidos o datos mock mezclados con producción.
> - `[DESIGNED]` — Diseñado en documentos de producto pero no implementado aún.
> - `[FUTURE]` — En el roadmap pero sin diseño detallado.
> - `[EXTERNAL-NEEDS-REVERIFICATION]` — Dato externo (precios, APIs, regulaciones) que puede haber cambiado.

---

## ÍNDICE

1. [Resumen Ejecutivo y Objetivo](#1-resumen-ejecutivo-y-objetivo)
2. [Visión, Positioning y Tesis de Negocio](#2-visión-positioning-y-tesis-de-negocio)
3. [Arquitectura y Stack Tecnológico](#3-arquitectura-y-stack-tecnológico)
4. [Domain Model — Entidades Clave](#4-domain-model--entidades-clave)
5. [Estado Actual del Producto](#5-estado-actual-del-producto)
6. [Buyer Golden Path](#6-buyer-golden-path)
7. [Seller Golden Path](#7-seller-golden-path)
8. [Módulos de Inteligencia](#8-módulos-de-inteligencia)
9. [VARA Visit — Servicio Premium](#9-vara-visit--servicio-premium)
10. [VARA AI y Transaction Agent](#10-vara-ai-y-transaction-agent)
11. [LATAM Core y Jurisdiction Packs](#11-latam-core-y-jurisdiction-packs)
12. [Decisiones Clave y Reglas](#12-decisiones-clave-y-reglas)
13. [Bugs Conocidos P0/P1](#13-bugs-conocidos-p0p1)
14. [Data Moat y Knowledge Graph](#14-data-moat-y-knowledge-graph)
15. [Analytics y North Star Metrics](#15-analytics-y-north-star-metrics)
16. [UX/UI — Dirección y Paleta](#16-uxui--dirección-y-paleta)
17. [Deployment — Vercel + Supabase](#17-deployment--vercelsupabase)
18. [Claude Code Operating Workflow](#18-claude-code-operating-workflow)
19. [Reglas de Seguridad](#19-reglas-de-seguridad)
20. [Fundraising Narrative y Kaszek Sprint](#20-fundraising-narrative-y-kaszek-sprint)
21. [Freeze List — Lo que NO se toca ahora](#21-freeze-list--lo-que-no-se-toca-ahora)
22. [RealXpert Learnings](#22-realxpert-learnings)
23. [Pendientes Inmediatos](#23-pendientes-inmediatos)
24. [Glosario](#24-glosario)
25. [Bootstrap Prompt para Nueva Sesión de IA](#25-bootstrap-prompt-para-nueva-sesión-de-ia)

---

## 1. Resumen Ejecutivo y Objetivo

**VARA es un GPS inmobiliario** para comprar y vender propiedades en Argentina (con expansión a LATAM diseñada en la arquitectura). Guía a compradores y vendedores a través del ciclo completo de una operación inmobiliaria — desde el primer análisis hasta la escritura — con datos regulatorios reales, IA conversacional, y un servicio premium de visitas con acompañante profesional.

**El problema que resuelve:** Una operación inmobiliaria en Argentina dura entre 3 y 12 meses, involucra a 5-8 partes distintas (comprador, vendedor, escribano, agente, banco, agrimensor, gestor), requiere documentación compleja, y está llena de trampas legales y fiscales que el usuario no conoce. Las plataformas existentes (Zonaprop, MercadoLibre) se detienen en el anuncio. El resto del proceso queda en manos del mercado informal.

**La propuesta de VARA:** ser la capa de inteligencia sobre esa transacción — no un portal de anuncios, sino la plataforma que convierte un proceso opaco en uno navegable.

**Estado del repo actual:** `vara-altv3` — tercera generación, fusión de `vara-mvp` (VARA Visit completo, 80 tests) + `vara-alt` (diseño índigo, IA embebida). Deploy activo en Vercel.

**URL de producción:** `https://vara-altv3.vercel.app/` `[EXTERNAL-NEEDS-REVERIFICATION]`

---

## 2. Visión, Positioning y Tesis de Negocio

### 2.1 Positioning

- **Tagline actual:** "Tu GPS Inmobiliario" `[VERIFIED]`
- **Target primario:** Compradores y vendedores particulares que quieren entender y controlar su operación sin depender 100% de una inmobiliaria.
- **Diferenciador central:** Datos regulatorios reales (no estimados) + IA que conoce el proceso argentino + servicio físico verificado (VARA Visit).

### 2.2 Tesis de Desintermediación

`[DESIGNED]` La tesis no es eliminar a los profesionales (escribanos, abogados, gestores), sino eliminar la **opacidad** que obliga al usuario a depender de ellos para información básica. VARA provee contexto; los profesionales hacen el trabajo técnico. El usuario llega informado.

Analogía interna: lo que Pomelo hace por los pagos en LATAM — infraestructura de confianza sobre un sistema opaco — VARA lo hace por las transacciones inmobiliarias.

### 2.3 B2C → B2B Infrastructure

`[DESIGNED]` La visión de largo plazo no es solo un producto B2C. Una vez que VARA tiene suficientes transacciones reales, la plataforma se convierte en infraestructura para:
- Inmobiliarias que quieren dar inteligencia a sus clientes.
- Escribanos que quieren gestión documental.
- Bancos que quieren reducir el riesgo pre-hipotecario.

El B2C es el primer cliente y la fuente del data moat. El B2B es el modelo de escala.

### 2.4 Argentina Primero, México Segundo

`[DESIGNED]` La arquitectura tiene Jurisdiction Packs diseñados. Argentina (24 provincias, datos verificados) es el único país implementado. México es el segundo target nombrado en los docs. La expansión se habilita agregando un pack `mx.ts`, no modificando el core.

---

## 3. Arquitectura y Stack Tecnológico

### 3.1 Stack Confirmado `[VERIFIED]`

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Framework | Next.js | 16 | App Router. **BREAKING CHANGES** vs 14/15. Leer `node_modules/next/dist/docs/` antes de codear. |
| UI | React | 19 | Breaking changes también. |
| Estilos | Tailwind CSS | v4 | Rewrite completo vs v3. Nueva sintaxis. |
| Lenguaje | TypeScript | strict | `tsconfig.json` con strict mode activado. |
| DB/Auth | Supabase | v2 | PostgreSQL + Auth + Storage. RLS activado en todas las tablas. |
| ORM | Ninguno | — | Queries directas con Supabase JS client. |
| IA/LLM | OpenAI SDK | v7 | GPT-4o + DALL-E 3 / gpt-image-1. |
| Deploy | Vercel | — | `vercel.json` configurado. Sin Docker ni CI. |
| Tests | Vitest | v3 | 80 tests, todos de VARA Visit. Cero tests del core. |
| Icons | lucide-react | — | Sin component library (shadcn, MUI, etc.) — todo custom con Tailwind. |

### 3.2 Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=           # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Clave anon (o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
OPENAI_API_KEY=                     # Solo server-side. NUNCA en NEXT_PUBLIC_*
MELI_CLIENT_ID=                     # Opcional — comparables de MercadoLibre
MELI_CLIENT_SECRET=                 # Opcional
NEXT_PUBLIC_FLAGS=                  # Feature flags separados por coma (ej: docIntelligence,sharedTransaction)
```

### 3.3 Estructura de Carpetas

```
vara-altv3/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   ├── page.tsx            # Landing /
│   │   ├── layout.tsx          # Root layout con AppShell
│   │   ├── middleware.ts        # Refresh de sesión Supabase en cada request
│   │   ├── dashboard/          # Panel principal post-login
│   │   ├── operacion/[id]/     # Transaction Room (6 pestañas)
│   │   ├── propiedades/        # Lista y detalle de propiedades
│   │   ├── propiedades/[id]/   # Detalle de propiedad + Visual Intelligence
│   │   ├── asistente/          # Chat IA página completa
│   │   ├── negociacion/        # Coach de negociación IA
│   │   ├── vara-visit/         # Servicio premium landing
│   │   ├── vara-visit/solicitar/  # Solicitud de visita
│   │   ├── visit/[code]/       # Visit Mode para partners
│   │   ├── visit/[code]/reporte/  # Reporte post-visita
│   │   ├── costos/             # Calculadora regulatoria (24 provincias)
│   │   ├── financiamiento/     # Calculadora hipotecaria
│   │   ├── precios/            # Estrategia de precio (OCULTAR — datos inventados)
│   │   ├── publicar/           # Generación de aviso con IA
│   │   ├── ofertas/            # Gestión de ofertas (mock)
│   │   ├── visitas/            # Checklist de visita (comprador)
│   │   ├── mis-visitas/        # Visitas contratadas (VARA Visit)
│   │   ├── visitas-vendedor/   # Gestión de visitas (vendedor)
│   │   ├── profesionales/      # Directorio de profesionales
│   │   ├── guia/               # Guía paso a paso
│   │   ├── partner/            # Landing para partners
│   │   ├── partner/onboarding/ # Onboarding de partners (7 pasos)
│   │   ├── admin/visitas/      # Panel admin de visitas
│   │   ├── vara-labs/          # Features experimentales
│   │   ├── dinero/             # Hub costos + financiamiento
│   │   ├── acciones/           # Centro de acciones urgentes
│   │   └── api/                # 11 endpoints server-side
│   │       ├── chat/           # Chat VARA (GPT-4o)
│   │       ├── negotiation/    # Coach negociación (GPT-4o, 8 modos)
│   │       ├── listing-copy/   # Copy para publicaciones (GPT-4o)
│   │       ├── transform/      # Visual Intelligence (GPT-4o + DALL-E 3)
│   │       ├── comparables/    # Comparables desde MercadoLibre
│   │       ├── doc-intelligence/ # Análisis de escrituras PDF (GPT-4o)
│   │       ├── scrape-property/ # Scraping de portales
│   │       ├── visit/verify-pin/ # Verificación PIN VARA Visit
│   │       └── v1/operations/  # API pública v1 (feature flag: publicApi)
│   ├── components/
│   │   ├── layout/AppShell.tsx # Shell completo (sidebar + mobile nav)
│   │   ├── ai/VaraAIFloat.tsx  # Botón flotante de chat IA (en todas las páginas)
│   │   ├── guidance/           # Sistema de onboarding guided journey
│   │   ├── ui/                 # Átomos: Badge, Button, Progress, VaraLogo, InfoTip
│   │   ├── documents/          # OperationDocuments
│   │   ├── offers/             # OperationOffers, RealOffersPanel
│   │   ├── risks/              # OperationRisks
│   │   ├── activity/           # ActivityLedger
│   │   ├── money/              # CostosPanel, FinanciamientoPanel, PreciosPanel
│   │   ├── comparables/        # MarketComparison
│   │   ├── participants/       # OperationParticipants
│   │   └── visit/              # PartnerCard
│   ├── lib/
│   │   ├── supabase/           # Clientes y helpers por entidad
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server-side client
│   │   │   ├── operations.ts   # CRUD de operaciones
│   │   │   ├── properties.ts   # CRUD de propiedades
│   │   │   ├── visits.ts       # CRUD de visitas
│   │   │   ├── offers.ts       # CRUD de ofertas
│   │   │   ├── documents.ts    # CRUD de documentos
│   │   │   ├── candidates.ts   # Property candidates
│   │   │   ├── activity.ts     # Activity ledger
│   │   │   ├── photos.ts       # Fotos de propiedades
│   │   │   ├── visitPhotos.ts  # Fotos de visitas
│   │   │   └── visitsAdmin.ts  # Admin de visitas
│   │   ├── regulations.ts      # Motor regulatorio (fuente única)
│   │   ├── nba/engine.ts       # Next Best Action (determinístico, NO IA)
│   │   ├── risks/engine.ts     # Motor de detección de riesgos
│   │   ├── guidanceEngine.ts   # Motor de Guided Journey
│   │   ├── varaVisit/          # Lógica de VARA Visit (pricing, matching, session)
│   │   ├── jurisdiction/       # Packs por país: ar.ts, mx.ts
│   │   ├── flags/index.ts      # Feature flags
│   │   └── observability/logger.ts
│   ├── data/
│   │   ├── knowledge.ts        # Knowledge base para el chat (14 entradas)
│   │   ├── mock.ts             # mockTransaction, mockProperties (isMock: true)
│   │   ├── mockOfertas.ts      # Ofertas demo (isMockData: true, opt-in)
│   │   └── regulations/provinces.ts  # Datos regulatorios por provincia
│   └── types/                  # Tipos TypeScript globales
└── supabase/migrations/        # 12 migraciones SQL históricas
```

### 3.4 Base de Datos — Schema Principal `[VERIFIED]`

Tablas confirmadas en migraciones:

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario (role, is_admin) |
| `operations` | Operaciones inmobiliarias (BUY/SELL, status, country) |
| `tasks` | Tareas por operación (TODO/IN_PROGRESS/BLOCKED/DONE/NOT_APPLICABLE) |
| `documents` | Documentos por operación (PENDING/RECEIVED/IN_REVIEW/APPROVED/REJECTED/EXPIRED) |
| `properties` | Propiedades (con isMock, promoted_to_operation_id en diseño) |
| `risks` | Riesgos por operación (HIGH/MEDIUM/LOW, categorías: DOCUMENTAL/DOMINIAL/FISCAL/LEGAL/FINANCIERO/OPERATIVO) |
| `visit_bookings` | Reservas de VARA Visit |
| `visit_partners` | Partners verificados de VARA Visit |
| `property_candidates` | Propiedades candidatas que un comprador está evaluando |
| `offers` | Ofertas recibidas/enviadas |
| `activity_ledger` | Log de actividad por operación |
| `operation_participants` | Múltiples participantes por operación (comprador + vendedor) |
| `negotiations` | Sesiones de negociación con IA |

**RLS:** Activo en todas las tablas. El usuario solo ve sus propios datos.  
**is_admin():** Función SECURITY DEFINER. Admin ve todo.

### 3.5 Arquitectura Objetivo (No Implementada) `[DESIGNED]`

```
                    ┌─────────────────────────┐
                    │    VARA PLATFORM         │
                    │                          │
        ┌───────────┤  Core Layer              ├──────────┐
        │           │  - Domain Model          │          │
        │           │  - NBA Engine            │          │
        │           │  - Risk Engine           │          │
        │           │  - Regulation Engine     │          │
        │           └──────────┬───────────────┘          │
        │                      │                          │
  ┌─────▼──────┐    ┌──────────▼───────────┐   ┌─────────▼────┐
  │ Jurisdiction│    │  Intelligence Layer  │   │  AI Layer     │
  │ Packs       │    │  - Transaction Agent │   │  - Chat       │
  │  ar.ts      │    │  - Doc Intelligence  │   │  - Negotiation│
  │  mx.ts      │    │  - Visual Intel      │   │  - Listing    │
  │  (+ países) │    │  - Knowledge Graph   │   │  - Doc Anal.  │
  └─────────────┘    └──────────────────────┘   └──────────────┘
```

---

## 4. Domain Model — Entidades Clave

### 4.1 Property Candidate vs Operation `[DESIGNED]` (parcialmente `[IMPLEMENTED-NEEDS-VALIDATION]`)

**Este es uno de los conceptos más importantes y más incompleto del sistema.**

```
Property Candidate                    Operation
─────────────────                     ─────────
Una propiedad que el comprador        Una operación formal de compra/venta
está EVALUANDO. No hay                que ya tiene commitment. Tiene
compromiso todavía.                   partes, plazos, documentos, costos,
                                      y un resultado esperado.
Estados:
  ANALYZING                           Etapas:
  FAVORITE                              PREPARACION → OFERTA → RESERVA
  VISITED                               → BOLETO → ESCRITURA → CIERRE
  DISCARDED
  → PROMOTED (se convierte en Operation)
```

**Implementación actual:** La tabla `property_candidates` existe en el schema `[VERIFIED]`. La promoción `Candidate → Operation` (botón "Avanzar con esta propiedad") **no existe** como flujo. `[DESIGNED]`

**Decision Center** (pantalla donde se comparan candidatas): **no existe**. `[DESIGNED]`

### 4.2 Operation (Transaction Room) `[IMPLEMENTED-NEEDS-VALIDATION]`

La página `/operacion/[id]` existe con 6 pestañas:
- **Tareas** — Checklist de la etapa actual
- **Documentos** — Lista de requeridos (no se pueden subir aún)
- **Riesgos** — Categorías con severidad
- **Costos** — Motor regulatorio real
- **Timeline** — Etapas de la operación
- **Equipo** — Participantes (diseñado, no completamente implementado)

**Falta:** participantes con roles, activity ledger, deadlines, ofertas integradas, acción primaria visible (hoy hay 6 pestañas sin jerarquía de acción).

### 4.3 Multi-Operation `[DESIGNED]`

Un usuario puede tener múltiples operaciones en simultáneo. El dashboard debe mostrar el estado de todas. La tabla `operations` soporta esto con `user_id` + `status`. La UI del dashboard muestra operaciones activas. `[IMPLEMENTED-NEEDS-VALIDATION]`

### 4.4 Transaction Room `[DESIGNED]` / `[IMPLEMENTED-NEEDS-VALIDATION]`

El Transaction Room es el concepto de que `/operacion/[id]` sea el centro de comando donde comprador, vendedor y sus equipos ven el mismo estado de la operación. Hoy es single-user. La tabla `operation_participants` existe para soportar multi-user. `[VERIFIED]` pero sin UI de participantes real.

---

## 5. Estado Actual del Producto

### 5.1 Resumen por Módulo

| Módulo | Estado | Etiqueta |
|---|---|---|
| Build / TypeScript | ✅ Limpio | `[VERIFIED]` |
| Design System (atoms) | ✅ Consistente | `[VERIFIED]` |
| Motor Regulatorio (24 provincias) | ✅ Real y citado | `[VERIFIED]` |
| Chat IA (VARA Assistant) | ✅ GPT-4o real | `[VERIFIED]` |
| Onboarding (4 pasos) | ✅ Funciona | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Guided Journey / NBA | ⚠️ Corre sobre mock | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Dashboard | ⚠️ Fallback a mock | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Transaction Room | ⚠️ 6 tabs sin acción primaria | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Propiedades (lista) | ⚠️ Mock data | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Costos | 🔴 Precio hardcodeado | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Financiamiento | ⚠️ Tasas fijas sin fecha | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Visual Intelligence (transform) | ✅ Funciona | `[VERIFIED]` |
| Publicar (copy IA) | ⚠️ Genera copy, no publica | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Profesionales | 🔴 Recomendaciones ficticias | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Visitas (checklist) | 🔴 No persiste | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| VARA Visit (software) | ✅ Completo | `[VERIFIED]` |
| VARA Visit (red partners) | 🔧 Vacía — operación manual | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| Auth / Sesiones | ✅ Supabase Auth | `[VERIFIED]` |
| Negociación IA | ✅ 8 modos, GPT-4o | `[VERIFIED]` |
| Doc Intelligence | ✅ Gated por feature flag | `[VERIFIED]` |
| Ofertas | ❌ Solo mock opt-in | `[DESIGNED]` |
| Decision Center | ❌ No existe | `[DESIGNED]` |
| Activity Ledger | ❌ No existe en UI | `[DESIGNED]` |
| Subir documentos | ❌ No existe | `[DESIGNED]` |
| Precios / Comparables | ❌ OCULTAR (datos inventados) | `[DESIGNED]` |
| API pública v1 | ✅ Gated por feature flag | `[VERIFIED]` |

### 5.2 El Problema Principal `[IMPLEMENTED-NEEDS-VALIDATION]` — P0

> El motor de guía de VARA corre sobre datos ficticios, siempre.

```
src/hooks/useGuidance.ts:17
  const txn = mockTransaction
```

`useGuidance` alimenta al `GuidanceBanner` y al `GuiameButton`, que están en el `AppShell` — en **todas las pantallas**. El "próximo paso" que VARA le recomienda a un usuario real se calcula sobre una operación inventada de una casa en Pilar de USD 185.000. Esto no es un placeholder — es un **consejo falso**.

---

## 6. Buyer Golden Path

### Estado por paso (2026-09-24)

| Paso | Estado | Etiqueta |
|---|---|---|
| 1. Landing → entender VARA | ✅ | `[VERIFIED]` |
| 2. Onboarding → declarar intención | ⚠️ Precio inventado en costo inicial | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 3. Cargar propiedad (URL o manual) | ⚠️ Cadena existe; fallback UI falta | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 4. Analizar propiedad | ⚠️ Costos reales; riesgo sin operación no existe | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 5. Decision Center (comparar 3 propiedades) | ❌ NO EXISTE | `[DESIGNED]` |
| 6. Visitar (checklist propio) | ✅ | `[VERIFIED]` |
| 6b. Visitar (VARA Visit) | ✅ Software completo / 🔧 red vacía | `[VERIFIED]` |
| 7. Promover candidata a operación | ❌ El puente no existe | `[DESIGNED]` |
| 8. Transaction Room | ⚠️ 6 tabs / sin acción primaria | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 9. Subir documentos | ❌ No se puede subir nada | `[DESIGNED]` |
| 10. Ver riesgos | ⚠️ Qué y por qué / falta evidencia | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 11. Costos | ✅ Lo mejor del producto | `[VERIFIED]` |
| 12. Hacer oferta | ❌ No existe entidad Offer | `[DESIGNED]` |
| 13. Negociación | ❌ No existe | `[DESIGNED]` |
| 14. Profesionales | ⚠️ Datos reales / recomendaciones ficticias | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 15. Cierre | ⚠️ Tareas existen / sin deadlines reales | `[IMPLEMENTED-NEEDS-VALIDATION]` |

**Criterio de aprobación del golden path:** Una persona que nunca vio VARA, sin explicación, puede: cargar una propiedad, entender cuánto le sale, compararla con otra, decidir, crear la operación, subir un documento, entender un riesgo, pedir una visita, hacer una oferta, y volver a los 10 días sabiendo qué cambió.

**Hoy falla en: comparar, decidir, subir documento, ofertar, y volver.**

---

## 7. Seller Golden Path

### Estado por paso (2026-09-24)

| Paso | Estado | Etiqueta |
|---|---|---|
| 1. Landing → entender VARA para vendedor | ✅ | `[VERIFIED]` |
| 2. Onboarding → journey de venta | ⚠️ Switch funciona / precio inventado | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 3. Cargar su propiedad | ✅ Funciona | `[VERIFIED]` |
| 4. Preparar la propiedad | ⚠️ Tips reales / sin checklist de preparación | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 5. Visual Intelligence (transformar fotos) | ✅ Funciona / está enterrado en UI | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 6. Definir precio | ❌ OCULTAR — `/precios` usa datos inventados | `[DESIGNED]` |
| 7. Documentación del inmueble | ❌ Motor dice qué falta / no se puede subir | `[DESIGNED]` |
| 8. Publicación | ⚠️ Copy IA funciona / publicación es manual | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 9. Interesados y consultas | ❌ No existe | `[DESIGNED]` |
| 10. Visitas (VARA Visit para mostrar) | ✅ Software / 🔧 red vacía | `[VERIFIED]` |
| 11. Recibir oferta | ❌ No existe | `[DESIGNED]` |
| 12. Negociación | ❌ No existe | `[DESIGNED]` |
| 13. Profesionales | ⚠️ Datos reales / recomendaciones ficticias | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 14. Reserva y firma | ⚠️ Tareas existen / sin deadlines ni firma | `[IMPLEMENTED-NEEDS-VALIDATION]` |
| 15. Cierre | ⚠️ Checklist existe / sin confirmación real | `[IMPLEMENTED-NEEDS-VALIDATION]` |

**Hoy falla en: subir documentación, precio con fundamento, y recibir/responder ofertas.**

**Diferencia clave vendedor vs comprador:**
- Para el vendedor, Visual Intelligence es CRÍTICO (vender mejor), no exploratorio.
- VARA Visit tiene más valor para el vendedor (mostrar por él) que para el comprador.
- El precio es la decisión más importante del vendedor — y hoy se basa en datos inventados.

---

## 8. Módulos de Inteligencia

### 8.1 Next Best Action (NBA) Engine `[IMPLEMENTED-NEEDS-VALIDATION]`

```
src/lib/nba/engine.ts
src/lib/guidanceEngine.ts
```

**Principio de diseño:** El NBA es **intencionalmente NO IA**. El flujo inmobiliario tiene reglas determinísticas: si faltan documentos de la etapa 2, la siguiente acción es conseguirlos. No necesitamos un modelo para inferir eso.

**Estado actual:** El motor existe y calcula acciones priorizadas con evidencia. El **problema crítico** es que lo alimenta `mockTransaction` en lugar del estado real del usuario. `useGuidance.ts:17`.

**Diseño objetivo:** NBA lee de Supabase el estado real de la operación activa del usuario y calcula:
1. Acción bloqueante más urgente
2. Por qué es urgente (evidencia del estado real)
3. Cómo resolverla (link a la pantalla/acción específica)

### 8.2 Document Intelligence `[VERIFIED]` (gated por feature flag)

```
src/app/api/doc-intelligence/route.ts
Feature flag: docIntelligence
```

- Lee PDFs (escrituras, planos, libre deuda)
- Extrae: titulares, gravámenes (hipotecas, embargos), restricciones (usufructo, servidumbres)
- Genera alertas para revisión profesional
- Modelo: GPT-4o con visión

**Activar:** `NEXT_PUBLIC_FLAGS=docIntelligence`

### 8.3 Risk Engine `[IMPLEMENTED-NEEDS-VALIDATION]`

```
src/lib/risks/engine.ts
```

Detecta riesgos por categoría:
- DOCUMENTAL, DOMINIAL, FISCAL, LEGAL, FINANCIERO, OPERATIVO
- Cada riesgo tiene severidad (HIGH/MEDIUM/LOW), descripción y recomendación
- **Falta:** campo `evidence` (fuente/documento que genera el riesgo) y `status` (resuelto/abierto)

### 8.4 Cost Engine `[VERIFIED]`

```
src/lib/regulations.ts
src/data/regulations/provinces.ts
generateChecklist() — fuente única de costos
```

Lo más sólido del producto. Cubre las 24 provincias argentinas con:
- Impuesto de sellos (VERIFIED con fuentes ARBA/AGIP)
- Honorarios escribano
- Informes de dominio, inhibición, etc.
- Confianza calibrada: VERIFIED / PARTIAL / ESTIMATED por dato

**Problema actual:** En 6 lugares del código se pasa `185000` hardcodeado como precio cuando no hay propiedad cargada. Los costos se muestran como del usuario pero son de un precio inventado.

### 8.5 Negotiation Intelligence `[VERIFIED]`

```
src/app/api/negotiation/route.ts
src/app/negociacion/ (UI)
```

8 modos disponibles:
1. **prepare** — preparar la negociación
2. **reply** — redactar respuesta a oferta recibida
3. **analyze** — analizar la contraparte
4. **strategy** — construir estrategia
5. **call_prep** — preparar llamada
6. **offer** — redactar oferta inicial
7. **counter** — redactar contraoferta
8. **review** — analizar un acuerdo

**Regla crítica:** El precio de reserva (walk-away price) nunca aparece en ningún mensaje generado. El sistema lo conoce pero no lo revela.

**Principio:** Separar siempre **hecho** de **inferencia** de **recomendación** en los outputs.

### 8.6 Visual Intelligence `[VERIFIED]`

```
src/app/api/transform/route.ts
```

- Input: foto real de la propiedad
- Modelo: GPT-4o (análisis) + `gpt-image-1` con `input_fidelity: high`
- Modos: exterior paint, interior renovación, cocina, baño, jardín, vaciar ambiente
- Genera estimación de costos de renovación en USD
- **SIEMPRE marcado como "visualización generada con IA"**
- **Problema:** Está enterrado en `/propiedades/[id]` y en una pestaña de operación. El vendedor no lo encuentra cuando lo necesita (al preparar publicación).

### 8.7 Listing Copy Generator `[VERIFIED]`

```
src/app/api/listing-copy/route.ts
src/app/publicar/
```

- Input: datos de la propiedad (superficie, ambientes, zona, notas del dueño)
- Output: título + descripción para portales inmobiliarios
- Modelo: GPT-4o
- La publicación en portales es **manual** (VARA lo hace por fuera). El botón debe llamarse "Pedir publicación", no "Publicar ahora".

---

## 9. VARA Visit — Servicio Premium

### 9.1 Descripción

Un partner verificado de VARA acompaña físicamente al comprador o comprador en la visita a la propiedad. Deja un reporte estructurado. Tiene cadena de custodia verificada.

### 9.2 Estado del Software `[VERIFIED]`

El software está **completo** y fue construido en la iteración `vara-mvp`. Tiene 80 tests (todos pasan).

| Pieza | Estado |
|---|---|
| Modelo de datos (14 tablas, 3 planos de privacidad, RLS) | ✅ KEEP |
| Matching (filtros duros + ranking auditable, 27 tests) | ✅ KEEP |
| Precios (bandas centrales, suplementos, 22 tests) | ✅ KEEP |
| Visit Mode (check-in, PIN, checklist, check-out, 31 tests) | ✅ KEEP |
| Reporte de hechos | ✅ KEEP |
| Portal del partner + onboarding de 7 pasos | ✅ KEEP |
| Trust & Safety admin | ✅ KEEP |
| Reviews bilaterales + flags privados | ✅ KEEP |
| Subida de fotos en el reporte | ❌ `photoPaths` se guarda vacío |
| Contacto partner↔cliente tras asignación | 🔧 Manual — lo coordina VARA |
| Verificación de identidad del partner | 🔧 Manual — P0 para lanzar |
| Envío de pedidos de referencia | 🔧 Manual — sin emails automáticos |
| Pagos | `[FUTURE]` — requiere proveedor externo |

### 9.3 Seguridad y Chain of Custody `[VERIFIED]`

- PIN de verificación generado server-side
- Check-in con geolocalización y timestamp
- Checklist firmado digitalmente (timestamp Supabase)
- Reporte vinculado a la visita (inmutable post-check-out)
- RLS: solo dueño de la reserva + admin pueden ver el reporte
- Reviews bilaterales con flags privados (para moderación sin exponer al partner)

### 9.4 Red de Partners `[IMPLEMENTED-NEEDS-VALIDATION]`

La red está **vacía** en producción. Es explícito en la UI ("modo piloto"). Cada partner se incorpora de forma manual por ahora. Los 3 `DEMO_VISIT_PARTNERS` que existían fueron eliminados del árbol en `vara-altv2`.

**P0 para lanzar:** Verificación de identidad de partners (actualmente manual fuera de la plataforma).

### 9.5 Precios `[EXTERNAL-NEEDS-REVERIFICATION]`

Las bandas de precio de VARA Visit están en el código (`lib/varaVisit/pricing.ts`). Verificar que las bandas reflejen el mercado actual antes de lanzar.

---

## 10. VARA AI y Transaction Agent

### 10.1 VARA Chat Assistant `[VERIFIED]`

```
src/app/api/chat/route.ts
src/components/ai/VaraAIFloat.tsx
src/app/asistente/
```

- **Disponible en todas las páginas** como botón flotante (VaraAIFloat)
- **Página completa** en `/asistente`
- Modelo: GPT-4o
- **Persona:** Rioplatense. Directo. No recomienda terceros fuera de VARA. Solo navega dentro de la app.
- **Knowledge Base:** `src/data/knowledge.ts` — 14 entradas con conocimiento inmobiliario argentino
- **Contexto operativo:** Cuando el usuario está viendo una operación, se inyectan datos reales de Supabase como contexto antes del mensaje

### 10.2 Human-in-the-Loop `[DESIGNED]`

**Principio de diseño clave:** VARA no toma decisiones por el usuario. Informa, estructura, recomienda. La decisión es siempre del usuario.

Áreas donde el human-in-the-loop es explícito:
- Negociación: el precio de reserva no se revela; el usuario decide cuándo ceder
- Visual Intelligence: siempre marcado como "visualización generada con IA"
- Doc Intelligence: genera alertas, recomienda revisión profesional — no da veredictos
- NBA Engine: muestra la acción y la evidencia, el usuario decide ejecutar

### 10.3 Transaction Agent (Visión) `[FUTURE]`

El Transaction Agent es la evolución del Chat Assistant: un agente que no solo responde preguntas sino que puede tomar acciones dentro de la operación (crear tareas, actualizar estado de documentos, alertar sobre deadlines) con confirmación explícita del usuario.

No implementado. La infraestructura (Supabase, RLS, API routes) está preparada para recibirlo.

---

## 11. LATAM Core y Jurisdiction Packs

### 11.1 Arquitectura `[VERIFIED]` (parcialmente `[DESIGNED]`)

```
src/lib/jurisdiction/
  ar.ts    # Argentina — implementado
  mx.ts    # México — estructura base
```

La idea es que toda la lógica que depende del país viva en un "pack" de jurisdicción, no en el core. El core es agnóstico al país.

**Estado actual:** La separación no está 100% implementada. `src/lib/regulations.ts` mezcla core y Argentina. `src/lib/utils.ts` formatea en `es-AR`. `varaVisit.ts` tiene números de emergencia argentinos y `buildVisitCode` con `VIS-AR-` fijo.

**Roadmap:** Argentina (producción) → México (segundo país) → otros.

### 11.2 Argentina — Datos Regulatorios `[VERIFIED]`

- 24 provincias con datos de impuesto de sellos, honorarios notariales, informes de dominio
- Confianza calibrada: VERIFIED (fuente oficial) / PARTIAL (estimado con fuente) / ESTIMATED (sin fuente)
- CABA y Buenos Aires verificados con ARBA/AGIP (2026-09-13) `[EXTERNAL-NEEDS-REVERIFICATION]`
- `generateChecklist()` es la **única fuente de verdad para costos** — no duplicar este cálculo en ningún lado

---

## 12. Decisiones Clave y Reglas

### 12.1 Reglas Invariantes (No Negociar)

1. **`generateChecklist()` es la única fuente de costos.** Si una pantalla muestra costos, los toma de ahí. No hay cálculos paralelos.
2. **El NBA Engine es determinístico, no IA.** Las reglas del flujo inmobiliario no se infieren — se calculan.
3. **Human-in-the-loop siempre.** VARA informa, el usuario decide. Ninguna acción con consecuencias reales se ejecuta sin confirmación.
4. **El precio de reserva no sale de los outputs de negociación.** Nunca.
5. **No mostrar datos inventados como reales.** Si no hay datos reales, mostrar "No disponible" o no mostrar la sección.
6. **Visual Intelligence siempre etiquetada.** Ninguna imagen generada con IA se presenta sin el label visible.
7. **`isMock: true` en los datos de test.** Ningún dato mock puede llegar a un path de producción sin opt-in explícito del usuario.

### 12.2 Decisiones de Arquitectura

| Decisión | Elegido | Alternativa descartada |
|---|---|---|
| Property Candidate como entidad | Estado en `properties` + `promoted_to_operation_id` | Tabla nueva (migración más compleja) |
| Borrar `mockTransaction` | Desconectar de producción, preservar para tests | Borrar completamente |
| Jurisdiction packs ahora | No — diseñar para el futuro, construir para el presente | Refactorizar todo a packs ya |
| Unificar 3 pantallas de dinero | No en esta fase — P1 | Refactor de UI sin ganancia funcional |
| `/precios` con datos inventados | OCULTAR hasta tener datos reales | Mostrar con disclaimer |
| Sin ORM | Queries directas Supabase JS | Prisma (overhead innecesario para este schema) |

### 12.3 Freezes Anteriores (Decisiones tomadas, no discutir)

- **Alquiler:** No existe. No se implementa. `grep -i "alquiler|rental|rent"` no devuelve funcionalidad. Por diseño.
- **VARA Visit está completo:** No refactorizar el software de VARA Visit. Está testeado y funciona.
- **RLS es la fuente de seguridad de datos:** No agregar lógica de filtrado en el frontend como sustituto.

---

## 13. Bugs Conocidos P0/P1

### P0 — Daño Real al Usuario

| # | Archivo:Línea | Problema | Impacto |
|---|---|---|---|
| P0-1 | `useGuidance.ts:17` | NBA corre sobre `mockTransaction` siempre | El consejo de VARA es ficticio en todas las pantallas |
| P0-2 | `profesionales/page.tsx:14-18` | "Tu operación necesita X" calcula desde `mockTransaction` | Recomendación de profesional falsa |
| P0-3 | — | Property Candidate y Transaction son lo mismo | No se puede analizar sin comprometerse |
| P0-4 | — | No se puede subir ningún documento | Flujo de documentación no existe |
| P0-5 | — | Entidad `Offer` no existe | No se puede hacer ni recibir una oferta real |
| P0-6 | `precios/page.tsx` | Comparables de precio son de `mockPreciosMercado.ts` | Afirmación falsa sobre precios de mercado |
| P0-7 | `costos/page.tsx:14` | `useState(185000)` — precio no editable | Costos del onboarding sobre precio inventado |

### P1 — Fricción Significativa

| # | Archivo:Línea | Problema |
|---|---|---|
| P1-1 | `publicar/page.tsx:75` | `handlePublish` solo setea estado local |
| P1-2 | `publicar/page.tsx:264` | Botón de fotos sin handler |
| P1-3 | `profesionales/page.tsx:142` | Botón "Contactar" sin onClick |
| P1-4 | `visitas/page.tsx` | Checklist no persiste al refrescar |
| P1-5 | `asistente/page.tsx` | Historial de chat en `useState` — se pierde al navegar |
| P1-6 | `propiedades/[id]/page.tsx:33` | Fallback silencioso a `prop-001` si ID no existe |
| P1-7 | `vara-visit/solicitar/page.tsx:71` | "Enviar solicitud" no envía nada |
| P1-8 | `onboarding/page.tsx:18` | `'Rosario'` mapeada silenciosamente a `BUENOS_AIRES` — debería ser `Santa Fe` |

### Hardcoded que deben centralizarse

| Archivo:Línea | Valor | Correcto sería |
|---|---|---|
| `costos/page.tsx:14` | `185000` | `property.price` del usuario |
| `financiamiento/page.tsx:23` | `185000` | Mismo precio que costos |
| `financiamiento/page.tsx:36` | `price * 0.035` | `generateChecklist()` de regulations |
| `dashboard/page.tsx:243` | `'USD 1.200 – 2.100 / m²'` | Dato real o "No disponible" |
| `dashboard/page.tsx:535` | `'30–60 días'` | Calculado del estado real |
| `financiamiento/page.tsx:11-14` | Tasas bancarias fijas | Agregar "última actualización" visible |

---

## 14. Data Moat y Knowledge Graph

`[DESIGNED]`

### 14.1 Tesis del Data Moat

Cada operación real que VARA procesa genera datos que ningún competitor tiene:
- Tiempos reales por etapa por provincia
- Qué documentos realmente traban las operaciones
- Correlación entre tipo de riesgo y resolución
- Patrones de negociación (sin PII)
- Qué preguntas hacen los usuarios antes de cada decisión

A escala, esto genera un **Knowledge Graph inmobiliario** que permite:
- Predecir tiempos de cierre
- Calibrar probabilidades de éxito por tipo de operación
- Mejorar el NBA Engine con datos reales
- Ofertas de datos B2B (bancos, aseguradoras, proptech)

### 14.2 Infraestructura Actual para el Data Moat

- `activity_ledger` — log de eventos por operación `[VERIFIED]`
- `negotiations` — sesiones de negociación `[VERIFIED]`
- `visit_events` — eventos de VARA Visit `[VERIFIED]`
- RLS garantiza que los datos son del usuario, no accesibles sin permiso

**Gap:** No hay eventos de dominio generales (qué pantallas ve el usuario, en qué paso abandona, qué preguntas hace al chat). Cero instrumentación fuera de VARA Visit.

---

## 15. Analytics y North Star Metrics

`[DESIGNED]` `[EXTERNAL-NEEDS-REVERIFICATION]`

### 15.1 North Star Propuesta

**Operaciones activas con al menos una acción tomada en los últimos 7 días.**

Razonamiento: Una operación activa en la que el usuario está tomando acciones reales (no solo visitando) es el indicador más claro de que VARA está entregando valor. El engagement pasivo (visitas al dashboard sin acciones) no cuenta.

### 15.2 Métricas de Soporte

| Métrica | Por qué importa |
|---|---|
| Operaciones creadas / semana | Volumen de adquisición |
| % operaciones con ≥ 1 documento subido | Profundidad de uso |
| % operaciones con consulta al chat | Engagement con IA |
| VARA Visit bookings confirmadas | Revenue potential |
| Tiempo promedio entre etapas | Calidad del guidance |
| Tasa de regreso (D7, D30) | Retención |

---

## 16. UX/UI — Dirección y Paleta

### 16.1 Dirección General `[VERIFIED]`

- **Paleta principal:** Índigo (`indigo-*`) sobre fondos oscuros (`zinc-900`, `zinc-950`)
- **Sin component library:** Todo es custom con Tailwind v4
- **Mobile-first:** Bottom nav en mobile, sidebar en desktop
- **AppShell** envuelve toda la app. Es auth-aware (muestra/oculta según sesión)

### 16.2 Componentes Átomo `[VERIFIED]`

```
src/components/ui/
  Badge.tsx      — estado y etiquetas
  Button.tsx     — (inferido del AppShell y páginas)
  Progress.tsx   — barras de progreso
  VaraLogo.tsx   — logo
  InfoTip.tsx    — tooltips de contexto
```

### 16.3 Principios de UX Establecidos

- **Una acción primaria por pantalla.** El usuario no debería tener que elegir entre 6 opciones.
- **El estado visible sin navegar.** El dashboard debe decir qué cambió, no solo mostrar listas.
- **Empty states productivos.** Si no hay datos, hay un CTA claro de qué hacer.
- **La IA no reemplaza la acción.** Cada output de IA debe llevar a una acción concreta del usuario.

### 16.4 Problemas de UX Conocidos

- Transaction Room: 6 pestañas sin jerarquía de acción. El usuario elige pestaña, no acción siguiente.
- Visual Intelligence: enterrado en `/propiedades/[id]`. El vendedor no lo encuentra al preparar publicación.
- `/visitas` y `/mis-visitas` tienen el mismo nombre conceptual pero son cosas distintas (checklist propio vs visita contratada). Confunde.
- Landing: positioning débil. No diferencia claro vs portal de búsqueda.

---

## 17. Deployment — Vercel + Supabase

### 17.1 Configuración Confirmada `[VERIFIED]`

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build"
}
```

- **URL de producción:** `https://vara-altv3.vercel.app/` `[EXTERNAL-NEEDS-REVERIFICATION]`
- **Sin Docker.** Sin CI/CD (GitHub Actions). Sin pipeline de tests automático.
- **Deploy:** Push a `main` → Vercel build automático.

### 17.2 Supabase `[VERIFIED]`

- 12 migraciones SQL en `/supabase/migrations/`
- Las migraciones **no se aplican automáticamente** en dev local. Hay que aplicarlas manualmente en el dashboard de Supabase o con `supabase db push`.
- Supabase Storage: buckets para fotos de propiedades y fotos de visitas.

### 17.3 Scripts Disponibles

```bash
npm run dev         # Next.js dev server
npm run build       # Build producción
npm run start       # Start producción
npm run lint        # ESLint
npm run test        # Vitest run (una vez)
npm run test:watch  # Vitest watch
```

### 17.4 Riesgos de Deploy

- Sin CI: un push de código roto va directo a producción.
- Sin rollback automatizado.
- `OPENAI_API_KEY` es server-side — no exponer con `NEXT_PUBLIC_*` nunca.
- Next.js 16 y React 19 son versiones muy nuevas — los breaking changes pueden sorprender.

---

## 18. Claude Code Operating Workflow

### 18.1 Reglas del Repo (`AGENTS.md`) `[VERIFIED]`

```
# This is NOT the Next.js you know
Breaking changes — leer node_modules/next/dist/docs/ antes de codear.
```

### 18.2 Flujo de Trabajo Recomendado para Claude Code

1. **Antes de tocar cualquier archivo de Next.js:** leer `node_modules/next/dist/docs/` para la API específica.
2. **Antes de modificar lógica de costos:** verificar que `generateChecklist()` sigue siendo la fuente única.
3. **Antes de modificar la DB:** revisar RLS activo en la tabla afectada.
4. **Para features nuevas:** crear en rama `feature/xxx`, no en `main`.
5. **Para bugs P0:** verificar con `grep` sobre el repo antes de asumir el scope del cambio.
6. **Nunca:** agregar lógica de negocio en páginas (`app/*/page.tsx`). Debe ir en `lib/`.
7. **Nunca:** pasar `OPENAI_API_KEY` a una variable `NEXT_PUBLIC_*`.
8. **Nunca:** hacer `push` a `main` sin confirmar que el build pasa (`npm run build`).

### 18.3 Coordinación Claude Code + Codex

| Tarea | Agente recomendado |
|---|---|
| Arquitectura, lógica de negocio, DB, seguridad | Claude Code |
| Generación de UI, componentes nuevos, estilos Tailwind | Codex |
| Refactors de `lib/` | Claude Code |
| Tests unitarios | Codex |
| Revisión final antes de merge | Claude Code |
| Iteraciones rápidas de UX | Codex |

**Regla de coordinación:** Antes de que cualquier agente toque un archivo, debe verificar que no está en la lista de zonas de alta sensibilidad (ver abajo).

### 18.4 Zonas de Alta Sensibilidad (No Modificar Sin Revisión Humana)

```
src/lib/nba/engine.ts              # Lógica NBA determinística
src/lib/risks/engine.ts            # Detección de riesgos
src/lib/regulations.ts             # Motor regulatorio
src/data/regulations/provinces.ts  # Datos regulatorios por provincia
src/lib/varaVisit/                 # Todo VARA Visit (80 tests)
supabase/migrations/               # Migraciones de DB
src/middleware.ts                  # Auth middleware
```

---

## 19. Reglas de Seguridad

### 19.1 Reglas Invariantes

1. **RLS es la fuente de seguridad de datos.** No filtrar en el frontend como sustituto.
2. **`OPENAI_API_KEY` nunca en `NEXT_PUBLIC_*`.** Solo server-side.
3. **`is_admin()` es SECURITY DEFINER.** No replicar esta función — usarla.
4. **Validar inputs en API routes.** Los endpoints de IA son server-side pero reciben inputs del browser.
5. **Rate limiting en endpoints de IA.** `[DESIGNED]` — no implementado aún.
6. **PII en negociación.** El sistema conoce el precio de reserva del usuario. Este dato **nunca sale** en outputs al otro lado de la negociación.

### 19.2 Feature Flags de Seguridad

```
NEXT_PUBLIC_FLAGS=docIntelligence   # Activa análisis de escrituras (PDF con PII)
NEXT_PUBLIC_FLAGS=publicApi         # Activa API pública v1
NEXT_PUBLIC_FLAGS=sharedTransaction # Activa Transaction Room multi-usuario
```

Estos flags están desactivados por default. Activar solo cuando estén validados.

---

## 20. Fundraising Narrative y Kaszek Sprint

`[EXTERNAL-NEEDS-REVERIFICATION]` — Este contexto viene de chats previos fuera del repo. Verificar antes de usar en contexto de inversores.

### 20.1 Narrativa Base

- **Problema:** La operación inmobiliaria en LATAM es opaca, lenta y cara. Los portales de búsqueda se detienen en el anuncio.
- **Solución:** VARA es la capa de inteligencia sobre la transacción — GPS para la parte más compleja del proceso.
- **Mercado:** Argentina como laboratorio (complejidad regulatoria = caso de prueba difícil). LATAM como escala.
- **Tesis de defensibilidad:** Data moat (transacciones reales + patrones de negociación) + red de partners VARA Visit + confianza regulatoria acumulada.
- **Analogía:** Pomelo para pagos → VARA para transacciones inmobiliarias.

### 20.2 Kaszek 45-60 Day Readiness Sprint `[EXTERNAL-NEEDS-REVERIFICATION]`

El objetivo del sprint es tener evidencia suficiente para una conversación con Kaszek (u otro fondo LATAM). Evidencia que importa:
- Operaciones reales creadas (no mocks)
- Al menos 1 VARA Visit realizada con reporte completo
- Regulatory engine citado y verificado
- Buyer golden path completo de punta a punta
- Cohort de usuarios reales (aunque sea pequeño)

**Métricas mínimas para la conversación:** `[EXTERNAL-NEEDS-REVERIFICATION]`
- ≥ 10 operaciones activas reales
- ≥ 1 VARA Visit realizada
- NPS > 50 en usuarios que completaron el golden path

---

## 21. Freeze List — Lo que NO se toca ahora

Esta lista viene de decisiones explícitas en los documentos de producto. No discutir en esta fase.

| Ítem | Razón del freeze |
|---|---|
| Alquiler | Fuera del scope de VARA. Por diseño, no por omisión. |
| Jurisdiction Packs (refactor completo) | "Diseñar para el futuro, construir para el presente" |
| Unificación de `/costos` + `/financiamiento` + `/precios` | Refactor de UI sin ganancia funcional inmediata |
| Pagos en VARA Visit | Requiere proveedor externo. P2/P3. |
| Firma digital | Requiere proveedor legal externo. P3. |
| Interesados y consultas del vendedor | No hay API de portales disponible. P2. |
| Comparables de precio (/precios) | OCULTAR hasta tener datos reales. No construir sobre mock. |

---

## 22. RealXpert Learnings

`[EXTERNAL-NEEDS-REVERIFICATION]` — Contexto de experiencia previa en el sector inmobiliario que informa el diseño de VARA.

Lecciones clave que aplican al diseño:

1. **La documentación es el cuello de botella más frecuente.** No los costos, no el precio. Los documentos que falta tramitar frenan más operaciones que cualquier otra cosa.
2. **El comprador no entiende las etapas.** "Reserva vs boleto vs escritura" no es intuitivo. Necesita traducción constante.
3. **El escribano es el árbitro real.** Su disponibilidad y criterio determinan el timeline más que cualquier otra parte.
4. **La negociación es emocional.** Los compradores dejan operaciones buenas por no manejar bien una contraoferta.
5. **La opacidad beneficia al que sabe.** El vendedor profesional (inmobiliaria) siempre sabe más que el comprador particular. VARA invierte esa asimetría.

---

## 23. Pendientes Inmediatos

### Sprint Actual (post 2026-09-30)

**P0 — Hacer antes de cualquier demo a usuarios reales:**

- [ ] Desconectar `mockTransaction` de `useGuidance.ts:17` — conectar al estado real del usuario
- [ ] Desconectar `mockTransaction` de `profesionales/page.tsx:14-18`
- [ ] Desconectar `mockTransaction` del fallback de `dashboard/page.tsx:578`
- [ ] Ocultar `/precios` o agregar disclaimer explícito de datos no reales
- [ ] Conectar NBA Engine a estado real de Supabase

**P1 — Antes de lanzamiento público:**

- [ ] Decision Center (comparar Property Candidates)
- [ ] Flujo `Candidate → Operation` (botón "Avanzar con esta propiedad")
- [ ] Subir documentos (UI + Storage)
- [ ] Activity Ledger en UI de operación
- [ ] Persistir checklist de visita (`visitas/page.tsx`)
- [ ] Persistir historial del chat en Supabase
- [ ] Entidad `Offer` completa (hacer/recibir/contraofertar)
- [ ] Fix `onboarding/page.tsx:18` — Santa Fe mal mapeada
- [ ] Renombrar botón "Publicar ahora" → "Pedir publicación"
- [ ] Agregar CI básico (GitHub Actions: lint + test en PR)

**P2 — Para el sprint Kaszek:**

- [ ] Instrumentación básica (qué pantallas ve el usuario, dónde abandona)
- [ ] Rate limiting en endpoints de IA
- [ ] Error states descriptivos en todos los flujos
- [ ] Empty states productivos con CTA en módulos sin datos
- [ ] Visual Intelligence reubicado en el flujo de publicación del vendedor

---

## 24. Glosario

| Término | Definición |
|---|---|
| **Operación** | Proceso formal de compra o venta de una propiedad. Tiene etapas, partes, documentos, costos y un resultado. En el código: tabla `operations`. |
| **Property Candidate** | Propiedad que un comprador está evaluando. No hay compromiso. Puede estar en `ANALYZING`, `FAVORITE`, `VISITED`, `DISCARDED`, o `PROMOTED`. |
| **Transaction Room** | El centro de comando de una operación activa. En el código: `/operacion/[id]`. |
| **NBA (Next Best Action)** | La siguiente acción más importante que el usuario debe tomar en su operación, calculada determinísticamente por el estado real de tareas, documentos y riesgos. |
| **VARA Visit** | Servicio premium: un partner verificado acompaña al comprador o vendedor en una visita física. Tiene PIN, checklist, reporte y cadena de custodia. |
| **Partner** | Profesional verificado por VARA que realiza visitas físicas como parte del servicio VARA Visit. |
| **Jurisdiction Pack** | Módulo de código que contiene toda la lógica específica de un país (impuestos, regulaciones, formatos, números de emergencia). Hoy: `ar.ts`, `mx.ts` (incompleto). |
| **Golden Path** | El flujo de punta a punta que un comprador o vendedor debe poder completar sin explicación. El criterio de calidad del producto. |
| **Data Moat** | La ventaja competitiva acumulada a partir de datos de transacciones reales que ningún competitor puede replicar fácilmente. |
| **Walk-away price** | El precio mínimo/máximo aceptable en una negociación. VARA lo conoce para dar consejos, pero nunca lo revela en outputs. |
| **Reserva** | Primera etapa formal de compromiso: seña + contrato de reserva. Anterior al boleto. |
| **Boleto** | Contrato de compraventa privado. Obligatorio antes de la escritura en Argentina. |
| **Escritura** | Documento público ante escribano que transfiere la propiedad. Etapa final de la operación. |
| **RLS** | Row-Level Security. Política de Supabase que garantiza que cada usuario solo ve sus propios datos. |
| **Feature Flag** | Variable de entorno que activa/desactiva features en producción. En VARA: `NEXT_PUBLIC_FLAGS`. |
| **ARBA** | Agencia de Recaudación de la Provincia de Buenos Aires. Fuente de datos de impuesto de sellos. |
| **AGIP** | Administración Gubernamental de Ingresos Públicos de CABA. Fuente de datos fiscales de CABA. |
| **Pomelo** | Analogía de negocio: fintech que construyó infraestructura de pagos para LATAM. VARA aspira a ser eso para transacciones inmobiliarias. |

---

## 25. Bootstrap Prompt para Nueva Sesión de IA

Copiá y pegá este bloque al inicio de cualquier nueva sesión de IA (Claude, ChatGPT, etc.) para restaurar el contexto completo de VARA:

---

```
Sos el AI assistant de VARA, una plataforma de inteligencia para transacciones 
inmobiliarias en Argentina (con expansión LATAM diseñada). Repositorio: vara-altv3.

VARA es un "GPS Inmobiliario": guía a compradores y vendedores a través de todo 
el ciclo de una operación (reserva → boleto → escritura) con datos regulatorios 
reales, IA conversacional y un servicio premium de visitas físicas verificadas.

STACK CONFIRMADO (no asumir compatibilidad con versiones anteriores):
- Next.js 16 (App Router, breaking changes vs 14/15)
- React 19 (breaking changes)
- Tailwind CSS v4 (rewrite completo vs v3)
- Supabase v2 (PostgreSQL + Auth + Storage, sin ORM)
- OpenAI SDK v7 (GPT-4o + gpt-image-1)
- TypeScript strict mode
- Vercel deploy (sin Docker ni CI)

ESTADO DEL PRODUCTO (2026-09-30):
- Motor regulatorio para 24 provincias argentinas: FUNCIONA, es la joya del producto
- VARA Visit (visitas con partner físico): SOFTWARE COMPLETO, 80 tests
- Chat IA + Negociación IA + Visual Intelligence + Doc Intelligence: FUNCIONAN
- NBA Engine, Risk Engine, Cost Engine: FUNCIONAN pero algunos corren sobre mock
- Decision Center, Subir documentos, Entidad Offer, Activity Ledger: NO EXISTEN AÚN
- Auth (Supabase): FUNCIONA

PROBLEMA CRÍTICO P0 (no olvidar nunca):
useGuidance.ts:17 → const txn = mockTransaction
El NBA de VARA corre sobre una operación ficticia para TODOS los usuarios.
El consejo que VARA da en TODAS las pantallas es inventado.
Esto debe corregirse antes de cualquier demo a usuarios reales.

REGLAS INVARIANTES:
1. generateChecklist() es la única fuente de costos. No duplicar.
2. NBA Engine es determinístico, no IA. Las reglas del flujo no se infieren.
3. Human-in-the-loop siempre. VARA informa, el usuario decide.
4. El precio de reserva del usuario NUNCA sale en outputs de negociación.
5. No mostrar datos inventados como reales. Si no hay datos → "No disponible".
6. Visual Intelligence siempre etiquetada como generada con IA.
7. OPENAI_API_KEY nunca en NEXT_PUBLIC_* (solo server-side).
8. RLS es la fuente de seguridad de datos, no lógica en el frontend.

ZONAS SENSIBLES (no modificar sin revisión humana):
- src/lib/nba/engine.ts
- src/lib/risks/engine.ts
- src/lib/regulations.ts
- src/data/regulations/provinces.ts
- src/lib/varaVisit/ (todo)
- supabase/migrations/
- src/middleware.ts

FREEZE LIST (no discutir en esta fase):
- Alquiler: fuera del scope por diseño
- Jurisdiction Packs (refactor completo): P3
- Unificación pantallas de dinero: P1 (no ahora)
- Pagos VARA Visit: requiere proveedor externo
- /precios: OCULTAR hasta tener datos reales

Para contexto completo, leer:
VARA_CONTEXT_MASTER_2026-09-30.md en el root del repo.

Antes de cualquier cambio:
1. Leer node_modules/next/dist/docs/ para la API de Next.js 16 específica
2. Verificar con grep que el cambio no rompe las reglas invariantes
3. Para bugs P0/P1, citar archivo y línea antes de proponer fix
4. No agregar lógica de negocio en páginas (app/*/page.tsx) — va en lib/
```

---

**Fin del documento.**

*Generado el 2026-09-30 por Claude Code sobre el repositorio vara-altv3.*  
*Para actualizar este documento: editar directamente y subir versión en el changelog.*

**Changelog:**
| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-09-30 | Creación inicial a partir de inspección completa del repo + documentos de producto |
