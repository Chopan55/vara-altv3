# VARA — Contexto del producto

> Fuente de verdad compartida entre el Manager (OpenAI) y el implementador (Claude Code).
> Ningún agente debe depender solo del historial de chat: esto es lo que tienen que saber siempre.

## Qué es VARA

VARA ayuda a una persona a **comprar o vender una propiedad con una decisión informada**, en Argentina (y México). Lema interno: *"VARA empieza donde terminan los portales."* No es un portal: toma el aviso que la persona ya encontró y le dice qué mirar antes de avanzar.

Dueño del producto: **Pancho** (Francisco Alonso-Hidalgo, cuenta GitHub `Chopan55`). Es la única persona que aprueba decisiones de producto, gasto, credenciales, producción y merges a `master`.

## Qué hace hoy (producción: `master`)

- **Analizar propiedad (`/analizar`, "V3")**: se pega el link (o el texto) de un aviso. VARA devuelve conclusión, encaje, posición del precio *publicado* frente a avisos comparables, evidencia inspectable, qué falta confirmar, riesgos, costo total y **una** próxima acción. Siempre habla de *precio publicado/pedido*, nunca de "valor de mercado".
- **Mercado en la nube**: los avisos comparables viven en Supabase (`market_listings`); el barrido con Bright Data existe pero está apagado.
- **Preguntale a VARA**: chat con IA que solo explica lo ya calculado por el análisis (responde únicamente con números que estén en el análisis), limitado a emails de `AI_ALLOWED_EMAILS`.
- **Avatar animado (WebGL) y voz (TTS de OpenAI)** dentro de "Preguntale a VARA"; se pueden ocultar/silenciar.
- **Compra y venta separadas**: dashboards, menú por etapa y herramientas de venta (precio, publicación, fotos, interesados, papeles).
- **VARA Visit** (visitas con persona verificada), comparador, costos, guía, asistente general, formulario de contacto público.

## Entornos

| Entorno | Rama | Base de datos | Quién lo toca |
|---|---|---|---|
| Producción | `master` | Supabase "VARA MVP" | Solo Pancho |
| Staging / Preview | `integracion` y ramas `agent/*` | Supabase "VARA STAGING" | Los agentes pueden proponer; las migraciones las aplica Pancho |

Hosting: Vercel (proyecto `vara-altv3`; producción en `vara-altv3-theta.vercel.app`). Repo: `Chopan55/vara-altv3`.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto, Tailwind 4, Supabase (Postgres/Auth/Storage con RLS), Vitest, ESLint 9. Scripts obligatorios: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Qué NO es todavía (no implementar sin pedido explícito)

- Voz en vivo estilo ChatGPT (OpenAI Realtime): es un sprint aparte.
- Avatar y voz dentro de `/asistente`: pendiente de un sprint propio.
- Valuación o "precio justo" propio, y cualquier cifra producida por un LLM como verdad numérica.
