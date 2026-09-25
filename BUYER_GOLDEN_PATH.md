# BUYER_GOLDEN_PATH.md

El camino que tiene que funcionar de punta a punta para un comprador.
Fecha: 2026-09-24

Cada paso declara: **qué hace el usuario**, **qué hace VARA**, **cuál es la
acción primaria**, y **qué estado tiene hoy**.

Estados: ✅ funciona · ⚠️ a medias · ❌ no existe · 🔧 manual detrás de escena

---

## El camino

### 1. Landing → entender qué es VARA ✅
**Usuario:** llega sin saber qué es.
**VARA:** una frase, una demo visual, un CTA.
**Acción primaria:** "Empezar operación gratis".
**Hoy:** funciona. 30 segundos alcanzan.

### 2. Onboarding → declarar intención ⚠️
**Usuario:** dice que quiere comprar, en qué provincia.
**VARA:** muestra qué va a pasar y un orden de magnitud de costos.
**Acción primaria:** una pregunta por paso.
**Hoy:** el costo usa USD 185.000 inventado. → **P0-7**

### 3. Cargar la propiedad que encontró ⚠️
**Usuario:** pega la URL de Zonaprop, o carga a mano.
**VARA:** extrae título, precio, superficie, ambientes, zona.
**Acción primaria:** pegar URL.
**Estados que el flujo tiene que cubrir:** `URL_DETECTED → ANALYZING → EXTRACTING → FOUND → PEDIR SOLO LO QUE FALTA`, más `UNSUPPORTED`, `PARTIAL`, `BLOCKED`, `ERROR`.
**Hoy:** la cadena existe (JSON-LD → OG → Jina → GPT-4o-mini → pegar texto) y detecta bot walls. Falta que el fallback de pegar texto se ofrezca **antes** del error, no después. → **P1**

### 4. Analizar la propiedad ⚠️
**Usuario:** quiere saber si le conviene.
**VARA:** costo total estimado (real), riesgos conocidos, qué falta saber.
**Acción primaria:** "Ver costo total".
**Hoy:** el cálculo de costos es real y citado. El análisis de riesgo de una propiedad suelta (fuera de una operación) no existe. → **P1**

### 5. Decision Center → poner 3 propiedades juntas ❌
**Usuario:** mira tres casas y necesita compararlas.
**VARA:** las guarda como **candidatas**, con estado (`ANALYZING / FAVORITE / VISITED / DISCARDED`), y muestra de cada una solo lo útil: estado, dato clave, riesgo relevante, qué falta, próxima acción.
**Acción primaria:** "Comparar".
**Hoy:** no existe. → **P0-3**. Es el corte más grave del journey.

### 6. Visitar ⚠️
**Usuario:** va a ver la casa, o manda a alguien.
**VARA:** checklist de visita con notas; o VARA Visit con partner verificado.
**Acción primaria:** "Preparar la visita" / "Pedir una visita".
**Hoy:** el checklist funciona ✅. VARA Visit funciona completo ✅ pero la red de partners está vacía 🔧. El checklist vive en un destino global en vez de dentro de la visita. → **P1-5**

### 7. Promover a operación ❌
**Usuario:** decide avanzar con una.
**VARA:** crea la operación **conservando todo el contexto previo** — análisis, visita, notas, riesgos.
**Acción primaria:** "Avanzar con esta propiedad".
**Hoy:** no existe el puente. La operación se crea desde cero. → **P0-3**

### 8. Transaction Room → el centro operativo ⚠️
**Usuario:** quiere saber en qué está y qué sigue.
**VARA:** etapa, progreso, bloqueantes, próxima acción, y las pestañas.
**Acción primaria:** la que diga el Next Best Action.
**Hoy:** existe con 6 pestañas y deep-link por `?tab=`. Falta: participantes, actividad, deadlines, ofertas. Y **no tiene acción primaria visible**: el usuario elige pestaña, no acción. → **P1-2**

### 9. Documentos ❌
**Usuario:** sube la escritura, los planos, el libre deuda.
**VARA:** los relaciona con requisitos, tareas y riesgos.
**Acción primaria:** "Subir documento".
**Hoy:** se ve la lista de lo requerido pero **no se puede subir nada**. → **P0-4**

### 10. Riesgos ⚠️
**Usuario:** quiere saber qué lo puede frenar.
**VARA:** qué pasa, por qué importa, qué evidencia hay, qué hacer.
**Hoy:** dice qué y por qué. Falta evidencia y estado. → **P1-3**

### 11. Costos ✅
**Usuario:** cuánto le sale de verdad.
**VARA:** sellos, escribano, informes, con fuente y fecha.
**Hoy:** lo mejor del producto. Real, citado, por provincia.

### 12. Oferta ❌
**Usuario:** ofrece un precio con condiciones.
**VARA:** estructura la oferta (precio, forma de pago, seña, plazo, posesión, condiciones), la registra y la sigue.
**Acción primaria:** "Hacer una oferta".
**Hoy:** no existe la entidad. `/ofertas` muestra ejemplos. → **P0-5**

### 13. Negociación ❌
**Usuario:** recibe contraoferta, responde.
**VARA:** historial de la negociación, separando **hecho** de **inferencia** de **recomendación**.
**Hoy:** no existe. → **P0-5**

### 14. Profesionales ⚠️
**Usuario:** necesita un escribano.
**VARA:** aparece cuando el contexto lo pide, no como directorio suelto.
**Hoy:** los registros oficiales son reales ✅, pero "tu operación necesita X" se calcula sobre `mockTransaction` ❌. → **P0-1**

### 15. Cierre ⚠️
**Usuario:** firma y toma posesión.
**VARA:** tareas de la etapa final, deadlines, checklist de escrituración.
**Hoy:** las tareas existen (motor regulatorio). Sin deadlines reales ni firma. → **P1**

---

## Las tres preguntas en cada paso

| Paso | ¿Sé dónde estoy? | ¿Sé qué hacer? | ¿Hay una acción primaria? |
|---|---|---|---|
| Landing | ✅ | ✅ | ✅ |
| Onboarding | ✅ | ✅ | ✅ |
| Cargar propiedad | ✅ | ⚠️ dos CTAs compiten | ⚠️ |
| Decision Center | ❌ no existe | ❌ | ❌ |
| Transaction Room | ✅ | ⚠️ | ❌ 6 pestañas sin jerarquía |
| Documentos | ✅ | ❌ no se puede subir | ❌ |
| Costos | ✅ | ✅ | ✅ |
| Oferta | ❌ | ❌ | ❌ |
| VARA Visit | ✅ | ✅ | ✅ |

---

## Criterio de aprobación del golden path

Se considera aprobado cuando una persona que nunca vio VARA, sin explicación,
puede: cargar una propiedad, entender cuánto le sale, compararla con otra,
decidir, crear la operación, subir un documento, entender un riesgo, pedir una
visita, hacer una oferta, y volver a los 10 días sabiendo qué cambió.

**Hoy falla en: comparar, decidir, subir documento, ofertar, y volver.**
