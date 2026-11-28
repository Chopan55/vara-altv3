# Evaluación de GPT-Live para VARA

Estado: evaluación documentada; GPT-Live (`gpt-live-1`) NO está activado. La voz que ya funciona en producción («Hablar con VARA») usa `gpt-realtime-2.1` y no se toca. Para probar GPT-Live basta cambiar la variable de servidor `OPENAI_REALTIME_MODEL=gpt-live-1` en un entorno de prueba; no hace falta código nuevo. Una versión previa de este trabajo ponía un interruptor que apagaba también la voz actual; se quitó (2026-11-28) porque habría roto una función en uso.

## Costos oficiales consultados el 2026-11-27

Fuente oficial: [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing).

- `gpt-realtime-2.1`: audio a USD 32 por 1M tokens de entrada, USD 64 por 1M tokens de salida y USD 0,40 por 1M tokens de entrada cacheada. Texto: USD 4 / 24 / 0,40 por 1M tokens.
- `gpt-live-1`: sesión de voz a USD 0,05 por minuto de tarifa activa y USD 0,02 por minuto en espera; la sesión se factura por segundo. El uso del modelo y herramientas del backend se cobra aparte.
- El modelo configurado hoy en este repo es `gpt-realtime-2.1`, con voz `marin` y transcripción `gpt-4o-mini-transcribe`.

Estos precios no permiten calcular todavía un costo por operación de VARA: faltan duración media de sesión, proporción de audio de entrada/salida, tokens de texto, cache, transcripción, espera y uso de herramientas.

## Qué está implementado y qué falta medir

- Transporte: WebRTC desde el navegador, con secreto efímero emitido por el servidor; la clave real nunca llega al cliente.
- Seguridad de producto: la ruta exige usuario autorizado y tiene límites por usuario y globales; no se envían documentos ni se modifica la base real desde esta evaluación.
- Latencia: no hay p50/p95 universal oficial que sirva como promesa. Debe medirse únicamente con tráfico real o un piloto controlado, desde el fin del turno de la persona hasta el primer audio de VARA, informando región, navegador, red, duración y p50/p95.
- Falta instrumentar y observar ese piloto, además de medir tasa de conexión fallida, interrupciones, duración, mezcla de entrada/salida y costo efectivo por sesión.

## Decisión

GPT-Live permanece sin activar (solo se cambia el modelo por variable de servidor, tras medir). La lectura de respuestas existente sigue separada; no se activa ningún proveedor, tercero o flujo que escriba datos reales.
