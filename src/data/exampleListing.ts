/**
 * Ejemplo de la portada: avisos REALES y públicos, no datos inventados.
 * Se guardan solo los datos de cada aviso (no su descripción) y la fecha en que se copiaron.
 * Los comparables son avisos reales de la misma zona: VARA no busca comparables solo,
 * así que el ejemplo los trae para mostrar la comparación de precio.
 * Cuando un aviso se vence, se reemplaza por otro real y se actualiza `copiedAt`.
 */
export const EXAMPLE_LISTING = {
  id: 'palermo',
  label: 'Departamento en Palermo, CABA',
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

export const EXAMPLE_VICENTE_LOPEZ = {
  id: 'vicente-lopez',
  label: 'Departamento en Florida, Vicente López (GBA Norte)',
  url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-venta-departamento-en-florida-vicente-lopez-2-60101100.html',
  portal: 'Zonaprop',
  copiedAt: '2026-11-23',
  text: 'Departamento en venta en Florida, Vicente López, GBA Norte. Hipólito Yrigoyen al 1800.\nVenta. Departamento. USD 150.000.\n56 m² totales, 56 m² cubiertos. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
  comparables: [
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-2-ambientes-a-estrenar-puerto-de-olivos-57324818.html',
      text: 'Departamento en venta en Olivos, Vicente López, GBA Norte. Juan Carlos Cruz al 2200.\nVenta. Departamento. USD 190.000.\n55 m² totales, 50 m² cubiertos. 2 ambientes. 1 dormitorio. 1 baño. A estrenar.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-simpatico-departamento-dos-ambientes-en-duplex-con-60147165.html',
      text: 'Departamento en venta en Olivos, Vicente López, GBA Norte. Córdoba 2681.\nVenta. Departamento. USD 198.000. Expensas $ 320.000.\n63 m² totales, 49 m² cubiertos. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-depadepartamento-2-ambientes-con-cochera-en-venta-a-58673642.html',
      text: 'Departamento en venta en Olivos, Vicente López, GBA Norte. Maipú al 3100.\nVenta. Departamento. USD 154.000.\n48 m² totales. 2 ambientes. 1 dormitorio. 1 baño. A estrenar, con cochera.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-en-venta-en-olivos-eco-zona-norte-2-60401880.html',
      text: 'Departamento en venta en Olivos, Vicente López, GBA Norte. Olivos Eco.\nVenta. Departamento. USD 185.000. Expensas $ 500.000.\n64 m² totales, 58 m² cubiertos. 2 ambientes. 1 dormitorio. 1 baño.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-en-venta-de-2-ambientes-en-vicente-lopez-59050801.html',
      text: 'Departamento en venta en Olivos, Vicente López, GBA Norte. Gobernador Valentín Vergara al 700.\nVenta. Departamento. USD 105.000. Expensas $ 118.000.\n50 m² totales, 50 m² cubiertos. 2 ambientes. 1 dormitorio. 1 baño. Antigüedad 90 años.\nDatos copiados del aviso publicado en Zonaprop.',
    },
    {
      url: 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-venta-departamento-2-ambientes-cochera-piscina-60149190.html',
      text: 'Departamento en venta en Vicente López, GBA Norte. San Martín al 800, piso 13.\nVenta. Departamento. USD 208.000. Expensas $ 290.000.\n50 m² totales. 2 ambientes. 1 dormitorio. 1 baño. Con cochera y pileta.\nDatos copiados del aviso publicado en Zonaprop.',
    },
  ],
} as const

export const EXAMPLE_CDMX = {
  id: 'cdmx',
  label: 'Departamento en Américas Unidas, Benito Juárez (CDMX)',
  url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-venta-en-americas-unidas-150874175.html',
  portal: 'Inmuebles24',
  copiedAt: '2026-11-23',
  text: 'Departamento en venta en Américas Unidas, Benito Juárez, Ciudad de México. Ramos Millán 49.\nVenta. Departamento. MXN 3,390,000. Mantenimiento MXN 1,800.\n62 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
  comparables: [
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-para-remodelar-en-la-colonia-del-valle-150341189.html',
      text: 'Departamento en venta en Del Valle Centro, Benito Juárez, Ciudad de México. Providencia.\nVenta. Departamento. MXN 4,000,000. Mantenimiento MXN 1,500.\n90 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-independencia-151534512.html',
      text: 'Departamento en venta en Independencia, Benito Juárez, Ciudad de México. Independencia.\nVenta. Departamento. MXN 4,730,014.\n73 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-venta-en-del-valle-centro-2-151649006.html',
      text: 'Departamento en venta en Del Valle Centro, Benito Juárez, Ciudad de México. Avenida Eugenia.\nVenta. Departamento. MXN 4,720,000. Mantenimiento MXN 5,000.\n62 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-life-eugenia:-departamento-en-venta-en-narvarte-151593850.html',
      text: 'Departamento en venta en Narvarte Oriente, Benito Juárez, Ciudad de México. Avenida Eugenia 1600.\nVenta. Departamento. MXN 5,227,000.\n76 m² construidos. 3 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-venta-en-narvarte-oriente-benito-151627667.html',
      text: 'Departamento en venta en Narvarte Oriente, Benito Juárez, Ciudad de México. Cumbres de Maltrata 423.\nVenta. Departamento. MXN 3,890,000. Mantenimiento MXN 3,700.\n67 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-venta-en-calzada-de-tlalpan-nativitas-151375193.html',
      text: 'Departamento en venta en Nativitas, Benito Juárez, Ciudad de México. Calzada de Tlalpan.\nVenta. Departamento. MXN 3,480,000. Mantenimiento MXN 1,700.\n65 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-narvarte-vive-sin-coche!-con-balcon-y-148070690.html',
      text: 'Departamento en venta en Narvarte Poniente, Benito Juárez, Ciudad de México. Avenida Cuauhtémoc.\nVenta. Departamento. MXN 4,945,000. Mantenimiento MXN 2,500.\n75 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
    {
      url: 'https://www.inmuebles24.com/propiedades/clasificado/veclapin-venta-departamento-napoles-78-m-sup2-151529661.html',
      text: 'Departamento en venta en Nápoles, Benito Juárez, Ciudad de México. Indianápolis 89.\nVenta. Departamento. MXN 5,550,000.\n78 m² construidos. 2 recámaras. 2 baños.\nDatos copiados del aviso publicado en Inmuebles24.',
    },
  ],
} as const

/** Casos reales de la portada. `?ejemplo=1` sigue abriendo Palermo. */
export const EXAMPLES = [EXAMPLE_LISTING, EXAMPLE_VICENTE_LOPEZ, EXAMPLE_CDMX] as const
export type Example = (typeof EXAMPLES)[number]

export function exampleById(id: string | null): Example | null {
  if (!id) return null
  if (id === '1') return EXAMPLE_LISTING
  return EXAMPLES.find(e => e.id === id) ?? null
}

export function formatCopiedAt(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Barrio y ciudad de un aviso de ejemplo, sacados de su primera línea
 * («Departamento en venta en Olivos, Vicente López, GBA Norte.»). Sin IA, el texto
 * pegado no trae ubicación y sin ella no hay comparables: el ejemplo la completa
 * con lo que el mismo aviso dice, nunca inventada.
 */
export function exampleLocation(text: string): { neighborhood?: string; city?: string } {
  const m = text.match(/en venta en ([^.\n]+)\./i)
  if (!m) return {}
  const parts = m[1].split(',').map(p => p.trim()).filter(Boolean)
  if (/ciudad de m[eé]xico/i.test(m[1])) return { neighborhood: parts[0], city: 'Ciudad de México' }
  if (/gba/i.test(parts[parts.length - 1] ?? '')) {
    const rest = parts.slice(0, -1)
    return rest.length >= 2 ? { neighborhood: rest[0], city: rest[rest.length - 1] } : { city: rest[0] }
  }
  if (/capital federal|caba/i.test(parts[parts.length - 1] ?? '')) {
    const rest = parts.slice(0, -1)
    return { neighborhood: rest[rest.length - 1], city: 'Capital Federal' }
  }
  return {}
}
