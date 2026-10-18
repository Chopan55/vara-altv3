# VARA — Release candidate `integracion`

**Fecha:** 2026-10-17 · **Rama:** `integracion` (base `a74b874`; los cambios descritos acá van en un único commit sobre esa base) · **Producción:** `e21db7b`, sin tocar.
No se desplegó, no se mergeó a `master`, no se modificó la base de producción ni sus datos. No se cambiaron variables de Vercel. No se imprimieron secretos.

Cómo se verificó: pruebas automáticas (790), compilación de producción local (con la bandera `buyWowV3`, igual que producción), navegador real contra esa compilación, escaneo de los archivos públicos compilados, y lectura de solo lectura de Vercel y de las bases. **Límite honesto:** no se puede iniciar sesión desde acá (la autenticación es de un servicio externo y la contraseña es tuya), así que los flujos que exigen sesión **no se verificaron de punta a punta**; está dicho en cada punto.

---

## 1. AI ALLOWLIST

- **Antes:** dos mecanismos. `AI_ALLOWED_EMAILS` (V3, chat nuevo y voz; ya cargada en producción) y `VARA_AI_ALLOWED_EMAILS` (6 rutas heredadas; no existía en ningún entorno de Vercel). Dos implementaciones de `isAiAllowed`.
- **Ahora:** **una sola**, en `src/lib/ai/allowlist.ts`, variable canónica **`AI_ALLOWED_EMAILS`** (solo servidor). `lib/analysis/aiAccess.ts` y `lib/api/aiAccess.ts` la reutilizan (re-exportan la misma función; test: ambas son idénticas). `VARA_AI_ALLOWED_EMAILS` se eliminó del código, de `.env.example` y de `VARA_DECISIONS.md`.
- **Falla cerrado:** sin la variable (o vacía) nadie puede usar la IA. Verificado por test.
- Autorizado pasa; no autorizado recibe **403**; sin sesión, **401**; tope diario → **429**. Probado por test sobre `requireAiAccess`/`requireAiAllowed` (con `requireAuth` simulado) y contra la compilación local sin sesión: `chat`, `negotiation`, `transform`, `listing-copy`, `tour-clip` → 401; `v3/explain`, `v3/speak` → 403.
- Nunca se expone al navegador (test: ningún `NEXT_PUBLIC_AI_ALLOWED*`, ningún archivo de cliente la lee; escaneo del build: no aparece).
- **No verificado:** que las 6 rutas respondan 200 para tu email con sesión real (requiere tu sesión).
- **Consecuencia para producción (decisión tuya):** hoy, en `master`, esas rutas dejan usar OpenAI a cualquier usuario con sesión (y `scrape-property`, **a cualquiera sin cuenta**, ver riesgos). Con esta rama solo usan IA los emails de `AI_ALLOWED_EMAILS` (hoy: solo `falonsohidalgo@gmail.com`). Las otras 4 cuentas de producción (todas tuyas) perderían la IA salvo que las agregues.

## 2. BRIGHT DATA DEPENDENCY

**REQUIRED_FOR_ANALYZAR: NO.**
- `BRIGHTDATA_API_KEY` solo se lee en `api/v3/market/sweep/route.ts` y `api/v3/market/sweep/cron/route.ts` (solo servidor). El flujo de `/analizar` usa `/api/scrape-property` (no usa Bright Data) y `/api/v3/market` (lee `market_listings`, 300 avisos sin coordenadas, ya cargados).
- Es solo servidor: ningún archivo de cliente lo menciona; escaneo del build: ni el nombre ni el valor aparecen en los archivos públicos. Test: exactamente esos 3 archivos lo referencian.
- Falla con honestidad: sin la clave, el barrido responde **503** "Falta configurar Bright Data" sin llamar a la red ni escribir; con secreto incorrecto, **401**. No se inventan comparables (test).
- Requisito exacto para **usar** el barrido (no para `/analizar`): en Production, `BRIGHTDATA_API_KEY` + `MARKET_SWEEP_SECRET` (+ `CRON_SECRET` y `MARKET_CRON_ENABLED=1` si se quiere el cron). **No se cargó ninguna.** Hoy Bright Data existe solo en `.env.local`.

## 3. STAGING SCHEMA

- **Actualización posterior (informada por el dueño, NO re-verificada desde acá):** después de esta verificación, el dueño informó que `contact_requests` **ya fue creada y verificada en staging**, y se pidió no tocar Supabase, por lo que no se volvió a consultar. Todo lo que sigue de este punto describe la verificación previa, hecha cuando la tabla todavía no aparecía, y queda como registro. Pendiente de re-verificación independiente (esquema exacto, camino feliz = 1 registro, anónimo sin lectura): se hace cuando se autorice volver a consultar staging.
- **Estado a 2026-10-17 (verificación previa): la migración NO figuraba aplicada en staging.** Tras el aviso de que la habías aplicado, se verificó (solo lectura, base confirmada como staging `itdeptqwpztsooozarut`): `contact_requests` → **HTTP 404, `PGRST205` "Could not find the table 'public.contact_requests' in the schema cache"**, tanto con la clave de servicio como con la pública, y se reintentó durante ~45 s sin cambio. La API de staging expone **32 tablas y `contact_requests` no está entre ellas**. No es un problema de caché: el SQL incluye `notify pgrst, 'reload schema'`.
- **Producción, para comparar (solo lectura):** `contact_requests` → 401 (existe), igual que antes. Producción no cambió.
- Causas posibles (no se puede distinguir desde acá, porque no hay acceso de DDL ni al panel): el SQL no se ejecutó, falló con un error, o se ejecutó en **otro proyecto** (por ejemplo en "VARA MVP", donde la tabla ya existía y por eso no habría dado error).
- **Cómo comprobarlo vos (30 segundos):** en el SQL Editor de **VARA STAGING** (la URL debe contener `itdeptqwpztsooozarut`), ejecutar `select to_regclass('public.contact_requests');`. Si devuelve `null`, la tabla no existe: volvé a pegar `supabase/migrations/20261010000000_contact_requests.sql` y ejecutá, y fijate si aparece algún error. Si devuelve `contact_requests`, ejecutá `notify pgrst, 'reload schema';` y avisame.
- **Verificación de la tabla (pendiente, la repito en cuanto avises):** esquema exacto (columnas `id uuid`, `name`, `email`, `message`, `created_at`), camino feliz (un pedido válido crea exactamente un registro con el mail normalizado), pedidos inválidos sin registros, y que el anónimo no pueda leer, modificar ni borrar.

**Verificado en staging, sin depender de la tabla (2026-10-17, sitio local compilado contra staging):**
- **Validación (13 casos):** nombre de 1 o 81 letras, mail sin arroba, dos mails, mail con salto de línea, mensaje de 9 o de 1001 caracteres, campos numéricos, objeto como mail, campos faltantes y JSON roto → **400** con mensaje genérico; cuerpo de más de 4.000 caracteres → **413**; campo trampa → 200 sin guardar. Ningún caso llegó a la base.
- **Límite de uso:** 8 pedidos seguidos desde una misma IP → `400 400 400 400 400 429 429 429` (a partir del sexto, 429); un pedido **válido** desde esa IP ya limitada → 429; otra IP distinta sigue pudiendo.
- **Sin datos personales en logs:** tras forzar el camino de error con un pedido válido, el log del servidor solo tiene `contacto.rate_limited` y `contacto.save_failed`, ambos con contexto vacío. **0 coincidencias** del nombre, el mail y el mensaje de prueba en todo el log.
- **Resto de staging sin cambios:** foto de las 32 tablas antes y después → **idénticas** (ninguna fila creada, modificada ni borrada; `market_listings` sigue en 358, `profiles` 1, `audit_events` 10). Como la tabla no existe, ningún pedido pudo guardar nada.
- **Camino de error con la tabla ausente:** un pedido válido responde 500 con "No pudimos guardar tu mensaje" (sin filtrar detalles técnicos).

## 4. CONTACT ENDPOINT

`POST /api/contacto` endurecido (`src/app/api/contacto/route.ts` + `src/lib/contact.ts`):
- **Límite de uso:** 5 pedidos por IP por hora y 300 por día en total (en memoria de cada instancia: frena abusos evidentes, no es contabilidad exacta). Excedido → 429.
- **Tamaño:** cuerpo máximo 4.000 caracteres → 413.
- **Validación estricta:** solo texto; nombre 2–80, mail 5–120, mensaje 10–1000; sin caracteres de control; mail normalizado (minúsculas) y con formato estricto (rechaza listas, saltos de línea, `<>`, comas).
- **Sin relay abierto:** el endpoint no envía mails; solo inserta en `contact_requests`.
- **Errores seguros:** mensajes genéricos; no devuelve ni registra detalles de la base.
- **Sin registro sensible:** los logs no incluyen nombre, mail ni mensaje (test lo comprueba).
- Campo trampa conservado. 16 tests nuevos. Probado en el navegador: con staging sin tabla muestra el error amable (500) y no guarda nada.
- Límite conocido: el tope por IP vive en memoria; con varias instancias de Vercel es aproximado. Para algo estricto haría falta un almacén compartido.

## 5. /EMPEZAR

- **Defecto encontrado:** "Ya encontré una propiedad" llevaba a `/propiedades`, no a `/analizar`; la pantalla nunca guiaba a "Analizar propiedad".
- **Corregido:** con V3 activo, esa opción lleva a `/analizar`.
- **Decisión:** `/empezar` **sigue detrás de su bandera y ahora apagada por defecto** (`conversationalEntry: false`; se enciende con `NEXT_PUBLIC_FLAGS=conversationalEntry`). Motivos: crea una operación al terminar (escritura en la base), y no puedo verificar con sesión real el redirect post-login, el recargar, la URL directa y el volver. La página no se borró.
- **Verificado en el navegador (bandera apagada):** `/empezar` → `/dashboard`; el login, sin bandera, va a `/dashboard` (test + código). Quien ya tiene operaciones iba igual a `/dashboard`.
- **No verificado:** el comportamiento con la bandera **encendida** y con sesión real.
- El login conserva `?next=` (`safeNext`).

## 6. ROUTING

- Ruta canónica: **`/analizar`**. No existe `/dashboard/analizar` en ninguna rama (404 en producción y en el build local; ningún archivo la genera: test).
- Menú de compra "Analizar propiedad" → `/analizar` (probado con clic real en el navegador, con la bandera de producción; solo aparece en modo Comprando).
- Los 3 enlaces internos a `/analizar` (menú, `/empezar`, `/compartido`) usan exactamente esa ruta (test).
- Navegación directa, recarga, atrás y adelante: OK. El middleware solo refresca la sesión: `/analizar` es accesible con o sin cuenta (a propósito: "sin cuenta ni formularios"); tras el login se respeta `?next=`.
- Menor: la portada nueva no tiene un acceso directo a `/analizar` (su CTA va a `/onboarding`).

## 7. AVATAR / AI

- **Verificado localmente (prueba visual de 6 estados con capturas, antes de esta etapa):** el avatar WebGL carga, reposo animado, parpadeo, "pensando" y "hablando" con boca sincronizada con el volumen; respaldo al avatar básico si WebGL falla (3 tests nuevos: sin WebGL, shader que no compila, contexto perdido).
- **No verificable acá:** en la vista previa (protegida por login de Vercel y sin clave de OpenAI) ni con sesión real. La sección "Preguntale a VARA" y el avatar solo aparecen para un email autorizado con sesión.
- La voz no en vivo (OpenAI TTS) está implementada y probada con audio simulado; la respuesta real de OpenAI **no se verificó** (requiere tu sesión).
- Las respuestas de la IA usan el contexto del análisis (el chat recibe solo el resumen calculado del análisis y descarta respuestas con números ajenos; 14 tests de IA, incluida la verificación de números). No se probó en vivo.
- La voz en vivo (Realtime) **no** se tocó.
- `/analizar` no se rompe: carga con y sin avatar (probado sin sesión; el avatar no se monta sin acceso).

## 8. CRITICAL FLOW RESULTS

| Flujo | Resultado |
|---|---|
| A. Anónimo: portada → login → entrada | **Parcial:** portada y `/login` cargan; **no se pudo iniciar sesión** (no verificado el paso del login y la entrada autenticada) |
| B. Usuario con sesión → `/empezar` → `/analizar` | **No verificado** (requiere sesión). Sin sesión: `/empezar` → `/dashboard` (bandera apagada) y `/analizar` accesible |
| C. Analizar propiedad | **Verificado sin cuenta:** link de Zonaprop → avisa con honestidad que el portal bloquea y ofrece pegar el texto; al pegar, **sin acceso de IA** responde un mensaje (que se corrigió porque decía "creá una cuenta" y la cuenta no alcanza). **No verificado:** resultado completo con un email autorizado |
| D. Dashboard existente | OK (estado vacío; con operación de venta muestra "Tu operación de venta") |
| E. Compra | OK: menú Buscar/Visitar/Mi operación, "Analizar propiedad", pantallas cargan |
| F. Venta | OK: onboarding "Quiero vender" → dashboard de venta (20 pasos); menú Mi venta/Interesados/Mi operación; 32 rutas sin pantallas rotas. Defecto menor: justo tras crear la operación, el menú sigue en "Comprando" hasta recargar o cambiar de pantalla |
| G. VARA AI | **No verificado en vivo** (requiere sesión + clave) |
| H. Avatar | Verificado localmente (ver punto 7); no en Preview |
| I. Formulario de contacto | Verificados validación (13 casos), límite de uso, logs sin datos personales y camino de error. **Camino feliz NO verificado: la tabla `contact_requests` no existe en staging** (ver punto 3) |
| J. Cerrar sesión y volver a entrar | **No verificado** (requiere sesión) |

Otros defectos encontrados en el recorrido: error de hidratación de React (#418) en `/planes`, `/demo` y `/labs` (las páginas funcionan; menor); favicon 404.

## 9. MIGRATION SAFETY

- Las 17 migraciones se escanearon. **Ninguna de las dos nuevas es destructiva:** sin `DROP`, `TRUNCATE`, `DELETE`, `UPDATE` ni `ALTER ... DROP`; ambas idempotentes (`if not exists`).
- En el resto: los `UPDATE` están dentro del cuerpo de funciones (lógica de ejecución de Visit, no cambios de datos al migrar) y hay un único `DROP COLUMN` (`visit_bookings.confirmation_pin` en `visit_hardening`) que solo corre si la columna existe y **antes copia sus datos** a `visit_pins`; ya está aplicada en producción y no forma parte de esta entrega.
- **Las migraciones de producción NO necesitan correr para este release.** Evidencia (sondas de lectura): en producción ya existen `contact_requests`, la columna `operations.country`, `negotiations`, `market_listings`, `audit_events`. Es una inferencia por existencia de objetos (no hay acceso al historial de migraciones); el índice `idx_operations_country` no se pudo verificar (solo afecta rendimiento).
- **Supuestos de esquema de producción:** las tablas anteriores existen con esas columnas; `contact_requests` admite INSERT para `anon`/`authenticated` y no admite lectura.

## 10. SECRET SAFETY

- Escaneo de **298 archivos públicos** del build (`.next/static` + HTML prerenderizado): **no aparece ningún valor** de `OPENAI_API_KEY`, `BRIGHTDATA_API_KEY`, `SUPABASE_SECRET_KEY`, `MARKET_SWEEP_SECRET` ni del token de Vercel; **ningún nombre** de `OPENAI_API_KEY`, `BRIGHTDATA_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `MARKET_SWEEP_SECRET` ni `AI_ALLOWED_EMAILS`; ningún patrón de clave (`sb_secret_`, `sk-`, `AIza`).
- Tests permanentes: ningún archivo "use client" lee variables privadas; ninguna variable privada con `NEXT_PUBLIC_`; el código no contiene claves reales.
- Nota: `GEMINI_API_KEY` no está cargada en ningún lado (no se pudo contrastar su valor, pero su nombre no aparece en el cliente).

## 11. BYPASS TOKEN

- Hay **1** token de bypass de la protección de despliegues en el proyecto `vara-altv3`, tipo `automation-bypass`, creado el 2026-10-16 05:21 UTC (lo generó un `vercel curl` mío), sin nota. Valor no impreso.
- **Nada lo usa:** ningún archivo del repo, ni workflow, ni script referencia un token de bypass.
- **Recomendación: revocarlo.** No se revocó (requiere tu aprobación explícita).

## 12. CRON

- `vercel.json` (en `master`) registra `GET /api/v3/market/sweep/cron` todos los días a las 09:00 UTC.
- Comportamiento actual (probado, test + compilación local): con `MARKET_CRON_ENABLED` ausente, responde `{"status":"disabled"}` **antes de cualquier otra cosa**: no llama a ningún proveedor (la red está simulada para fallar y no se toca), no lee Bright Data, **no escribe ni modifica datos**. Costo externo: ninguno; solo una invocación de función sin costo apreciable.
- Si se enciende (`MARKET_CRON_ENABLED=1` + `CRON_SECRET` + `BRIGHTDATA_API_KEY`): decide cada día según el último barrido (iniciar uno nuevo si pasaron 7 días, ingresar el reciente, o esperar); con credenciales incorrectas responde 401 sin tocar el proveedor.
- **No es bloqueante.**

## 13. BACKUP STATUS

**BACKUP_READY: NO.**
- No hay evidencia de un respaldo verificado de la base de producción ("VARA MVP"). La documentación del repo lo da como `UNKNOWN`; la organización de Supabase figura en plan Free, que no incluye respaldos diarios gestionados ni recuperación a un punto en el tiempo. Yo no puedo abrir el panel (requiere tu inicio de sesión) ni exportar la base (requiere su contraseña o un token de administración), y no creé pruebas destructivas.
- Qué hace falta (acción tuya): en Supabase → proyecto "VARA MVP" → Database → Backups, confirmar si hay copias diarias o PITR; si no hay, pasar a un plan con respaldos (costo, a tu aprobación) o hacer una exportación completa manual antes de promover y guardarla fuera de la notebook.

## 14. TEST RESULTS

- **Tipos:** `tsc --noEmit` OK.
- **Lint:** 0 errores, 87 avisos (de estilo, los mismos que ya había).
- **Tests:** **790 pasan**, 1 omitido (60 archivos). Base: 749. **+41 nuevos, ninguna regresión.** Nuevos: lista de IA (8), Bright Data/cron (5), contacto (16), rutas y secretos (8), avatar/respaldo (3), banderas (+1).
- **Build de producción:** OK (47 páginas), también con `NEXT_PUBLIC_FLAGS=buyWowV3`.
- **CI de GitHub** sobre `a74b874` (antes de estos cambios): success. La CI del commit de endurecimiento corre al subirlo; el resultado se revisa en GitHub.

## 15. REMAINING RISKS

1. **Producción actual tiene un hueco de gasto:** en `master`, `/api/scrape-property` llama a OpenAI **sin ningún control de acceso ni tope** (conclusión por lectura del código; no se probó en vivo para no gastar). Esta rama lo cierra. Es un argumento para promover, y para revisar el gasto en el panel de OpenAI.
2. **Funciones de IA solo para emails habilitados:** también el atajo de pegar texto de Zonaprop (el portal más usado y que bloquea la lectura automática). Un usuario normal no puede analizar un aviso de Zonaprop hoy. Decisión de producto/costo.
3. Flujos con sesión sin verificar (ver punto 8).
4. `/empezar` queda apagada; su valor real no se probó.
5. Tope de contacto por IP aproximado (memoria por instancia).
6. Hidratación (#418) en `/planes`, `/demo`, `/labs`; desfase de menú tras crear una operación; favicon 404.
7. `vara-ar`: segundo proyecto de Vercel que despliega previews del mismo repo; su producción no se pudo inspeccionar (403). **Ambigüedad de infraestructura, no bloqueante;** limpiar más adelante. No se modificó.
8. Cron diario registrado (inofensivo mientras esté apagado); token de bypass sin uso (revocar).
9. La portada nueva no enlaza a `/analizar`.

## SAFE TO PROMOTE: **NO**

**Bloqueantes pendientes (actualizado 2026-10-17):**
1. **Respaldo de producción no verificado** (`BACKUP_READY: NO`).
2. **Flujos críticos con sesión sin verificar** (login y entrada, usuario existente, VARA AI con tu cuenta, avatar y voz, cerrar sesión y volver a entrar). Hace falta que los recorras vos en la vista previa o en una compilación con tu sesión.
3. **`contact_requests` en staging: informada como creada y verificada por el dueño; sin re-verificación independiente.** Mi verificación previa la daba por ausente (404 `PGRST205`). Hasta re-verificarla (esquema exacto, camino feliz = un registro, anónimo sin lectura) el camino feliz del formulario cuenta como no verificado por mí. No es un riesgo para producción (la tabla ya existe allí).

*Resueltos con evidencia en esta ronda:* validación, límite de uso, ausencia de datos personales en logs, y que el resto de staging no cambió.

*No bloquean pero sí hay que hacerlos antes de cerrar:* decidir sobre la lista de IA (cuentas a agregar) y revocar el token de bypass.
