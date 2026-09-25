# VARA AltV2 — Auditoría final

**Fecha:** 24 de septiembre de 2026 · **URL:** https://vara-altv2.vercel.app
**Alcance:** las 8 fases del plan (A–H), sobre el proyecto existente. No se reconstruyó nada desde cero.

---

## 1. Estado verificado

Todo lo de esta tabla se midió en esta sesión, no se estimó.

| Qué | Valor | Cómo se verificó |
|---|---|---|
| Tests | **280 pasando**, 12 archivos | `npx vitest run` |
| Typecheck | limpio | `npx tsc --noEmit` |
| Build | OK | `npm run build` |
| Rutas | 24 | 17 en HTTP 200, 3 en 307 (redirects), medido con `curl` |
| Links internos rotos | **0** | barrido de `href` contra las rutas existentes |
| Migraciones | 7, todas aplicadas | `supabase migration list` — local = remoto |
| `console.error` sueltos | **0** | los 11 pasaron al logger |

### Lo que se construyó, por fase

| Fase | Entregado |
|---|---|
| **A** | Desconexión de `mockTransaction`; estados vacíos honestos |
| **B** | Next Best Action determinístico, con evidencia por acción |
| **C** | Decision Center: candidato ≠ operación, comparación sin puntaje |
| **D** | Subida real de documentos + entidad `Offer` con contraofertas |
| **E** | Activity Ledger por triggers + participantes reales |
| **F** | `/dinero` unificada; nombres de visitas distinguibles |
| **G** | Error boundary, logger con lista blanca, tests del core |
| **H** | Esta auditoría |

---

## 2. Bugs encontrados y corregidos en la auditoría

Los tests de la Fase G destaparon tres errores que **ya estaban en producción**. Los tres son de la misma familia: entradas del mundo real que nadie había probado.

| Bug | Qué mostraba | Dónde |
|---|---|---|
| División por cero | `Infinity% – Infinity% del valor de la propiedad` | `regulations.ts` — cálculo de costos |
| Sin validar entrada | `USD NaN` | `utils.ts` — `formatPrice` |
| Error crudo del motor | `Invalid Date` | `utils.ts` — `formatDate` |

El primero es el más serio: aparecía en la pantalla de costos de alguien a punto de comprometer doscientos mil dólares.

Además, dos datos fabricados que sobrevivían:

- **`/costos` arrancaba en `USD 185.000`** y la cabecera decía *"Propiedad: USD 185.000"*, como si fuera la del usuario. Ahora toma el precio real cargado o no calcula nada.
- **`/visitas` mostraba `"Av. Los Robles 432, La Lonja · Pilar"`**, escrito a mano, sin ninguna fuente de datos.

---

## 3. Barrido de honestidad

Se revisaron las 24 rutas buscando datos inventados presentados como reales.

**Resultado: no queda ninguno.** Las tres pantallas que muestran datos de ejemplo lo declaran explícitamente y solo tras un clic deliberado:

| Ruta | Qué muestra | Salvaguarda |
|---|---|---|
| `/ofertas` | compradores de ejemplo | opt-in + banner *"Estos compradores y sus ofertas no son reales"* |
| `/visitas-vendedor` | solicitudes de ejemplo | opt-in + banner *"Estos compradores no son reales"* |
| `/dinero?tab=precios` | comparables de mercado | opt-in + banner persistente |

`/visitas` usa una plantilla estática de checklist. Es contenido, no un dato de usuario fabricado: la lista de qué mirar al visitar una casa es la misma para todos.

Las operaciones demo (`txn-001` a `txn-003`) siguen usando el mock, pero están explícitamente identificadas como demo en el código y no se crean solas.

---

## 4. Decisiones de producto que quedaron fijadas con tests

No son opiniones sueltas: hay un test que falla si alguien las revierte.

**VARA no elige por vos.** La comparación de propiedades marca quién gana en cada dimensión y no arma un puntaje compuesto. Un número de 0 a 100 que mezcla precio, superficie y ambientes no significa nada porque cada persona pondera distinto.

**Un empate no tiene ganador, y un dato único tampoco.** Ganar por ser la única propiedad que cargó las expensas no es ganar.

**VARA no opina sobre la plata de nadie.** Ofrecer un 30% menos del precio pedido no genera error ni advertencia: es una estrategia legítima. Solo se muestra la diferencia contra el precio pedido, que es un hecho verificable. Sin precio publicado, no se muestra un 0% — se dice que no hay referencia.

**El historial no se puede editar ni borrar.** Los eventos los escriben triggers de Postgres, no la aplicación: un ledger que depende de que cada pantalla se acuerde de registrar tiene agujeros, y un agujero da confianza falsa.

**El tiempo nunca se adelanta.** 2h50 se dice "hace 2 horas", no "hace 3".

**Nunca se loguea el dato de la persona.** El contexto pasa por una lista blanca, no negra: un campo nuevo con datos sensibles queda afuera por omisión.

---

## 5. Privacidad y seguridad

| Qué | Cómo está |
|---|---|
| Documentos | bucket privado, URL firmada que vence a los **5 minutos** |
| Ofertas | RLS propia — revelan cuánto está dispuesto a pagar alguien |
| Participantes | RLS propia — son datos de contacto de terceros |
| Historial | solo lectura desde el cliente; sin política de insert/update/delete |
| Montos | `numeric(14,2)`, no float |
| Logs | lista blanca de claves; nunca dirección, precio ni nombre |

### Pendiente, y es lo más urgente de todo este documento

**Rotar la API key de OpenAI.** Se pegó en el chat durante el desarrollo y sigue activa. Ahora que la base tiene documentos y ofertas reales, esto deja de ser una deuda menor. Es un minuto en el dashboard de OpenAI.

---

## 6. Lo que queda sin hacer, y por qué

Nada de esto es un descuido: son decisiones tomadas a conciencia.

**Las tareas no tienen fecha de vencimiento.** El checklist no las trae y no las inventé. Podría haber armado un panel de deadlines con plazos plausibles —"el informe de dominio tarda 5 días"— y se vería muy bien, pero serían fechas fabricadas sobre las que alguien tomaría decisiones reales. El único vencimiento que existe de verdad hoy es la validez de una oferta, y ese sí se muestra.

**53 `catch {}` vacíos.** La mayoría son `try { localStorage... } catch {}`, donde fallar en silencio es correcto: si el navegador bloquea el storage, la app tiene que seguir andando. Revisarlos uno por uno es trabajo de mantenimiento, no de esta fase.

**No hay servicio de monitoreo.** El logger guarda los últimos 50 eventos en memoria y escribe en consola. No finge mandar nada a ningún lado porque no hay Sentry contratado. Cuando lo haya, se enchufa en `setSink` sin tocar los 11 lugares que loguean.

**Fotos del reporte de VARA Visit** (`photoPaths` se guarda vacío) — quedó de la etapa anterior, P1-8.

**Riesgos con evidencia y estado** (P1-3) — quedó fuera del plan de estas 8 fases.

---

## 7. Qué probar antes de mostrárselo a alguien

Tres caminos que no pude verificar yo porque necesitan tu sesión:

1. **Subir un PDF** en una operación → abrirlo → subir una versión nueva. Es la primera vez que ese camino corre contra la base real.
2. **Hacer una oferta** → marcar que te contraofertaron → confirmar que la original queda visible en la cadena.
3. **Entrar a "Qué pasó"** después de lo anterior y confirmar que los triggers registraron todo solos.

Si los tres andan, el producto hace lo que dice que hace.
