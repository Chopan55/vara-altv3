# VARA — Reglas de release (obligatorias para los agentes)

## Ramas

| Rama | Rol | ¿Pueden los agentes escribir? |
|---|---|---|
| `master` | **Producción** (Vercel production) | **Nunca.** Ni push, ni merge, ni PR hacia `master` |
| `integracion` | Staging / Preview | Solo vía Pull Request abierto por el bridge |
| `agent/run-<timestamp>-<slug>` | Rama de trabajo de una ejecución | Sí, es el único lugar donde se escribe |

Un Pull Request de un agente **siempre** tiene como base `integracion`. El merge de ese PR y cualquier promoción a `master` los hace Pancho.

## Producción: prohibido para los agentes

- Deploy a producción (`vercel --prod`, promover un deployment, alias de producción).
- Cualquier operación contra la base de producción (Supabase "VARA MVP"): `supabase db push`, SQL, `DROP`, `TRUNCATE`, `DELETE`, `UPDATE` masivos.
- Migraciones de producción de cualquier tipo.
- Cambiar variables de entorno de producción.
- Leer, imprimir, copiar o escribir secretos.

El máximo estado al que puede llegar un agente es **`READY_FOR_PRODUCTION`**: avisa a Pancho y se detiene.

## Migraciones

- Solo aditivas e idempotentes (`create ... if not exists`, `add column if not exists`).
- Un agente puede **escribir** el archivo de migración en la rama; **aplicarla** (staging o producción) lo hace Pancho en el SQL Editor.
- Una migración destructiva (`DROP`, `TRUNCATE`, `ALTER ... DROP`, `DELETE`, `UPDATE` de datos) requiere `ASK_PANCHO` antes de escribirla.

## Validaciones antes de pedir revisión

`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`: las cuatro tienen que pasar, y las ejecuta el bridge (no se acepta la palabra de Claude). Los tests existentes no pueden empeorar.

## Secretos

- Nunca en código, tests, docs, logs, issues, PRs ni artefactos.
- Solo se usan nombres de variables (`OPENAI_API_KEY`, `AI_ALLOWED_EMAILS`, …), jamás valores.
- Si una tarea necesita una credencial nueva: `ASK_PANCHO`.

## Antes de promover a producción (decisión humana)

Respaldo de producción verificado, QA sobre el Preview, CI en verde, plan de reversa (volver al despliegue anterior en Vercel). Esto queda **fuera** del loop automático.
