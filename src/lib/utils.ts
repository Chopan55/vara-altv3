import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Formateador determinístico: produce el mismo string en Node.js y en el browser.
// toLocaleString('es-AR') varía según los datos ICU instalados en el servidor,
// causando hydration error #418 cuando el resultado del SSR difiere del cliente.
function numToAR(n: number): string {
  const int = Math.abs(Math.round(n)).toString()
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatPrice(amount: number, currency: 'USD' | 'ARS' = 'USD'): string {
  /*
   * Un dato que falta se dice, no se imprime como "USD NaN".
   * Pasa con precios que vienen de un portal a medio leer, y aparece en la
   * pantalla de alguien que está por poner doscientos mil dólares.
   */
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return currency === 'USD' ? 'USD —' : '$ —'
  }
  if (currency === 'USD') {
    return `USD ${numToAR(amount)}`
  }
  return `$ ${numToAR(amount)}`
}

export function formatDate(dateStr: string): string {
  // "Invalid Date" es un error crudo del motor, no algo que alguien deba leer.
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return ''
  const d = String(date.getDate()).padStart(2, '0')
  const m = MONTHS_ES[date.getMonth()]
  const y = date.getFullYear()
  return `${d} ${m} ${y}`
}

export function formatSurface(m2: number): string {
  if (typeof m2 !== 'number' || !Number.isFinite(m2)) return '— m²'
  return `${numToAR(m2)} m²`
}


export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DONE: 'Completado',
    COMPLETED: 'Completado',
    IN_PROGRESS: 'En curso',
    CURRENT: 'Etapa actual',
    TODO: 'Pendiente',
    UPCOMING: 'Próximo',
    BLOCKED: 'Bloqueado',
    PENDING: 'Pendiente',
    RECEIVED: 'Recibido',
    IN_REVIEW: 'En revisión',
    APPROVED: 'Aprobado',
    REJECTED: 'Rechazado',
    EXPIRED: 'Vencido',
    AVAILABLE: 'Disponible',
    BUSY: 'Ocupado',
    UNAVAILABLE: 'No disponible',
  }
  return map[status] ?? status
}

export function getPropertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    HOUSE: 'Casa', APARTMENT: 'Departamento', PH: 'PH',
    LAND: 'Terreno', GARAGE: 'Garage', LOCAL: 'Local',
    OFFICE: 'Oficina', FIELD: 'Campo',
  }
  return map[type] ?? type
}

export function getProfessionalLabel(specialty: string): string {
  const map: Record<string, string> = {
    ESCRIBANO: 'Escribano/a', ABOGADO: 'Abogado/a', AGRIMENSOR: 'Agrimensor/a',
    TASADOR: 'Tasador/a', GESTOR: 'Gestor/a', ARQUITECTO: 'Arquitecto/a',
    CONTADOR: 'Contador/a', ADMINISTRADOR: 'Administrador/a',
  }
  return map[specialty] ?? specialty
}
