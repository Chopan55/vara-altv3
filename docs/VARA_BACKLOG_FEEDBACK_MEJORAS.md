# Mejoras de usabilidad del backlog de feedback

Propuesta aplicable sin integraciones ni datos de terceros. Cada mejora debe poder probarse con fixtures sintéticos y apagarse sin afectar la operación existente.

## Orden sugerido

1. **Fuente y fecha por rubro**: convertir cada costo en una tarjeta compacta con “qué sabemos”, “qué estimamos” y “qué falta confirmar”; el botón de fuente debe abrir el detalle sin sacar a la persona del análisis.
2. **Oferta auditable**: mostrar “precios pedidos”, cantidad de avisos incluidos y excluidos con motivo. Mantener “precios de cierre: sin datos” hasta contar con evidencia; el botón “Preparar mi oferta” debe llevar a negociación con el contexto visible.
3. **Próximo paso accionable**: cada alerta debe tener un único botón primario, texto de qué pedir y un enlace a Docs, Costos o Negociación. Evitar dos botones que hagan lo mismo.
4. **Escribano a elección**: sumar en los pasos de documentación una acción “Preparar consulta para mi escribano”, dejando claro que puede ser uno de VARA o el que elija la persona. VARA prepara preguntas; no reemplaza la validación profesional ni ofrece garantía.
5. **Plata para el cierre**: mantener moneda, cotización, fecha y origen de cada dato juntos; mostrar el total recalculado al editar la cotización y un aviso si está desactualizada.
6. **Privacidad visible**: antes de compartir, una vista previa “Esto verá la otra persona” y un recordatorio de que los documentos no se comparten automáticamente.

## Criterio de aceptación común

Una persona nueva debe poder identificar qué está confirmado, qué es estimación, qué tiene que hacer hoy y quién lo valida en menos de un minuto. Los tests deben cubrir navegación, estados vacíos, error de carga, móvil y que ningún texto prometa garantía o invente precios de cierre.

## Fuera de esta tanda

Integraciones con registros, bancos, ofertas vigentes, importes municipales automáticos, validación normativa en tiempo real y casos reales requieren datos, alianzas o decisiones externas; quedan explícitamente apartados.
