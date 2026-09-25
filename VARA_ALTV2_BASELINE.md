# VARA ALT V2 — BASELINE DOCUMENT

> Snapshot tomado el 2026-09-25 antes de iniciar VARA ALT V3.
> Este documento es la referencia para detectar regresiones.
> ALT V2 debe permanecer intacta en `vara-altv2.vercel.app`.

---

## Commit baseline

```
git baseline: commit inicial creado al hacer git init sobre este estado
fecha: 2026-09-25
tests: 332 passed / 0 failed
typecheck: 0 errors
build: OK (Vercel production deploy exitoso)
url: https://vara-altv2.vercel.app
```

---

## Build status

| Check | Estado |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx vitest run` | ✅ 332/332 |
| Vercel build | ✅ Ready |

---

## Variables de entorno requeridas

| Variable | Scope | Descripción |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Clave anon pública de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client | Alias alternativo de anon key |
| `MELI_CLIENT_ID` | Server only | App ID de MercadoLibre |
| `MELI_CLIENT_SECRET` | Server only | Secret de MercadoLibre |
| `OPENAI_API_KEY` | Server only | Clave OpenAI (pendiente rotación) |
| `NEXT_PUBLIC_FLAGS` | Client + Server | Feature flags activos, separados por coma (opcional) |

---

## Database — Supabase

**Proyecto V2:** `hmvoyigahqfqpoersimr.supabase.co`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `user_operations` | Operaciones de compra/venta del usuario |
| `operation_tasks` | Tareas de cada operación |
| `operation_documents` | Documentos adjuntos a operaciones |
| `operation_offers` | Cadena de ofertas/contraofertas |
| `operation_participants` | Participantes de la operación |
| `vara_visits` | Visitas programadas |
| `visit_reports` | Reportes de visita con checklist y notas |
| `activity_ledger` | Ledger append-only de eventos (Postgres triggers) |
| `property_candidates` | Propiedades analizadas por compradores |

### Storage buckets

| Bucket | Acceso | TTL URL firmada |
|--------|--------|-----------------|
| `documents` | Privado | 5 min |
| `property-photos` | Privado | — |
| `visit-photos` | Privado | 10 min |

### Migrations aplicadas (en orden)

```
20260919000000_initial_schema.sql
20260919000001_storage.sql
20260921000000_vara_visit.sql
20260924000000_property_candidates.sql
20260925000000_offers.sql
20260926000000_activity_ledger.sql
20260926000001_operation_participants.sql
20260927000000_visit_photos_bucket.sql
```

---

## Rutas frontend

| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/` | Landing / home | ✅ |
| `/login` | Auth (magic link / OAuth) | ✅ |
| `/auth/callback` | Callback OAuth Supabase | ✅ |
| `/onboarding` | Flujo inicial: tipo + propiedad | ✅ |
| `/dashboard` | Panel principal (comprador/vendedor) | ✅ |
| `/operacion/[id]` | Detalle de operación | ✅ |
| `/propiedades` | Lista de candidatas | ✅ |
| `/propiedades/[id]` | Detalle de candidata | ✅ |
| `/ofertas` | Cadena de ofertas | ✅ |
| `/dinero` | Costos + comparación de mercado | ✅ |
| `/costos` | Calculadora regulatoria | ✅ |
| `/visitas` | Checklist de visita + notas | ✅ |
| `/visitas-vendedor` | Panel vendedor de visitas | ✅ |
| `/mis-visitas` | Visitas del comprador | ✅ |
| `/vara-visit` | Servicio visita asistida | ✅ |
| `/vara-visit/solicitar` | Solicitar visita VARA | ✅ |
| `/visit/[code]` | Vista pública visitador | ✅ |
| `/visit/[code]/reporte` | Reporte de visita | ✅ |
| `/asistente` | Chat IA | ✅ (requiere OPENAI_API_KEY) |
| `/guia` | Guía paso a paso | ✅ |
| `/financiamiento` | Opciones de financiamiento | ✅ |
| `/publicar` | Draft de publicación | ✅ |
| `/profesionales` | Directorio (datos mock) | ✅ |
| `/vara-labs` | Roadmap + features experimentales | ✅ |
| `/partner` | Panel de socios | ✅ |
| `/partner/onboarding` | Onboarding partners | ✅ |
| `/admin/visitas` | Admin visitas VARA | ✅ |

---

## API Routes

| Endpoint | Método | Descripción | Estado |
|----------|--------|-------------|--------|
| `/api/chat` | POST | Chat OpenAI | ✅ requiere OPENAI_API_KEY |
| `/api/comparables` | POST | Lee aviso MeLi por URL | ✅ requiere MELI_* |
| `/api/scrape-property` | POST | Scraper HTML portales | ✅ (ZP bloqueado por CF) |
| `/api/transform` | POST | Transforma datos de propiedad | ✅ |
| `/api/listing-copy` | POST | Copy de publicación con IA | ✅ requiere OPENAI_API_KEY |
| `/api/doc-intelligence` | POST | Lee PDF → extrae titulares/cargas | ⚠️ flag `docIntelligence` |
| `/api/v1/operations` | GET | Lista operaciones (API pública) | ⚠️ flag `publicApi` |
| `/api/v1/operations/[id]` | GET | Detalle operación (API pública) | ⚠️ flag `publicApi` |

---

## Feature Flags (`src/lib/flags/index.ts`)

| Flag | Default | Descripción |
|------|---------|-------------|
| `docIntelligence` | OFF | IA lee escrituras PDF |
| `sharedTransaction` | OFF | Operación compartida comprador+vendedor |
| `pushAlerts` | OFF | Alertas push en cambios de estado |
| `publicApi` | OFF | API pública v1 habilitada |
| `whiteLabel` | OFF | UI personalizable |

---

## Features funcionando — KEEP en V3

| Feature | Clasificación V3 |
|---------|-----------------|
| Auth magic link + OAuth | KEEP |
| Onboarding comprador/vendedor | KEEP |
| Dashboard comprador multi-operación | KEEP |
| Dashboard vendedor con checklist + fechas | KEEP |
| Risk engine (riesgos derivados) | KEEP |
| Regulatory engine AR (6 provincias) | EXTEND |
| Candidates store localStorage→Supabase | KEEP |
| Document upload + signed URLs | KEEP |
| Visit report + fotos | KEEP |
| Market comparables (MeLi + scraper) | KEEP |
| Activity ledger (Postgres triggers) | KEEP |
| Offers chain | KEEP |
| VARA Labs page | EXTEND |
| Observability / logger | KEEP |
| API pública v1 (estructura) | EXTEND |
| Doc Intelligence (backend) | EXTEND |

---

## Mocks y hardcodes existentes

| Archivo | Contenido | Tipo |
|---------|-----------|------|
| `src/data/mock.ts` | `mockUserOperations`, `OPERATION_STORE` | Demo data |
| `src/data/mockOfertas.ts` | Ofertas de ejemplo | Demo data |
| `src/app/profesionales/page.tsx` | Directorio de profesionales | Hardcoded |
| `src/data/knowledge.ts` | Base de conocimiento del asistente | Estático |
| `src/data/regulations/provinces.ts` | Reglas regulatorias AR | Estático |
| `src/app/financiamiento/page.tsx` | Tasas de financiamiento | Estimadas |

---

## Bugs conocidos

| Bug | Severidad |
|-----|-----------|
| OpenAI API key comprometida (pegada en chat) | Media — rotar antes de lanzar |
| Zonaprop bloqueado por Cloudflare | Baja — diseño conocido, flujo alternativo existe |
| MeLi `/sites/MLA/search` devuelve 403 | Info — diseño intencional, se usa item individual |

---

## Arquitectura de persistencia

```
Con sesión   → Supabase (source of truth)
Sin sesión   → localStorage (fallback, migra al loguearse)
Documentos   → Supabase Storage / documents (privado, 5 min)
Fotos visita → Supabase Storage / visit-photos (privado, 10 min)
Checklist    → localStorage vara_seller_checklist_v2
```

---

## Lo que NO existe en V2 (target V3)

- Multi-país / LATAM (solo AR regulatoriamente)
- Terminología localizable (hardcodeada en es-AR)
- Jurisdiction packs (MX, CL, CO, etc.)
- White label / multi-tenant
- Shared transaction en tiempo real
- Push notifications
- VARA Invest
- API pública activa para externos

---

*Generado: 2026-09-25 · VARA ALT V2 · vara-altv2.vercel.app*
