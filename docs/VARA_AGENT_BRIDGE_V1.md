# VARA Agent Bridge V1

Guía para Pancho, en lenguaje simple. Fecha: 2026-10-17.

## Qué hace

Vos escribís un objetivo ("agregá tal cosa", "revisá el estado del proyecto"). El bridge arma un equipo de dos:

- **GPT (el Manager)** piensa: decide qué hacer, escribe la tarea y revisa el resultado.
- **Claude Code (el implementador)** trabaja: lee el código, lo cambia y lo prueba.

Entre los dos van y vienen hasta **4 rondas como máximo**. Si todo sale bien, queda un **Pull Request hacia `integracion`** para que lo revises. **Nunca se mergea solo y nunca toca producción.**

## Quién hace qué

| | GPT (Manager) | Claude Code | El bridge (código) |
|---|---|---|---|
| Decide qué sigue | Sí | No | No |
| Escribe y cambia archivos | No | Sí | No |
| Corre typecheck, lint, tests, build | No | A veces, para orientarse | **Sí, siempre; es lo que vale** |
| Commit, push y PR | No | No | Sí |
| Pregunta a Pancho | Pide hacerlo | Puede sugerirlo | Crea el Issue |

El bridge no le cree a nadie "los tests pasan": los corre él.

## Cómo lo arrancás (desde el celular también)

1. En GitHub abrí **Actions → VARA Agent Bridge → Run workflow**.
2. Completá **goal** (el objetivo). Dejá `max_rounds` en 4. Marcá `dry_run` si es una prueba: no crea rama, ni commit, ni PR, ni Issue.
3. Tocá **Run workflow** y esperá. Al final, el resumen de la corrida dice cómo terminó y dónde está el PR.

Solo la cuenta `Chopan55` puede lanzarlo.

## Cuándo te interrumpe

Se frena y te pregunta (un Issue llamado **"VARA Agent — Approval Required"**) cuando:

- GPT decide que necesita tu OK (`ASK_PANCHO`).
- Se llegó a 4 rondas sin terminar.
- El mismo problema apareció dos veces.
- Se pidió algo prohibido (producción, master, secretos, base de producción).
- Claude tocó archivos protegidos, o una tarea "solo lectura" modificó archivos.

El Issue trae: objetivo, qué hizo GPT, qué hizo Claude, tests, el problema, una recomendación y **una pregunta concreta**.

## Cómo aprobar o rechazar desde el celular

Abrí el Issue (llega notificación de GitHub) y comentá, en la primera línea, **una palabra**:

| Comando | Qué pasa |
|---|---|
| `APPROVE` | Sigue adelante con lo propuesto |
| `CONTINUE` | Sigue trabajando; podés agregar una nota ("CONTINUE pero sin tocar auth") |
| `REJECT` | Descarta y cierra la corrida |
| `STOP` | Frena todo |

Después volvé a correr **VARA Agent Bridge** poniendo en `resume_issue` el número del Issue. Solo cuenta lo que comenta `@Chopan55`; los comentarios de otros se ignoran y quedan avisados. Tu decisión queda registrada en el PR.

El tope sumado de rondas por objetivo, contando reanudaciones, es **8**.

## Lo que NUNCA hace solo

- Mergear a `master` o a `integracion` (solo abre un PR hacia `integracion`).
- Deployar a producción, promover o hacer rollback en Vercel.
- Correr migraciones o tocar la base de producción de Supabase.
- Cambiar variables de entorno o secretos.
- Pasar de 4 rondas por corrida.
- Modificar su propio código, su workflow o las reglas de `agent/`.
- Usar `--dangerously-skip-permissions`.

Si el objetivo menciona producción, el máximo al que llega es **READY_FOR_PRODUCTION** y se detiene. El deploy es tuyo.

## Qué queda registrado

Cada corrida guarda `run_id`, objetivo, inicio y fin, rama, rondas, decisión de GPT y resultado de Claude por ronda, resultados de typecheck/lint/test/build, commits, estado final, tus aprobaciones y costo estimado. Se baja como artefacto **vara-agent-run** del workflow (14 días). Las claves se tapan como `[REDACTADO]`.

Estados finales: `DONE`, `READY_FOR_REVIEW`, `READY_FOR_PRODUCTION`, `WAITING_FOR_HUMAN`, `STOPPED`, `FAILED`.

## Costos

- **OpenAI**: se paga por tokens del Manager (pocas llamadas chicas por corrida).
- **Claude Code**: el costo real lo informa cada corrida (aparece en el resumen).
- **GitHub Actions**: minutos del runner (límite del workflow: 60 min).
- Con 4 rondas máximas y sin loops, el gasto por corrida está acotado. Para ver el estimado de OpenAI definí las variables `OPENAI_PRICE_INPUT_PER_M` y `OPENAI_PRICE_OUTPUT_PER_M`; si no, el resumen muestra solo el costo de Claude.
- Probá siempre primero con `dry_run`.

## Cómo frenarlo

- En Actions, abrí la corrida y tocá **Cancel workflow**.
- O comentá `STOP` en el Issue.
- Para desactivarlo del todo: Actions → VARA Agent Bridge → **Disable workflow**, o sacar el secreto `OPENAI_API_KEY`.

## Secretos que hay que cargar (Settings → Secrets and variables → Actions)

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY` **o** `CLAUDE_CODE_OAUTH_TOKEN` (uno alcanza)
- Opcional (variables, no secretos): `OPENAI_MODEL` (por defecto `gpt-5.5`), `CLAUDE_MODEL` (por defecto `sonnet`).

Además, en Settings → Actions → General activá **"Allow GitHub Actions to create and approve pull requests"**.

## Modelo de OpenAI

El pedido original decía `gpt-5.6` como valor por defecto, pero ese nombre **no existe** en la cuenta (sí existen `gpt-5.6-luna`, `-sol` y `-terra`). Por eso el valor por defecto es `gpt-5.5`, verificado. Antes de gastar tokens el bridge consulta si el modelo existe y, si no, frena con un mensaje claro. Para usar otro, cargá la variable `OPENAI_MODEL`.

## Pruebas recomendadas, en orden

1. **Dry-run de análisis**: goal "Revisá el estado actual del proyecto VARA y proponé las 3 próximas tareas técnicas prioritarias. No modifiques código." Esperado: GPT → Claude → GPT → `DONE`, sin cambios de archivos.
2. **Cambio mínimo**: goal "Agregá un archivo docs/AGENT_BRIDGE_TEST.md con una línea de prueba." Esperado: rama `agent/run-…`, validaciones en verde, PR hacia `integracion` sin mergear.

## Si algo falla

| Síntoma | Qué pasa y qué hacer |
|---|---|
| "Falta el secreto OPENAI_API_KEY" | Cargarlo en GitHub Secrets |
| "El modelo … no existe" | Cambiar la variable `OPENAI_MODEL` |
| El workflow no aparece en Actions | GitHub solo muestra workflows que están en la rama por defecto (`master`); aparece cuando este cambio llegue ahí por el camino normal |
| No se crea el PR | Activar "Allow GitHub Actions to create … pull requests" |
| El PR no dispara el CI | Los PR creados con el token de Actions no disparan workflows: cerrá y reabrí el PR, o pusheá un commit tuyo |
| `FAILED` con error de Claude | Mirar el log del paso "Correr el bridge"; suele ser clave inválida o límite de uso |
| Pide decisión una y otra vez | Reformulá el objetivo en algo más chico |

## Límites conocidos de V1

- Probado con dobles de prueba; la primera corrida real con `dry_run` valida la integración con OpenAI y Claude Code (en particular el modo `dontAsk` de permisos).
- El workflow solo se puede lanzar desde la UI de GitHub cuando existe en `master`.
- Reanudar es manual: comentás en el Issue y volvés a lanzar el workflow con `resume_issue`.
- En Windows, `claude` debe estar instalado como `.exe`; el camino soportado es el runner Linux de GitHub.
- No guarda memoria entre objetivos distintos más allá de `agent/CURRENT_STATE.json`, que se actualiza a mano.
