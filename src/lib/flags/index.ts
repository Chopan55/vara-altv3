/**
 * Feature flags.
 *
 * Un flag apagado por defecto se enciende agregando su nombre a la variable de
 * entorno NEXT_PUBLIC_FLAGS (separado por comas). Ejemplo en .env.local:
 *   NEXT_PUBLIC_FLAGS=docIntelligence,sharedTransaction
 *
 * Las flags están resueltas en tiempo de módulo (build + runtime) — no cambian
 * en una misma sesión sin recargar. Para desarrollo se pueden encender sin
 * hacer un deploy: basta con setear la variable y reiniciar el servidor.
 */

const ALL_FLAGS = {
  /** P2: IA lee escrituras PDF y extrae titularidad, cargas, restricciones. */
  docIntelligence: false,
  /** P2: comprador y vendedor ven y actualizan la misma operación en simultáneo. */
  sharedTransaction: false,
  /** P2: alertas push cuando cambia el estado de un documento u oferta. */
  pushAlerts: false,
  /** P3: API pública v1 expuesta a integraciones externas. */
  publicApi: false,
  /** P3: UI y dominio personalizables para corredores o escribanías. */
  whiteLabel: false,
  /**
   * VARA Buy WOW V3: pegás un aviso y el análisis comparable aparece en /analizar.
   * Preview: `?v3=1` en la URL o NEXT_PUBLIC_FLAGS=buyWowV3. El flujo actual no cambia.
   */
  buyWowV3: false,
  /** Encendidos por defecto: se apagan con NEXT_PUBLIC_FLAGS_OFF=nombre (rollback sin tocar código). */
  /** Después del login, quien no tiene operaciones pasa por /empezar. */
  conversationalEntry: true,
  /** Menú lateral agrupado por etapa del recorrido. */
  groupedMenu: true,
  /** Herramientas nuevas de venta y compra (precio, ficha, video, interesados, mi búsqueda). */
  journeyTools: true,
} as const

export type FlagName = keyof typeof ALL_FLAGS

function resolveFlags(): Readonly<Record<FlagName, boolean>> {
  const enabled = (process.env.NEXT_PUBLIC_FLAGS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const off = (process.env.NEXT_PUBLIC_FLAGS_OFF ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return Object.fromEntries(
    (Object.keys(ALL_FLAGS) as FlagName[]).map(k => [k, (enabled.includes(k) || ALL_FLAGS[k]) && !off.includes(k)])
  ) as Record<FlagName, boolean>
}

export const flags: Readonly<Record<FlagName, boolean>> = resolveFlags()

export function isEnabled(name: FlagName): boolean {
  return flags[name]
}
