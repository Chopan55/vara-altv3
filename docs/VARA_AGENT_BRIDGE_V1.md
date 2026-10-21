# VARA Agent Bridge V1.1

Guía para Pancho, en lenguaje simple. Actualizada: 2026-10-17 (hardening V1.1).

> Para trabajar desde tu computadora usando los cupos incluidos en ChatGPT y Claude, sin descontar saldo de API, usá [VARA Duo local](./VARA_AGENT_BRIDGE_LOCAL.md). Esta guía describe el modo remoto de GitHub Actions, que sí usa APIs.

## En una frase

Vos lanzás **un objetivo una sola vez**. GPT y Claude trabajan entre ellos. Si hace falta una decisión tuya, te llega un aviso de GitHub y **respondés `APPROVE` con un comentario**: el agente sigue **solo**, sin que vuelvas a lanzar nada.

## Qué hace

- **GPT (el Manager)** piensa: decide qué hacer, escribe la tarea y revisa el resultado.
- **Claude Code (el implementador)** trabaja: lee el código, lo cambia y lo prueba.
- **El bridge (código)** vigila: corre typecheck, lint, tests y build él mismo, hace commit y push, abre el PR y dispara el CI.

Van y vienen hasta **4 rondas como máximo** por corrida. Si todo sale bien, queda un **Pull Request hacia `integracion`** con el CI en verde. **Nunca se mergea solo y nunca toca producción.**

| | GPT (Manager) | Claude Code | El bridge |
|---|---|---|---|
| Decide qué sigue | Sí | No | No |
| Escribe y cambia archivos | No | Sí | No |
| Corre typecheck, lint, tests, build | No | A veces, para orientarse | **Sí, siempre; es lo que vale** |
| Commit, push, PR y CI | No | No | Sí |
| Te pregunta | Pide hacerlo | Puede sugerirlo | Abre el Issue |

## Uso real, paso a paso

1. **Una sola vez:** GitHub → Actions → **VARA Agent Bridge** → Run workflow. Escribís el `goal`. Dejá `max_rounds` en 4. Marcá `dry_run` para una prueba sin rama, commit, PR ni Issue.
2. GPT ↔ Claude trabajan solos.
3. **Si necesitan una decisión tuya**, el bridge abre un Issue **propio de esa corrida**: `VARA Agent — Approval Required [run-…]`. GitHub te avisa al celular.
4. Abrís el Issue y comentás **una palabra** en la primera línea (podés sumar una nota):

   | Comentario | Qué pasa |
   |---|---|
   | `APPROVE` | Registra tu decisión, **cierra el Issue** y el agente **continúa solo** |
   | `CONTINUE` | Igual que `APPROVE` (seguí; podés agregar una nota) |
   | `REJECT` | Registra, **cierra el Issue** y **termina** la corrida |
   | `STOP` | Registra, **cierra el Issue** y **termina** la corrida |

5. El workflow se **reanuda automáticamente** al recibir tu comentario. No lances nada a mano.
6. Al final, el PR a `integracion` queda esperándote. Lo mergeás vos.

Si el agente vuelve a tener una duda en la **misma** corrida, **reabre el mismo Issue** (un Issue por corrida, nunca se comparte entre corridas).

El tope de rondas sumando todas las reanudaciones de un objetivo es **8**.

## Cuándo te interrumpe

- GPT decide que necesita tu OK (`ASK_PANCHO`).
- Se llegó a 4 rondas sin terminar.
- El mismo problema apareció dos veces.
- Se pidió algo prohibido (producción, master, secretos, base de producción).
- Claude tocó archivos protegidos, o una tarea "solo lectura" modificó archivos.

El Issue trae: objetivo original, qué hizo GPT, qué hizo Claude, tests, el problema, una recomendación y **una pregunta concreta**. Antes de pausar, el bridge deja el trabajo guardado en la rama `agent/run-…`, y al reanudar usa **exactamente el objetivo original** que guardó el Issue.

## Quién puede dar órdenes

Solo comentarios de **`@Chopan55`** (usuario real, no bot) en un Issue del bridge. Se ignoran, sin escribir nada:

- comentarios de otros usuarios;
- comentarios de bots y los del propio bridge (empiezan con `[vara-agent]`: así no hay loops);
- Issues que no son del bridge, sin estado de corrida, con un título que no coincide con su corrida o con una rama no permitida;
- Issues ya cerrados (la decisión ya se usó).

## El PR y el CI

Los PR y push que crea GitHub Actions con su token **no disparan el CI solos**. Por eso, apenas el bridge abre el PR, **dispara el CI explícitamente** sobre la rama y espera el resultado (hasta 30 minutos).

- CI en verde → el PR queda **listo para tu revisión** (`DONE` o `READY_FOR_REVIEW`).
- CI en rojo, cancelado o sin terminar → el bridge **no declara `READY_FOR_REVIEW`**: la corrida termina `FAILED` y deja un comentario en el PR. No hace falta cerrar y reabrir nada.

El CI también corre para los PR hacia `integracion`. Además del typecheck del proyecto, **typecheckea el propio bridge** (`npm run typecheck --prefix tools/vara-agent`): si el bridge no compila, el CI no queda en verde.

## Lo que NUNCA hace solo

- Mergear a `master` o a `integracion` (solo abre un PR hacia `integracion`).
- Deployar a producción, promover o hacer rollback en Vercel.
- Correr migraciones o tocar la base de producción de Supabase.
- Cambiar variables de entorno o secretos.
- Pasar de 4 rondas por corrida (8 en total por objetivo).
- Modificar su propio código, su workflow o las reglas de `agent/`.
- Usar `--dangerously-skip-permissions`.

Si el objetivo menciona producción, el máximo al que llega es **READY_FOR_PRODUCTION** y se detiene. El deploy es tuyo.

## Qué ve Claude (secretos)

Claude Code recibe un entorno **por lista blanca**: solo lo básico del sistema (PATH, HOME, temporales) y **su propia credencial** (`ANTHROPIC_API_KEY` o `CLAUDE_CODE_OAUTH_TOKEN`). **No hereda** el entorno completo: nunca ve `OPENAI_API_KEY`, `GH_TOKEN`, `GITHUB_TOKEN`, claves de Supabase, Bright Data, Gemini ni ningún otro secreto. Las validaciones del proyecto tampoco reciben las claves de IA ni de GitHub. Todo lo que se registra pasa por una redacción que tapa claves como `[REDACTADO]`.

## Modelo de OpenAI

`OPENAI_MODEL` es configurable (variable del repositorio). Por defecto es `gpt-5.5`. **Antes de cualquier trabajo, en cada corrida (también dry-run), el bridge le pregunta a OpenAI si ese modelo existe para tu cuenta**; si no existe o la clave no sirve, frena con un mensaje claro y no gasta tokens ni crea ramas. El nombre `gpt-5.6` que figuraba en el pedido original **no existe** en la cuenta (sí `gpt-5.6-luna`, `-sol` y `-terra`): para usar otro, definí `OPENAI_MODEL`.

## Qué queda registrado

Cada corrida guarda `run_id`, objetivo, inicio y fin, rama, rondas, decisión de GPT y resultado de Claude por ronda, resultados de typecheck/lint/test/build, commits, resultado del CI, estado final, tus aprobaciones y costo estimado. Se baja como artefacto **vara-agent-run** (14 días).

Estados finales: `DONE`, `READY_FOR_REVIEW`, `READY_FOR_PRODUCTION`, `WAITING_FOR_HUMAN`, `STOPPED`, `FAILED`.

## Costos

- **OpenAI**: tokens del Manager (pocas llamadas chicas por corrida).
- **Claude Code**: el costo real aparece en el resumen de cada corrida.
- **GitHub Actions**: minutos del runner. Cada reanudación es una corrida corta aparte; el CI suma otra.
- **Tope por llamada a Claude:** `CLAUDE_MAX_BUDGET_USD` (por defecto **2,50**). Se pasa a cada llamada como `--max-budget-usd`. El bridge no pasa `--max-turns`: versiones actuales de Claude Code pueden cortar con `error_max_turns` antes de entregar el resultado estructurado. El gasto sigue acotado por presupuesto, timeout y rondas.
- **Tope acumulado de la corrida:** `MAX_AGENT_COST_USD` (por defecto **8,00**). Después de cada ronda el bridge suma el costo real que informa Claude (y el de OpenAI si cargaste precios). Si lo supera, **se detiene solo**: no inicia otra llamada a Claude ni otra ronda, deja el trabajo en la rama y te pregunta en el Issue. El gasto se arrastra entre reanudaciones, y si respondés `APPROVE` o `CONTINUE` se habilita **una ventana nueva** de ese monto a partir de lo ya gastado, no un cheque en blanco.
- Con 4 rondas por corrida y 8 en total, más estos dos topes, el gasto está acotado. Para ver el estimado de OpenAI definí `OPENAI_PRICE_INPUT_PER_M` y `OPENAI_PRICE_OUTPUT_PER_M`. Probá primero con `dry_run`.

## Cómo frenarlo

- Comentá `STOP` en el Issue (cierra la corrida), o en Actions tocá **Cancel workflow** sobre la corrida en curso.
- Para desactivarlo del todo: Actions → VARA Agent Bridge → **Disable workflow**, o sacá el secreto `OPENAI_API_KEY`.

## Qué hay que configurar una vez

- Secretos: `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` **o** `CLAUDE_CODE_OAUTH_TOKEN`.
- Variables opcionales: `OPENAI_MODEL`, `CLAUDE_MODEL` (por defecto `sonnet`).
- Settings → Actions → General: activar **"Allow GitHub Actions to create and approve pull requests"**.

## Pruebas recomendadas, en orden

1. **Dry-run de análisis**: "Revisá el estado actual del proyecto VARA y proponé las 3 próximas tareas técnicas prioritarias. No modifiques código." Esperado: GPT → Claude → GPT → `DONE`, sin cambios de archivos.
2. **Cambio mínimo**: "Agregá un archivo docs/AGENT_BRIDGE_TEST.md con una línea de prueba." Esperado: rama `agent/run-…`, validaciones en verde, PR hacia `integracion`, CI en verde, sin merge.

## Si algo falla

| Síntoma | Qué pasa y qué hacer |
|---|---|
| "Falta el secreto OPENAI_API_KEY" | Cargarlo en GitHub Secrets |
| "El modelo … no existe" | Cambiar la variable `OPENAI_MODEL` |
| Comenté `APPROVE` y no pasó nada | Revisá que el comentario sea tuyo (`@Chopan55`), esté en un Issue `VARA Agent — Approval Required [run-…]` abierto, y que la primera línea sea solo el comando. Mirá la corrida en Actions: dice por qué ignoró el evento |
| El workflow no aparece o no reacciona a comentarios | GitHub usa el workflow de la rama por defecto (`master`): hasta que este cambio llegue ahí por el camino normal, ni el botón "Run workflow" ni `issue_comment` funcionan |
| No se crea el PR | Activar "Allow GitHub Actions to create … pull requests" |
| `FAILED` por CI | Abrí el link del CI en el comentario del PR; el PR queda abierto para que lo veas |
| `FAILED` con error de Claude | Mirar el log del paso "Correr el bridge"; suele ser clave inválida o límite de uso |
| Pide decisión una y otra vez | Reformulá el objetivo en algo más chico |

## Límites conocidos

- Todo está probado con dobles; la primera corrida real con `dry_run` valida la integración con OpenAI y Claude Code (en particular el modo de permisos `dontAsk`) y el disparo de CI con `gh workflow run`.
- Hasta que el workflow esté en `master`, no se puede usar desde GitHub.
- El `ci.yml` ahora acepta `workflow_dispatch`; el CI explícito necesita el permiso `actions: write`, que el workflow del bridge ya declara.
- En Windows, `claude` debe estar instalado como `.exe`; el camino soportado es el runner Linux de GitHub.
- No guarda memoria entre objetivos distintos más allá de `agent/CURRENT_STATE.json`, que se actualiza a mano.
- `resume_issue` queda solo como salida de emergencia; el uso normal es comentar en el Issue.
