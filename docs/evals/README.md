# Evaluación continua del asistente de VARA

Este banco verifica las garantías que dependen del servidor, no si una respuesta del modelo «suena bien».

## Capa determinística

Corre en CI, sin red ni claves:

```bash
npx vitest run tests/assistantEvals.test.ts
```

Los 34 fixtures viven en `tests/evals/assistantCases.ts`. El test simula OpenAI y las consultas a Supabase, y observa:

- contexto de operación filtrado por dueño, propiedad vinculada, documentos y tareas;
- estado verificado rotulado como datos, con nombres recortados;
- calculadora y `calcular_costos` únicamente para preguntas de costos;
- cálculo forzado únicamente cuando existe un precio registrado en USD;
- rechazo de precios inventados por el modelo;
- separación del borrador, protección del tope privado y fuentes declaradas;
- terminología mexicana, operación ajena y recuentos de documentos `0` frente a `null`.

## Capa con modelo real

Es opcional y no corre en CI. Ejecuta los mismos casos contra el modelo de verdad **pasando por la ruta real del chat** (`tests/assistantEvalsReal.test.ts`), con Supabase simulado, así que no duplica ninguna lógica:

```bash
OPENAI_API_KEY='…' npm run eval:assistant
# para comparar otro modelo sin tocar el código:
OPENAI_API_KEY='…' OPENAI_CHAT_MODEL=gpt-4o npm run eval:assistant
```

La clave se lee solo desde `process.env.OPENAI_API_KEY`; no se guarda en archivos. Aplica reglas objetivas (`tests/evals/scoring.ts`) y escribe `docs/evals/ultimo-resultado.md` con el modelo usado, el puntaje por caso, las reglas que falló, la latencia y la respuesta. No usa otro LLM como juez. Los casos 25 y 26 simulan a un modelo que se equivoca y solo corren con el modelo simulado.

Reglas: montos respaldados por los mensajes o la herramienta, sin garantías ni «está en regla», sin revelar el tope privado, fuentes coherentes (operación solo si hay una verificada; calculadora solo en costos), una sola pregunta cuando falta el precio, sin derivar a herramientas externas, y terminología mexicana en México.
