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
