/**
 * Base de conocimiento de VARA.
 *
 * Se escribe UNA vez y sirve para dos cosas:
 *   1. Se muestra como guía dentro de la app (glosario y explicaciones por paso).
 *   2. Alimenta al asistente: /api/chat inyecta las entradas que matchean la pregunta.
 *
 * Regla: acá NO van porcentajes ni montos. Los números los calcula el motor
 * regulatorio (src/lib/regulations.ts) porque cambian; si se duplican, quedan viejos.
 */

export type Audience = 'BUY' | 'SELL' | 'BOTH'

export type KnowledgeStage =
  | 'Reserva'
  | 'Documentación del vendedor'
  | 'Documentación del comprador'
  | 'Estudio de títulos y certificaciones'
  | 'Boleto de compraventa'
  | 'Escrituración'

export interface KnowledgeEntry {
  id: string
  title: string
  /** Palabras con las que se busca esta entrada. En minúscula y sin tildes. */
  terms: string[]
  audience: Audience
  stage?: KnowledgeStage
  summary: string
  body: string
  watchOut?: string[]
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'sena',
    title: 'Seña y reserva',
    terms: ['sena', 'reserva', 'arras', 'adelanto', 'arrepentimiento'],
    audience: 'BOTH',
    stage: 'Reserva',
    summary: 'El primer dinero que cambia de manos y qué pasa si alguien se arrepiente.',
    body: `La reserva es la primera plata que entrega el comprador para sacar la propiedad del mercado mientras se avanza con la documentación. Se descuenta del precio final.

Lo importante no es el monto sino qué dice el papel. Según cómo esté redactada, la seña puede permitir arrepentirse pagando un costo, o puede ser un compromiso firme donde arrepentirse habilita a la otra parte a exigir que la operación se cumpla.

Pedí siempre un recibo escrito con la dirección completa del inmueble, los datos de quien recibe, el monto, a qué se imputa y el plazo hasta la firma del boleto.`,
    watchOut: [
      'Un recibo sin dirección del inmueble ni datos del vendedor no sirve para reclamar.',
      'Si quien recibe la seña no es el titular registral, exigí ver el poder que lo autoriza.',
      'Que el papel diga explícitamente qué pasa si alguna de las partes se arrepiente.',
    ],
  },
  {
    id: 'boleto',
    title: 'Boleto de compraventa',
    terms: ['boleto', 'compraventa', 'contrato', 'preliminar'],
    audience: 'BOTH',
    stage: 'Boleto de compraventa',
    summary: 'Un contrato privado que compromete a las partes, pero todavía no te hace dueño.',
    body: `El boleto es el contrato donde quedan fijados precio, forma de pago, fecha de escritura, quién paga qué y en qué estado se entrega la propiedad. Se firma entre las partes.

Acá está la confusión más cara del proceso: firmar el boleto NO te convierte en propietario. La propiedad se transfiere recién con la escritura pública y su inscripción en el Registro. Entre el boleto y la escritura, el inmueble sigue a nombre del vendedor.

Por eso conviene firmarlo después del estudio de títulos, no antes: si aparece un problema dominial, ya comprometiste plata y plazos.`,
    watchOut: [
      'Que figure la fecha concreta de escrituración y qué pasa si no se cumple.',
      'Que diga en qué estado se entrega: con muebles o sin, con deudas canceladas o no.',
      'Si el inmueble está alquilado, tiene que decir cómo y cuándo se desocupa.',
    ],
  },
  {
    id: 'escritura',
    title: 'Escritura e inscripción',
    terms: ['escritura', 'escriturar', 'escrituracion', 'inscripcion', 'registro'],
    audience: 'BOTH',
    stage: 'Escrituración',
    summary: 'El acto ante escribano que sí transfiere la propiedad, y el trámite que la hace oponible.',
    body: `La escritura es el acto público ante escribano donde se transfiere el dominio. Ahí se paga el saldo, se entregan las llaves y el escribano retiene los impuestos que correspondan.

Pero el acto no termina el día de la firma. El escribano después inscribe la escritura en el Registro de la Propiedad Inmueble, y recién con esa inscripción tu titularidad es oponible a terceros. El trámite puede demorar semanas.

En una compraventa el comprador suele elegir al escribano, porque es quien más riesgo asume en la verificación. Es negociable y conviene definirlo temprano.`,
    watchOut: [
      'Pedí el testimonio de la escritura y, más tarde, la constancia de inscripción.',
      'Los certificados de dominio e inhibición vencen: tienen que estar vigentes el día de la firma.',
    ],
  },
  {
    id: 'estudio-titulos',
    title: 'Estudio de títulos',
    terms: ['estudio de titulos', 'titulos', 'antecedentes', 'cadena'],
    audience: 'BUY',
    stage: 'Estudio de títulos y certificaciones',
    summary: 'Revisar hacia atrás cómo llegó la propiedad hasta el vendedor actual.',
    body: `El escribano revisa la cadena de transmisiones de los últimos veinte años: cada venta, herencia o donación que llevó el inmueble hasta el titular actual. Busca que no haya eslabones defectuosos.

Los casos que más problemas traen son las sucesiones mal terminadas —herederos que nunca firmaron— y las donaciones, que históricamente complicaron la venta posterior.

Es el paso que más gente saltea por apuro, y el que más caro sale cuando falla: si el título tiene un vicio, lo descubrís cuando querés vender.`,
    watchOut: [
      'Si el vendedor heredó el inmueble, pedí ver la declaratoria de herederos y su inscripción.',
      'Si en la cadena hay una donación, preguntale al escribano qué implica en este caso concreto.',
    ],
  },
  {
    id: 'informe-dominio',
    title: 'Informe de dominio y gravámenes',
    terms: ['dominio', 'informe de dominio', 'gravamen', 'gravamenes', 'hipoteca', 'embargo'],
    audience: 'BOTH',
    stage: 'Estudio de títulos y certificaciones',
    summary: 'La foto oficial del Registro: quién figura como dueño y qué pesa sobre el inmueble.',
    body: `Lo emite el Registro de la Propiedad Inmueble y dice dos cosas: quién es el titular registral y qué gravámenes tiene el inmueble — hipotecas, embargos, usufructos, servidumbres.

Es distinto del estudio de títulos. El informe es una foto del estado actual; el estudio revisa la historia. Necesitás los dos.

Una hipoteca no impide vender: se cancela con parte del precio en el mismo acto de escritura. Lo que no puede pasar es enterarse el día de la firma.`,
    watchOut: [
      'Que el nombre del titular coincida exactamente con el DNI de quien firma.',
      'Un embargo anotado tiene que estar levantado antes de escriturar.',
    ],
  },
  {
    id: 'inhibicion',
    title: 'Inhibición',
    terms: ['inhibicion', 'inhibido', 'certificado de inhibicion'],
    audience: 'BOTH',
    stage: 'Estudio de títulos y certificaciones',
    summary: 'Una restricción que pesa sobre la persona, no sobre el inmueble.',
    body: `La inhibición impide que una persona disponga de sus bienes registrables. Es una medida sobre el individuo, por eso no aparece en el informe de dominio del inmueble: se pide aparte, por nombre y DNI.

Si el vendedor está inhibido, no puede escriturar aunque el inmueble esté impecable. Por eso el certificado se pide cerca de la firma: tiene vigencia corta y busca que no haya aparecido nada entre medio.`,
    watchOut: [
      'Si el inmueble está a nombre de una sociedad, se pide sobre la sociedad y sus representantes.',
      'Si hay más de un titular, hay que pedirlo para cada uno.',
    ],
  },
  {
    id: 'sellos',
    title: 'Impuesto de sellos',
    terms: ['sellos', 'impuesto de sellos', 'sellado'],
    audience: 'BOTH',
    stage: 'Escrituración',
    summary: 'Impuesto provincial sobre el contrato. Cambia mucho según la jurisdicción.',
    body: `Es un impuesto provincial que grava el acto de la compraventa. Cada provincia fija su alícuota y sus exenciones, así que el mismo inmueble tributa distinto en CABA que en Provincia de Buenos Aires.

Se suele repartir entre comprador y vendedor, pero es negociable y conviene dejarlo escrito en el boleto.

Hay exenciones —por ejemplo para vivienda única y permanente hasta cierto valor— que varían por provincia y se actualizan.

Los montos exactos para tu caso están en la calculadora de Costos de VARA, que usa las alícuotas vigentes de tu provincia con la fuente declarada.`,
    watchOut: [
      'No asumas el porcentaje de otra provincia: cambian bastante entre sí.',
      'Las exenciones suelen tener tope de valor que se actualiza.',
    ],
  },
  {
    id: 'iti-ganancias',
    title: 'ITI o Ganancias al vender',
    terms: ['iti', 'ganancias', 'impuesto a la transferencia', 'cedular'],
    audience: 'SELL',
    stage: 'Escrituración',
    summary: 'Qué impuesto paga el vendedor depende de cuándo compró la propiedad.',
    body: `Cuando vendés, el impuesto que te toca depende de la fecha en que adquiriste el inmueble.

Para propiedades adquiridas hasta el 31/12/2017 corresponde el Impuesto a la Transferencia de Inmuebles (ITI), que se calcula sobre el precio de venta, sin importar si ganaste o perdiste.

Para las adquiridas desde el 01/01/2018 rige el impuesto cedular sobre la ganancia: se grava la diferencia entre lo que pagaste y lo que cobrás.

Existe un supuesto de no gravabilidad cuando se vende la vivienda única para comprar otra, con requisitos y plazos. Confirmá tu caso con el escribano: es la parte donde más se equivoca la gente.`,
    watchOut: [
      'Buscá la fecha exacta de tu escritura de compra: define qué régimen te aplica.',
      'El beneficio por reemplazo de vivienda tiene plazos para concretar la compra siguiente.',
    ],
  },
  {
    id: 'uif',
    title: 'Origen de fondos (UIF)',
    terms: ['uif', 'origen de fondos', 'lavado', 'declaracion jurada'],
    audience: 'BUY',
    stage: 'Documentación del comprador',
    summary: 'Tenés que poder explicar de dónde salió la plata.',
    body: `El escribano es sujeto obligado ante la Unidad de Información Financiera y debe documentar el origen de los fondos de la operación.

En la práctica significa mostrar el recorrido del dinero: extractos bancarios, venta de otro bien, retiro de plazo fijo, préstamo familiar documentado. No alcanza con decir "los tenía ahorrados".

Conviene preparar esto temprano. Es de las cosas que frenan una escritura a último momento, sobre todo cuando parte del dinero vino de terceros.`,
    watchOut: [
      'Si parte de la plata la aporta un familiar, hay que documentar esa transferencia.',
      'Los movimientos en efectivo sin respaldo bancario son los más difíciles de justificar.',
    ],
  },
  {
    id: 'expensas',
    title: 'Expensas y deudas del inmueble',
    terms: ['expensas', 'deuda', 'libre deuda', 'consorcio', 'abl', 'arba', 'servicios'],
    audience: 'BOTH',
    stage: 'Documentación del vendedor',
    summary: 'Las deudas que siguen al inmueble y las que siguen a la persona.',
    body: `Antes de escriturar hay que pedir libre deuda de expensas al consorcio o a la administración del barrio, y constancias de impuestos y servicios al día.

La distinción práctica importa: algunas deudas se reclaman al inmueble y pueden terminar afectando al nuevo dueño; otras son personales del vendedor. Por eso el escribano retiene o exige cancelación antes de entregar el saldo.

En barrios cerrados sumá las expensas del barrio, que suelen ser el gasto mensual más pesado y no siempre figuran en el aviso.`,
    watchOut: [
      'Pedí el monto de los últimos meses, no solo el libre deuda: te dice cuánto vas a pagar.',
      'Preguntá si hay expensas extraordinarias aprobadas pero todavía no facturadas.',
    ],
  },
  {
    id: 'ph',
    title: 'PH y Propiedad Horizontal',
    terms: ['ph', 'propiedad horizontal', 'reglamento', 'unidad funcional', 'asamblea'],
    audience: 'BOTH',
    summary: 'Qué cambia cuando comprás una unidad dentro de un edificio o conjunto.',
    body: `En Propiedad Horizontal sos dueño de una unidad funcional y copropietario de las partes comunes. Eso trae dos papeles que conviene leer: el reglamento de copropiedad y las actas de las últimas asambleas.

El reglamento define qué podés hacer con tu unidad —si se permite alquiler temporario, mascotas, uso comercial— y cómo se reparten las expensas.

Las actas cuentan la salud del consorcio: obras pendientes, juicios, morosidad. Un edificio con una obra grande aprobada significa expensas extraordinarias que vas a pagar vos.`,
    watchOut: [
      'Pedí las actas de asamblea del último año, no solo el reglamento.',
      'Verificá que la superficie de la unidad funcional coincida con lo publicado.',
    ],
  },
  {
    id: 'apto-credito',
    title: 'Apto crédito',
    terms: ['apto credito', 'credito', 'hipotecario', 'uva', 'tasacion'],
    audience: 'BOTH',
    summary: 'Qué significa que una propiedad sea apta para comprar con hipoteca.',
    body: `Que una propiedad sea "apta crédito" significa que cumple los requisitos del banco: título sin observaciones dominiales, planos aprobados y superficie que coincida con lo registrado.

Muchas propiedades que se venden bien en efectivo no pasan el filtro del banco por diferencias entre lo construido y lo aprobado en el plano.

Si comprás con crédito, el banco hace su propia tasación y presta sobre ese valor, no sobre el precio que acordaste. Si tasa por debajo, la diferencia la ponés vos.`,
    watchOut: [
      'Una ampliación sin declarar puede hacer que el banco rechace la operación.',
      'El tiempo del banco no es el del vendedor: acordá plazos realistas en el boleto.',
    ],
  },
  {
    id: 'comision',
    title: 'Comisión inmobiliaria',
    terms: ['comision', 'inmobiliaria', 'corredor', 'honorarios'],
    audience: 'BOTH',
    summary: 'Quién la paga y cuándo se devenga.',
    body: `La comisión del corredor se rige por la normativa de cada jurisdicción, que fija topes y define qué parte puede pagarla. En CABA y en Provincia de Buenos Aires las reglas difieren.

Conviene dejar claro por escrito desde el principio tres cosas: cuánto, quién la paga, y en qué momento se devenga — si al firmar la reserva, el boleto o la escritura.

Tiene que intervenir un corredor matriculado, y podés verificar la matrícula en el colegio correspondiente.`,
    watchOut: [
      'Que el acuerdo diga cuándo se paga: si la operación se cae antes de escriturar, importa.',
      'Pedí la matrícula del corredor y verificala en el colegio de la jurisdicción.',
    ],
  },
  {
    id: 'posesion',
    title: 'Entrega de posesión',
    terms: ['posesion', 'llaves', 'entrega', 'desocupacion', 'mudanza'],
    audience: 'BOTH',
    stage: 'Escrituración',
    summary: 'Cuándo entrás realmente a la propiedad y qué revisar ese día.',
    body: `Lo habitual es que la posesión se entregue el día de la escritura, contra el pago del saldo. Se puede pactar otra cosa, pero tiene que estar escrito en el boleto.

El día de la entrega conviene recorrer la propiedad antes de firmar: que esté en el estado acordado, que estén los artefactos que se incluían, que funcionen los servicios, y tomar lectura de los medidores.

Si el inmueble está ocupado —por inquilinos o por el mismo vendedor— la fecha de desocupación es de las cláusulas más importantes del boleto.`,
    watchOut: [
      'Sacá fotos el día de la entrega y anotá los medidores.',
      'Si algo del estado acordado no se cumple, planteálo antes de firmar, no después.',
    ],
  },
]

/** Normaliza para comparar: minúsculas y sin tildes. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Busca entradas relevantes a una consulta. Coincidencia simple por términos. */
export function findKnowledge(query: string, audience?: Audience, limit = 4): KnowledgeEntry[] {
  const q = norm(query)

  const scored = KNOWLEDGE.map(e => {
    if (audience && e.audience !== 'BOTH' && e.audience !== audience) return { e, score: 0 }
    let score = 0
    for (const t of e.terms) if (q.includes(norm(t))) score += 2
    for (const w of norm(e.title).split(/\s+/)) {
      if (w.length > 4 && q.includes(w)) score += 1
    }
    return { e, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.e)
}

export function getKnowledge(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE.find(e => e.id === id)
}

export function knowledgeForStage(stage: string): KnowledgeEntry[] {
  return KNOWLEDGE.filter(e => e.stage === stage)
}
