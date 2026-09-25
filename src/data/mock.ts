import type { Transaction, Property, Professional, VisitChecklistItem, Risk, UserOperationSummary, OperationRelation } from '@/types'

export const mockProperty: Property = {
  id: 'prop-001', type: 'HOUSE', operationType: 'sale', price: 185000, currency: 'USD',
  title: 'Casa 3 ambientes con jardín', address: 'Av. Los Robles 432', neighborhood: 'La Lonja',
  city: 'Pilar', province: 'Buenos Aires', surface: 420, coveredSurface: 180,
  rooms: 3, bedrooms: 3, bathrooms: 2, garage: true,
  description: 'Hermosa casa en barrio cerrado con jardín propio, quincho y pileta.',
  images: ['/placeholder.jpg'], features: ['Pileta', 'Quincho', 'Jardín', 'Seguridad 24hs'],
  expenses: 45000, ageYears: 12, isMock: true, score: 82,
}

export const mockProperties: Property[] = [
  mockProperty,
  { id: 'prop-002', type: 'HOUSE', operationType: 'sale', price: 210000, currency: 'USD', title: 'Casa 4 amb · Nordelta', address: 'Los Alisos 78', neighborhood: 'Los Alisos', city: 'Tigre', province: 'Buenos Aires', surface: 520, coveredSurface: 240, rooms: 4, bedrooms: 4, bathrooms: 3, garage: true, description: 'Espectacular casa en Nordelta, jardín propio 280m², pileta y parrilla. A 5 minutos de la laguna principal.', images: ['/placeholder.jpg'], features: ['Pileta', 'Parrilla', 'Seguridad 24hs', 'Club house'], expenses: 62000, ageYears: 8, isMock: true, score: 88 },
  { id: 'prop-003', type: 'HOUSE', operationType: 'sale', price: 165000, currency: 'USD', title: 'Casa 3 amb · Del Viso', address: 'Ruta 8 km 36', neighborhood: 'Del Viso', city: 'Pilar', province: 'Buenos Aires', surface: 380, coveredSurface: 160, rooms: 3, bedrooms: 3, bathrooms: 2, garage: false, description: 'Casa práctica en barrio cerrado de Del Viso. Luminosa, bien mantenida, ideal para familia con niños.', images: ['/placeholder.jpg'], features: ['Jardín', 'Parrilla', 'Seguridad'], expenses: 38000, ageYears: 15, isMock: true, score: 71 },
  { id: 'prop-004', type: 'APARTMENT', operationType: 'sale', price: 98000, currency: 'USD', title: 'Depto 2 amb c/balcón · Palermo', address: 'Thames 1456 Piso 4 B', neighborhood: 'Palermo', city: 'CABA', province: 'CABA', surface: 68, coveredSurface: 68, rooms: 2, bedrooms: 1, bathrooms: 1, garage: false, description: 'Luminoso departamento en planta alta con balcón. Cocina integrada. Excelente estado. A 2 cuadras del subte D.', images: ['/placeholder.jpg'], features: ['Balcón', 'Luminoso', 'Planta alta', 'Subte D'], expenses: 85000, ageYears: 5, isMock: true, score: 80 },
  { id: 'prop-005', type: 'APARTMENT', operationType: 'sale', price: 145000, currency: 'USD', title: 'PH 3 amb c/terraza · Belgrano R', address: 'Juramento 2830 PB', neighborhood: 'Belgrano R', city: 'CABA', province: 'CABA', surface: 110, coveredSurface: 95, rooms: 3, bedrooms: 2, bathrooms: 2, garage: true, description: 'PH en planta baja con terraza propia de 60m². Cochera incluida. Barrio Belgrano R, a pasos de Av. Cabildo.', images: ['/placeholder.jpg'], features: ['Terraza propia', 'Cochera', 'PH', 'Premium'], expenses: 92000, ageYears: 22, isMock: true, score: 77 },
  { id: 'prop-006', type: 'HOUSE', operationType: 'sale', price: 285000, currency: 'USD', title: 'Casa 5 amb en country · San Isidro', address: 'El Talar Country Club', neighborhood: 'El Talar', city: 'San Isidro', province: 'Buenos Aires', surface: 680, coveredSurface: 320, rooms: 5, bedrooms: 4, bathrooms: 3, garage: true, description: 'Amplia casa en country premium de San Isidro. 4 dormitorios en suite, home office, pileta y quincho. 15 min de CABA.', images: ['/placeholder.jpg'], features: ['Pileta', 'Quincho', 'Cochera doble', 'Seguridad 24hs'], expenses: 85000, ageYears: 18, isMock: true, score: 84 },
]

export const mockProfessionals: Professional[] = [
  { id: 'prof-01', name: 'Dra. María Fernández', specialty: 'ESCRIBANO', firm: 'Estudio Gómez & Fernández', city: 'Pilar', province: 'Buenos Aires', description: 'Escribana con 18 años de experiencia en operaciones inmobiliarias en GBA Norte.', experience: 18, rating: 4.9, reviewCount: 127, priceRange: 'Honorarios según arancel colegial', availability: 'AVAILABLE', isMock: true, tags: ['Compraventa', 'Subdivisión', 'Hipotecas'] },
  { id: 'prof-02', name: 'Ing. Roberto Sosa', specialty: 'AGRIMENSOR', firm: 'Agrimensura Sosa', city: 'Pilar', province: 'Buenos Aires', description: 'Agrimensor matriculado. Especializado en mensuras y verificación de planos.', experience: 12, rating: 4.7, reviewCount: 89, priceRange: 'USD 300 - USD 800', availability: 'AVAILABLE', isMock: true, tags: ['Mensuras', 'Planos', 'Regularización'] },
  { id: 'prof-03', name: 'Dr. Pablo Giménez', specialty: 'ABOGADO', firm: 'Giménez & Asociados', city: 'Pilar', province: 'Buenos Aires', description: 'Abogado especialista en derecho inmobiliario. Revisión de contratos y boletos.', experience: 15, rating: 4.8, reviewCount: 64, priceRange: 'Consulta desde USD 80', availability: 'BUSY', isMock: true, tags: ['Contratos', 'Boleto', 'Litigios'] },
  { id: 'prof-04', name: 'Arq. Cecilia Martínez', specialty: 'TASADOR', firm: 'CM Tasaciones', city: 'Tigre', province: 'Buenos Aires', description: 'Arquitecta y tasadora certificada. Cobertura GBA Norte y CABA.', experience: 10, rating: 4.6, reviewCount: 112, priceRange: 'USD 150 - USD 400', availability: 'AVAILABLE', isMock: true, tags: ['Tasación', 'Valuación', 'Informes'] },
  { id: 'prof-05', name: 'Lic. Hernán Castro', specialty: 'GESTOR', firm: 'Castro Gestiones', city: 'Escobar', province: 'Buenos Aires', description: 'Gestor de documentación. Trámites en municipio, ARBA, AFIP y registros.', experience: 8, rating: 4.5, reviewCount: 53, priceRange: 'USD 200 - USD 600', availability: 'AVAILABLE', isMock: true, tags: ['Trámites', 'Municipio', 'ARBA', 'AFIP'] },
]

export const mockVisitChecklist: VisitChecklistItem[] = [
  { id: 'vc-01', section: 'Exterior', label: 'Estado de la fachada', checked: true, note: 'Buen estado, pintura reciente' },
  { id: 'vc-02', section: 'Exterior', label: 'Humedad exterior visible', checked: true },
  { id: 'vc-03', section: 'Exterior', label: 'Estado del techo', checked: true, note: 'Losa en buen estado' },
  { id: 'vc-04', section: 'Exterior', label: 'Aberturas (ventanas, puertas)', checked: true },
  { id: 'vc-05', section: 'Interior', label: 'Manchas de humedad en paredes', checked: false },
  { id: 'vc-06', section: 'Interior', label: 'Presión y calidad del agua', checked: false },
  { id: 'vc-07', section: 'Interior', label: 'Instalación eléctrica', checked: false },
  { id: 'vc-08', section: 'Interior', label: 'Instalación de gas', checked: false },
  { id: 'vc-09', section: 'Interior', label: 'Estado del piso', checked: true, note: 'Cerámica en buen estado' },
  { id: 'vc-10', section: 'Interior', label: 'Calefacción / aire acondicionado', checked: false },
  { id: 'vc-11', section: 'Entorno', label: 'Nivel de ruido del barrio', checked: true, note: 'Tranquilo' },
  { id: 'vc-12', section: 'Entorno', label: 'Acceso y estado de calles', checked: true },
  { id: 'vc-13', section: 'Entorno', label: 'Comercios y servicios cercanos', checked: true },
  { id: 'vc-14', section: 'Entorno', label: 'Transporte público', checked: false },
  { id: 'vc-15', section: 'Documentación', label: 'Vendedor tiene escritura disponible', checked: false },
  { id: 'vc-16', section: 'Documentación', label: 'Planos de la propiedad', checked: false },
  { id: 'vc-17', section: 'Documentación', label: 'Impuestos al día (ABL/ARBA)', checked: false },
  { id: 'vc-18', section: 'Documentación', label: 'Expensas al día', checked: true },
]

export const mockTransaction: Transaction = {
  id: 'txn-001', type: 'BUY_PROPERTY', title: 'Compra de casa', subtitle: 'Pilar, Buenos Aires',
  userId: 'user-001', propertyId: 'prop-001', property: mockProperty,
  progress: 42, province: 'Buenos Aires', provinceCode: 'BUENOS_AIRES', city: 'Pilar', currentStageId: 'stage-04',
  stages: [
    { id: 'stage-01', key: 'NEEDS', label: 'Definir necesidades', description: 'Establecer qué buscás y cuánto podés invertir', order: 1, status: 'COMPLETED', tasks: [
      { id: 't-01', title: 'Definir presupuesto máximo', description: 'Establecé tu presupuesto incluyendo todos los costos', why: 'Sin presupuesto claro podés comprometerte a más de lo que podés pagar', status: 'DONE', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'stage-01', warnings: [], recommendations: ['Incluí gastos de escritura (~3-5%)'] },
      { id: 't-02', title: 'Definir criterios de búsqueda', description: 'Zona, tipo, ambientes, características esenciales', why: 'Acotar la búsqueda ahorra tiempo', status: 'DONE', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'stage-01', warnings: [] },
    ]},
    { id: 'stage-02', key: 'SEARCH', label: 'Buscar propiedad', description: 'Explorar opciones y hacer visitas', order: 2, status: 'COMPLETED', tasks: [
      { id: 't-03', title: 'Buscar propiedades', description: 'Revisar portales y opciones disponibles', why: 'Tener variedad permite comparar mejor', status: 'DONE', priority: 'MEDIUM', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'stage-02', warnings: [] },
      { id: 't-04', title: 'Visitar propiedades', description: 'Recorrer las propiedades seleccionadas', why: 'La visita detecta problemas que no se ven en fotos', status: 'DONE', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'stage-02', warnings: [] },
    ]},
    { id: 'stage-03', key: 'EVAL', label: 'Evaluar propiedad', description: 'Análisis profundo', order: 3, status: 'COMPLETED', tasks: [
      { id: 't-06', title: 'Revisar estado general', description: 'Inspección de humedad, instalaciones, estructura', why: 'Detectar problemas antes evita costos inesperados', status: 'DONE', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'stage-03', professionalType: 'ARQUITECTO', warnings: [] },
    ]},
    { id: 'stage-04', key: 'DOCS', label: 'Documentación', description: 'Verificar toda la documentación', order: 4, status: 'CURRENT', tasks: [
      { id: 't-07', title: 'Solicitar escritura', description: 'Pedir copia de la escritura al vendedor', why: 'La escritura confirma quién es el dueño real', status: 'IN_PROGRESS', priority: 'HIGH', responsibleRole: 'Comprador/Escribano', documentsRequired: ['Escritura'], stageId: 'stage-04', warnings: ['Sin escritura no podés confirmar titularidad'] },
      { id: 't-08', title: 'Verificar planos', description: 'Confirmar que los planos coincidan con la construcción', why: 'Una diferencia puede generar problemas legales', status: 'TODO', priority: 'HIGH', responsibleRole: 'Agrimensor', documentsRequired: ['Planos aprobados'], professionalType: 'AGRIMENSOR', stageId: 'stage-04', warnings: [] },
      { id: 't-09', title: 'Verificar situación impositiva', description: 'Confirmar que ABL y ARBA estén al día', why: 'Deudas impositivas pueden transferirse al nuevo titular', status: 'TODO', priority: 'HIGH', responsibleRole: 'Gestor/Escribano', documentsRequired: ['Libre deuda ABL', 'Libre deuda ARBA'], stageId: 'stage-04', warnings: [] },
      { id: 't-10', title: 'Consultar inhibiciones', description: 'Verificar que el vendedor no tenga inhibiciones', why: 'Una inhibición puede impedir la escritura', status: 'BLOCKED', priority: 'HIGH', responsibleRole: 'Escribano', documentsRequired: ['Informe de dominio'], blockedBy: ['t-07'], stageId: 'stage-04', warnings: ['Requiere la escritura para avanzar'] },
    ]},
    { id: 'stage-05', key: 'NEGOTIATION', label: 'Negociación', description: 'Acordar precio y condiciones', order: 5, status: 'UPCOMING', tasks: [
      { id: 't-11', title: 'Hacer oferta', description: 'Presentar oferta formal al vendedor', why: 'Una oferta formal protege a ambas partes', status: 'TODO', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'stage-05', warnings: [] },
    ]},
    { id: 'stage-06', key: 'RESERVATION', label: 'Reserva', description: 'Formalizar la reserva con seña', order: 6, status: 'UPCOMING', tasks: [
      { id: 't-12', title: 'Firmar reserva', description: 'Firmar contrato de reserva y pagar seña', why: 'La reserva compromete formalmente la operación', status: 'TODO', priority: 'HIGH', responsibleRole: 'Comprador/Inmobiliaria', documentsRequired: ['Contrato de reserva'], stageId: 'stage-06', warnings: [] },
    ]},
    { id: 'stage-07', key: 'STUDY', label: 'Estudio de títulos', description: 'El escribano estudia la cadena de titularidad', order: 7, status: 'UPCOMING', tasks: [
      { id: 't-13', title: 'Estudio de títulos', description: 'El escribano verifica los últimos 20 años', why: 'Garantiza que no existan problemas legales', status: 'TODO', priority: 'HIGH', responsibleRole: 'Escribano', documentsRequired: ['Escrituras anteriores'], professionalType: 'ESCRIBANO', stageId: 'stage-07', warnings: [] },
    ]},
    { id: 'stage-08', key: 'DEED', label: 'Escritura', description: 'Firma de la escritura ante escribano', order: 8, status: 'UPCOMING', tasks: [
      { id: 't-14', title: 'Escriturar', description: 'Firma de escritura traslativa de dominio', why: 'La escritura es el documento que te hace propietario legal', status: 'TODO', priority: 'HIGH', responsibleRole: 'Escribano/Comprador/Vendedor', documentsRequired: ['Todos los documentos anteriores'], professionalType: 'ESCRIBANO', stageId: 'stage-08', warnings: [] },
    ]},
    { id: 'stage-09', key: 'POSSESSION', label: 'Posesión', description: 'Recibir las llaves y tomar posesión', order: 9, status: 'UPCOMING', tasks: [
      { id: 't-15', title: 'Tomar posesión', description: 'Recibir las llaves y hacer inventario', why: 'Documentar el estado al recibir protege ante futuros reclamos', status: 'TODO', priority: 'MEDIUM', responsibleRole: 'Comprador/Vendedor', documentsRequired: [], stageId: 'stage-09', warnings: [] },
    ]},
  ],
  participants: [
    { id: 'p-01', name: 'Francisco Alonso', role: 'Comprador', email: 'francisco@demo.com', phone: '+54 9 11 5555-0001' },
    { id: 'p-02', name: 'Carlos Méndez', role: 'Vendedor', phone: '+54 9 11 5555-0002' },
    { id: 'p-03', name: 'Estudio Pérez & Asociados', role: 'Inmobiliaria', phone: '+54 230 555-0010' },
  ],
  documents: [
    { id: 'd-01', name: 'Escritura de propiedad', category: 'ESCRITURA', status: 'PENDING', transactionId: 'txn-001', version: 1 },
    { id: 'd-02', name: 'Planos aprobados', category: 'PLANOS', status: 'PENDING', transactionId: 'txn-001', version: 1 },
    { id: 'd-03', name: 'Libre deuda ABL', category: 'IMPUESTOS', status: 'PENDING', transactionId: 'txn-001', version: 1 },
    { id: 'd-04', name: 'Libre deuda ARBA', category: 'IMPUESTOS', status: 'PENDING', transactionId: 'txn-001', version: 1 },
    { id: 'd-05', name: 'DNI comprador', category: 'CONTRATOS', status: 'APPROVED', date: '2026-09-01', uploadedBy: 'Francisco', transactionId: 'txn-001', version: 1 },
    { id: 'd-06', name: 'Tasación', category: 'TASACIONES', status: 'RECEIVED', date: '2026-09-08', transactionId: 'txn-001', version: 1 },
  ],
  costs: [],
  timeline: [
    { id: 'e-01', date: '2026-08-15', title: 'Operación iniciada', description: 'Se creó la operación de compra', type: 'SYSTEM' },
    { id: 'e-02', date: '2026-08-16', title: 'Presupuesto definido', description: 'USD 200.000 máximo', type: 'TASK_COMPLETED', actor: 'Francisco' },
    { id: 'e-03', date: '2026-08-20', title: 'Propiedad encontrada', description: 'Casa en La Lonja, Pilar', type: 'SYSTEM' },
    { id: 'e-04', date: '2026-08-28', title: 'Visita realizada', description: 'Estado general muy bueno.', type: 'TASK_COMPLETED', actor: 'Francisco' },
    { id: 'e-05', date: '2026-09-03', title: 'Etapa de documentación iniciada', type: 'STAGE_CHANGED', actor: 'Francisco' },
    { id: 'e-06', date: '2026-09-08', title: 'Tasación recibida', description: 'Valor tasado: USD 188.000', type: 'DOCUMENT_ADDED', actor: 'Estudio Pérez' },
  ],
  risks: [
    { id: 'r-01', severity: 'HIGH', category: 'DOMINIAL', label: 'Escritura no recibida', detail: 'La escritura original no fue entregada por el vendedor. Sin ella no es posible verificar la cadena de titularidad ni avanzar con el informe de dominio.', evidence: 'Documento d-01 en estado PENDING', recommendation: 'Solicitar al vendedor la escritura original o copia certificada con carácter urgente.' },
    { id: 'r-02', severity: 'HIGH', category: 'LEGAL', label: 'Inhibición pendiente de verificación', detail: 'La tarea de consulta de inhibiciones del vendedor está bloqueada por la falta de escritura. No se puede confirmar que el vendedor esté habilitado para vender.', evidence: 'Tarea t-10 en estado BLOCKED', recommendation: 'Desbloquear solicitando la escritura. Una inhibición no detectada puede impedir la escritura.' },
    { id: 'r-03', severity: 'HIGH', category: 'DOCUMENTAL', label: 'Planos sin verificar', detail: 'Los planos aprobados municipalmente no fueron recibidos. Diferencias entre lo construido y los planos pueden generar multas o problemas en la escritura.', evidence: 'Documento d-02 en estado PENDING', recommendation: 'Solicitar copia de planos al municipio de Pilar o al vendedor.' },
    { id: 'r-04', severity: 'MEDIUM', category: 'FISCAL', label: 'Libre deuda ABL y ARBA pendientes', detail: 'No se recibieron los certificados de libre deuda de ABL ni de ARBA. Deudas impositivas se transfieren con la propiedad al nuevo titular.', evidence: 'Documentos d-03 y d-04 en estado PENDING', recommendation: 'El gestor puede tramitar ambos certificados en paralelo. Tiempo estimado: 5–10 días hábiles.' },
  ] as Risk[],
  createdAt: '2026-08-15', updatedAt: '2026-09-12',
}

// ─── OPERACIÓN 2: VENTA PILAR ────────────────────────────────────────────────
export const mockSellPilar: Transaction = {
  id: 'txn-002', type: 'SELL_PROPERTY', title: 'Venta de lote La Paz 96–97',
  subtitle: 'Pilar, Buenos Aires',
  userId: 'user-001', propertyId: 'prop-001',
  property: mockProperty,
  progress: 28, province: 'Buenos Aires', provinceCode: 'BUENOS_AIRES', city: 'Pilar',
  currentStageId: 'sell-stage-02',
  stages: [
    { id: 'sell-stage-01', key: 'PREP', label: 'Preparar la venta', description: 'Documentación y presentación', order: 1, status: 'CURRENT', tasks: [
      { id: 'st-01', title: 'Reunir escritura y planos', description: 'Tener escritura original y planos aprobados', why: 'Sin estos documentos no podés escriturar', status: 'IN_PROGRESS', priority: 'HIGH', responsibleRole: 'Vendedor', documentsRequired: ['Escritura', 'Planos'], stageId: 'sell-stage-01', warnings: ['Escritura debe coincidir con datos del registro'] },
      { id: 'st-02', title: 'Obtener libre deuda ABL y ARBA', description: 'Tramitar certificados de libre deuda', why: 'Deudas se transfieren al comprador si no se regulariza', status: 'TODO', priority: 'HIGH', responsibleRole: 'Gestor', documentsRequired: ['Libre deuda ABL', 'Libre deuda ARBA'], stageId: 'sell-stage-01', warnings: [] },
      { id: 'st-03', title: 'Contratar tasador', description: 'Tasación oficial para fijar precio base', why: 'Evita vender por debajo o por encima del mercado', status: 'DONE', priority: 'MEDIUM', responsibleRole: 'Vendedor', documentsRequired: [], professionalType: 'TASADOR', stageId: 'sell-stage-01', warnings: [] },
    ]},
    { id: 'sell-stage-02', key: 'PUBLISH', label: 'Publicar', description: 'Publicar en portales y gestionar visitas', order: 2, status: 'CURRENT', tasks: [
      { id: 'st-04', title: 'Publicar en Zonaprop y Argenprop', description: 'Armar el aviso con fotos y descripción', why: 'Mayor exposición = más interesados', status: 'TODO', priority: 'HIGH', responsibleRole: 'Vendedor/Inmobiliaria', documentsRequired: [], stageId: 'sell-stage-02', warnings: [] },
      { id: 'st-05', title: 'Organizar visitas', description: 'Coordinar horarios con interesados', why: 'La visita es el paso previo a la oferta', status: 'TODO', priority: 'MEDIUM', responsibleRole: 'Vendedor', documentsRequired: [], stageId: 'sell-stage-02', warnings: [] },
    ]},
    { id: 'sell-stage-03', key: 'NEGOTIATION', label: 'Negociación', description: 'Evaluar y responder ofertas', order: 3, status: 'UPCOMING', tasks: [
      { id: 'st-06', title: 'Evaluar ofertas recibidas', description: 'Comparar precio, condición y financiación', why: 'Una oferta baja no siempre es la peor', status: 'TODO', priority: 'HIGH', responsibleRole: 'Vendedor', documentsRequired: [], stageId: 'sell-stage-03', warnings: [] },
    ]},
    { id: 'sell-stage-04', key: 'RESERVATION', label: 'Reserva y boleto', description: 'Formalizar con seña y boleto', order: 4, status: 'UPCOMING', tasks: [
      { id: 'st-07', title: 'Firmar boleto de compraventa', description: 'Con escribano o abogado', why: 'El boleto es vinculante y protege a ambas partes', status: 'TODO', priority: 'HIGH', responsibleRole: 'Escribano/Abogado', documentsRequired: ['DNI'], stageId: 'sell-stage-04', warnings: [] },
    ]},
    { id: 'sell-stage-05', key: 'DEED', label: 'Escritura', description: 'Escritura traslativa de dominio', order: 5, status: 'UPCOMING', tasks: [
      { id: 'st-08', title: 'Escriturar', description: 'Firma ante escribano y cobro', why: 'La escritura transfiere legalmente el dominio', status: 'TODO', priority: 'HIGH', responsibleRole: 'Escribano', documentsRequired: ['Todos los documentos'], professionalType: 'ESCRIBANO', stageId: 'sell-stage-05', warnings: [] },
    ]},
  ],
  participants: [
    { id: 'sp-01', name: 'Francisco Alonso', role: 'Vendedor', email: 'francisco@demo.com' },
    { id: 'sp-02', name: 'Dra. María Fernández', role: 'Escribano', phone: '+54 230 555-0020' },
  ],
  documents: [
    { id: 'sd-01', name: 'Escritura La Paz 96–97', category: 'ESCRITURA', status: 'RECEIVED', date: '2026-09-05', uploadedBy: 'Francisco', transactionId: 'txn-002', version: 1 },
    { id: 'sd-02', name: 'Tasación', category: 'TASACIONES', status: 'APPROVED', date: '2026-09-10', transactionId: 'txn-002', version: 1 },
    { id: 'sd-03', name: 'Libre deuda ABL', category: 'IMPUESTOS', status: 'PENDING', transactionId: 'txn-002', version: 1 },
    { id: 'sd-04', name: 'Libre deuda ARBA', category: 'IMPUESTOS', status: 'PENDING', transactionId: 'txn-002', version: 1 },
    { id: 'sd-05', name: 'Planos aprobados', category: 'PLANOS', status: 'PENDING', transactionId: 'txn-002', version: 1 },
  ],
  costs: [
    { id: 'sc-01', label: 'Comisión inmobiliaria', category: 'COMISION', minAmount: 5550, maxAmount: 7400, currency: 'USD', isEstimate: true, source: 'Arancel CUCICBA', notes: '3–4% del precio de venta estimado (USD 185.000)' },
    { id: 'sc-02', label: 'Honorarios escribano (vendedor)', category: 'ESCRIBANIA', minAmount: 1850, maxAmount: 1850, currency: 'USD', isEstimate: true, source: 'Arancel colegial', notes: '~1% del precio' },
    { id: 'sc-03', label: 'ITI (Impuesto a la Transferencia)', category: 'IMPUESTO', minAmount: 2775, maxAmount: 5550, currency: 'USD', isEstimate: true, source: 'AFIP Ley 23.905', notes: '1.5–3% según caso' },
  ],
  timeline: [
    { id: 'se-01', date: '2026-09-01', title: 'Operación de venta iniciada', type: 'SYSTEM' },
    { id: 'se-02', date: '2026-09-05', title: 'Escritura recibida', description: 'Escritura original lote 96–97', type: 'DOCUMENT_ADDED', actor: 'Francisco' },
    { id: 'se-03', date: '2026-09-10', title: 'Tasación completada', description: 'Valor tasado: USD 188.000', type: 'DOCUMENT_ADDED', actor: 'Arq. Martínez' },
  ],
  risks: [
    { id: 'sr-01', severity: 'MEDIUM', category: 'DOCUMENTAL', label: 'Planos sin presentar', detail: 'Los planos aprobados no fueron cargados. Pueden generar demoras al momento de escriturar.', recommendation: 'Solicitar copia al municipio de Pilar.' },
    { id: 'sr-02', severity: 'LOW', category: 'FISCAL', label: 'Libre deudas pendientes', detail: 'ABL y ARBA todavía no fueron tramitados.', recommendation: 'Encargar al gestor lo antes posible. Tiempo estimado: 5–10 días.' },
  ] as Risk[],
  createdAt: '2026-09-01', updatedAt: '2026-09-15',
}

// ─── OPERACIÓN 3: COMPRA BELGRANO ────────────────────────────────────────────
const mockPropBelgrano = mockProperties.find(p => p.id === 'prop-004')!
export const mockBuyBelgrano: Transaction = {
  id: 'txn-003', type: 'BUY_PROPERTY', title: 'Compra depto Palermo',
  subtitle: 'CABA',
  userId: 'user-001', propertyId: 'prop-004',
  property: mockPropBelgrano,
  progress: 12, province: 'CABA', provinceCode: 'CABA', city: 'CABA',
  currentStageId: 'b2-stage-02',
  stages: [
    { id: 'b2-stage-01', key: 'NEEDS', label: 'Definir necesidades', description: 'Presupuesto y criterios', order: 1, status: 'COMPLETED', tasks: [
      { id: 'b2t-01', title: 'Definir presupuesto', description: 'USD 100.000 + costos', why: 'Marco claro para buscar', status: 'DONE', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'b2-stage-01', warnings: [] },
    ]},
    { id: 'b2-stage-02', key: 'EVAL', label: 'Evaluar propiedad', description: 'Thames 1456 · Palermo', order: 2, status: 'CURRENT', tasks: [
      { id: 'b2t-02', title: 'Visitar el depto', description: 'Visita con checklist VARA', why: 'Detectar estado real antes de avanzar', status: 'IN_PROGRESS', priority: 'HIGH', responsibleRole: 'Comprador', documentsRequired: [], stageId: 'b2-stage-02', warnings: [] },
      { id: 'b2t-03', title: 'Analizar expensas e historial', description: 'Revisar últimas 6 liquidaciones', why: 'Expensas altas impactan en el costo total', status: 'TODO', priority: 'MEDIUM', responsibleRole: 'Comprador', documentsRequired: ['Liquidación de expensas'], stageId: 'b2-stage-02', warnings: [] },
    ]},
    { id: 'b2-stage-03', key: 'DOCS', label: 'Documentación', description: 'Verificar títulos y situación registral', order: 3, status: 'UPCOMING', tasks: [
      { id: 'b2t-04', title: 'Solicitar escritura', description: 'Pedir copia al vendedor', why: 'Verifica titularidad y libre de gravámenes', status: 'TODO', priority: 'HIGH', responsibleRole: 'Comprador/Escribano', documentsRequired: ['Escritura'], stageId: 'b2-stage-03', warnings: [] },
    ]},
  ],
  participants: [
    { id: 'b2p-01', name: 'Francisco Alonso', role: 'Comprador', email: 'francisco@demo.com' },
  ],
  documents: [
    { id: 'b2d-01', name: 'Escritura depto', category: 'ESCRITURA', status: 'PENDING', transactionId: 'txn-003', version: 1 },
    { id: 'b2d-02', name: 'Reglamento de copropiedad', category: 'CONTRATOS', status: 'PENDING', transactionId: 'txn-003', version: 1 },
  ],
  costs: [
    { id: 'b2c-01', label: 'Sello provincial', category: 'IMPUESTO', minAmount: 980, maxAmount: 980, currency: 'USD', isEstimate: true, source: 'AGIP Ley 2231-CABA', notes: '1% del precio (CABA)' },
    { id: 'b2c-02', label: 'Honorarios escribano (comprador)', category: 'ESCRIBANIA', minAmount: 980, maxAmount: 1960, currency: 'USD', isEstimate: true, source: 'Arancel colegial CABA', notes: '1–2% del precio' },
    { id: 'b2c-03', label: 'Inscripción registral', category: 'REGISTRO', minAmount: 196, maxAmount: 294, currency: 'USD', isEstimate: true, source: 'RPI CABA', notes: '~0.2–0.3% del precio' },
  ],
  timeline: [
    { id: 'b2e-01', date: '2026-09-10', title: 'Operación de compra CABA iniciada', type: 'SYSTEM' },
    { id: 'b2e-02', date: '2026-09-14', title: 'Primera visita coordinada', description: 'Thames 1456 · Palermo', type: 'TASK_COMPLETED', actor: 'Francisco' },
  ],
  risks: [
    { id: 'b2r-01', severity: 'LOW', category: 'DOCUMENTAL', label: 'Documentación inicial pendiente', detail: 'Escritura y reglamento de copropiedad aún no recibidos.', recommendation: 'Solicitar al vendedor al inicio de la negociación.' },
  ] as Risk[],
  createdAt: '2026-09-10', updatedAt: '2026-09-15',
}

// ─── OPERACIONES: ÍNDICE DE OPERACIONES DEL USUARIO ─────────────────────────
export const mockUserOperations: UserOperationSummary[] = [
  {
    id: 'txn-001', type: 'BUY', title: 'Compra casa Pilar',
    status: 'ACTIVE', progress: 42,
    province: 'Buenos Aires', city: 'Pilar',
    propertyId: 'prop-001', createdAt: '2026-08-15',
  },
  {
    id: 'txn-002', type: 'SELL', title: 'Venta lote La Paz 96–97',
    status: 'ACTIVE', progress: 28,
    province: 'Buenos Aires', city: 'Pilar',
    propertyId: 'prop-001', createdAt: '2026-09-01',
  },
  {
    id: 'txn-003', type: 'BUY', title: 'Compra depto Palermo',
    status: 'ACTIVE', progress: 12,
    province: 'CABA', city: 'CABA',
    propertyId: 'prop-004', createdAt: '2026-09-10',
  },
]

export const OPERATION_STORE: Record<string, Transaction> = {
  'txn-001': mockTransaction,
  'txn-002': mockSellPilar,
  'txn-003': mockBuyBelgrano,
}

export const mockOperationRelations: OperationRelation[] = [
  {
    id: 'rel-001',
    fromOperationId: 'txn-002',
    toOperationId: 'txn-003',
    type: 'SALE_FUNDS_PURCHASE',
    metadata: { note: 'Los fondos de la venta del lote financian la compra del depto' },
  },
]
