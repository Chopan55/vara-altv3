# VARA — Informe de Sesión Completo
> Generado: 2026-09-17 · Cubre sesiones anteriores + sesión actual

---

## 1. PROYECTO

**Nombre:** VARA — Tu GPS Inmobiliario  
**Repositorio local:** `C:\Users\falon\Documents\Obsidian Vault\Plataforma Real State`  
**Deploy:** https://propos-mvp.vercel.app  
**Vercel project:** `fichap1/propos-mvp`  
**Owner:** Francisco Alonso-Hidalgo (FAH / Pancho)

---

## 2. TECH STACK

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js (App Router) |
| UI | React + TypeScript strict |
| Estilos | Tailwind v4 (config en `globals.css` con `@theme`) |
| Tipografía | Inter (Google Fonts) |
| Iconos | Lucide React |
| IA — Visión | OpenAI GPT-4o Vision |
| IA — Imagen | DALL-E 3 |
| Deploy | Vercel CLI (`npx vercel --prod --yes`) |
| Estado cliente | localStorage (sin auth aún) |

**Variables de entorno Vercel (producción):**
- `OPENAI_API_KEY` — configurada en Vercel production environment

---

## 3. ESTRUCTURA DE RUTAS ACTUAL

```
src/app/
├── page.tsx                    # Landing page — dark premium design
├── layout.tsx                  # Root layout — usa AppShell
├── globals.css                 # Tailwind + brand tokens (amarillo #FFD200)
├── onboarding/page.tsx         # Onboarding 4 pasos con localStorage
├── dashboard/page.tsx          # Dashboard con greeting personalizado
├── operacion/[id]/page.tsx     # Operación con 6 tabs (mock)
├── propiedades/page.tsx        # Lista de propiedades
├── propiedades/[id]/page.tsx   # AI staging con OpenAI
├── costos/page.tsx             # Calculadora de costos regulatorios
├── financiamiento/page.tsx     # Calculadora hipotecaria (4 bancos)
├── asistente/page.tsx          # Asistente keyword-based (legacy)
├── profesionales/page.tsx      # Red de profesionales (mock)
├── vara-labs/page.tsx          # Showcase de features en desarrollo
└── api/
    └── transform/route.ts      # API: GPT-4o Vision + DALL-E 3

src/components/
├── layout/
│   ├── AppShell.tsx            # NUEVO — Sidebar desktop + drawer mobile
│   └── BottomNav.tsx           # Legacy — ya no se usa en páginas
├── ui/
│   ├── VaraLogo.tsx
│   ├── Badge.tsx
│   ├── Button.tsx
│   └── Progress.tsx

src/hooks/
└── useVaraState.ts             # NUEVO — Lee localStorage (nombre, journey, etc.)

src/lib/
├── regulations.ts              # Motor regulatorio por provincia
└── utils.ts

src/data/
├── mock.ts                     # mockTransaction (demo data)
└── regulations/
    └── types.ts

src/types/
└── index.ts
```

---

## 4. HISTORIAL DE SESIONES — TODO LO HECHO

### SESIÓN ANTERIOR (antes de este chat)

#### Features P2-P4 implementadas:
1. **`/vara-labs`** — página dark premium con 10 capacidades en 3 grupos (Available / En desarrollo / Investigando)
2. **`/propiedades/[id]`** — integración real con OpenAI (GPT-4o Vision + DALL-E 3), drag-and-drop, before/after
3. **`/financiamiento`** — calculadora hipotecaria con Banco Nación (9.5%), Banco Provincia (10.2%), Santander (11.0%), BBVA (10.8%)
4. **`BottomNav.tsx`** — cambiado último tab de `DollarSign`/`/costos` → `Sparkles`/`/vara-labs` (Labs)
5. **`/propiedades`** — agregado botón "Visualizá" en amber

#### API `/api/transform/route.ts`:
- POST body: `{ imageBase64: string, mimeType: string }`
- Response: `{ roomType, currentState, potentialScore, recommendations, transformedImageUrl }`
- Fix aplicado: `imageGen.data?.[0]?.url ?? ''` para TypeScript strict

#### Landing page `/` — reescritura total:
- Antes: blanca/flat, inconsistente con el resto
- Ahora: dark premium (`bg-slate-950`), Google Fonts Plus Jakarta Sans
- Elementos: gradient amber text "sin sorpresas", mockup de browser embebido, stats (24/6/IA/0), 3 feature cards con hover, trust quote, CTA con amber gradient border
- CSS custom: `.gradient-text`, `.card-glow`, `.hero-glow`, `.feature-line`

#### Deploy ejecutado:
- OPENAI_API_KEY agregada a Vercel production via `npx vercel env add`
- Deploy: `npx vercel --prod --yes`

---

### SESIÓN ACTUAL (2026-09-17)

#### PASO 0 — Guardar contexto estratégico V2

El usuario entregó el **VARA Product & UX Evolution V2** — documento de 100 secciones con la dirección estratégica completa del producto.

**Guardado en memoria:** `memory/vara-v2-vision.md`

**Principios clave del V2:**
- LA COMPLEJIDAD DEBE VIVIR EN VARA, NO EN LA CABEZA DEL USUARIO
- Customer Journey > Features (diseñar alrededor del usuario, no de módulos)
- TRUST > MAGIC (nunca inventar datos, etiquetar siempre FACT/ESTIMATE/INFERENCE)
- Zero dead ends — cada pantalla tiene NEXT ACTION
- NO reconstruir VARA, EVOLUCIONAR VARA (clasificar: KEEP/IMPROVE/EXTEND/REFACTOR/REMOVE)

---

#### FASE 0 — Auditoría del producto

Documento creado: `CUSTOMER_JOURNEY_AUDIT.md`

**Hallazgos críticos:**

| Problema | Severidad |
|----------|-----------|
| Dashboard muestra datos de "Francisco" (mock) a todos | CRÍTICO |
| Journey vendedor 0% implementado | CRÍTICO |
| Sin auth/persistencia — todo se pierde al cerrar | CRÍTICO |
| Asistente solo hace keyword matching, no IA real | ALTO |
| Sidebar desktop faltante (solo bottom nav mobile) | ALTO |
| Financiamiento no aparece en navegación principal | MEDIO |
| Propiedades/[id] desconectada del journey principal | MEDIO |

**Clasificación de rutas:**

| Ruta | Clasificación |
|------|--------------|
| `/` | IMPROVE |
| `/onboarding` | EXTEND |
| `/dashboard` | EXTEND |
| `/operacion/[id]` | EXTEND |
| `/propiedades` | REFACTOR |
| `/propiedades/[id]` | EXTEND |
| `/costos` | KEEP |
| `/asistente` | REFACTOR → contextual AI |
| `/profesionales` | REMOVE temporalmente |
| `/vara-labs` | KEEP |
| `/financiamiento` | EXTEND |

---

#### FASE 6 — App Shell V2 (COMPLETADA)

**Problema:** La app solo tenía `BottomNav` — un patrón mobile forzado que no funciona en desktop y limita la navegación.

**Solución implementada:**

**Archivo creado:** `src/components/layout/AppShell.tsx`

```
Comportamiento:
- Desktop (>=1024px): sidebar lateral 240px, colapsable a 60px (icon-only)
- Mobile (<1024px): top bar con hamburger + drawer desde la izquierda
- / y /onboarding NO tienen shell (se excluyen por pathname)
- Nav items dinámicos: BUY_PROPERTY → nav de compra, SELL_PROPERTY → nav de venta
- Toggle de colapso: botón circular flotante en el borde derecho del sidebar
- Cierre del drawer: al clickear backdrop o X
```

**Nav items BUY journey:**
- Inicio (`/dashboard`)
- Mi Operación (`/operacion/txn-001`)
- Propiedades (`/propiedades`)
- Costos (`/costos`)
- Financiamiento (`/financiamiento`)
- — divider —
- Asistente, Red, Labs (secondary)

**Nav items SELL journey:**
- Inicio, Mi Operación, Mi Propiedad, Costos

**Archivos modificados:**
- `src/app/layout.tsx` — importa y wrappea con `<AppShell>`
- 9 páginas — removidos `import { BottomNav }`, `<BottomNav />`, y `pb-24`

---

#### FASE 7 — Buyer Golden Path (COMPLETADA)

**Problema:** El onboarding guardaba nada. El dashboard mostraba "Francisco" hardcodeado a todos.

**Hook creado:** `src/hooks/useVaraState.ts`

```typescript
interface VaraState {
  userName: string      // 'vara_user_name'
  journeyType: string  // 'vara_journey_type' -> BUY_PROPERTY | SELL_PROPERTY | RENT_PROPERTY  
  province: string     // 'vara_province'
  propertyUrl: string  // 'vara_property_url'
  onboardingDone: boolean // 'vara_onboarding_done' === '1'
  loaded: boolean      // false en SSR, true después de useEffect
}
// Default mientras carga: { userName: 'Francisco', journeyType: 'BUY_PROPERTY', ... }
```

**Onboarding reescrito** (`src/app/onboarding/page.tsx`):

```
PASO 1: ¿Cómo te llamás? (nombre, opcional)
        → Botón cambia dinámicamente: "Hola, Pancho 👋" al escribir
        
PASO 2: ¿Qué querés hacer? (BUY/SELL/RENT)
        → Título personalizado: "Pancho, ¿qué querés hacer?"
        
PASO 3: ¿En qué provincia? (Buenos Aires, CABA, Córdoba, Rosario, Mendoza, Otro)

PASO 4: Tu GPS está listo
        → Resumen de checklist regulatorio real (datos reales por provincia)
        → Campo opcional URL de propiedad (Zonaprop, MeLi, Argenprop)
        → "Empezar mi operación" → guarda localStorage → router.push('/dashboard')
```

**localStorage writes en onboarding:**
```
vara_user_name      → nombre ingresado (default: 'Usuario')
vara_journey_type   → BUY_PROPERTY | SELL_PROPERTY | RENT_PROPERTY
vara_province       → provincia seleccionada
vara_property_url   → URL ingresada (puede ser '')
vara_onboarding_done → '1'
```

**Dashboard personalizado** (`src/app/dashboard/page.tsx`):

```
Greeting dinámico:
- < 12hs → "Buenos días, {nombre}"
- 12-19hs → "Buenas tardes, {nombre}"
- > 19hs → "Buenas noches, {nombre}"

Lógica de render:
- vara.loaded === false → render con defaults (evita flicker)
- vara.loaded && !vara.onboardingDone → EmptyState con CTA
- vara.loaded && vara.onboardingDone → Dashboard con datos demo personalizados
```

**Resultado verificado en producción:**
```
localStorage en prod:
  vara_user_name: "Pancho"
  vara_onboarding_done: "1"
  vara_journey_type: "BUY_PROPERTY"

Dashboard muestra: "Buenos días, Pancho" ✅
Sidebar muestra: "P" en avatar + "Pancho" ✅
```

---

## 5. ESTADO ACTUAL DE PRODUCCIÓN

**URL:** https://propos-mvp.vercel.app

| Ruta | Estado |
|------|--------|
| `/` | Landing dark premium |
| `/onboarding` | 4 pasos con localStorage |
| `/dashboard` | Personalizado + empty state |
| `/operacion/txn-001` | 6 tabs (datos mock) |
| `/propiedades` | Lista mock |
| `/propiedades/[id]` | AI staging (OpenAI real) |
| `/costos` | Calculadora regulatoria real |
| `/financiamiento` | Calculadora hipotecaria |
| `/asistente` | Keyword matching (no IA real) |
| `/profesionales` | Mock estático |
| `/vara-labs` | Showcase features |
| `/api/transform` | GPT-4o Vision + DALL-E 3 |

**Shell:**
- Desktop: Sidebar 240px colapsable ✅
- Mobile: Top bar + drawer ✅
- Sin bottom nav ✅

---

## 6. FASES PENDIENTES (V2 Roadmap)

| Fase | Descripción | Prioridad |
|------|-------------|-----------|
| FASE 8 | Seller Golden Path — crear propiedad, pricing intelligence, flujo de venta | P0 |
| FASE 9 | Document Intelligence — subir docs reales, clasificar, detectar riesgos | P0 |
| FASE 10 | Negotiation Intelligence + VARA AI contextual (reemplaza /asistente) | P0 |
| FASE 11 | Visits + Communications + Professionals (con datos reales) | P1 |
| FASE 12 | Seller publication (crear listado en portales) | P1 |
| FASE 13 | Visual Intelligence — AI staging integrado al journey | P2 |
| FASE 14 | Responsive + Accessibility audit | P2 |
| FASE 15 | E2E Customer Journey QA | P2 |
| FASE 16 | Final product audit | P3 |
| FASE 17 | Polish | P3 |

### Deuda técnica pendiente

| Item | Descripción |
|------|-------------|
| Auth | Sin auth — todo en localStorage (no persistente cross-device) |
| Mock data | Dashboard, Operación, Profesionales usan `mockTransaction` |
| Seller journey | 0% implementado |
| `/asistente` | Solo keyword matching — reemplazar con AI contextual (FASE 10) |
| `/profesionales` | Lista mock sin función real |

---

## 7. MOTOR REGULATORIO (NO TOCAR)

`src/lib/regulations.ts` — sólido, no requiere cambios.

```typescript
// Función principal:
generateChecklist(provinceCode: ProvinceCode, type: OperationType, propertyValue: number): Checklist

// ProvinceCode: 'BUENOS_AIRES' | 'CABA' | 'CORDOBA' | 'ROSARIO' | 'MENDOZA' | 'OTHER'
// OperationType: 'BUY_PROPERTY' | 'SELL_PROPERTY' | 'RENT_PROPERTY'

// Output incluye:
// - checklist.costs.stampTaxBuyer (sellos)
// - checklist.costs.notaryFeeBuyer (honorarios escribano)
// - checklist.costs.registryFee (inscripción registro)
// - checklist.costs.certificates
// - checklist.costs.totalBuyer.min/max/percentMin/percentMax
// - checklist.dataConfidence: 'VERIFIED' | 'PARTIAL' | 'ESTIMATED'
// - checklist.warnings[] (advertencias específicas de la provincia)
// - checklist.stages[] (etapas de la operación)
```

---

## 8. OPENAI INTEGRATION

**API Route:** `src/app/api/transform/route.ts`

```typescript
// POST /api/transform
// Body: { imageBase64: string, mimeType: string }
// Response: {
//   roomType: string,
//   currentState: string,
//   potentialScore: number,
//   recommendations: string[],
//   transformedImageUrl: string  // URL de DALL-E 3
// }
```

**Flujo:**
1. Recibe imagen en base64
2. GPT-4o Vision analiza: tipo de habitación, estado actual, potencial
3. DALL-E 3 genera versión renovada
4. Retorna análisis + URL de imagen generada

---

## 9. DESIGN TOKENS

```css
/* globals.css */
--color-brand-500: #FFD200;   /* Amarillo VARA (principal) */
--color-brand-600: #F5C800;   /* Hover del amarillo */
--color-brand-700: #333333;
--color-brand-950: #1a1a1a;

/* Backgrounds en uso */
bg-slate-950   /* Sidebar, AppShell frame */
bg-slate-900   /* Sidebar nav, dark pages */
bg-slate-50    /* Content areas (páginas internas) */
bg-white       /* Cards */
```

---

## 10. ARCHIVOS DE MEMORIA (persistentes entre sesiones)

Ubicación: `C:\Users\falon\.claude\projects\C--Users-falon-Documents-Obsidian-Vault-12--Hotmart\memory\`

| Archivo | Contenido |
|---------|-----------|
| `MEMORY.md` | Índice de toda la memoria |
| `vara-project.md` | Stack, rutas, regulatory engine, tipos de datos |
| `vara-strategy.md` | Problema, solución, competencia, monetización |
| `vara-feedback.md` | Cómo trabajar con Pancho en este proyecto |
| `vara-v2-vision.md` | Spec V2 completo: principios, customer journey, P0-P3, 17 fases |

---

## 11. REGLAS DE TRABAJO CON ESTE PROYECTO

1. **NO reconstruir, EVOLUCIONAR** — antes de tocar algo, clasificar: KEEP/IMPROVE/EXTEND/REFACTOR/REMOVE
2. **TRUST > MAGIC** — nunca inventar datos regulatorios o legales
3. **Customer Journey primero** — toda feature se evalúa contra: ¿le saca trabajo mental al usuario?
4. **Deploy después de cada fase** — verificar TypeScript (`npx tsc --noEmit`) y luego `npx vercel --prod --yes`
5. **GateGuard** — el proyecto tiene un hook que bloquea primeras ediciones. Ante bloqueo, presentar 4 facts: (1) importers/callers, (2) sin duplicado existente, (3) data schemas si aplica, (4) instrucción verbatim del usuario. Luego reintentar.

---

## 12. COMANDOS ÚTILES

```bash
# TypeScript check
npx tsc --noEmit

# Deploy producción
npx vercel --prod --yes

# Verificar auth Vercel
npx vercel whoami
# → francisco-9190

# Ver env vars de Vercel
npx vercel env ls
```

---

## 13. NEXT BEST ACTION

**FASE 8 — Seller Golden Path:**

El onboarding pregunta "Quiero vender" pero NO existe nada para el vendedor. Es el gap más grande del producto.

Mínimo viable para FASE 8:
1. Dashboard para el vendedor (diferente al de comprador)
2. Alta de propiedad (dirección, tipo, precio sugerido)
3. Seller Pricing Intelligence (basado en datos regulatorios + análisis básico)
4. Checklist del vendedor (documentos a preparar, pasos a dar)

O alternativamente, **FASE 9 — Document Intelligence** (más técnico, mayor impacto en el journey de compra).

---

*Fin del informe · VARA v0.7 · 2026-09-17*
