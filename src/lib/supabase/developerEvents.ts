/**
 * Eventos que se pueden recibir por webhook. Sin dependencias de navegador:
 * lo usan el panel (cliente) y la documentación de la API (servidor).
 */
export const WEBHOOK_EVENTS: { value: string; label: string }[] = [
  { value: 'DOCUMENT_UPLOADED', label: 'Documento subido' },
  { value: 'DOCUMENT_STATUS_CHANGED', label: 'Cambio de estado de un documento' },
  { value: 'OFFER_CREATED', label: 'Oferta creada' },
  { value: 'OFFER_STATUS_CHANGED', label: 'Cambio de estado de una oferta' },
  { value: 'OPERATION_CREATED', label: 'Operación creada' },
]
