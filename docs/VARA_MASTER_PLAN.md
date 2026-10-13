# VARA — Plan maestro (estado)

Última actualización: 2026-10-12. Reglas permanentes en `CLAUDE.md`; decisiones en `VARA_DECISIONS.md`.

| Fase | Alcance | Estado |
|---|---|---|
| 1 | Auditoría + journeys | En curso: ver hallazgos abajo |
| 2 | Experiencia pública | Hecha en producción (portada, /demo, /labs, /planes borrador, FAQ, contacto). Falta: precios definitivos |
| 3 | Compra/venta guiada y dashboard | Parcial: /empezar, Mi búsqueda, Preparar la venta, Precio, Interesados, menú por etapa. Falta: perfil por conversación libre, NBA única, What Changed completo |
| 4 | Estudio de presentación | Parcial: fotos con recomendaciones y pedido libre, recorrido gratis, recorrido IA (Veo). Falta: versiones V1/V2 guardadas, storyboard arrastrable, 3D (bloqueado por proveedor pago) |
| 5 | VARA Live | No iniciada |
| 6 | Documentos, firma y cierre | No iniciada (requiere investigación oficial de Firma Digital) |

## Hallazgos de auditoría (Fase 1)
- P1 corregido: 12 llamadas a la API leían la respuesta sin protección; ante un timeout el usuario veía "Unexpected token… not valid JSON". Se creó `lib/api/client.ts` y se aplicó en Visual Intelligence y Redactar con IA. Quedan sitios con captura propia (chats) que ya muestran un mensaje amable.
- Pendiente de revisar: coherencia Dashboard/NBA/Acciones/Documentos; estados vacíos; pérdida de contexto Candidate vs Transaction.
- P1 corregido: el Dashboard mostraba a la vez la próxima acción del motor NBA (`nba/engine`) y el banner de `guidanceEngine`, que podían contradecirse. Ahora, si hay próxima acción de la operación, el banner no se muestra. Pendiente: unificar ambos motores en uno solo (Acciones, Guíame y Documentos).
- P0 corregido (2026-10-12): el modo comprar/vender y la operación activa eran estados independientes (menú en Comprando, guía con datos de una venta). Regla única en `lib/journey.ts` (`deriveJourney`, `pickActiveOperation`), usada por `useOperations`, menú, guía y Dashboard. La operación activa es siempre del recorrido actual.
- P0 corregido: Precio de venta, Interesados, Preparar la venta y Ficha leían la venta con otra fuente y decían "no hay venta" aunque la hubiera. Ahora usan `useSellOperation` (misma fuente que el resto).
- P1 corregido: menú sin entradas repetidas.
- Pendiente del prompt de mejoras: P0.3 (placeholders USD 0 en operación), P0.4 (asistente "No autorizado"), P0.5 (operation.insert.failed y React #418), P0.6 (fotos vs planos/documentos), tabs de operación, Dinero por contexto, modal de sumar propiedad.

## Prompt de mejoras P0/P1 (2026-10-12)
Hecho: P0.1 modo/operación (lib/journey), P0.2 herramientas de venta (useSellOperation), P0.3 encabezado de operación sin USD 0 (dice qué falta y lleva a cargarlo), P0.4 asistente (errores como aviso recuperable, sin "No autorizado" guardado, contexto de compra/venta), P0.5 logger con causa real y hidratación (#418: historial del asistente y saludo del Dashboard tras montar), P0.6 fotos vs planos/documentos (isPublishable; ficha exige datos mínimos y revisión), P1.2 pestañas siguen a la URL, P1.3 Dinero con la misma regla, P1.7 menú sin repetidos.
Pendiente: P1.1 onboarding con primera experiencia de valor, P1.4 mover Labs/PRUEBA fuera del core, P1.5 faltantes de comparación como tareas, P1.6 cargar propiedad manualmente o pegar texto sin link, causa raíz de `operation.insert.failed` (ahora el log mostrará código y mensaje de Supabase: hace falta verlo en producción), y pruebas de humo de rutas autenticadas.
- Hecho (2026-10-12, 2ª tanda): P1.6 cargar propiedad a mano (modal con pestañas), P1.5 faltantes de comparación con campos y mensaje al anunciante, P1.4 sección Experimental separada del menú, pruebas de humo de las 45 rutas (`tests/routesSmoke.test.ts`). Pendiente: P1.1 (primera experiencia de valor tras el onboarding: hoy `/empezar` ya lleva a la herramienta de cada caso), causa de `operation.insert.failed` (esperando el log real) y pegar texto del aviso sin link.

## Seguimiento post-arreglos (2026-10-12, 3ª tanda)
- Causa raíz común: la base de producción no tiene `operations.country` (PGRST204). Las operaciones nuevas quedaban solo en el navegador y, con sesión, `loadOperations` leía solo la base: la venta "desaparecía" de Precio de venta y Preparar la venta. Corregido en código: `insertOperation` reintenta sin `country`; `loadOperations` suma las locales pendientes. SQL preparado y NO aplicado: `supabase/migrations/20261012000000_operations_country_hotfix.sql`.
- Dashboard de venta: nunca "0 de 0"; usa la checklist del motor regulatorio si no hay checklist remoto.
- Sesión: sin "Sin cuenta" ni "solo en este navegador" mientras se verifica.
- P1: Dinero con títulos por rol, Interesados con copy honesto (solo en este dispositivo), Experimental colapsable, /planes sin menú de operación, alertas priorizadas por recorrido, menú móvil cerrado con `inert`.
- Pendiente: Dashboard BUY/SELL con secciones separadas para multi-operación; revisar `/ofertas` y `/visitas-vendedor` contra la fuente única; pruebas de componentes con sesión simulada.
- (2026-10-13) Dashboard con compra y venta separadas (las del recorrido actual primero, las del otro después); ofertas reales filtradas por recorrido con palabras según el lado (`offerPartyLabel`). `/visitas-vendedor` es solo del vendedor y no depende de la operación.
