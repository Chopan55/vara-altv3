/**
 * Las tres preguntas que conviene hacerle al vendedor sí o sí, antes de dar
 * plata. Salen de los mismos trámites que VARA usa en el checklist de cada
 * país (`lib/regulations`): no son opiniones ni datos del aviso.
 *
 * Argentina: deudas (libre deuda), titulares que firman, informe de dominio e
 * inhibición. México: constancias de no adeudo, certificado de libertad de
 * gravamen y cónyuge en bienes mancomunados.
 */

export interface SellerQuestion {
  id: string
  question: string
  why: string
}

export interface QuestionContext {
  country: string
  /** Departamento, PH o dentro de un barrio/condominio: hay expensas o cuota de mantenimiento. */
  hasCommonCharges?: boolean
}

export function sellerQuestions(ctx: QuestionContext): SellerQuestion[] {
  if (ctx.country === 'MX') {
    return [
      {
        id: 'mx-no-adeudo',
        question: ctx.hasCommonCharges
          ? '¿El predial, el agua y las cuotas de mantenimiento están al corriente?'
          : '¿El predial y el agua están al corriente?',
        why: 'El notario pide las constancias de no adeudo para firmar. Pedilas antes de dar el apartado.',
      },
      {
        id: 'mx-gravamen',
        question: '¿La propiedad está inscrita en el Registro Público y libre de gravámenes?',
        why: 'Se confirma con el certificado de libertad de gravamen. Si hay una hipoteca, se cancela antes o en la misma firma.',
      },
      {
        id: 'mx-conyuge',
        question: '¿El vendedor está casado por bienes mancomunados?',
        why: 'Si es así, su cónyuge también tiene que firmar la venta.',
      },
    ]
  }
  return [
    {
      id: 'ar-deudas',
      question: ctx.hasCommonCharges
        ? '¿Está al día con los impuestos, los servicios y las expensas?'
        : '¿Está al día con los impuestos y los servicios?',
      why: 'Las deudas se cancelan antes o en la escritura. Pedí los comprobantes o libres deuda antes de reservar.',
    },
    {
      id: 'ar-titulares',
      question: '¿Quiénes son los titulares y pueden firmar todos?',
      why: 'Si hay varios dueños, una sucesión en trámite o un divorcio, todos tienen que firmar y los tiempos cambian.',
    },
    {
      id: 'ar-gravamenes',
      question: '¿Tiene hipoteca, embargo o alguna inhibición?',
      why: 'Si la tiene, hay que levantarla para escriturar. El escribano lo confirma con el informe de dominio y el certificado de inhibición.',
    },
  ]
}

/** Mensaje listo para mandarle a la inmobiliaria o al vendedor. */
export function sellerQuestionsMessage(questions: SellerQuestion[], title?: string | null): string {
  const list = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')
  const about = title ? ` por la propiedad "${title.slice(0, 120)}"` : ''
  return `Hola, te escribo${about}. Antes de avanzar quería consultarte:\n${list}\nGracias.`
}
