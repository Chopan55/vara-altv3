import { redirect } from 'next/navigation'

/**
 * Esta pantalla ahora vive como pestaña dentro de /dinero.
 *
 * La ruta se mantiene en vez de borrarse: hay links guardados, compartidos y
 * en el dashboard que apuntan acá. Romperlos para ahorrar un archivo sería
 * mal negocio.
 */
export default function CostosRedirect() {
  redirect('/dinero?tab=costos')
}
