# SELLER_GOLDEN_PATH.md

El camino que tiene que funcionar de punta a punta para un vendedor.
Fecha: 2026-09-24

Estados: ✅ funciona · ⚠️ a medias · ❌ no existe · 🔧 manual detrás de escena

El vendedor de VARA es alguien que quiere vender **sin delegar todo** en una
inmobiliaria. Eso define el estándar: tiene que poder hacer él lo que hoy hace
un tercero, y entender con claridad lo que no puede hacer solo.

---

## El camino

### 1. Landing → entender qué le ofrece VARA ✅
**Usuario:** tiene una propiedad y no sabe por dónde empezar.
**VARA:** le dice que lo acompaña desde la preparación hasta la escritura.
**Hoy:** funciona.

### 2. Onboarding → journey de venta ⚠️
**Usuario:** dice que quiere vender, en qué provincia.
**VARA:** cambia todo el producto al modo venta (navegación, tareas, costos).
**Hoy:** el switch de journey funciona ✅. El costo estimado usa precio inventado. → **P0-7**

### 3. Cargar su propiedad ✅
**Usuario:** datos, superficie, ambientes, fotos.
**VARA:** guarda todo; las fotos van a Supabase Storage si hay sesión, a IndexedDB si no.
**Acción primaria:** "Cargar mi propiedad".
**Hoy:** funciona. El formulario arranca vacío (sin datos de ejemplo) y los pasos están numerados.

### 4. Preparar la propiedad ⚠️
**Usuario:** quiere mostrarla lo mejor posible.
**VARA:** tips de fotos, orden de ambientes, qué destacar.
**Hoy:** hay tips reales. Falta un checklist de preparación con estado.

### 5. Visual Intelligence → mostrar el potencial ⚠️
**Usuario:** su cocina está vieja y quiere mostrar cómo podría quedar.
**VARA:** transforma **su propia foto** con `gpt-image-1` (`input_fidelity: high`), no genera una casa inventada. Modos: pintura, interior, cocina, baño, jardín, vaciar.
**Siempre marcado como:** visualización generada con IA.
**Hoy:** funciona de verdad ✅. **Está enterrado**: vive en `/propiedades/[id]` y en una pestaña de la operación. El vendedor no lo encuentra cuando lo necesita — que es al preparar la publicación. → **P1-6**

### 6. Precio ❌
**Usuario:** cuánto pedir.
**VARA:** contexto de mercado con comparables reales.
**Hoy:** `/precios` muestra comparables de `mockPreciosMercado.ts` — **inventados**. Es una afirmación falsa sobre el mercado, del mismo tipo que inventar un partner. → **P0-6: ocultar hasta tener datos reales.**

### 7. Documentación del inmueble ❌
**Usuario:** junta escritura, planos, libre deuda, expensas.
**VARA:** le dice exactamente qué necesita según provincia y tipo, y los recibe.
**Hoy:** el motor regulatorio dice qué hace falta ✅. **No se puede subir nada.** → **P0-4**

### 8. Publicación 🔧
**Usuario:** quiere que su propiedad esté en los portales.
**VARA:** genera el aviso (título y descripción con IA, usando solo los datos provistos), y lo carga.
**Hoy:** el aviso se genera ✅. **La publicación la hace VARA a mano** 🔧 — no hay API gratuita de Zonaprop ni MercadoLibre. Está dicho en la pantalla, pero el botón se llama "Publicar ahora", lo que sugiere automatismo. → **P1: renombrar a "Pedir publicación".**

### 9. Interesados y consultas ❌
**Usuario:** recibe preguntas.
**VARA:** las centraliza y ayuda a responder.
**Hoy:** no existe. Las consultas llegan al portal, fuera de VARA.

### 10. Visitas ⚠️
**Usuario:** no puede ir a mostrar cada vez.
**VARA:** VARA Visit manda a un partner verificado que muestra y deja un reporte.
**Acción primaria:** "Pedir una visita".
**Hoy:** el software está completo ✅ — PIN, check-in, checklist, reporte, calificación. **La red de partners está vacía** 🔧 y se dice explícitamente. La verificación de identidad es manual.

### 11. Ofertas ❌
**Usuario:** recibe una oferta y tiene que responder.
**VARA:** la estructura (precio, forma de pago, seña, plazo de escritura, posesión, condiciones), la registra, y permite aceptar / contraofertar / rechazar.
**Hoy:** `/ofertas` muestra ejemplos opt-in. **No se puede recibir una oferta real.** → **P0-5**

### 12. Negociación ❌
**Usuario:** contraoferta, plazos, condiciones.
**VARA:** historial completo, separando hecho de inferencia de recomendación.
**Hoy:** no existe. → **P0-5**

### 13. Profesionales ⚠️
**Usuario:** necesita escribano para la escritura.
**VARA:** aparece cuando la etapa lo requiere.
**Hoy:** registros oficiales reales ✅; "tu operación necesita" es ficticio ❌. → **P0-1**

### 14. Reserva y firma ⚠️
**Usuario:** seña, boleto, escritura.
**VARA:** tareas por etapa con responsable y documentos requeridos.
**Hoy:** las tareas existen y salen del motor regulatorio ✅. Sin deadlines reales, sin firma digital.

### 15. Cierre ⚠️
**Hoy:** la etapa final existe en el checklist. No hay confirmación de cierre ni registro de resultado.

---

## Diferencias clave con el comprador

| | Comprador | Vendedor |
|---|---|---|
| Objeto de análisis | Varias propiedades ajenas | Una propiedad propia |
| Decision Center | **Crítico** — compara y elige | No aplica |
| Visual Intelligence | Evaluar potencial | **Crítico** — vender mejor |
| VARA Visit | Acompañamiento | **Mostrar por él** — es el caso de mayor valor |
| Precio | Evaluar si es razonable | **Definirlo** — hoy sobre datos inventados |
| Documentos | Los pide | **Los tiene que juntar** — es su tarea principal |

**Conclusión:** para el vendedor, los dos puntos de mayor valor son Visual
Intelligence (que funciona y está escondido) y VARA Visit (que funciona y no
tiene oferta). Y el de mayor daño es `/precios`, que afirma cosas falsas sobre
el mercado justo en la decisión más importante del vendedor.

---

## Criterio de aprobación del golden path

Aprobado cuando un propietario, sin explicación, puede: cargar su propiedad,
entender qué documentación necesita y subirla, ver cómo podría quedar con IA,
poner un precio con fundamento, pedir que alguien la muestre, recibir una
oferta, responderla, y llegar a la escritura sabiendo en qué etapa está.

**Hoy falla en: subir documentación, precio con fundamento, y recibir/responder ofertas.**
