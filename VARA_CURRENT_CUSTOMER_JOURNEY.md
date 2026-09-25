# VARA_CURRENT_CUSTOMER_JOURNEY.md

El journey **tal como está hoy**, recorrido como usuario nuevo, sin explicaciones.
Fecha: 2026-09-24 · Base: `vara-altv2`

Criterio de cada fila: en 5 segundos, ¿sé dónde estoy, qué hago, y por qué?
Severidad: **P0** rompe el journey · **P1** fricción alta · **P2** pulido.

---

## A. Journey del comprador

| # | Pantalla | Qué quiere el usuario | Qué encuentra | Fricción | Sev |
|---|---|---|---|---|---|
| 1 | `/` landing | Entender qué es VARA | "Tu próxima operación sin sorpresas" + demo visual | Ninguna. Es clara. | — |
| 2 | `/onboarding` | Empezar | Elige comprar/vender, provincia, y ve un costo estimado | **El costo usa USD 185.000 inventado** (`onboarding:151`). El usuario ve un número que no es suyo. | P1 |
| 3 | `/dashboard` | Saber qué hacer | Saludo, resumen, operaciones, columna derecha con "próximos pasos" | Sin operaciones: estado vacío correcto. **Con operación: el banner de guía viene de `mockTransaction`.** | P0 |
| 4 | `/propiedades` | Cargar la propiedad que encontró | Importador por URL + carga manual | Zonaprop bloquea; el fallback de pegar texto funciona pero **no se ofrece hasta después del error**. | P1 |
| 5 | — | Analizar y comparar 3 propiedades | **No existe.** No hay Decision Center, ni estados de candidato, ni comparación. | El usuario que mira 3 propiedades no tiene dónde ponerlas. | P0 |
| 6 | — | Decidir por cuál avanzar | **No existe** la promoción Candidate → Transaction. | Salto conceptual sin puente. | P0 |
| 7 | `/operacion/[id]` | Ver el estado de su operación | 6 pestañas: Tareas, Documentos y riesgos, Costos, Timeline, Equipo, Diseño | Lo mejor del producto. Falta: actividad, deadlines, ofertas, participantes. | P1 |
| 8 | Documentos | Subir la escritura | Lista con estados y recomendaciones | **No se puede subir nada.** Se ve una lista que no acepta archivos. | P0 |
| 9 | Riesgos | Entender qué lo frena | Riesgos con severidad, causa y recomendación | Bien. Falta evidencia y estado (resuelto/abierto). | P1 |
| 10 | `/costos` | Saber cuánto le sale | Calculadora real por provincia, con fuentes | **Lo mejor del producto.** Real, citado, correcto. | — |
| 11 | `/visitas` | Prepararse para visitar | Checklist con notas, persistido | Bien. **Pero se llama casi igual que `/mis-visitas`**, que es otra cosa. | P1 |
| 12 | `/vara-visit` | Contratar a alguien que lo acompañe | Marketplace real, con garantías, precios y niveles | Red vacía, y lo dice. Correcto. | — |
| 13 | `/profesionales` | Encontrar un escribano | Registros oficiales reales + "tu operación necesita X" | **"Tu operación necesita" es ficticio** (`profesionales:14`). | P0 |
| 14 | `/ofertas` | Hacer una oferta | Ejemplos opt-in con banner | **No se puede hacer una oferta.** La entidad no existe. | P0 |
| 15 | — | Negociar | **No existe.** | — | P0 |
| 16 | — | Volver a los 10 días y ver qué cambió | **No existe historial.** | El usuario recurrente no tiene memoria del sistema. | P1 |

## B. Journey del vendedor

| # | Pantalla | Qué quiere | Qué encuentra | Fricción | Sev |
|---|---|---|---|---|---|
| 1 | `/onboarding` | Vender su casa | Mismo flujo, journey SELL | Correcto. | — |
| 2 | `/publicar` | Cargar su propiedad | Formulario vacío, fotos a Supabase, copy con IA, pasos numerados | Bien. **"Publicar" no publica**: VARA carga a mano en los portales. Está dicho, pero el botón se llama "Publicar ahora". | P1 |
| 3 | Fotos con IA | Mostrar el potencial | `gpt-image-1` sobre la foto real | Funciona de verdad. **Está enterrado**: vive en `/propiedades/[id]` y en una pestaña de la operación. | P1 |
| 4 | `/precios` | Poner precio | Comparables de mercado | **Los comparables son inventados** (`mockPreciosMercado.ts`). Una afirmación falsa sobre el mercado. | P0 |
| 5 | `/visitas-vendedor` | Ver quién quiere visitar | Vacío + ejemplo opt-in | Honesto. | — |
| 6 | `/vara-visit` | Que alguien muestre por él | Marketplace real | Red vacía, dicho. | — |
| 7 | `/ofertas` | Recibir y responder ofertas | Ejemplos opt-in | **No se puede recibir una oferta real.** | P0 |
| 8 | Cierre | Escriturar | Las tareas existen en la operación | Sin firma, sin deadlines reales. | P1 |

---

## C. Dónde se rompe el hilo mental

Cuatro cortes, en orden de gravedad.

**Corte 1 — Entre "miro propiedades" y "tengo una operación".**
El usuario que encontró 3 casas en Zonaprop no tiene dónde ponerlas para
compararlas. VARA le pide que elija una operación antes de haber decidido.
Es pedirle el compromiso antes que la decisión.

**Corte 2 — Entre "VARA me dice qué hacer" y "lo que VARA sabe de mí".**
El consejo viene de una operación ficticia. Mientras el usuario no lo note,
funciona; cuando lo nota, se cae toda la confianza del producto.

**Corte 3 — Entre "tengo una operación" y "puedo ejecutarla".**
Se ven los documentos requeridos pero no se pueden subir. Se ve la negociación
pero no se puede ofertar. La operación es un tablero de lectura, no de ejecución.

**Corte 4 — Entre una sesión y la siguiente.**
No hay actividad ni historial. Volver a los 10 días es empezar a mirar de cero.

---

## D. Test del próximo clic

> *Si dejo VARA abierta frente a alguien que nunca la usó, ¿sabría dónde hacer clic?*

| Pantalla | ¿Sabe? | Por qué |
|---|---|---|
| Landing | **Sí** | Un CTA dominante. |
| Onboarding | **Sí** | Una pregunta por paso. |
| Dashboard con operación | **Sí** | "Próxima acción" con botón. Pero lleva a un consejo ficticio. |
| Dashboard vacío | **Sí** | Estado vacío con CTA único. |
| `/propiedades` | **Dudoso** | "Importar" y "Cargar manual" compiten sin jerarquía. |
| `/operacion/[id]` | **No** | 6 pestañas sin acción primaria visible. El usuario elige pestaña, no acción. |
| `/costos` | **Sí** | Un input, un resultado. |
| `/ofertas` | **No** | Ejemplos sin acción real posible. |
| `/profesionales` | **Dudoso** | Lista de registros oficiales; la acción es salir a un sitio externo. |
| `/vara-visit` | **Sí** | Dos tarjetas, la sugerida destacada. |
| Visit Mode | **Sí** | Una sola acción grande por vez. Es la mejor pantalla del producto en este criterio. |

---

## E. Arquitectura de información: qué está mal ubicado

| Elemento | Dónde está | Dónde debería estar |
|---|---|---|
| Fotos con IA | `/propiedades/[id]` + pestaña de operación | Donde el vendedor prepara la publicación, y donde el comprador evalúa potencial |
| Checklist de visita | `/visitas` (destino global) | Dentro de la visita concreta |
| Profesionales | Ítem global del menú | Contextual: aparece cuando un riesgo o tarea lo requiere |
| Costos | Destino global | Ambos: global (explorar) y dentro de la operación (el mío) — hoy están duplicados |
| Precios de mercado | Destino global | Dentro de "preparar mi venta" |
| Financiamiento | Destino global | Dentro de la decisión de compra |

El patrón: **el menú refleja los módulos del software, no la cabeza del usuario.**
Tres destinos distintos hablan de plata (`/costos`, `/precios`, `/financiamiento`)
y el usuario no sabe cuál abrir.
