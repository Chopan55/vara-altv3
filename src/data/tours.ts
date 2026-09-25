export interface TourStep {
  selector: string
  title: string
  body: string
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export interface Tour {
  id: string
  nombre: string
  pasos: TourStep[]
}

export const TOURS: Record<string, Tour> = {
  tour_bienvenida: {
    id: 'tour_bienvenida',
    nombre: 'Bienvenida a VARA',
    pasos: [
      {
        selector: '[href="/dashboard"]',
        title: 'Tu panel de operación',
        body: 'Desde acá ves el estado de tu operación de un vistazo: etapa actual, tareas pendientes y alertas importantes.',
        placement: 'right',
      },
      {
        selector: '[href="/publicar"]',
        title: 'Publicar tu propiedad',
        body: 'Subí fotos, completá los datos y coordiná la publicación en Zonaprop y Argenprop desde un solo lugar.',
        placement: 'right',
      },
      {
        selector: '[href="/ofertas"]',
        title: 'Gestión de ofertas',
        body: 'VARA compara y rankea cada oferta automáticamente. Ves el score, el método de pago y el análisis antes de responder.',
        placement: 'right',
      },
      {
        selector: '[href="/precios"]',
        title: 'Inteligencia de precios',
        body: 'Comparables reales de tu zona, posición de mercado y recomendación de precio de cierre basada en datos.',
        placement: 'right',
      },
      {
        selector: '[href="/asistente"]',
        title: 'Tu consultor VARA',
        body: 'Hacé cualquier pregunta sobre la operación, el mercado o los próximos pasos. VARA tiene el contexto completo de tu caso.',
        placement: 'right',
      },
    ],
  },

  tour_operacion: {
    id: 'tour_operacion',
    nombre: 'Mi Operación',
    pasos: [
      {
        selector: '[data-tour="operacion-timeline"]',
        title: 'Timeline de la operación',
        body: 'Cada etapa tiene tareas y fechas estimadas. VARA te avisa cuando algo requiere tu atención.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="operacion-costos"]',
        title: 'Costos de cierre',
        body: 'Todos los costos reales de la operación: impuestos, escribanía, comisiones. Sin sorpresas al final.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="operacion-docs"]',
        title: 'Documentación',
        body: 'Seguí el estado de cada documento necesario. VARA te dice qué falta y quién lo tiene que presentar.',
        placement: 'bottom',
      },
    ],
  },

  tour_costos: {
    id: 'tour_costos',
    nombre: 'Costos de la operación',
    pasos: [
      {
        selector: '[data-tour="costos-total"]',
        title: 'Total estimado',
        body: 'Esta es tu exposición total en costos de cierre. Incluye impuestos, honorarios y gastos de escrituración.',
        placement: 'bottom',
      },
      {
        selector: '[data-tour="costos-desglose"]',
        title: 'Desglose por categoría',
        body: 'Cada rubro tiene su base legal. Si algo no te cierra, consultale a VARA para entender el cálculo.',
        placement: 'top',
      },
    ],
  },
}
