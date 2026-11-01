/**
 * Visualizar el potencial de una foto (usa /api/transform, que ya existe).
 * Todo lo que sale de acá es una imagen GENERADA: nunca se presenta como el
 * estado real de la propiedad.
 */
export type VisualizeMode = 'AUTO' | 'PINTURA_EXTERIOR' | 'INTERIOR' | 'COCINA' | 'BANO' | 'JARDIN' | 'VACIAR'

export const VISUALIZE_MODES: { id: VisualizeMode; label: string; hint: string }[] = [
  { id: 'AUTO', label: 'Lo que más suma', hint: 'La mejora de mayor impacto' },
  { id: 'VACIAR', label: 'Ambiente vacío', hint: 'Sin muebles ni objetos personales' },
  { id: 'INTERIOR', label: 'Interior renovado', hint: 'Pintura, pisos, luz y decoración' },
  { id: 'COCINA', label: 'Cocina', hint: 'Muebles, mesada y artefactos' },
  { id: 'BANO', label: 'Baño', hint: 'Revestimientos y sanitarios' },
  { id: 'JARDIN', label: 'Jardín', hint: 'Césped, canteros y deck' },
  { id: 'PINTURA_EXTERIOR', label: 'Fachada', hint: 'Repintar frente y aberturas' },
]

export const GENERATED_LABEL = 'Imagen generada · visualización, no es el estado real'

/** Aviso a mostrar según cómo se obtuvo la imagen. */
export function noticeFor(editMethod: 'edit' | 'generated' | 'none' | undefined, apiNote?: string): string {
  if (editMethod === 'edit') return 'Edición de tu foto con IA. Muestra cómo podría verse, no cómo está hoy.'
  if (editMethod === 'generated') return apiNote ?? 'No pudimos editar tu foto. Esta imagen es una referencia de estilo, no tu propiedad.'
  return apiNote ?? 'No se pudo generar la imagen.'
}

/** Traduce la respuesta de error del servidor a lenguaje humano. */
export function humanError(status: number, serverMessage?: string): string {
  if (status === 401) return 'Ingresá a tu cuenta para usar esta función.'
  if (status === 403) return serverMessage ?? 'Esta función de IA está en prueba y todavía no está habilitada para tu cuenta.'
  if (status === 429) return serverMessage ?? 'Llegaste al límite diario de pruebas. Mañana se renueva.'
  if (status === 402) return 'La cuenta de IA se quedó sin crédito.'
  if (status === 413) return 'La imagen es muy pesada. Probá con otra.'
  return serverMessage ?? 'No pudimos procesar la imagen. Probá de nuevo en un rato.'
}

/** Achica la foto antes de enviarla: menos peso y menos costo. Solo navegador. */
export async function photoToBase64(url: string, maxSide = 1280): Promise<{ base64: string; mimeType: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('No se pudo leer la foto.'))
    i.src = url
  })
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar la foto.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg' }
}
