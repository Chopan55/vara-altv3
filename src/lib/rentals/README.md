# VARA Alquiler Check (lab)

Módulo **experimental y aislado** (prioridad P2). Ayuda a entender, antes de firmar un alquiler, cuánto cuesta entrar, cuánto cuesta por mes, qué riesgos hay y qué falta documentar. No es una plataforma transaccional ni asesoría legal.

## Aislamiento

- Nada del resto de VARA importa `src/lib/rentals`, `src/components/rentals` ni `src/app/alquileres`. El único cambio fuera del módulo es la clave `rentalsCheck` en `src/lib/flags/index.ts`.
- **Para eliminarlo:** borrar esas tres carpetas y la línea `rentalsCheck` de `src/lib/flags/index.ts`, y la carpeta `tests/rentals`. Nada más se rompe.
- No usa base de datos, red ni IA generativa: es lógica pura que corre en el navegador.

## Feature flag

Apagado por defecto: `/alquileres/check` responde 404.

- Encender: `NEXT_PUBLIC_FLAGS=rentalsCheck` (varias flags, separadas por coma) y reiniciar/rebuild. Las `NEXT_PUBLIC_*` se fijan en el build.
- Apagar: quitar `rentalsCheck` de la variable.

## Estructura

| Archivo | Qué hace |
|---|---|
| `types.ts` | Contrato de datos. `null` = dato no declarado (distinto de 0 o false). |
| `defaults.ts` | `emptyRentalInput` y `sanitizeInput` (vacíos, NaN, negativos, strings). |
| `calculator.ts` | Costo de entrada y mensual, en la moneda del contrato. No convierte monedas ni estima precios. |
| `risks.ts` | Motor: evalúa reglas, arma datos faltantes y nivel de confianza. |
| `contractChecks.ts` | Reglas de contrato compartidas entre jurisdicciones (contrato escrito, inventario, devolución del depósito). |
| `guarantees.ts` | Comparación básica de garantías, sin precios inventados. |
| `checklist.ts` | Checklist antes de firmar. |
| `jurisdictions/` | Un *pack* por jurisdicción (`ar-caba.ts`, `mx-cdmx.ts`) con reglas, fuentes, garantías y checklist. |
| `labels.ts` | Etiquetas de enums y de datos faltantes. |
| `index.ts` | `runRentalCheck(input)` — punto de entrada. |

## Reglas

Cada regla es un dato (`id`, jurisdicción, rol, severidad, título, explicación, fuente) más un predicado puro. La UI no contiene lógica legal.

- `confidence: VERIFIED` = la norma o guía oficial se leyó y coincide con el texto de la regla (ver `lastReviewed` del pack).
- `confidence: NEEDS_REVIEW` = la fuente es una guía, una nota o una ausencia de hallazgo, o hay dudas abiertas.
- **Ninguna regla tuvo revisión legal profesional.** Por eso cada pack tiene `maxConfidence: 'MEDIUM'`: el resultado nunca dice confianza alta. Subir ese techo solo después de una revisión legal.
- El lenguaje es hedged ("Alerta", "Revisar", "Potencialmente no corresponde", "Requiere validación local"). No usar "ilegal" salvo regla inequívoca con fuente primaria.

### Para agregar o cambiar una regla

1. Confirmar la norma en una fuente oficial y anotar el artículo y la URL.
2. Agregarla en el pack de la jurisdicción (o en `contractChecks.ts` si es compartida).
3. Marcar `NEEDS_REVIEW` si la fuente no es primaria o si hay dudas.
4. Agregar un test en `tests/rentals/`.
5. Actualizar `lastReviewed` del pack.

### Dudas abiertas conocidas (al 2026-10-06)

- **AR:** estado del DNU 70/2023 en Diputados (sesión especial pedida para el 15/10/2026); contratos anteriores al DNU pueden regirse por otro régimen; texto vigente de los arts. 1203, 1209, 1222 y 1351 del CCyC.
- **MX:** no se confirmó si hubo reformas entre enero y octubre de 2026; el registro digital de contratos (art. 2448-F) tiene un amparo en la SCJN y no se confirmó su operación.

## Fuera de alcance (a propósito)

Rental Room, pagos, reclamos, salida del inmueble, marketplace, B2B, caución/pólizas integradas, subida de documentos, IA generativa, puntajes opacos, y cualquier cambio en compra/venta, dashboard o Transaction Room.
