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

export type KnowledgeCountry = 'AR' | 'MX'

export type KnowledgeStage =
  | 'Reserva'
  | 'Documentación del vendedor'
  | 'Documentación del comprador'
  | 'Estudio de títulos y certificaciones'
  | 'Boleto de compraventa'
  | 'Escrituración'
  // México
  | 'Apartado'
  | 'Certificados y avalúo'
  | 'Promesa de compraventa'
  | 'Firma ante notario'

/** Etapas en el orden en que se viven, por país (coinciden con generateChecklist). */
export const STAGES_BY_COUNTRY: Record<KnowledgeCountry, KnowledgeStage[]> = {
  AR: ['Reserva', 'Documentación del vendedor', 'Documentación del comprador', 'Estudio de títulos y certificaciones', 'Boleto de compraventa', 'Escrituración'],
  MX: ['Apartado', 'Documentación del vendedor', 'Documentación del comprador', 'Certificados y avalúo', 'Promesa de compraventa', 'Firma ante notario'],
}

export interface KnowledgeEntry {
  id: string
  title: string
  /** Palabras con las que se busca esta entrada. En minúscula y sin tildes. */
  terms: string[]
  audience: Audience
  /** País al que aplica. Sin valor: Argentina (el contenido original). */
  country?: KnowledgeCountry
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

  // ── México ─────────────────────────────────────────────────────────────────
  // Proceso general; cada estado y cada notaría tienen variantes. Sin montos ni
  // porcentajes (los calcula el motor regulatorio). Validar con un notario local.
  {
    id: 'mx-apartado',
    country: 'MX',
    title: 'Apartado',
    terms: ['apartado', 'apartar', 'deposito', 'anticipo', 'separar', 'reserva'],
    audience: 'BOTH',
    stage: 'Apartado',
    summary: 'El primer dinero para separar el inmueble mientras se revisan los papeles.',
    body: `El apartado es un depósito que entrega el comprador para que el inmueble deje de ofrecerse mientras se revisa la documentación. Normalmente se descuenta del precio.

Lo que importa es qué dice el recibo: a quién se paga, cuánto, hasta cuándo vale y qué pasa si alguna de las partes se echa para atrás (si se devuelve, si se pierde o si hay una pena).

Si te piden un apartado alto antes de ver la escritura y el certificado de libertad de gravamen, es una señal para frenar.`,
    watchOut: [
      'Pedí recibo con la dirección completa del inmueble y el nombre de quien recibe.',
      'Si quien recibe no es el propietario según la escritura, pedí el poder notarial que lo autoriza.',
      'Que quede por escrito qué pasa con el dinero si la operación no se hace.',
    ],
  },
  {
    id: 'mx-promesa',
    country: 'MX',
    title: 'Contrato de promesa de compraventa',
    terms: ['promesa', 'contrato', 'compraventa', 'preliminar', 'pena convencional'],
    audience: 'BOTH',
    stage: 'Promesa de compraventa',
    summary: 'Un contrato privado que compromete a las partes, pero todavía no te hace dueño.',
    body: `La promesa de compraventa fija precio, anticipo, forma de pago, fecha de firma ante notario y las penas si alguien no cumple. Se firma entre las partes, sin notario.

Firmar la promesa no te hace propietario. La propiedad se transmite con la escritura pública ante notario y queda firme frente a terceros con la inscripción en el Registro Público de la Propiedad.

Conviene firmarla cuando ya viste la escritura del vendedor y el certificado de libertad de gravamen.`,
    watchOut: [
      'Que diga la fecha concreta de firma ante notario y qué pasa si no se cumple.',
      'Que aclare quién paga cada gasto e impuesto.',
      'Revisala con el notario o un abogado antes de firmar.',
    ],
  },
  {
    id: 'mx-escritura',
    country: 'MX',
    title: 'Firma ante notario e inscripción en el RPP',
    terms: ['notario', 'escritura', 'firma', 'testimonio', 'rpp', 'registro publico', 'inscripcion'],
    audience: 'BOTH',
    stage: 'Firma ante notario',
    summary: 'El acto ante notario que transmite la propiedad y el registro que la hace oponible.',
    body: `La compraventa se formaliza en escritura pública ante notario. Ese día se paga el saldo y el notario calcula y retiene los impuestos que correspondan (ISAI del comprador e ISR del vendedor, si aplica).

Después el notario inscribe la escritura en el Registro Público de la Propiedad (RPP) del estado. Con esa inscripción tu propiedad vale frente a terceros. Al final recibís el testimonio: tu copia de la escritura inscrita.

En México el notario es un profesional del derecho con nombramiento del estado; lo elige normalmente el comprador o el banco si hay crédito.`,
    watchOut: [
      'Pedí al notario una cotización por escrito de honorarios, impuestos y derechos antes de la firma.',
      'Preguntá cuánto tarda la inscripción en el RPP y cuándo te entregan el testimonio.',
    ],
  },
  {
    id: 'mx-gravamen',
    country: 'MX',
    title: 'Certificado de libertad de gravamen',
    terms: ['gravamen', 'libertad de gravamen', 'hipoteca', 'embargo', 'certificado'],
    audience: 'BUY',
    stage: 'Certificados y avalúo',
    summary: 'El documento del RPP que dice si el inmueble tiene hipotecas o embargos.',
    body: `Lo emite el Registro Público de la Propiedad y lo solicita el notario. Muestra si el inmueble tiene hipotecas, embargos u otras limitaciones inscritas.

Si aparece una hipoteca (por ejemplo, el crédito con el que el vendedor lo compró), se puede cancelar con el mismo dinero de la venta, pero tiene que quedar resuelto en la firma.`,
    watchOut: [
      'No des más dinero que el apartado hasta ver este certificado.',
      'Tiene vigencia limitada: el notario lo pide de nuevo cerca de la firma.',
    ],
  },
  {
    id: 'mx-avaluo',
    country: 'MX',
    title: 'Avalúo',
    terms: ['avaluo', 'valuacion', 'perito', 'valuador', 'valor catastral'],
    audience: 'BOTH',
    stage: 'Certificados y avalúo',
    summary: 'La valuación profesional que sirve de base para impuestos y para el crédito.',
    body: `El avalúo lo hace un perito valuador autorizado. Se usa para calcular el ISAI y, si hay crédito bancario o INFONAVIT, el banco lo exige para saber cuánto presta.

El ISAI suele calcularse sobre el valor más alto entre el precio de la operación, el avalúo y el valor catastral; la regla exacta depende del estado.`,
    watchOut: [
      'Si el avalúo sale por debajo del precio, el banco puede prestar menos de lo que esperabas.',
    ],
  },
  {
    id: 'mx-isai',
    country: 'MX',
    title: 'ISAI (Impuesto Sobre Adquisición de Inmuebles)',
    terms: ['isai', 'impuesto', 'adquisicion', 'traslado de dominio', 'itd'],
    audience: 'BUY',
    stage: 'Firma ante notario',
    summary: 'El impuesto local que paga quien compra; la tasa depende del estado o municipio.',
    body: `Lo paga el comprador y lo cobra el estado o el municipio, según dónde esté el inmueble. En algunos lugares se llama Impuesto sobre Traslado de Dominio.

La tasa y la base cambian por estado (algunas son progresivas según el valor). El notario lo calcula, lo cobra en la firma y lo entera a la tesorería. En VARA lo ves en Costos, con el nivel de confianza del dato de tu estado.`,
    watchOut: [
      'Hay reducciones para vivienda de interés social en varios estados: preguntale al notario si aplica.',
    ],
  },
  {
    id: 'mx-isr',
    country: 'MX',
    title: 'ISR del vendedor',
    terms: ['isr', 'ganancia', 'exencion', 'casa habitacion', 'sat', 'impuesto vendedor'],
    audience: 'SELL',
    stage: 'Firma ante notario',
    summary: 'El impuesto federal sobre la ganancia de la venta, que puede estar exento.',
    body: `Quien vende paga ISR sobre la ganancia (precio de venta menos el costo actualizado y las deducciones permitidas). El notario lo calcula, lo retiene en la firma y lo entera al SAT.

Si el inmueble es tu casa habitación, la venta puede estar exenta, con requisitos y un tope que fija la ley y que conviene revisar con el notario antes de pactar el precio.`,
    watchOut: [
      'Guardá la escritura con la que compraste y las facturas de mejoras: sirven para deducir.',
      'La exención por casa habitación tiene condiciones: confirmala antes de firmar la promesa.',
    ],
  },
  {
    id: 'mx-identificacion',
    country: 'MX',
    title: 'Documentos personales: INE, RFC y CURP',
    terms: ['ine', 'rfc', 'curp', 'identificacion', 'constancia de situacion fiscal', 'documentos'],
    audience: 'BOTH',
    stage: 'Documentación del comprador',
    summary: 'Lo que pide el notario a cada parte para identificarla.',
    body: `El notario pide identificación oficial vigente (INE o pasaporte), RFC con constancia de situación fiscal del SAT, CURP, comprobante de domicilio y acta de nacimiento o de matrimonio.

Si estás casado por bienes mancomunados, normalmente firma también tu cónyuge.`,
    watchOut: [
      'Si sos extranjero, puede haber requisitos extra (por ejemplo, en zonas restringidas cerca de costas y fronteras).',
    ],
  },
  {
    id: 'mx-predial',
    country: 'MX',
    title: 'Predial, agua y mantenimiento al corriente',
    terms: ['predial', 'agua', 'adeudo', 'mantenimiento', 'condominio', 'cuotas'],
    audience: 'BOTH',
    stage: 'Documentación del vendedor',
    summary: 'Las deudas del inmueble que tienen que estar pagadas antes de firmar.',
    body: `El vendedor entrega las boletas de predial y de agua al corriente, y en condominio una constancia de no adeudo de cuotas de mantenimiento firmada por la administración.

El notario no firma si hay adeudos de predial o agua: se pagan antes o con el dinero de la venta.`,
    watchOut: [
      'En condominio, pedí también el reglamento: dice qué se puede y qué no se puede hacer.',
    ],
  },
  {
    id: 'mx-credito',
    country: 'MX',
    title: 'Crédito bancario e INFONAVIT',
    terms: ['credito', 'hipotecario', 'infonavit', 'fovissste', 'cofinavit', 'banco', 'financiamiento'],
    audience: 'BUY',
    summary: 'Cómo cambia el proceso cuando comprás con crédito.',
    body: `Con crédito, el banco o el instituto (INFONAVIT, FOVISSSTE) agrega sus pasos: aprobación, avalúo, revisión de la documentación del inmueble y firma ante un notario de su lista.

Eso suma tiempo. Conviene tener la precalificación antes del apartado y que la promesa contemple un plazo realista para la firma.`,
    watchOut: [
      'Si el crédito no sale, que la promesa diga qué pasa con tu anticipo.',
    ],
  },
]

/** Normaliza para comparar: minúsculas y sin tildes. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function entryCountry(e: KnowledgeEntry): KnowledgeCountry {
  return e.country ?? 'AR'
}

/** Las entradas de un país. */
export function knowledgeFor(country: KnowledgeCountry): KnowledgeEntry[] {
  return KNOWLEDGE.filter(e => entryCountry(e) === country)
}

/** Busca entradas relevantes a una consulta, solo del país de la operación. */
export function findKnowledge(query: string, audience?: Audience, limit = 4, country: KnowledgeCountry = 'AR'): KnowledgeEntry[] {
  const q = norm(query)

  const scored = KNOWLEDGE.map(e => {
    if (entryCountry(e) !== country) return { e, score: 0 }
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

export function knowledgeForStage(stage: string, country: KnowledgeCountry = 'AR'): KnowledgeEntry[] {
  return KNOWLEDGE.filter(e => e.stage === stage && entryCountry(e) === country)
}
