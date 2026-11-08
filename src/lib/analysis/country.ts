/**
 * País de un aviso. Decide qué reglas se aplican: un aviso de México nunca
 * se analiza con reglas de Argentina (ni al revés).
 *
 * Orden: el dominio del portal (lo más confiable), después la moneda.
 */

import { MX_CODES } from '@/lib/regulations'

export type ListingCountry = 'AR' | 'MX'

const MX_HOSTS = [
  'inmuebles24.com', 'lamudi.com.mx', 'vivanuncios.com.mx', 'propiedades.com',
  'mercadolibre.com.mx', 'segundamano.mx', 'metroscubicos.com', 'icasas.mx',
]

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase() } catch { return '' }
}

export function isMexicanUrl(url: string): boolean {
  const h = hostOf(url)
  if (!h) return false
  return h.endsWith('.mx') || MX_HOSTS.some(d => h === d || h.endsWith(`.${d}`))
}

export function listingCountry(url: string, currency?: string | null): ListingCountry {
  if (isMexicanUrl(url)) return 'MX'
  if (currency === 'MXN') return 'MX'
  return 'AR'
}

/**
 * Estado de México a partir del texto del aviso (dirección, colonia, ciudad).
 * Solo devuelve un estado si lo reconoce sin ambigüedad; si no, undefined.
 */
const MX_STATE_PATTERNS: [string, RegExp][] = [
  ['CDMX', /\b(cdmx|ciudad de m[eé]xico|benito ju[aá]rez|miguel hidalgo|cuauht[eé]moc|coyoac[aá]n|[aá]lvaro obreg[oó]n|tlalpan|azcapotzalco|iztapalapa|gustavo a\.? madero|xochimilco|magdalena contreras|cuajimalpa|venustiano carranza|iztacalco|tl[aá]huac|milpa alta|polanco|condesa|roma norte|roma sur|santa fe|del valle|narvarte)\b/i],
  ['JALISCO', /\b(jalisco|guadalajara|zapopan|tlaquepaque|tlajomulco|tonal[aá]|puerto vallarta)\b/i],
  ['NUEVO_LEON', /\b(nuevo le[oó]n|monterrey|san pedro garza garc[ií]a|apodaca|guadalupe,? n\.?\s?l\.?|santa catarina|san nicol[aá]s de los garza|escobedo)\b/i],
  ['ESTADO_DE_MEXICO', /\b(estado de m[eé]xico|edomex|edo\.? m[eé]x\.?|naucalpan|huixquilucan|tlalnepantla|atizap[aá]n|metepec|toluca|ecatepec|cuautitl[aá]n|interlomas|coacalco|tecámac|tec[aá]mac)\b/i],
  ['PUEBLA', /\b(puebla|cholula|angel[oó]polis)\b/i],
  ['GUANAJUATO', /\b(guanajuato|le[oó]n,? gto|san miguel de allende|celaya|irapuato)\b/i],
  ['CHIHUAHUA', /\b(chihuahua|ciudad ju[aá]rez)\b/i],
  ['BAJA_CALIFORNIA', /\b(baja california|tijuana|mexicali|ensenada|rosarito)\b/i],
  ['QUERETARO', /\b(quer[eé]taro|juriquilla|el marqu[eé]s|corregidora)\b/i],
  ['YUCATAN', /\b(yucat[aá]n|m[eé]rida|progreso,? yuc)\b/i],
]

export function detectMxState(text: string): string | undefined {
  const hits = MX_STATE_PATTERNS.filter(([, re]) => re.test(text)).map(([code]) => code)
  // "Estado de México" contiene "México": si aparece, gana sobre CDMX genérico.
  if (hits.includes('ESTADO_DE_MEXICO') && hits.includes('CDMX') && !/\bcdmx\b|ciudad de m[eé]xico/i.test(text)) {
    return 'ESTADO_DE_MEXICO'
  }
  const unique = [...new Set(hits)]
  return unique.length === 1 && MX_CODES.has(unique[0]) ? unique[0] : unique.length > 1 ? undefined : undefined
}
