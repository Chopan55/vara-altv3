import type { GuaranteeNote, GuaranteeType, RentalInput, RentalJurisdictionPack } from './types'
import { amount, isDeclared } from './normalize'
import { GUARANTEE_LABELS } from './labels'

/**
 * Comparación básica de garantías. Texto general y prudente: describe qué es cada
 * una y qué conviene revisar. No estima precios de caución ni de pólizas.
 * Cada jurisdicción puede reemplazar el texto general con `pack.guaranteeCopy`.
 */

type Copy = { summary: string; caveats: string[] }

const CATALOG: Record<GuaranteeType, Copy> = {
  NONE: {
    summary: 'No se declaró una garantía. Conviene confirmar, antes de firmar, si el propietario la va a exigir y de qué tipo.',
    caveats: [],
  },
  DEPOSITO: {
    summary: 'Suma que se entrega al inicio y se devuelve al terminar si no hay deudas ni daños, según lo que diga el contrato.',
    caveats: ['Definir por escrito monto, moneda, plazo y forma de devolución.'],
  },
  FIADOR: {
    summary: 'Una tercera persona se obliga a responder por las obligaciones del inquilino.',
    caveats: ['El alcance y la duración dependen de lo escrito: revisar qué cubre (alquiler, expensas, daños).'],
  },
  OBLIGADO_SOLIDARIO: {
    summary: 'Una persona se obliga junto con el inquilino por la totalidad de las obligaciones del contrato.',
    caveats: ['Suele implicar responsabilidad directa por el total: revisar los términos antes de aceptar ese rol.'],
  },
  GARANTE_PROPIETARIO: {
    summary: 'Un tercero propietario de un inmueble respalda el alquiler.',
    caveats: ['Suele requerir informes sobre el inmueble del garante; confirmar condiciones y costos.'],
  },
  SEGURO_CAUCION: {
    summary: 'Una aseguradora emite una póliza a favor del propietario por incumplimientos del inquilino; el inquilino suele pagar una prima.',
    caveats: [
      'Pedir las condiciones generales: qué cubre, vigencia y si la aseguradora puede reclamar luego al inquilino.',
      'El costo lo informa la aseguradora: VARA no estima primas.',
    ],
  },
  POLIZA_JURIDICA: {
    summary: 'Servicio privado de una empresa que revisa al inquilino y respalda el contrato.',
    caveats: [
      'Es un producto comercial: su alcance depende del contrato con la empresa. Comparar qué cubre, qué excluye y cuánto cuesta.',
    ],
  },
  FIANZA: {
    summary: 'Garantía emitida por una empresa o institución a favor del propietario.',
    caveats: ['Verificar quién la emite, qué monto cubre y si hay contragarantías.'],
  },
  OTRA: {
    summary: 'Otra forma de garantía.',
    caveats: ['Pedir por escrito en qué consiste, qué cubre y cómo se devuelve o se cancela.'],
  },
}

export function buildGuaranteeNotes(input: RentalInput, pack: RentalJurisdictionPack): GuaranteeNote[] {
  const selected = input.guaranteeType
  const applicable = pack.applicableGuarantees
  const types = applicable.includes(selected) ? applicable : [...applicable, selected]

  const notes = types.map<GuaranteeNote>(type => {
    const copy = pack.guaranteeCopy[type] ?? CATALOG[type]
    const isSelected = type === selected
    const unusual = isSelected && !applicable.includes(type)
    return {
      type,
      label: GUARANTEE_LABELS[type],
      summary: copy.summary,
      caveats: unusual
        ? [...copy.caveats, 'Esta garantía no figura entre las habituales para la jurisdicción elegida: confirmar que se admite.']
        : [...copy.caveats],
      selected: isSelected,
      declaredCost: isSelected && isDeclared(input.guaranteeCost) ? amount(input.guaranteeCost) : null,
    }
  })

  // La garantía elegida primero; el resto conserva el orden del pack.
  return [...notes.filter(n => n.selected), ...notes.filter(n => !n.selected)]
}
