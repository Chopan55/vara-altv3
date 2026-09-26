import type { ProvinceRegulation } from './types'

export const MX_PROVINCES: ProvinceRegulation[] = [
  {
    code: 'CDMX',
    name: 'Ciudad de México',
    displayName: 'CDMX',
    dataConfidence: 'PARTIAL',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Administración y Finanzas de la CDMX', acronym: 'SAF', url: 'https://finanzas.cdmx.gob.mx', role: 'IMPOSITIVO' },
      { name: 'Registro Público de la Propiedad y de Comercio CDMX', acronym: 'RPPC', url: 'https://www.registropublico.cdmx.gob.mx', role: 'REGISTRO' },
      { name: 'Colegio de Notarios de la Ciudad de México', acronym: 'CNCM', url: 'https://www.colegiodenotariosdf.org.mx', role: 'COLEGIO_ESCRIBANOS' },
    ],
    stampTax: {
      totalRate: 0.045,
      buyerShare: 1.0,
      sellerShare: 0.0,
      base: 'PRICE_OR_FISCAL',
      exemptions: [
        { description: 'Vivienda de interés social (INFONAVIT/FOVISSSTE)', condition: 'Crédito gubernamental, valor ≤ umbral oficial' },
      ],
      confidence: 'PARTIAL',
      sourceUrl: 'https://finanzas.cdmx.gob.mx/codigo-fiscal',
      notes: 'ISAI CDMX: tasa progresiva 2%-6% según valor, promedio ~4.5%. Solo paga el comprador. El notario centraliza todos los impuestos.',
    },
    notaryFee: {
      minRate: 0.008, maxRate: 0.015, buyerShare: 0.7, sellerShare: 0.3, vatApplies: true,
      notes: 'Honorarios notariales CDMX: arancel orientativo 0.8%-1.5%. IVA 16% aplica.',
    },
    registryFee: { rate: 0.003, notes: 'Derechos de registro RPPC: aprox 0.3% del valor' },
    documents: [
      { id: 'mx-cdmx-1', name: 'RFC (Registro Federal de Contribuyentes)', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true, notes: 'Obligatorio para comprador y vendedor. Trámite en sat.gob.mx' },
      { id: 'mx-cdmx-2', name: 'CURP del comprador y vendedor', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
      { id: 'mx-cdmx-3', name: 'Boleta predial al corriente (últimas 5 anualidades)', responsibleParty: 'VENDEDOR', category: 'IMPOSITIVO', isUniversal: false, provinceSpecific: true },
      { id: 'mx-cdmx-4', name: 'Constancia de no adeudo de agua (SACMEX)', responsibleParty: 'VENDEDOR', category: 'SERVICIOS', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [],
    particularities: [
      'ISR por enajenación: vendedor persona física puede exentar si es casa habitación con 3+ años de residencia',
      'El notario es agente retenedor del ISR y del ISAI — centraliza todos los impuestos en la escritura',
      'Escritura digital: CDMX tiene protocolo electrónico notarial desde 2023',
    ],
  },

  {
    code: 'JALISCO',
    name: 'Jalisco',
    displayName: 'Jalisco',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Planeación, Administración y Finanzas de Jalisco', acronym: 'SEPAF', url: 'https://sepaf.jalisco.gob.mx', role: 'IMPOSITIVO' },
      { name: 'Registro Público de la Propiedad de Jalisco', acronym: 'RPP Jalisco', url: 'https://registropublico.jalisco.gob.mx', role: 'REGISTRO' },
      { name: 'Colegio de Notarios del Estado de Jalisco', acronym: 'CNEJ', url: 'https://www.colegionotariosjalisco.org.mx', role: 'COLEGIO_ESCRIBANOS' },
    ],
    stampTax: {
      totalRate: 0.02,
      buyerShare: 1.0,
      sellerShare: 0.0,
      base: 'PRICE_OR_FISCAL',
      exemptions: [{ description: 'Primera vivienda para uso habitual', condition: 'Valor catastral ≤ umbral definido por municipio' }],
      confidence: 'ESTIMATED',
      notes: 'ISAI Jalisco: ~2% sobre valor de escritura. Verificar en SEPAF.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002, notes: 'Derechos de registro RPP Jalisco: aprox 0.2%' },
    documents: [
      { id: 'mx-jal-1', name: 'RFC y CURP comprador y vendedor', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
      { id: 'mx-jal-2', name: 'Boleta predial municipal al corriente', responsibleParty: 'VENDEDOR', category: 'IMPOSITIVO', isUniversal: false, provinceSpecific: true },
      { id: 'mx-jal-3', name: 'Certificado de no adeudo de agua (SIAPA)', responsibleParty: 'VENDEDOR', category: 'SERVICIOS', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Guadalajara', extraRequirements: ['Libre deuda municipal', 'Dictamen de uso de suelo'], hasTransferTax: true, transferTaxRate: 0.002 },
      { name: 'Puerto Vallarta', extraRequirements: ['Libre deuda predial', 'Certificado de no adeudo CFE'], hasTransferTax: true, transferTaxRate: 0.002 },
    ],
    particularities: [
      'Puerto Vallarta: zona restringida costera — extranjeros no pueden tener dominio directo, requieren fideicomiso bancario',
      'Guadalajara ZMG: mayor volumen de transacciones del occidente; plazos registrales más cortos',
    ],
  },

  {
    code: 'NUEVO_LEON',
    name: 'Nuevo León',
    displayName: 'Nuevo León',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Finanzas y Tesorería General del Estado de NL', acronym: 'SFTGE', url: 'https://www.nl.gob.mx/finanzas', role: 'IMPOSITIVO' },
      { name: 'Registro Público de la Propiedad de Nuevo León', acronym: 'RPP NL', role: 'REGISTRO' },
      { name: 'Colegio de Notarios de Nuevo León', acronym: 'CNNL', role: 'COLEGIO_ESCRIBANOS' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI NL: estimado ~2%. Monterrey es el mayor mercado corporativo del norte.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.013, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-nl-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
      { id: 'mx-nl-2', name: 'Boleta predial Monterrey/municipio al corriente', responsibleParty: 'VENDEDOR', category: 'IMPOSITIVO', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Monterrey', extraRequirements: ['Libre deuda municipal', 'Certificado catastral'], hasTransferTax: false },
      { name: 'San Pedro Garza García', extraRequirements: ['Libre deuda municipal', 'Certificado de uso de suelo'], hasTransferTax: false },
    ],
    particularities: [
      'San Pedro Garza García: el municipio con mayor valor promedio de transacción del país',
      'Mercado industrial muy activo — alta demanda de inmuebles corporativos y manufactura',
    ],
  },

  {
    code: 'QUERETARO',
    name: 'Querétaro',
    displayName: 'Querétaro',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Finanzas del Estado de Querétaro', acronym: 'SEFIN QRO', url: 'https://sefi.queretaro.gob.mx', role: 'IMPOSITIVO' },
      { name: 'Registro Público de la Propiedad de Querétaro', acronym: 'RPP Qro', role: 'REGISTRO' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI Querétaro: estimado ~2%. Mercado en expansión por nearshoring.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-qro-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
      { id: 'mx-qro-2', name: 'Boleta predial al corriente', responsibleParty: 'VENDEDOR', category: 'IMPOSITIVO', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Querétaro (capital)', extraRequirements: ['Libre deuda municipal'], hasTransferTax: false },
      { name: 'El Marqués', extraRequirements: ['Constancia de uso de suelo para industrial'], hasTransferTax: false },
    ],
    particularities: [
      'Crecimiento acelerado por nearshoring — alta demanda industrial y residencial 2024-2026',
      'Zonas de reserva ecológica en sierra: verificar uso de suelo antes de comprar',
    ],
  },

  {
    code: 'YUCATAN',
    name: 'Yucatán',
    displayName: 'Yucatán',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Administración y Finanzas de Yucatán', acronym: 'SAF Yucatán', url: 'https://saf.yucatan.gob.mx', role: 'IMPOSITIVO' },
      { name: 'Registro Público de la Propiedad de Yucatán', acronym: 'RPP Yucatán', role: 'REGISTRO' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI Yucatán: estimado ~2%. Mérida es el mercado de mayor crecimiento del sureste.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-yuc-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
      { id: 'mx-yuc-2', name: 'Boleta predial al corriente', responsibleParty: 'VENDEDOR', category: 'IMPOSITIVO', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Mérida', extraRequirements: ['Libre deuda predial municipal'], hasTransferTax: false },
    ],
    particularities: [
      'Alta demanda de compradores extranjeros — fideicomiso bancario en zona restringida costera',
      'Mérida: ciudad más segura de México (rankings 2025) — motor de demanda residencial',
    ],
  },

  {
    code: 'BAJA_CALIFORNIA',
    name: 'Baja California',
    displayName: 'Baja California',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Hacienda del Estado de Baja California', acronym: 'SH BC', url: 'https://shbc.gob.mx', role: 'IMPOSITIVO' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI BC: estimado ~2%. Alta participación de compradores binacionales MX-US.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-bc-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Tijuana', extraRequirements: ['Libre deuda municipal', 'Certificado catastral municipal'], hasTransferTax: false },
      { name: 'Ensenada', extraRequirements: ['Libre deuda predial'], hasTransferTax: false },
    ],
    particularities: [
      'Todo BC es zona restringida en franja costera y fronteriza — extranjeros requieren fideicomiso bancario',
      'Nearshoring Tijuana: alta demanda industrial, plazos registrales pueden extenderse',
    ],
  },

  {
    code: 'ESTADO_DE_MEXICO',
    name: 'Estado de México',
    displayName: 'Estado de México',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Finanzas del Estado de México', acronym: 'SFEM', url: 'https://finanzas.edomex.gob.mx', role: 'IMPOSITIVO' },
    ],
    stampTax: {
      totalRate: 0.025, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI EdoMex: estimado ~2.5%. Municipios conurbados a CDMX son los de mayor actividad.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.013, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.003 },
    documents: [
      { id: 'mx-edomex-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
      { id: 'mx-edomex-2', name: 'Boleta predial municipal', responsibleParty: 'VENDEDOR', category: 'IMPOSITIVO', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Toluca', extraRequirements: ['Libre deuda municipal'], hasTransferTax: false },
      { name: 'Naucalpan', extraRequirements: ['Libre deuda municipal', 'Certificado de no adeudo ODAPAS'], hasTransferTax: false },
    ],
    particularities: [
      'Municipios conurbados a CDMX: aunque físicamente cerca de CDMX, el régimen fiscal es EdoMex',
      'Alta concentración de uso mixto industrial-residencial en zona nororiente',
    ],
  },

  {
    code: 'PUEBLA',
    name: 'Puebla',
    displayName: 'Puebla',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Finanzas y Administración de Puebla', acronym: 'SFA Puebla', url: 'https://finanzas.puebla.gob.mx', role: 'IMPOSITIVO' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI Puebla: estimado ~2%. Corredor Puebla-Tlaxcala en expansión industrial.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-pue-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Puebla capital', extraRequirements: ['Libre deuda predial', 'No adeudo agua SOAPAP'], hasTransferTax: false },
    ],
    particularities: [
      'Centro histórico declarado Patrimonio UNESCO: permisos especiales para remodelación',
    ],
  },

  {
    code: 'GUANAJUATO',
    name: 'Guanajuato',
    displayName: 'Guanajuato',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Finanzas, Inversión y Administración de Guanajuato', acronym: 'SFIA GTO', url: 'https://sfia.guanajuato.gob.mx', role: 'IMPOSITIVO' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI Guanajuato: estimado ~2%. León, San Miguel Allende y corredor Bajío los más activos.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-gto-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'San Miguel de Allende', extraRequirements: ['Certificado de no adeudo municipal', 'Dictamen de uso de suelo patrimonio'], hasTransferTax: false },
    ],
    particularities: [
      'San Miguel de Allende: alta demanda extranjera — verificar zona restringida si aplica',
      'León: mayor mercado industrial de calzado y manufactura del Bajío',
    ],
  },

  {
    code: 'CHIHUAHUA',
    name: 'Chihuahua',
    displayName: 'Chihuahua',
    dataConfidence: 'ESTIMATED',
    lastUpdated: '2026-09-26',
    entities: [
      { name: 'Secretaría de Hacienda del Estado de Chihuahua', acronym: 'SH Chihuahua', url: 'https://hacienda.chihuahua.gob.mx', role: 'IMPOSITIVO' },
    ],
    stampTax: {
      totalRate: 0.02, buyerShare: 1.0, sellerShare: 0.0, base: 'PRICE_OR_FISCAL', exemptions: [],
      confidence: 'ESTIMATED',
      notes: 'ISAI Chihuahua: estimado ~2%. Ciudad Juárez, principal polo maquilador de México.',
    },
    notaryFee: { minRate: 0.008, maxRate: 0.012, buyerShare: 0.65, sellerShare: 0.35, vatApplies: true },
    registryFee: { rate: 0.002 },
    documents: [
      { id: 'mx-chi-1', name: 'RFC y CURP', responsibleParty: 'AMBOS', category: 'IDENTIDAD', isUniversal: false, provinceSpecific: true },
    ],
    keyMunicipalities: [
      { name: 'Ciudad Juárez', extraRequirements: ['Libre deuda predial municipal'], hasTransferTax: false },
    ],
    particularities: [
      'Ciudad Juárez: mercado industrial más grande de la frontera norte, plazos registrales 15-30 días',
    ],
  },
]
