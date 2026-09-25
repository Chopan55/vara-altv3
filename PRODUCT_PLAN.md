# VARA — PRODUCT PLAN
> Última actualización: 2026-09-13 · Basado en V6 Master Evolution Prompt

---

## 1. CURRENT PRODUCT BASELINE

### Stack
- Next.js 16 + React 19 + Tailwind v4 + TypeScript strict
- App Router (no DB, no auth — demo frontend)
- Deploy: Vercel (`propos-mvp.vercel.app`)

### Rutas existentes
| Ruta | Estado | Descripción |
|------|--------|-------------|
| `/` | IMPROVE | Landing "GPS Inmobiliario" — positioning débil vs V6 |
| `/onboarding` | EXTEND | 3 steps: tipo → provincia → checklist preview. No crea operación real |
| `/dashboard` | KEEP | Operation Intelligence Center (reescrito 2026-09-13) |
| `/operacion/[id]` | EXTEND | Tabbed: Tareas/Docs/Costos/Timeline/Equipo. Sin intelligence header |
| `/propiedades` | REFACTOR | Lista mock con emoji. Parece portal, no "Mis propiedades" |
| `/profesionales` | KEEP | Directorio profesionales — funciona bien |
| `/costos` | KEEP | Calculadora regulatoria 24 provincias — sólida |
| `/asistente` | KEEP | Chat KB inmobiliario argentino — funciona bien |

### Componentes clave
- `VaraLogo`, `Badge`, `Button`, `Progress`, `BottomNav` — design system base
- `mockTransaction` — única operación demo con stages/tasks/docs/costs/timeline
- `mockProperties` — 6 propiedades mock
- Regulatory Engine: `provinces.ts` (24 provincias, VERIFIED/PARTIAL/ESTIMATED), `regulations.ts` (`generateChecklist`)

### Fortalezas actuales
- Regulatory engine completo (24 provincias, confianza calibrada, datos verificados)
- Tipo de datos bien estructurados (Task con `why`, `warnings`, `recommendations`)
- Operation page con task accordion expandible con contexto
- Cost calculator funcional con stamp tax correcto BA Prov.
- Dashboard reescrito como Intelligence Center (2026-09-13)

### Deudas / Gaps críticos
- Solo journey de **comprador** — vendedor inexistente
- No existe "Property Intelligence" (pegar link → análisis)
- No existe Risk Engine formal — solo `warnings[]` en tasks
- No existe "What Changed" / activity feed
- No existe Property Score explicable
- Propiedades page parece portal (anti-visión)
- Onboarding llega a checklist pero no crea operación real
- Landing positioning desactualizado
- No auth, no DB — todo mock

---

## 2. TARGET PRODUCT VISION

VARA = THE INTELLIGENCE LAYER FOR REAL ESTATE TRANSACTIONS

Promesa: **Comprar o vender una propiedad con claridad, control y acompañamiento inteligente, sin depender obligatoriamente de un intermediario tradicional.**

Núcleo diferencial:
```
PROPERTY GRAPH + TRANSACTION GRAPH + REGULATORY GRAPH
+ DOCUMENT INTELLIGENCE + RISK INTELLIGENCE
+ TRANSACTION DATA + AI TRANSACTION AGENT
```

---

## 3. GAP ANALYSIS

### KEEP (sin cambios)
- `/profesionales`, `/costos`, `/asistente`
- Design system completo
- Types system — bien estructurado, extensible
- Regulatory engine — sólido, 24 provincias

### IMPROVE
- `/dashboard` — ya mejorado; puede recibir "What Changed" en próxima iteración
- `/operacion/[id]` — agregar intelligence header antes de los tabs
- `/onboarding` — conectar a creación de operación real

### EXTEND
- `Transaction` type → agregar `risks[]` formales
- `Task` type → agregar `unblockAction`
- `/propiedades` → transformar en "Mis propiedades" con CTA "Analizar propiedad"

### REFACTOR
- `/propiedades` — remover emoji, reframe conceptual (no portal)
- Landing `/` — actualizar positioning

### MISSING — Priorizado
1. **Risk Engine** — `Risk[]` formal en Transaction
2. **Operation Intelligence Header** — summary bar en `/operacion/[id]`
3. **Property Intelligence entry point** — analizar propiedad por URL o manual
4. **Seller Journey** — onboarding + seller operation
5. **"What Changed"** — activity feed en dashboard
6. **Document Intelligence** — qué desbloquea cada doc
7. **Auth + DB** — necesario para multi-user
8. **LATAM expansion** (arquitectura ya preparada)

---

## 4. EVOLUTION PLAN

### P1 — TRANSACTION INTELLIGENCE (completado 2026-09-14)

| # | Feature | Estado |
|---|---------|--------|
| 1 | Landing V6 positioning | ✅ |
| 2 | Propiedades refactor "Mis propiedades" | ✅ |
| 3 | Operation Intelligence Header | ✅ |
| 4 | Risk Engine MVP (`Risk` type + mock + tab) | ✅ |
| 5 | "Qué cambió" widget en dashboard | ✅ |
| 6 | Costos calculados desde regulatory engine (no hardcodeados) | ✅ |
| 7 | Property link en operation header | ✅ |

### P2 — PROPERTY VISUAL INTELLIGENCE

| # | Feature | Descripción |
|---|---------|-------------|
| 1 | Property detail page | `/propiedades/[id]` — análisis completo de una propiedad |
| 2 | Visualizá su potencial | Input: foto → output: recomendaciones + visualización orientativa |
| 3 | Seller Staging | Before/after virtual para vendedores, preparación para publicar |
| 4 | Property Potential Score | Score explicable basado en estado, distribución, intervención necesaria |
| 5 | VARA Labs page | Sección discovery de capacidades en desarrollo |

**Decisión técnica pendiente:** API de transformación de imagen (Replicate SDXL / DALL-E 3 / Cloudflare AI).
La Capa de Texto (recomendaciones sin imagen) es implementable ahora.

### P3 — RENOVATION INTELLIGENCE

| # | Feature | Descripción |
|---|---------|-------------|
| 1 | Renovation Cost Estimation | Costo estimado por intervención (pintura, iluminación, pisos, cocina, baño) |
| 2 | True Acquisition Cost | Precio + gastos escritura + renovación = costo real de adquisición |
| 3 | Renovation Scenarios | Opción A (light refresh) / B (balanced) / C (full transformation) |
| 4 | Professional Execution Network | Pintores, interioristas, arquitectos conectados a propuestas de mejora |

**Guardrail:** nunca inventar presupuestos. Toda estimación requiere rango + ubicación + fecha + fuente + confidence.

### P4 — PAYMENT INTELLIGENCE

| # | Feature | Descripción |
|---|---------|-------------|
| 1 | Mortgage / hipoteca | Análisis de financiamiento, cuotas estimadas, relación cuota/ingreso |
| 2 | Mixed payment | Pago parcial en ARS + USD, combinaciones comunes en Argentina |
| 3 | Digital asset settlement | Coordinación con proveedor regulado (USDT/USDC) — VARA no custodia fondos |

```typescript
// Extensión futura del tipo Transaction
// paymentMethod: 'CASH' | 'MORTGAGE' | 'MIXED' | 'DIGITAL_ASSET'
// settlementCurrency: 'USD' | 'ARS' | 'USDT' | 'USDC'
// financingType?: 'BANK_MORTGAGE' | 'SELLER_FINANCING' | 'MIXED'
```

### P5 — DIGITAL ASSET INFRASTRUCTURE (RESEARCH)

- Crypto settlement con proveedor regulado (VARA como orchestrator, nunca como custodio)
- Tokenized real estate cuando exista marco jurídico válido en AR/LATAM
- Fractional investment structures (fondos, developers, bancos)
- Smart contracts para condiciones automatizables (depósitos, confirmaciones)

**Guardrail:** ninguna acción financiera o legal sin compliance + legal review + security review + aprobación explícita.

---

## 5. VARA LABS

Sección de descubrimiento dentro del producto. No ocupa protagonismo.

**Objetivo:** comunicar visión, validar interés, mostrar innovación, capturar demanda futura.

**Estados de innovación:**
- `AVAILABLE` — ya funciona
- `BETA` — disponible con limitaciones
- `ROADMAP` — comprometido, en desarrollo
- `RESEARCH` — explorando viabilidad
- `EXPLORING` — idea en evaluación

**Capacidades iniciales:**

| Capacidad | Estado | Descripción |
|-----------|--------|-------------|
| Visualizá el potencial | ROADMAP | IA transforma fotos de ambientes con mejoras propuestas |
| Presupuesto de renovación | ROADMAP | Estimá cuánto costaría transformar una propiedad antes de comprarla |
| True Acquisition Cost | ROADMAP | Precio + escritura + renovación = costo real de adquisición |
| Pagos con activos digitales | RESEARCH | Coordinación de operaciones con USDT/USDC mediante proveedor regulado |
| Real Estate Tokenization | RESEARCH | Infraestructura futura para estructuras inmobiliarias digitales |
| Fractional Real Estate | RESEARCH | Inversión fraccionada con due diligence y estructura legal |

```typescript
export type InnovationState = 'AVAILABLE' | 'BETA' | 'ROADMAP' | 'RESEARCH' | 'EXPLORING'

export interface FeatureInterest {
  featureId: string
  userId: string
  capturedAt: string
  context?: string
}
```

---

## 6. STRATEGIC EVOLUTION

```
HOY                    PRÓXIMO               LARGO PLAZO
─────────              ──────────            ───────────
UNDERSTAND             VISUALIZE             EXECUTE
    ↓                      ↓                     ↓
DECIDE                 ESTIMATE              SETTLE
    ↓                      ↓                     ↓
COORDINATE             OPTIMIZE              STRUCTURE
```

**De:** Real Estate Transaction Platform
**A:** Real Estate Intelligence & Transaction Infrastructure

---

## 7. QA CHECKLIST (por fase)
- [ ] `npx tsc --noEmit` — 0 errores
- [ ] Mobile responsive (375px)
- [ ] Sin datos falsos marcados como reales
- [ ] Navegación completa
- [ ] `npx vercel --prod` exitoso

---

## 8. NORTH STAR
**Successful transactions assisted by VARA**

KPI: Time to Confidence — tiempo desde que un usuario empieza hasta que siente que entiende suficientemente la operación para decidir.

---

## 9. COMPETITIVE CONTEXT

### PropLupa — Competidor principal
| Dimensión | PropLupa | VARA |
|-----------|----------|------|
| Formato | PDF estático, ARS 19,900 | Sistema vivo, operación activa |
| Actualización | Snapshot al momento | Tiempo real |
| Cobertura | Dominio/titularidad | Dominio + fiscal + operativo + riesgos |
| Acompañamiento | Ninguno | Todo el ciclo compra/venta |
| Precio | ARS ~20k (USD ~20) | USD 25 / 199 / 299 |

**Mensaje clave:** PropLupa es un snapshot estático. VARA es un sistema vivo.

No competimos con portales (Zonaprop) — son buscadores. No competimos con inmobiliarias — somos la capa de inteligencia que las complementa.

---

## 10. MONETIZACIÓN

| Producto | Precio | Descripción |
|----------|--------|-------------|
| VARA Check | USD 25 | Análisis de propiedad antes de comprometerse |
| VARA Buy | USD 199 | Acompañamiento completo operación de compra |
| VARA Sell | USD 299 | Acompañamiento completo operación de venta |
| Professional Marketplace | % comisión | Escribanos, arquitectos, tasadores |

**Funnel:** Herramienta gratuita (calculadora) → VARA Check USD 25 → VARA Buy/Sell → Marketplace

---

## 11. REVENUE MODEL (Y1 Conservador)

| Producto | Volumen | Precio | Total |
|----------|---------|--------|-------|
| VARA Check | 620 | USD 25 | USD 15,500 |
| VARA Buy | 125 | USD 199 | USD 24,875 |
| VARA Sell | 61 | USD 299 | USD 18,239 |
| **Total Y1** | | | **USD 58,614** |

Lanzamiento en GBA Norte (Pilar, Nordelta, Tigre). CAC target < USD 15 para Check. Escenario optimista con marketplace activo: USD 120k-150k Y1.

---

## 12. ACQUISITION STRATEGY

**Canal 1 — SEO + Contenido (80% inicial)**
- "Cuánto cuesta escriturar en [provincia]" — 24 artículos, alta intención
- "Gastos de compraventa Argentina" — volumen alto, baja competencia SEO
- Herramientas gratuitas como SEO: calculadora costos, simulador hipoteca

**Canal 2 — Viral Loop**
Compartir estado de operación por WhatsApp: "Estoy usando VARA para mi compra en Pilar". Cada operación activa genera 5-10 exposiciones orgánicas.

**Canal 3 — Professional Marketplace**
Los escribanos y arquitectos tienen cartera activa. Si VARA les genera clientes → ellos recomiendan VARA → loop.

**Canal 4 — Partnerships**
Desarrolladoras Pilar/Nordelta/Tigre, inmobiliarias que quieren diferenciarse, bancos con hipotecas.
