# VARA — Arquitectura de producción

**Estado real al 2026-10-15, no el objetivo.** Lo que falta para el objetivo está en `VARA_INFRASTRUCTURE_AUDIT.md`; el plan de entornos, en `VARA_STAGING_PLAN.md`; los respaldos, en `VARA_BACKUP_RECOVERY.md`.

## 1. Mapa

```
Navegador (usuario)
   │  HTTPS
   ▼
Vercel ── Next.js: páginas + funciones serverless (región iad1, EE. UU. Este)
   │         ├─ /api/scrape-property   lee un aviso (JSON-LD, Jina Reader, OpenAI)
   │         ├─ /api/v3/market         avisos de mercado de una zona
   │         ├─ /api/v3/market/sweep   barrido (protegido por secreto)
   │         ├─ /api/v3/explain        IA que explica un análisis (solo emails autorizados)
   │         └─ /api/health            estado de la plataforma
   ▼
Supabase ── Postgres + Auth + Storage (buckets privados)
OpenAI ──── explicaciones y lectura de avisos (clave solo en el servidor)
Bright Data  barrido de avisos de Zonaprop (asíncrono, con topes)

GitHub ──push──▶ Vercel (preview por rama, producción desde master)
GitHub Actions: tipos + tests + build en cada push
```

El análisis de una propiedad (`src/lib/analysis`) es código puro: corre en el navegador de la persona y solo consulta al servidor los avisos de mercado y, si está habilitada, la IA.

## 2. Componentes

| Componente | Qué usa hoy | Notas |
|---|---|---|
| Frontend y APIs | Next.js en Vercel (cuenta personal, plan Hobby) | Despliegue desde GitHub; producción = rama `master`. |
| Base de datos | Supabase (Postgres) | 15 migraciones versionadas en `supabase/migrations`. |
| Autenticación | Supabase Auth (email) | VARA se usa también sin cuenta; los datos sin sesión quedan en el navegador. |
| Archivos | Supabase Storage: `property-photos`, `documents`, `visit-photos` | Todos privados. |
| IA | OpenAI, solo desde el servidor | V3 usa `gpt-4o-mini`, con topes por usuario y globales. |
| Avisos de mercado | Bright Data (scraper de Zonaprop) → tabla `market_listings` | USD 1,5 por 1.000 registros; 5.000 créditos gratis por mes. |
| Código | GitHub `Chopan55/vara-altv3` | |
| Integración continua | GitHub Actions | Tipos, tests y build. Sin lint real todavía. |
| Observabilidad | `/api/health` y logger en memoria | Sin error tracking ni alertas todavía. |

## 3. Entornos

| Entorno | Supabase | Vercel | Variables |
|---|---|---|---|
| Producción | proyecto "VARA MVP" | rama `master` | Production |
| Staging | proyecto "VARA STAGING" | previews de ramas (variables de Preview: **pendiente de cargar**) | Preview |
| Desarrollo | el mismo proyecto de staging | `next dev` en la notebook | `.env.local` (ignorado por git) |

`VARA_ENV` marca el entorno; los eventos de analítica salen etiquetados y las métricas para inversores usan solo `production`.

## 4. Flujo de despliegue

`rama de trabajo` → push a GitHub → CI (tipos, tests, build) → preview de Vercel → pull request → `master` → producción.

Hoy nada impide publicar con la CI en rojo: falta activar protección de rama en GitHub. El despliegue no depende de la notebook.

## 5. Datos y privacidad

- Los buckets son privados; la base tiene seguridad por fila.
- Las claves públicas de Supabase viajan al navegador por diseño. La clave secreta vive solo en el servidor y la usa únicamente la tabla de mercado.
- `market_listings` no tiene política pública: solo el servidor la lee y la escribe. No guarda teléfonos ni datos de vendedores.
- El resumen que se manda a OpenAI no incluye datos de contacto, y la respuesta se descarta si nombra números que el análisis no tiene.

## 6. Dependencias críticas y qué pasa si fallan

| Si falla… | Efecto | Cómo se nota |
|---|---|---|
| Vercel | La plataforma entera cae | Monitor de disponibilidad (pendiente) |
| Supabase | Sin sesión, sin datos guardados; el análisis básico sigue en el navegador | `/api/health`: `database: down` → 503 |
| OpenAI | No hay asistente ni lectura asistida de avisos; el resultado determinístico sigue | `/api/health`: `ai` |
| Bright Data | No se actualizan avisos; los ya guardados siguen sirviendo | `/api/health`: `market` |
| La notebook | Ningún efecto en producción | — |

## 7. Lo que falta para que esté lista para diligencia

Dominio propio; staging con variables de Preview; protección de rama y CI obligatoria; monitoreo y alertas; backups probados; barrido programado en la nube; segundo administrador de las cuentas (hoy todo depende de una persona).
