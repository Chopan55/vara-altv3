/**
 * Ejemplo de la portada: avisos REALES y públicos, no datos inventados.
 * Se guardan solo los datos de cada aviso (no su descripción) y la fecha en que se copiaron.
 * Los comparables son avisos reales de la misma zona: VARA no busca comparables solo,
 * así que el ejemplo los trae para mostrar la comparación de precio.
 * Cuando un aviso se vence, se reemplaza por otro real y se actualiza `copiedAt`.
 */
export const EXAMPLE_LISTING = {
  url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-en-venta-en-palermo-capital-federal-59759132.html',
  portal: 'Zonaprop',
  copiedAt: '2026-11-22',
  text: [
    'Departamento en venta en Palermo, Capital Federal. Jerónimo Salguero al 1900.',
    'Venta. Departamento. USD 149.000. Expensas $ 200.000.',
    '48 m² totales. 2 ambientes. 1 dormitorio. 1 baño. Antigüedad 50 años.',
    'Datos copiados del aviso publicado en Zonaprop.',
  ].join('\n'),
  comparables: [
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-venta-departamento-palermo-con-pileta-y-parrilla-60621016.html',
      text: 'Departamento en venta en Palermo, Capital Federal. Darregueyra al 2400.\nVenta. Departamento. USD 115.000. Expensas $ 190.000.\n38 m² totales. 2 ambientes. 1 dormitorio. 1 baño. Antigüedad 25 años.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-excelente-2-ambientes-con-patio.-apto-profesional-60729846.html',
      text: 'Departamento en venta en Las Cañitas, Palermo, Capital Federal. Maure al 1600.\nVenta. Departamento. USD 120.000. Expensas $ 200.000.\n66 m² totales. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-venta-departamento-2-ambientes.-palermo.-amenities-59108295.html',
      text: 'Departamento en venta en Palermo, Capital Federal. Arévalo al 2300.\nVenta. Departamento. USD 230.000.\n42 m² totales. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-palermo-soho-en-construccion-financiado-60107927.html',
      text: 'Departamento en venta en Palermo Soho, Palermo, Capital Federal. Av. Córdoba al 5000.\nVenta. Departamento. USD 157.590. En construcción.\n52 m² totales. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-de-2-ambientes-en-venta-en-palermo-con-59854607.html',
      text: 'Departamento en venta en Palermo, Capital Federal. Paraguay al 3700.\nVenta. Departamento. USD 229.000. Expensas $ 290.000.\n81 m² totales. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-de-2-ambientes-en-palermo-chico-60097000.html',
      text: 'Departamento en venta en Palermo Chico, Palermo, Capital Federal. Cabello al 3200.\nVenta. Departamento. USD 86.000. Expensas $ 116.000.\n28 m² totales. 2 ambientes. 1 dormitorio. 1 baño. Antigüedad 45 años.\nDatos copiados del aviso publicado en Zonaprop.',
    },
  ],
} as const

export function formatCopiedAt(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
