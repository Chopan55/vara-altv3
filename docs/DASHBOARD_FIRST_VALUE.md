# Dashboard — First value / Next Best Action

Auditoría y propuesta. Sprint 2026-10-19. La implementación de este PR es **solo el MVP** de esta propuesta.

## Objetivo

Al entrar, en menos de 5 segundos, el usuario entiende:

1. qué operación tiene activa,
2. en qué estado está,
3. qué es lo más importante que debe hacer ahora,
4. por qué,
5. cuál es la acción concreta.

Principios: una sola acción principal · primero decisión, después detalle · mostrar incertidumbre cuando falta información · no inventar datos · compra y venta con la misma lógica · invitado y cuenta ven lo mismo · mobile first.

## Auditoría del dashboard actual

### Orden en el celular (compra)

`banner de guardar` → `banner "bienvenido de vuelta"` → `saludo 👋` → `tarjeta "VARA te acompaña…"` → `resumen de cartera` → **tarjeta azul del agente** → novedades → lista de operaciones (cada una con su "Próxima acción") → propiedad importada → tarjeta de la operación → **segunda "Próxima acción"** → riesgos → costos → documentos → "Tiempo estimado" → "Qué cambió" → accesos rápidos → columna derecha (atención, próximos pasos, VARA AI, Labs).

La decisión queda **debajo de tres bloques decorativos**, y la misma recomendación se repite **cinco veces**.

### Problemas encontrados

| # | Problema | Efecto |
|---|---|---|
| 1 | La acción principal aparece 5 veces (banner de retorno, tarjeta del agente, tarjeta dentro de cada operación, segunda tarjeta "Próxima acción", columna "Próximos pasos"). La segunda usa **otro cálculo** que el agente. | Ruido y riesgo de que se contradigan. |
| 2 | Saludo + tarjeta de marketing + resumen de cartera antes de la acción. | En un celular la acción no se ve sin scrollear. |
| 3 | El motor nunca recibe la propiedad cargada: muestra **"Precio $0" y "~0K gastos"** como si fuera un cálculo, y siempre pide "Cargá el precio" aunque ya esté. | Datos incorrectos presentados como ciertos. |
| 4 | "Tiempo estimado" es una barra decorativa (siempre marca "Docs"). | Dato inventado. |
| 5 | "Qué cambió" lee un timeline que en operaciones propias está siempre vacío. | Tarjeta vacía. |
| 6 | "Documentación crítica pendiente" se muestra como **riesgo alto desde el día 1**. | Alarma falsa en una operación nueva. |
| 7 | El estado vacío se muestra si falta una bandera del navegador (`vara_onboarding_done`), aunque haya operaciones. | Al iniciar sesión en otro dispositivo se ocultan las operaciones reales. |
| 8 | Estado vacío: "Ver demo" abre una operación ficticia, y hay un acceso a Labs. | Dos salidas que no llevan a valor. |
| 9 | Venta usa otra pantalla, otra lógica de "próximo paso" y toma la **primera** venta, no la activa. | Compra y venta no se comportan igual. |
| 10 | Accesos rápidos con textos fijos (p. ej. "Buenos Aires Prov." para cualquier provincia); "Costos del vendedor" con rangos escritos a mano. | Datos que no son del caso del usuario. |

## Propuesta

### Qué queda

- El **agente de próximo paso** (`NextStepAgent`): título, por qué, "en qué me baso", CTA. Es el héroe. No se toca su diseño ni su motor (`nba/engine`).
- Propiedad que el usuario está mirando (compacta).
- Costos estimados, **solo cuando hay precio**; si no, se dice qué falta.
- Novedades reales (`activity_events`), solo si hay.
- Checklist de venta (con sus fechas) y la referencia de precio por m².
- Lista de operaciones, solo si hay más de una.

### Qué se elimina

- Banner "Bienvenido de vuelta" (repetía la acción).
- Saludo con emoji y tarjeta "VARA te acompaña…".
- Resumen de cartera (pasa al encabezado: "Operación 1 de 2").
- Segunda tarjeta "Próxima acción" (otro cálculo, contradecía al agente).
- "Próxima acción" dentro de cada tarjeta de operación.
- "Tiempo estimado" (decorativo).
- "Qué cambió" (vacío).
- Documentación como bloque propio (queda un contador con link).
- Accesos rápidos fijos, VARA AI y Labs como tarjetas de promoción.
- Riesgos derivados de "documentos pendientes" (no son riesgos: son tareas).
- Estado vacío: "Ver demo" y el acceso a Labs.

### Qué se reordena

1. **Encabezado de la operación**: tipo (Compra/Venta), título, lugar, etapa, avance y **estado con su motivo**.
2. **Una sola acción principal** (héroe).
3. **Lo que falta saber** (incertidumbre), si corresponde.
4. **Después de esto** (las dos acciones siguientes, compactas).
5. **Datos**: propiedad, costos, atención.
6. Novedades.
7. Otras operaciones / administrar (colapsado).

### CTA principal

El CTA lo define siempre el motor: el de la acción principal (p. ej. "Ver documentos", "Cargar la propiedad"). Un solo botón relleno por pantalla. Si falta la propiedad, la acción principal es **cargarla**: sin ella no se puede calcular nada ni detectar riesgos.

### Estados

**Vacío (sin operaciones)** — una sola decisión:
> **Empezá tu operación.** Contanos si comprás o vendés y en qué provincia: VARA arma tu plan, tus costos y tus próximos pasos.
> `[Crear mi operación]` · enlace secundario: `Analizar una propiedad`

Se muestra **solo** si no hay operaciones (invitado o con cuenta). Nada de demos ni promociones.

**Operación nueva (sin pasos hechos, sin propiedad cargada)**
- Encabezado: *Compra · Mi compra · Palermo · Etapa 1 · 0%* — estado **"Recién empezada"** ("Todavía no marcaste ningún paso").
- Héroe: **"Cargá la propiedad que estás mirando"** — *por qué:* sin ella no podemos calcular cuánto te sale ni detectar riesgos — *en qué me baso:* "Todavía no hay una propiedad asociada" — `[Cargar la propiedad]`.
- Lo que falta saber: "Los costos se calculan sobre el precio. Cuando cargues la propiedad los ves acá." (sin números inventados; no se muestra "$0").
- Después de esto: las dos acciones siguientes del plan.

**Operación con riesgos / tareas pendientes**
- Encabezado: estado **"Requiere atención"** o **"Bloqueada"**, con el motivo ("2 tareas bloqueadas").
- Héroe: la acción bloqueante, con su evidencia.
- "Atención": lista corta de lo que frena (tareas bloqueadas, riesgos reales de la operación). Los documentos pendientes se cuentan, no se pintan de rojo.
- Costos con su confianza ("Estimado — validalo con tu escribano").

### Compra vs. venta

Misma estructura y mismo componente de encabezado, héroe e incertidumbre. Cambian los textos, las acciones y los datos:

| | Compra | Venta |
|---|---|---|
| Fuente del próximo paso | Motor NBA (reglas) | Checklist de venta (tareas), expresado como la misma acción |
| Datos | Propiedad que mirás + costos del comprador | Checklist con fechas + referencia de precio |
| Falta algo | "Cargá la propiedad que estás mirando" | "Cargá los datos de tu propiedad" |

### Invitado y cuenta

Una sola función pura (`buildFirstValue`) arma lo que se muestra. No recibe la sesión: lo mismo en ambos casos. La invitación "Guardá tu operación" sigue como franja aparte, sin competir con la acción.

## MVP implementado en este PR

- `src/lib/dashboard/firstValue.ts`: lógica pura y testeada (estado, motivo, acción principal, "después de esto", incertidumbre, regla de estado vacío).
- `src/components/dashboard/`: encabezado, incertidumbre, "después de esto", tarjetas de datos, estado vacío.
- `src/app/dashboard/page.tsx`: compra y venta con la nueva estructura; sin duplicados ni datos fijos.
- La propiedad cargada ahora se **asocia a la operación** en el dashboard: los costos y la acción usan el precio real.
- El estado vacío depende **solo** de que no haya operaciones.

## Fuera de alcance (a propósito)

Migraciones · auth · publicación · fotos · documentos · VARA Visit · voz/avatar. Tampoco se modifica el motor `nba/engine` (lo usa la pantalla de la operación) ni la pantalla `/operacion/[id]`.

## Riesgos y seguimiento

- La pantalla de la operación (`/operacion/[id]`) sigue sin recibir la propiedad cargada: allí el motor puede seguir pidiendo el precio. Mismo arreglo, en otro sprint.
- La propiedad "que estás mirando" se infiere (vínculo por `propertyId` y, si no hay, la última importada): conviene vincularla explícitamente al crear la operación.
- **Venta como invitado:** el plan sale del motor regulatorio (primer paso "Oferta y negociación de precio", 19 pasos), mientras que con cuenta sale del checklist de venta (documentos, precio, fotos, publicar… 7 pasos). La lógica del dashboard es la misma, pero el contenido del plan difiere. Unificarlo requiere guardar el checklist de venta también para invitados y migrarlo a la cuenta: es un sprint propio (no se resolvió acá a propósito).
- Una operación **nueva** no se presenta como "frenada": mientras no se marque ningún paso, los primeros documentos se muestran como "Lo siguiente para avanzar" y no como "Esto frena tu operación". Una tarea bloqueada o un riesgo real sí frenan.
- Se miró en un celular de 375 px contra el servidor local (invitado: estado vacío, compra nueva sin propiedad, compra con propiedad y precio, venta nueva). No se probó en un dispositivo real ni con cuenta.
- El agente de IA ("Explicámelo simple", "Redactá el mensaje") exige cuenta; un invitado ve un aviso. Se puede ocultar para invitados en otro sprint.
- No se probó en un dispositivo real: revisar en el preview en celular.
