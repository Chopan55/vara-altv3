# VARA Duo local — ChatGPT + Claude sin saldo de API

Este es el modo recomendado para usar el Bridge desde la computadora de Pancho. **Codex usa la sesión de la suscripción de ChatGPT** y **Claude Code usa la sesión de la suscripción de Claude**. No necesita `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` ni créditos cargados en las APIs.

No es uso ilimitado: consume los cupos incluidos en cada plan. Si un proveedor alcanza su límite temporal, el Bridge se detiene con un mensaje y puede retomarse más tarde. No descuenta dólares del saldo API.

## Qué hace

1. Codex lee el objetivo, actúa como Manager y le da una tarea concreta a Claude.
2. Claude Code implementa esa tarea en una rama `agent/run-...`.
3. El Bridge ejecuta typecheck, lint, tests y build.
4. Codex revisa el resultado y decide si Claude corrige, si hace falta preguntarle a Pancho o si quedó listo.
5. Cuando termina, el Bridge abre un Pull Request hacia `integracion` y espera el CI.

Nunca mergea, despliega a producción ni cambia secretos por su cuenta.

## Uso normal

Parado en el repositorio, ejecutá:

```powershell
npm run vara:duo -- "Describí acá lo que querés construir"
```

También podés abrir directamente el lanzador y escribir el objetivo cuando lo pregunte:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\vara-agent\vara-local.ps1
```

Debe arrancar desde la rama `integracion` y con el repositorio limpio. El Bridge crea su propia rama de trabajo.

## Configuración de una sola vez

Los tres programas deben mostrar una sesión activa:

```powershell
codex login status
claude auth status
gh auth status
```

- Codex debe decir que inició sesión usando ChatGPT.
- Claude debe indicar `authMethod: claude.ai` y una suscripción activa.
- GitHub CLI debe estar conectado para crear la rama, el PR y consultar el CI.

El Bridge comprueba esos tipos de inicio de sesión antes de cada trabajo. Además lanza Codex y Claude con un entorno mínimo que **excluye expresamente todas las claves de API de IA**, aunque existan en la terminal. Si un token de sesión venció, el primer intento se detiene y pide renovar el login; no cambia a la API como alternativa silenciosa.

## Si pide una decisión

El Bridge abre un Issue. Comentá `APPROVE`, `CONTINUE`, `REJECT` o `STOP` como primera palabra. Para continuar localmente:

```powershell
tools\vara-agent\vara-local.ps1 -ResumeIssue 123
```

Reemplazá `123` por el número del Issue. En el modo local la reanudación no queda ejecutándose en segundo plano: la iniciás con ese comando.

## Opciones

- `MAX_AGENT_ROUNDS`: rondas de Codex ↔ Claude; el modo local usa 3 por defecto y nunca supera 4 por corrida.
- `CODEX_MODEL`: fuerza un modelo disponible en tu plan. Si no se define, Codex usa el modelo configurado en la cuenta.
- `CLAUDE_MODEL`: por defecto `sonnet`.
- `DRY_RUN=true`: prueba de solo lectura; no crea rama, commit, PR ni Issue.

El modo original de GitHub Actions sigue disponible y está documentado en [VARA_AGENT_BRIDGE_V1.md](./VARA_AGENT_BRIDGE_V1.md). Ese modo sí usa APIs, permite ejecución remota y reanudación automática, pero puede generar cargos por consumo.
