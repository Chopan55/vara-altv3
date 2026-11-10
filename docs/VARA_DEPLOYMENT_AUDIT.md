# VARA — Auditoría de despliegue y bases de datos antes de promover `integracion`

**Fecha:** 2026-10-17 · **Alcance:** solo lectura. No se desplegó, no se mergeó, no se corrió ninguna migración, no se cambiaron variables de Vercel ni la base. Lo único creado fue este documento.
**Cómo se obtuvo cada dato:** `git` (ramas locales y `origin`), CLI de Vercel (`ls`, `inspect`, `env ls`, `env pull` solo para leer el identificador de la base), `/api/health` de producción, `GET` de solo lectura contra la API REST de Supabase con la clave pública, y `gh run list`. La API de herramientas de Vercel devolvió 403 para algunos proyectos; se usó la CLI con tu sesión.

---

## 1. PRODUCCIÓN

| Punto | Estado | Evidencia |
|---|---|---|
| 1. Rama de producción | `master` | Los despliegues de producción salen de `master` (`vara-altv3-git-master-chopan55.vercel.app` es alias del despliegue actual) |
| 2. Commit | `e21db7bc9939c57d8431d1a52e0ae6724c83c1d9` | `git rev-parse origin/master`; CI de GitHub sobre ese SHA: success |
| 3. ¿Es `e21db7b`? | **Sí** | `GET /api/health` → `"version":"e21db7b"`, `"env":"production"`, `"status":"ok"` |
| 4. Despliegue | `dpl_9u249bMuL5fnqVsGTcFBe4ghxk9Z` · `https://vara-altv3-bilkfm3u0-chopan55.vercel.app` · target `production` · Ready · creado 2026-10-16 22:08 (ART) | `vercel inspect`. Aliases: `vara-altv3-theta.vercel.app`, `vara-altv3-git-master-chopan55.vercel.app` |

Producción antes de esta sesión: `eb61116` (= `vara-hardening`). Hoy tiene 0 commits de esa versión que falten en `master`.

## 2. PREVIEW / INTEGRACION

| Punto | Estado | Evidencia |
|---|---|---|
| 5. Commit | `a74b87472ad1303be978581b7f2bc7a154a1b17e` | `git rev-parse origin/integracion`; CI success sobre ese SHA |
| 6. ¿Solo preview? | **Sí** | `vercel inspect`: `dpl_EwYK7Go7DJuKEBXfcPHbCZTPSK9V`, target `preview`, `https://vara-altv3-k1wek1etk-chopan55.vercel.app`. Alias de rama: `vara-altv3-git-integracion-chopan55.vercel.app` |

Observaciones: la vista previa está protegida por login de Vercel (no se pudo abrir sin sesión, por eso **no hubo verificación visual de la rama**). Es un redespliegue del primer preview de la rama, hecho después de cargar la variable `NEXT_PUBLIC_FLAGS` para esa rama.

## 3. DATABASES

| Entorno | Proyecto de Supabase (ref) | `VARA_ENV` | Evidencia |
|---|---|---|---|
| Local (`.env.local`) | **`itdeptqwpztsooozarut`** (staging, "VARA STAGING") | `development` | `.env.local` |
| Vercel Preview / `integracion` | **`itdeptqwpztsooozarut`** (staging) | `staging` | `vercel env pull --environment=preview --git-branch=integracion` (solo se leyó el ref; archivo temporal vaciado) |
| Vercel Production | **`hmvoyigahqfqpoersimr`** ("VARA MVP") | no definida | `vercel env pull --environment=production` |

- **13. ¿Preview y Production comparten base?** **NO.** Local y Preview comparten staging; Production usa su propia base. Tampoco comparten Local y Production.
- **14. Riesgo por base compartida:** **no aplica hoy.** Hasta el 15/10 sí compartían (alto riesgo); se separó con "VARA STAGING". Riesgo residual (MEDIO): el esquema de staging **no es igual** al de producción (ver Migraciones: `contact_requests` existe en producción y no en staging), así que una vista previa no representa del todo a producción.
- **11. ¿Cambió el esquema de producción durante este trabajo?** **Sí, por pasos que ejecutaste vos en el SQL Editor y con tu OK**, no por mí: se crearon `negotiations`, `negotiation_messages` y `market_listings` (SQL en `docs/PROD_MIGRACION_NEGOCIACIONES_MERCADO.sql`). Además yo inserté **358 filas** en `market_listings` de producción (copia desde staging, con tu autorización explícita). No se modificó ni borró ninguna tabla ni dato existente.

## 4. MIGRATIONS

Archivos en el repo: `eb61116` (producción anterior) = 13 · `master` (producción actual) = 15 · `integracion` = 17.

| Migración | Creada | Local (= staging) | Preview (= staging) | Producción | Evidencia |
|---|---|---|---|---|---|
| `20260928000000_negotiations.sql` (modificada en `master`) | 28/09 | Aplicada | Aplicada (misma base) | **Aplicada** (pegada el 16/10) | `negotiations` → 200 en staging y en producción |
| `20261005000000_visit_hardening.sql` | 05/10 | Aplicada | Aplicada | **Aplicada** (ya estaba antes de esta sesión) | `audit_events` → 200 en ambas. Solo se verificó esa tabla, no las 1167 líneas completas |
| `20261015000000_market_listings.sql` | 15/10 | Aplicada (15/10) | Aplicada | **Aplicada** (16/10) | `market_listings` → 200 en ambas; 358 filas en cada una |
| `20261010000000_contact_requests.sql` (**solo en `integracion`**) | 10/10 | **NO aplicada** (404) | **NO aplicada** | **Existe** (401 de permiso = tabla presente con solo INSERT) | Probe en ambas bases. No la apliqué yo ni se sabe cuándo se aplicó en producción |
| `20261012000000_operations_country_hotfix.sql` (**solo en `integracion`**) | 12/10 | Efecto presente (columna existe) | Ídem | **Efecto presente** (columna `operations.country` → 200). El comentario del archivo dice "NO se ejecutó contra producción", pero la columna existe | Probe `operations?select=country`. Su índice `idx_operations_country` no se pudo verificar |

- **9. Migraciones agregadas desde la producción actual (`master`) hasta `integracion`:** exactamente 2: `contact_requests` y `operations_country_hotfix`. Desde la producción anterior (`eb61116`) hasta `master`: 3 (negotiations modificada, visit_hardening, market_listings).
- Ninguna de las dos migraciones nuevas es destructiva: sin `DROP`, `DELETE`, `TRUNCATE` ni `UPDATE`; ambas son idempotentes (`if not exists`).
- Yo no apliqué ninguna migración; todas las aplicó la persona dueña en el SQL Editor. No hay historial de migraciones accesible sin acceso directo a la base, así que el estado "aplicada" se **infiere** de la existencia de los objetos.

## 5. ENVIRONMENT VARIABLES

**15. Nombres que usa el código de `integracion`** (sin valores):
`AI_ALLOWED_EMAILS`, `BRIGHTDATA_API_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`★, `MARKET_CRON_ENABLED`, `MARKET_DATA_DIR`, `MARKET_SWEEP_SECRET`, `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`, `NEXT_PUBLIC_FLAGS`, `NEXT_PUBLIC_FLAGS_OFF`★, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VARA_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `NODE_ENV`, `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VARA_AI_ALLOWED_EMAILS`★, `VEO_MODEL`★, `VERCEL_GIT_COMMIT_SHA`.
★ = **nuevas respecto de `master`**: `GEMINI_API_KEY`, `NEXT_PUBLIC_FLAGS_OFF`, `VARA_AI_ALLOWED_EMAILS`, `VEO_MODEL`.

**Presentes hoy en Vercel:**

| Variable | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Sí (producción) | Sí (staging) |
| `SUPABASE_SECRET_KEY` | Sí (producción) | Sí (staging) |
| `OPENAI_API_KEY` | Sí | **No** |
| `AI_ALLOWED_EMAILS` | Sí | No |
| `NEXT_PUBLIC_FLAGS` (`buyWowV3`) | Sí | Sí, **solo rama `integracion`** |
| `VARA_ENV` / `NEXT_PUBLIC_VARA_ENV` | No | Sí (`staging`) |
| `VARA_AI_ALLOWED_EMAILS` | **NO** | No |
| `GEMINI_API_KEY`, `VEO_MODEL` | **NO** | No |
| `BRIGHTDATA_API_KEY`, `MARKET_SWEEP_SECRET`, `CRON_SECRET`, `MARKET_CRON_ENABLED` | **NO** | No |

- **16. Bright Data:** configurado **solo en local** (`.env.local`). No está en Preview ni en Producción.

## 6. ROUTES

**Producción (`vara-altv3-theta.vercel.app`), medido con `GET`:**

| Ruta | Resultado |
|---|---|
| `/` | 200 |
| `/analizar` | 200 |
| `/dashboard` | 200 |
| `/dashboard/analizar` | **404** |
| `/empezar` | **404** (existe solo en `integracion`) |
| `/api/health` | 200 |

**`integracion` (archivos de ruta en el código):** `/` sí, `/analizar` sí, `/dashboard` sí, `/empezar` sí, **`/dashboard/analizar` no existe**. No se pudieron medir con `GET` por la protección de la vista previa.

- **18. Ruta canónica:** **`/analizar`**. `/dashboard` es la home de la cuenta; `/dashboard/analizar` no existe en ninguna rama (el 404 que viste vino de escribir esa dirección).
- **19. Menú "Analizar propiedad":** apunta a **`/analizar`** (`src/components/layout/AppShell.tsx:46`), correcto. Solo se muestra si la bandera `buyWowV3` está activa (activa en Producción y en la vista previa de `integracion`).

## 7. DIFF (producción actual `master` → `integracion`)

**143 archivos, +7787 / −1438** (100 agregados, 43 modificados). Es todo `feat/public-slice1` (15 commits, 13/10) más 1 commit mío (menú) y 1 merge.

- **8. Qué trae `feat/public-slice1`:**
  - **Esquema:** 2 migraciones (ver arriba), tipos de Supabase actualizados (`src/lib/supabase/types.ts`). **Sin cambios destructivos de datos.**
  - **Auth:** `requireAuth` ahora devuelve también `email` (cambio mínimo, compatible); `AuthScreen`: tras iniciar sesión, el destino por defecto pasa de `/dashboard` a **`/empezar`** (bandera `conversationalEntry`, activa por defecto). Sin cambios en `proxy`/middleware.
  - **Rutas nuevas:** `/empezar`, `/interesados`, `/precio-venta`, `/preparar-venta`, `/revisar-publicacion`, `/fotos-venta`, `/video-presentacion`, `/recorrido-ia`, `/mi-busqueda`, `/planes`, `/property-pack`, `/demo`, `/labs`; **API nuevas:** `/api/contacto` (público, escribe en `contact_requests`), `/api/tour-clip` (video con Gemini/Veo, de pago).
  - **Rutas modificadas:** `/` (home pública nueva), `/dashboard`, `/acciones`, `/comparar`, `/dinero`, `/ofertas`, `/operacion/[id]`, `/propiedades`, `/publicar`, `/vara-visit`, entre otras; API: `chat`, `negotiation`, `transform`, `listing-copy`, `scrape-property`.
  - **Variables de entorno nuevas:** `GEMINI_API_KEY`, `VEO_MODEL`, `VARA_AI_ALLOWED_EMAILS`, `NEXT_PUBLIC_FLAGS_OFF`.
- **Cambio de control de gasto:** las 6 rutas de IA pagas (`chat`, `negotiation`, `transform`, `listing-copy`, `scrape-property`, `tour-clip`) pasan a exigir sesión **y** email en `VARA_AI_ALLOWED_EMAILS`, con tope diario por usuario. **Sin esa variable, nadie las usa.**
- Verificación del código: tipos OK, lint 0 errores, **749 tests pasando** (55 archivos); CI de GitHub en `integracion`: success.

## 8. RISKS

**ALTO**
1. **Las funciones de IA existentes se apagan para todos.** Producción hoy no tiene `VARA_AI_ALLOWED_EMAILS`; con `integracion`, `chat`, `negotiation`, `transform`, `listing-copy` y `scrape-property` responderían 403 a todos, incluido el flotante "VARA AI". (Es un cambio intencional de protección de gasto, pero hoy sería una regresión visible.)
2. **Verificación visual pendiente.** La vista previa nunca se abrió; solo hay tests y CI. Además corre contra staging (1 sola cuenta, sin la tabla `contact_requests`), no contra los datos de producción.

**MEDIO**
3. **Cambio de entrada tras iniciar sesión:** `/empezar` pasa a ser el destino por defecto (no existe hoy en producción). Todas las cuentas de producción son tuyas (5), pero el flujo es nuevo.
4. **Home pública reemplazada** (`/`): cambio visible grande, con formulario de contacto público.
5. **`/api/contacto` es público y sin límite de uso por IP** (solo campo trampa y límites de largo en la tabla): riesgo de spam hacia `contact_requests`.
6. **Dos listas de permiso de IA distintas** (`AI_ALLOWED_EMAILS` para V3/chat/voz; `VARA_AI_ALLOWED_EMAILS` para las rutas heredadas): confuso y propenso a errores.
7. **Esquema de staging ≠ producción** (`contact_requests` solo en producción): la vista previa no es un espejo fiel.

**BAJO**
8. `/api/tour-clip` queda inerte sin `GEMINI_API_KEY` (503/403): no gasta, pero la función no anda.
9. Las migraciones nuevas son aditivas e idempotentes; ya hay efecto presente en producción.

## 9. ACCIDENTAL / NO PEDIDO — cambios hechos en producción durante este trabajo

Todo lo siguiente se hizo con tu OK expreso salvo el punto 5, que fue un efecto secundario:

1. **Despliegues de producción** por cada push a `master` (varios; el actual es `e21db7b`).
2. **Variables en Production:** `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_FLAGS=buyWowV3`, `AI_ALLOWED_EMAILS` (esta última y la primera con tu clave/OK explícito).
3. **Base de producción:** 3 tablas nuevas (SQL que pegaste vos) y 358 filas insertadas por mí en `market_listings` (con tu autorización).
4. **Cron diario registrado en producción** (`vercel.json` en `master`: `/api/v3/market/sweep/cron`, 09:00). Responde `disabled` mientras `MARKET_CRON_ENABLED` no exista: no gasta, pero **corre todos los días**. No se te informó de forma explícita al subirlo.
5. **Efecto secundario no pedido:** un `vercel curl` anterior creó un **token de bypass de la protección de despliegues** del proyecto. Sigue sin decidirse si revocarlo.
6. Fuera de producción: variable `NEXT_PUBLIC_FLAGS` en Preview (solo rama `integracion`), rama `integracion` y PR #2 (`master`→`altv3`) en GitHub.
7. Hay un **segundo proyecto de Vercel (`vara-ar`)** que despliega previews del mismo repo; no es cosa mía y su producción no se pudo inspeccionar (403).

No se detectó pérdida ni modificación de datos preexistentes, ni commits de producción anterior que falten en `master`.

## 10. SAFE TO PROMOTE: **NO**

Todavía no. No hay un bloqueo de datos (las migraciones son aditivas y ya tienen efecto en producción), pero hay una regresión de IA segura de producir y falta verificación visual.

## 11. REQUIRED ACTIONS BEFORE PROMOTION

1. Decidir y cargar `VARA_AI_ALLOWED_EMAILS` en Production (o unificarla con `AI_ALLOWED_EMAILS`), para que las funciones de IA no se apaguen para todos.
2. Abrir la vista previa `vara-altv3-git-integracion-chopan55.vercel.app` con sesión de Vercel y revisar a mano: menú de compra y de venta, `/empezar`, home pública, `/analizar`.
3. Decidir si `conversationalEntry` (entrada por `/empezar` tras el login) debe estar activo al promover, o apagarlo con `NEXT_PUBLIC_FLAGS_OFF=conversationalEntry`.
4. Decidir si el formulario de contacto público sale ya o se agrega límite de uso por IP antes.
5. Decidir sobre el cron diario ya registrado (mantenerlo, o sacarlo de `vercel.json`) y sobre el token de bypass.
6. Confirmar qué se aplicó realmente en producción de `contact_requests` y de la columna `country` (hoy solo se infiere por la existencia de los objetos) y sacar un backup de la base antes de promover. Los backups de producción siguen sin revisar.
7. Alinear el esquema de staging con producción (`contact_requests`) para que la vista previa sea representativa.
8. Con eso resuelto, promover con un plan de reversa: volver a `e21db7b` desde Vercel (Rollback del despliegue) y tener a mano el SQL de cualquier cambio.
