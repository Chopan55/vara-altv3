# VARA — Plan de staging

Objetivo: probar cambios, migraciones y datos sin tocar producción. Hoy **producción y desarrollo usan el mismo proyecto de Supabase** (ver `VARA_INFRASTRUCTURE_AUDIT.md`), y los previews de Vercel se despliegan sin variables.

Ya hecho en el código (sin gasto): el entorno se resuelve con `VARA_ENV` / `VERCEL_ENV` (`src/lib/config/env.ts`), cada evento sale etiquetado, `productionOnly()` separa la tracción real, y `/api/health` informa el estado y el entorno.

## 1. Variables por entorno

| Variable | Production | Preview (staging) | Development (`.env.local`) |
|---|---|---|---|
| `VARA_ENV` y `NEXT_PUBLIC_VARA_ENV` | `production` | `staging` | `development` |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | proyecto de producción | **proyecto de staging** | **proyecto de staging** (dejar de usar el de producción) |
| `OPENAI_API_KEY` | clave de producción | clave aparte con tope bajo | la de Preview |
| `AI_ALLOWED_EMAILS` | emails habilitados | emails de prueba | el tuyo |
| `APP_BASE_URL` | dominio definitivo | sin definir (usa `VERCEL_URL`) | `http://localhost:3000` |
| `BRIGHTDATA_API_KEY`, `MARKET_SWEEP_SECRET` | solo producción (barrido programado) | opcional, con tope bajo | no se usan |
| `SUPABASE_SERVICE_ROLE_KEY` | solo si hace falta en servidor | ídem, de staging | nunca en el navegador |

Regla: **ninguna clave de producción en una notebook**.

## 2. Pasos

### Los hacés vos (requieren tu cuenta)
1. Crear en Supabase un proyecto nuevo, `vara-staging` (el plan gratuito permite 2 proyectos; región São Paulo por cercanía). Aviso: los proyectos gratuitos se pausan tras una semana sin uso.
2. Pasarme **solo la URL pública** del proyecto nuevo. La clave anónima y la de servicio las cargás vos en Vercel y en `.env.local`, nunca por chat.
3. En Vercel, agregar las variables de la columna *Preview*. En el panel de configuración del proyecto, activar "Automatically expose System Environment Variables" o definir `NEXT_PUBLIC_VARA_ENV` a mano, para que el navegador sepa en qué entorno está.

### Los hago yo después
4. Armar un único archivo SQL con las 14 migraciones aplicadas en producción, en orden, para pegarlo en el editor SQL del staging. Orden: `20260919000000` → `…000001_storage` → `20260921…vara_visit` → `20260924…property_candidates` → `20260925…offers` → `20260926000000…activity_ledger` → `…000001_operation_participants` → `20260926_001/002/003…` → `20260927…visit_photos_bucket` → `20260928…negotiations` → `20260929…latam_country_column` → `20261005…visit_hardening`. Cuidado: los tres archivos `20260926_00X` tienen un nombre fuera del formato numérico del CLI de Supabase; por eso conviene aplicarlos por SQL y no con el CLI.
5. Apuntar `.env.local` al staging y verificar en `/api/health` que dice `env: staging` y `database: ok`.
6. Correr el recorrido principal (comprar, analizar, guardar, Visit) contra staging.
7. Aplicar `market_listings` **primero en staging**. En producción solo con tu aprobación explícita.

## 3. Cuándo está terminado

- `/api/health` en un preview muestra `env: staging` y la base de staging responde.
- Un usuario de prueba creado en staging no existe en producción, y al revés.
- Los eventos de un preview salen con `env: staging` y no entran en `productionOnly()`.
- Ningún `.env.local` contiene la URL del Supabase de producción.

## 4. Costo y riesgos

- Supabase free para staging y Vercel sin cambios de plan: USD 0.
- Riesgo principal mientras no exista staging: cualquier migración o script local toca datos reales. Hasta entonces, **no aplicar migraciones contra el proyecto actual sin confirmación explícita**.
- Pendiente aparte, que sí cuesta: pasar Vercel a un plan con uso comercial y mover la región a São Paulo (ver auditoría, sección 4).
