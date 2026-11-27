# VARA — Contexto para armar el modelo de precios y planes

> Documento para pasarle a otra IA. Está armado leyendo el repo `Chopan55/vara-altv3` (estado al 27/11/2026).
> Lo marcado **[Hecho]** sale del código o de los docs del repo. Lo marcado **[Inferencia]** es interpretación mía. Lo marcado **[Falta]** es un dato que no existe en el repo y hay que pedírselo a Pancho. No inventes datos: si falta algo, preguntá.

---

## 1. Qué es VARA (en 30 segundos)

VARA ayuda a una persona a **comprar o vender una propiedad con una decisión informada**, en Argentina (y México).
Lema interno: *"VARA empieza donde terminan los portales."* Lema público: *"Comprá y vendé a tu manera."*

- **No es un portal** (Zonaprop, MercadoLibre): toma el aviso que la persona ya encontró y le dice qué mirar antes de avanzar.
- **No ataca a las inmobiliarias**: se posiciona como capa de inteligencia que las complementa.
- **No da un "precio justo" ni "valor de mercado"**: compara el *precio publicado/pedido* contra otros avisos.
- Dueño del producto y único que aprueba decisiones de producto, gasto, producción y precios: **Pancho (Francisco Alonso-Hidalgo)**.

North Star (doc de producto de sept-2026): *transacciones exitosas asistidas por VARA*. KPI: *Time to Confidence* (cuánto tarda alguien en sentir que entiende lo suficiente para decidir).

## 2. A quién le sirve

- **Comprador** (particular): quiere saber si un aviso le conviene, cuánto cuesta realmente (escritura, impuestos, gastos), qué riesgos tiene, qué documentos pedir y qué hacer después.
- **Vendedor** (particular): quiere fijar precio, preparar la publicación (fotos, ficha), manejar interesados, ofertas y papeles.
- **Profesionales** (escribanos, arquitectos, tasadores): hay una idea de marketplace [Hecho: está en el plan, no implementado].
- Mercado de lanzamiento: **GBA Norte (Pilar, Nordelta, Tigre)** [Hecho: plan de sept-2026].

## 3. Qué hace hoy (producto real)

| Módulo | Qué hace | Usa IA paga |
|---|---|---|
| **Analizar propiedad** (`/analizar`) | Se pega el link o texto de un aviso. Devuelve conclusión, encaje, posición del precio publicado vs. comparables, evidencia, qué falta confirmar, riesgos, costo total y **una** próxima acción. | No (los números los calcula código determinístico) |
| **Preguntale a VARA** | Chat con IA que solo explica lo ya calculado. Con avatar animado y voz (TTS de OpenAI). | **Sí** |
| **Costos por provincia** | Calcula gastos de compraventa con motor regulatorio, con fuente. | No |
| **Comparador** | Compara propiedades por dimensión; no arma puntaje compuesto. | No |
| **Mercado / comparables** | Avisos comparables en Supabase (`market_listings`). El barrido automático (Bright Data) existe pero está **apagado**. | No |
| **Motor de Valor de Referencia v1** | Con comparables que carga la persona (mín. 3 parecidos ≥60%) da un rango, confianza y margen de negociación. | No |
| **Herramientas de venta** | Precio de venta, preparar la venta, publicación, fotos con recomendaciones, interesados, papeles. | Parcial |
| **Estudio de presentación** | Fotos con recomendaciones, recorrido gratis, **recorrido con IA (Google Veo)**. | **Sí** (Veo) |
| **Negociación / ofertas** | Preparación de oferta y negociación asistida; "Negotiation Intelligence" (lectura de la cadena de ofertas, en Labs). | Parcial |
| **VARA Visit** | Visita física con persona verificada (Visit Partner): PIN para empezar, checklist y reporte. Piloto. | No |
| **Labs** | Capacidades en exploración, separadas del core. | — |

Hosting: Vercel. Backend: Supabase (Postgres/Auth/Storage). Stack: Next.js 16, React 19, TypeScript. [Hecho]

## 4. Estado del producto (para calibrar qué se puede cobrar hoy)

- Está en **beta privada**. La página `/planes` hoy dice: *"hoy podés usar VARA sin costo y los precios se definen junto con los primeros usuarios"*. [Hecho]
- **No hay cobros implementados.** No hay Stripe ni MercadoPago integrados. En VARA Visit el pago es *"fuera de plataforma en el piloto"*: el precio se muestra y registra, el cobro se coordina a mano. [Hecho]
- Los datos de herramientas nuevas viven hoy en el **navegador** (localStorage), no en la cuenta. Sincronizar con la cuenta requiere migración. [Hecho] → **Implicancia [Inferencia]:** un plan "con historial/guardado en la nube" todavía no se puede vender sin trabajo previo.
- La IA paga está limitada por lista blanca de emails (`AI_ALLOWED_EMAILS`) con tope diario: **hoy solo la usa el dueño**. [Hecho] → no existe todavía control de cuotas por usuario/plan.
- Pendiente de producto: perfil por conversación libre, próxima acción única unificada, "What Changed" completo, VARA Live (no iniciado), documentos/firma/cierre (no iniciado; requiere investigación de Firma Digital). [Hecho]

## 5. Restricciones y principios que condicionan el pricing

1. **Honestidad antes que impacto.** No se inventan cifras ni comparables. Un plan no puede prometer algo que el producto no hace. [Hecho]
2. **No prometer lo que no existe**: ningún botón/plan debe anunciar una función que no funciona. [Hecho] → el pricing solo puede vender lo que está en la tabla de la sección 3 (o marcarlo como "próximamente").
3. **Costo externo USD 0 salvo aprobación de Pancho.** Excepciones vigentes: OpenAI hasta USD 20 y Google Veo, solo para el email del dueño y con tope diario. [Hecho] → hoy no hay presupuesto aprobado para que usuarios externos consuman IA.
4. **Falla cerrado cuando hay gasto o riesgo.** Sin cupo/credencial, la función se apaga con mensaje honesto. [Hecho]
5. **Privacidad por defecto.** No se guardan teléfonos ni datos de vendedores. [Hecho]
6. **Lo generado por IA se rotula** como visualización, nunca como estado real. [Hecho]
7. **Nada de pagos con custodia de fondos**: en la visión de largo plazo VARA orquesta, nunca custodia (USDT/USDC vía proveedor regulado). [Hecho, es visión, no producto]
8. **Español rioplatense**, tono directo. Aplica a cualquier texto de la página de planes. [Hecho]
9. Mostrar precio **desglosado** antes de contratar (la política de Visit lo exige: *"si un suplemento no se puede explicar en una línea, no se cobra"*). [Hecho]

## 6. Lo que ya existe sobre precios (hay dos versiones que no coinciden)

### 6.1 Plan de monetización del doc de producto (sept-2026) — [Hecho], parece anterior

| Producto | Precio | Descripción |
|---|---|---|
| VARA Check | USD 25 | Análisis de propiedad antes de comprometerse |
| VARA Buy | USD 199 | Acompañamiento completo de la operación de compra |
| VARA Sell | USD 299 | Acompañamiento completo de la operación de venta |
| Professional Marketplace | % de comisión | Escribanos, arquitectos, tasadores |

- Funnel previsto: herramienta gratuita (calculadora) → Check USD 25 → Buy/Sell → Marketplace.
- Proyección Y1 conservadora del mismo doc: 620 Check + 125 Buy + 61 Sell ≈ **USD 58.614**; escenario optimista con marketplace USD 120–150 mil. CAC objetivo < USD 15 para Check. **[Falta]** de dónde salen esos volúmenes: no hay respaldo en el repo, tratalos como supuestos.
- Competidor citado: **PropLupa** (PDF estático, ~ARS 19.900 ≈ USD 20 según el doc; **no lo verifiqué**).

### 6.2 Planes en el código hoy (`src/lib/pricing/plans.ts`, oct-2026) — [Hecho], es lo vigente

Tres planes, **todos con precio sin definir** salvo el gratuito. El archivo dice que es BORRADOR y que los límites "hay que fijarlos con los costos reales".

| Plan | Precio | Incluye | Límites |
|---|---|---|---|
| **Explorer** | Gratis | Costos por provincia con fuente, riesgos y documentos explicados, comparador con tus prioridades, próximo paso de la operación | Propiedades activas: *a definir*. Análisis con IA: *a definir* |
| **Por etapa** | *A definir* | Todo Explorer + preparación de oferta y negociación asistida, Property Pack y descripción de publicación, visualización de mejoras (imagen generada). Idea: pagás por etapa (preparar, ofertar o cerrar) | Negociaciones asistidas, generaciones de imagen, documentos analizados: *a definir* |
| **VARA Visit** | *A definir por visita* | Visit Partner verificado, PIN, checklist y reporte | Se contrata por visita |

> **Decisión pendiente [Inferencia]:** el modelo "Check / Buy / Sell" (por producto) y el de "Explorer / Por etapa / Visit" (por etapa + servicio) son dos enfoques distintos. Hay que decidir cuál es el vigente. La IA que ayude con el pricing debería partir del segundo (es el que está en el código) y evaluar si conviene volver al primero.

### 6.3 Precios de VARA Visit (en el código, `src/types/varaVisit.ts`) — [Hecho]

Banda de precio por duración (USD, el precio lo fija el partner dentro de la banda):

| Duración | Mínimo | Máximo | Por defecto |
|---|---|---|---|
| 30 min | 25 | 35 | 30 |
| 60 min | 35 | 50 | 42 |
| 90 min | 50 | 70 | 58 |

Suplementos (multiplicadores sobre el precio base): urgencia (<24 h) ×1,20 · horario especial (antes de 9 o después de 19) ×1,15 · distancia (>15 km de la zona del partner) ×1,10.
Cancelación: sin costo hasta 24 h antes; después se cobra el 50%.
Un doc de auditoría de Visit menciona packs hardcodeados de USD 25/20/16 que habría que mover a configuración central; hoy las bandas ya viven en el archivo de tipos.

**[Falta]** Qué porción del precio de la visita se queda VARA (comisión) y cuánto cobra el partner. Hoy no está definido en el repo.

## 7. Estructura de costos conocida

Lo que sé del repo (sin cifras unitarias):

| Costo | Estado | Dato |
|---|---|---|
| OpenAI (chat + voz TTS + visión) | Activo, solo dueño | Tope aprobado: USD 20 en total, con tope diario |
| Google Veo (clips de recorrido) | Activo, solo dueño | Con tope diario, sin monto fijado en el repo |
| Generación de imagen (visualizar mejoras) | Activo | Proveedor/costo unitario **[Falta]** |
| Bright Data (scraping de comparables) | **Apagado** | Costo **[Falta]** |
| Supabase | Producción + staging | Plan y costo **[Falta]** |
| Vercel | Producción + preview | Plan y costo **[Falta]** |
| Visit Partners | Piloto, sin red real | Pago al partner **[Falta]** |
| Cobro online (Stripe/MercadoPago) | No integrado | Comisión por transacción **[Falta]** |

> Sin costos unitarios reales por llamada de IA no se pueden fijar los límites de los planes con rigor. Es el primer dato que hay que conseguir (se puede sacar del panel de OpenAI/Google y de los logs de uso).

## 8. Datos que faltan para cerrar el modelo (pedírselos a Pancho)

1. **Cuál es el objetivo de la primera versión de precios**: ¿validar disposición a pagar en la beta, o generar ingresos desde ya?
2. **Moneda de cobro**: ¿USD, ARS o ambas? ¿Hay restricción cambiaria o fiscal que condicione cómo se factura? (VARA ya diferencia mercado AR y MX.)
3. **Costos unitarios** de IA (chat, voz, imagen, Veo) y de infraestructura.
4. **Pasarela de pago** elegida y su comisión.
5. **Modelo de Visit**: comisión de VARA vs. pago al partner.
6. **Cantidad de usuarios reales hoy** y su comportamiento (qué funciones usan más). PostHog está disponible en el entorno, pero no sé si tiene datos cargados.
7. **¿Se cobra al comprador, al vendedor o a ambos?** ¿Y al profesional del marketplace?
8. **Posicionamiento deseado frente a PropLupa** (precio de referencia ARS ~20 mil según el doc) y frente a inmobiliarias.
9. **Restricciones legales/fiscales** (factura, monotributo/SA, defensa del consumidor) y **desde cuándo** se podría cobrar.

## 9. Preguntas que tiene que responder el modelo de precios

- ¿Qué parte es **gratis** (el gancho) y qué parte se paga? Hoy el gancho natural es el análisis + los costos por provincia, que no consumen IA paga.
- ¿Se cobra **por producto** (Check/Buy/Sell), **por etapa** (preparar/ofertar/cerrar), **por suscripción** o **por uso**? Considerar que la compra/venta de una propiedad es un evento **poco frecuente** por persona (una vez cada varios años): un abono mensual tiene poco sentido salvo para profesionales. [Inferencia]
- ¿Qué **límites** tiene cada plan en las funciones que cuestan plata (chat con IA, imágenes, Veo, análisis de documentos, negociaciones asistidas)?
- ¿Cómo se prueba **disposición a pagar** durante la beta sin romper el principio de no prometer lo que no existe?
- ¿Qué **margen bruto** deja cada plan una vez descontado el costo de IA + pasarela + soporte?
- ¿Cómo se estructura el **precio de Visit** (banda + suplementos ya definidos) y la comisión de VARA?
- ¿Hay un plan para **profesionales** (escribanos, inmobiliarias, desarrolladoras) distinto del de particulares? El doc de producto lo menciona como canal de partnerships.

## 10. Entregable que se le pide a la IA

1. Un **modelo de planes** (nombres, qué incluye cada uno, límites) alineado con las funciones reales de la sección 3.
2. **Precios propuestos** con rango y justificación, en la moneda que defina Pancho, con **escenarios** (conservador / base / optimista) y los supuestos explícitos.
3. **Unit economics** por plan: ingreso, costo de IA, pasarela, margen. Marcando cada número como dato o supuesto.
4. Una **estrategia de validación** durante la beta (cómo medir disposición a pagar con usuarios reales).
5. Una lista de **riesgos y datos faltantes**.

Formato: español rioplatense, tablas y secciones claras, supuestos separados de datos, y sin inventar cifras de mercado: si no tenés una fuente, decilo.

---

*Fuentes dentro del repo:* `PRODUCT_PLAN.md` (secciones 9–12), `agent/PRODUCT_CONTEXT.md`, `agent/PRODUCT_PRINCIPLES.md`, `docs/VARA_DECISIONS.md`, `docs/VARA_MASTER_PLAN.md`, `src/lib/pricing/plans.ts`, `src/types/varaVisit.ts`, `src/lib/varaVisit/pricing.ts`, `VARA_VISIT_AUDIT.md`.
*Limitaciones:* no consulté Supabase, PostHog, Vercel ni facturación de IA, así que no hay datos de uso ni de costo reales. Los precios del punto 6.1 son del plan de sept-2026 y pueden estar desactualizados.
