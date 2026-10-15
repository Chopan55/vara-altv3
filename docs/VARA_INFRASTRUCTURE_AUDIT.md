# VARA — Auditoría de infraestructura (2026-10-15)

Solo lectura: no se migró ni se cambió nada. Evidencia medida contra el repo, GitHub, Vercel (CLI) y la app en producción. Los valores de secretos no se leyeron ni se copian acá.

Clasificación: `CLOUD_PRODUCTION_READY` · `CLOUD_BUT_FRAGILE` · `LOCAL_DEPENDENCY` · `MISSING` · `UNKNOWN`.

## 1. Respuesta corta

**¿Puede apagarse la notebook una semana?**

- **Producción actual (master en Vercel + Supabase en la nube): sí.** Se despliega desde GitHub, no desde tu máquina.
- **Todo lo nuevo no.** Hay trabajo que solo existe en la notebook (commits sin subir) y el módulo de mercado de V3 depende de un archivo en disco y de un barrido que se dispara a mano.

### Hallazgos que importan (ordenados)

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **Producción y desarrollo usan el mismo Supabase.** El host de `.env.local` es el mismo que el del bundle de producción. No hay base de staging. Probar una migración o un script local toca datos reales. | Alta |
| 2 | **Código solo en la notebook:** `altv3` tiene 10 commits sin subir, `buy-wow-v3` (todo V3) no existe en GitHub (3 commits) y `feat/rentals-check` tiene 1. Si la notebook falla, se pierde. | Alta |
| 3 | **El módulo de mercado de V3 es `LOCAL_DEPENDENCY`:** guarda los avisos en `.data/market` (disco local) y el barrido lo dispara una persona desde la notebook con un secreto local. En Vercel el disco no persiste: el proveedor devolvería vacío. | Alta (para V3) |
| 4 | **No hay staging real:** en Vercel solo existen variables para *Production* (3: URL y clave pública de Supabase, y la clave de OpenAI). Los previews se construyen sin variables. | Alta |
| 5 | **La integración continua está rota y no protege producción:** las 6 últimas ejecuciones fallaron (el paso de lint no corre) y el último intento fue el 2 de octubre. Además solo escucha `main`, `altv3` y `vara-hardening`, y la rama de producción es `master`. Nada bloquea un despliegue malo. | Alta |
| 6 | **Sin dominio propio:** 0 dominios en la cuenta de Vercel; producción vive en `vara-altv3-theta.vercel.app`. | Media (decisión tuya) |
| 7 | **Cuenta personal de Vercel (Hobby)**, región `iad1` (EE. UU. Este). Hay que confirmar que el plan permite uso comercial, y una región más cercana (São Paulo) bajaría la latencia en Argentina. | Media |
| 8 | **Sin monitoreo, sin alertas, sin health check, sin backups documentados.** | Media |
| 9 | **Sin trabajos en segundo plano ni tareas programadas:** 0 crons, sin cola, sin envío de emails. El análisis corre dentro de una función de hasta 60 s. | Media |
| 10 | **Datos del usuario en el navegador cuando no hay sesión** (candidatos, propiedades, fotos en IndexedDB): no es un problema de la notebook, pero no es durable ni multi-dispositivo. | Media |

Lo que está bien: no hay secretos en los 146 commits, ningún `.env` se versionó nunca, los buckets de Supabase son privados, y `.env*` está ignorado.

## 2. Dependencia por dependencia

| Área | Clasificación | Evidencia | Acción sugerida |
|---|---|---|---|
| **Frontend** | `CLOUD_PRODUCTION_READY` | Vercel (`chopan55/vara-altv3`), Next.js, integrado a GitHub (`Chopan55/vara-altv3`), rama de producción `master`. Producción responde HTTP 200. | No migrar. |
| **Backend / APIs** | `CLOUD_PRODUCTION_READY` | Rutas de Next.js como funciones serverless en Vercel. Ninguna depende de `localhost` (la única mención es la lista de bloqueo anti-SSRF del importador). | No migrar. |
| **Base de datos** | `CLOUD_BUT_FRAGILE` | Supabase en la nube (`*.supabase.co`), 15 migraciones versionadas en `supabase/migrations`. Pero **un único proyecto sirve a producción y a desarrollo**, y no hay `config.toml` ni Supabase local. | Crear proyecto de staging; separar variables. No tocar el actual. |
| **Archivos subidos** | `CLOUD_PRODUCTION_READY` (con reparos) | Supabase Storage, buckets `property-photos`, `documents` y `visit-photos`, todos privados. Reparo: los usuarios sin sesión guardan fotos en IndexedDB del navegador. | Verificar URLs firmadas y políticas; decidir cuándo exigir sesión para guardar. |
| **Workers / colas** | `MISSING` | No hay cola ni worker. Importar un aviso y analizarlo ocurren en la request. | Solo si el análisis o el barrido superan el límite de la función. |
| **Tareas programadas** | `MISSING` | 0 crons en Vercel. El barrido de mercado de V3 se dispara a mano. | Cron en la nube (Vercel Cron o equivalente) para el barrido. |
| **Importación / scraping** | `CLOUD_BUT_FRAGILE` | Corre en la función serverless (`fetch` + Jina Reader + OpenAI); no usa navegador local. Fragilidad: Zonaprop bloquea desde servidores y depende del texto pegado. | Mantener; la fuente de mercado viene del barrido (ver abajo). |
| **Mercado V3 (Bright Data)** | `LOCAL_DEPENDENCY` | Store en `.data/market` (disco), clave en `.env.local` (no está en Vercel), barrido manual. | Mover el store a la tabla `market_listings` (migración escrita, sin aplicar) y programar el barrido en la nube. |
| **IA (OpenAI)** | `CLOUD_BUT_FRAGILE` | Se ejecuta en el servidor con `OPENAI_API_KEY` (secreta en Vercel, solo Production). No hay medición de uso ni de costo, salvo los topes que agregué a V3. | Medir uso y latencia; tope de gasto en el proveedor. |
| **Voz / tiempo real** | `MISSING` | No existe todavía. | Diseñar con sesiones efímeras creadas en servidor cuando se construya. |
| **VARA Visit** | `CLOUD_BUT_FRAGILE` | Datos en Supabase y verificación de PIN en el servidor. Sin trabajos de asignación ni recordatorios programados. | Revisar al armar la cola. |
| **Email / notificaciones** | `MISSING` | No hay ningún proveedor integrado. Nada depende de la notebook. | Elegir proveedor cuando haya un caso (recordatorios, Visit). |
| **Secretos** | `CLOUD_BUT_FRAGILE` | Producción: 3 variables en Vercel (una oculta). Local: `.env.local` con claves de OpenAI, Supabase, Bright Data y un token OIDC de Vercel. Historial limpio. La clave de Bright Data se pegó en un chat y debe rotarse. | Rotar la clave de Bright Data; cargar los secretos nuevos en Vercel, nunca por chat. |
| **Analítica** | `MISSING` | Los eventos de V3 van solo al logger; no hay destino ni panel. | Elegir destino de eventos de producción (separado de demo y staging). |
| **Observabilidad** | `MISSING` | Solo `observability/logger.ts` (en memoria). Sin Sentry, sin alertas, sin uptime, sin `/api/health`. | Error tracking + uptime + health check. |
| **Backups / recuperación** | `UNKNOWN` | No hay documento. El plan de Supabase y su política de backups no se pudieron ver. | Confirmar plan, frecuencia y hacer una restauración de prueba. |
| **CI / calidad** | `LOCAL_DEPENDENCY` en la práctica | Existe `.github/workflows/ci.yml`, pero falla en lint (ESLint 10 sin `eslint.config`) y no escucha `master`. En el flujo real las pruebas se corren en la notebook. | Arreglar lint, apuntar a `master` y a las ramas de trabajo, y exigir el chequeo antes de producción. |
| **Entornos** | `MISSING` (staging) | Solo Production tiene variables; los previews se despliegan sin ellas. Desarrollo local usa los datos de producción. | Staging con su propio Supabase y variables de Preview. |
| **Dominio** | `MISSING` | 0 dominios; sin `APP_BASE_URL` o equivalente. No hay URLs `vercel.app` fijas en el código (V3 usa `window.location.origin`). | Elegir dominio; ver sección 4. |
| **Protección de previews** | `UNKNOWN` | El proyecto tiene protección con login de Vercel en previews (excepto dominios propios). Para mostrar un preview a alguien hace falta invitarlo. | Decidir política antes de compartir demos. |

## 3. Qué NO conviene migrar

- **Vercel y Supabase** están bien elegidos para esta etapa. Lo que falta es separar entornos, no cambiar de proveedor.
- Un worker o una cola propios son prematuros mientras el análisis tarde segundos. Con el barrido programado alcanza.

## 4. Orden propuesto (sin ejecutar nada todavía)

| Paso | Qué | Quién decide | Costo / riesgo |
|---|---|---|---|
| 1 | **Subir las ramas que solo viven en la notebook** (`altv3`, `buy-wow-v3`, `feat/rentals-check`). | Vos (es una acción hacia afuera) | USD 0. Elimina el mayor riesgo de pérdida. |
| 2 | **Arreglar CI** (lint) y apuntarla a `master` y a las ramas de trabajo. | Yo | USD 0. |
| 3 | **Staging:** segundo proyecto de Supabase + variables de Preview en Vercel. | Vos (puede costar) | Supabase free alcanza para staging. Evita tocar datos reales. |
| 4 | **Mercado en la nube:** aplicar `market_listings` en staging, mover el store y programar el barrido; cargar la clave de Bright Data en Vercel. | Vos (migración) | Bright Data: créditos gratis. Aplicar en producción solo con tu OK. |
| 5 | **Dominio:** elegir nombre, DNS, HTTPS, URL base por variable, callbacks de autenticación. | Vos | Dominio: unos USD 10–40 por año. |
| 6 | **Observabilidad básica:** `/api/health`, error tracking y uptime. | Yo | Los planes gratuitos alcanzan al principio. |
| 7 | **Plan de Vercel y región:** pasar a Pro (uso comercial) y evaluar São Paulo. | Vos | Vercel Pro: pago mensual. |
| 8 | **Backups documentados + restauración de prueba.** | Yo + vos | Depende del plan de Supabase. |

## 5. Lo que no pude verificar

- Plan y política de backups de Supabase, y si hay recuperación a un punto en el tiempo.
- Si el plan Hobby de Vercel permite el uso comercial que VARA va a tener.
- Si GitHub tiene protecciones de rama o chequeos obligatorios.
- Qué incluye exactamente `master` frente a las ramas nuevas (la última publicación a producción fue hace 7 días).
- Las políticas de seguridad por fila de Supabase y la configuración de URLs de callback de autenticación.
- El tope de gasto configurado en el proveedor de OpenAI.

## 6. Prueba de aceptación (cuando termine la migración)

Con la notebook apagada: la aplicación abre, un aviso se analiza, los comparables se traen de la base, el asistente responde, un error genera una alerta y no queda ninguna dependencia de `localhost`, de archivos locales ni de `.env.local`.
