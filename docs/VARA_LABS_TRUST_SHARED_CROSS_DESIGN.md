# Labs · Trust Passport, Shared Transaction State y Cross-Transaction Intelligence

Diseño. 2026-10-22. **No hay código ni migraciones en este PR**: las tres funciones necesitan tablas nuevas, permisos entre personas y decisiones de privacidad que son de Pancho. Este documento deja el camino más corto para cada una y qué hay que decidir antes.

Estado hoy: las tres figuran en `/vara-labs` como "En desarrollo" y **ninguna existe en el producto**. Next Best Action y Negotiation Intelligence salieron de esa lista en este mismo PR porque sí funcionan.

## Qué ya existe y se reutiliza

| Pieza | Dónde | Sirve para |
|---|---|---|
| Operaciones BUY/SELL con dueño único | `userOperations`, tabla `operations` (RLS por dueño) | Base de Shared State y Cross |
| `Transaction.participants` (nombre, rol, mail) | `src/types` | Lista de personas, hoy solo informativa: no tienen cuenta ni permisos |
| Cadena de ofertas con `party` BUYER/SELLER | `lib/offers/model` | Vencimientos reales de una compra |
| Plan de venta con `dueDate` por paso | `lib/supabase/sellerTasks` | Fechas reales de una venta |
| Visit Partners con login propio | `/partner`, tablas de Visit | Primer "participante externo" con cuenta |
| `buildFirstValue` / NBA | `lib/dashboard`, `lib/nba` | Una sola fuente para "qué hacer ahora" |

## 1. Cross-Transaction Intelligence (recomendada primero)

**Idea:** quien vende para comprar tiene dos operaciones que se pisan. Detectar conflictos entre ellas.

**Primer corte, sin base de datos nueva y sin migraciones:** función pura `crossOperationConflicts(operaciones)` que cruza, para una misma persona:
- vencimiento de una oferta de compra abierta (`validUntil`) contra la fecha de un paso de la venta (`dueDate`, p. ej. escritura/entrega);
- operaciones en monedas distintas (se avisa, no se convierte);
- una venta sin ningún paso con fecha: "no sabemos cuándo entra el dinero".

Cada hallazgo: hecho (qué fechas), lectura (INFERENCE: "puede faltar liquidez") y qué falta saber. **No inventa fechas**: las tareas de compra no tienen fecha hoy y no se les pone una.

**Aparece en:** Inicio (una línea bajo la acción principal, solo si hay conflicto) y en el contexto del asistente.

**Riesgos:** pocas personas tienen las dos operaciones a la vez; sin fechas cargadas casi no hay nada que decir. Por eso el primer corte es chico y honesto.

**Decisión de Pancho:** ¿alcanza con avisar o se quiere sugerir alternativas (puente financiero)? Sugerir financiamiento es asesoramiento: requiere revisión legal.

## 2. Shared Transaction State

**Idea:** comprador, vendedor y profesionales ven la misma operación con permisos propios.

**Lo que hay que decidir antes de escribir código:**
1. **Quién invita a quién y qué ve cada rol.** Propuesta: tabla `operation_members(operation_id, user_id, role, invited_by, status)` con roles `OWNER`, `COUNTERPART`, `PROFESSIONAL`, `PARTNER`.
2. **Qué se comparte por defecto: nada.** Cada dato (documento, oferta, tarea) lleva `visibility` explícita; el dueño comparte ítems, no la operación entera.
3. **RLS**: hoy las políticas son "dueño ve lo suyo". Shared State obliga a reescribirlas para `operations`, `documents`, `offers` y tareas: es la parte riesgosa y la que toca producción.
4. **Tiempo real:** Supabase Realtime sobre una tabla de eventos, no sobre las tablas con datos sensibles.

**Primer corte seguro:** solo lectura. El dueño genera un enlace a un resumen de estado (etapa, avance, documentos entregados, sin montos) para su escribano. Sin cuentas nuevas, vence solo y se puede revocar. Reutiliza la idea de `/compartido` (snapshot).

**Riesgos:** privacidad y filtraciones entre partes; es la función con más consecuencias legales.

## 3. Trust Passport

**Idea:** verificaciones y señales de confianza de cada participante.

**Lo que no hay que prometer:** "verificado" solo debe significar algo que VARA verificó de verdad. Hoy VARA no verifica identidad, ingresos ni referencias.

**Camino mínimo honesto:**
1. Empezar por **Visit Partners**, que ya tienen cuenta y proceso de alta: mostrar en su perfil lo que realmente consta (alta aprobada, visitas completadas, fecha). Es un `FACT` con fuente.
2. Cualquier verificación de identidad (documento, biometría) requiere un proveedor externo, consentimiento y política de datos personales: **decisión y costo de Pancho**.
3. Separar siempre `declarado por la persona` de `verificado por VARA` de `verificado por un tercero`.

**Riesgos:** datos personales sensibles (DNI, ingresos), ley de protección de datos, y el daño de mostrar "confianza" sin respaldo.

## Orden recomendado

1. Cross-Transaction (primer corte puro, 1 PR chico, sin migraciones).
2. Shared State en modo solo lectura por enlace.
3. Trust Passport para Visit Partners.
4. Recién después, miembros con cuenta y verificaciones externas.

## Qué necesito de Pancho para avanzar

- ¿Cross: avisar solamente, o también sugerir alternativas?
- ¿Shared: aprobás el enlace de solo lectura como primer corte?
- ¿Trust: querés arrancar solo con Visit Partners (sin proveedor externo)?
- Todo con migraciones se prueba primero en staging (`itdeptqwpztsooozarut`).
