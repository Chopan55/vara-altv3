/**
 * Minimización de datos personales antes de enviar texto a un tercero (OpenAI).
 * Oculta lo que NO hace falta para entender el documento: números de DNI/CUIT/CUIL, mails y teléfonos.
 * Nombres y domicilios NO se pueden ocultar sin dejar de entender el papel: siguen viajando y la pantalla lo dice.
 * Montos, matrículas, partidas y fechas quedan intactos.
 */
export function redactPii(text: string): string {
  return text
    // CUIT / CUIL: 20-12345678-9 (con o sin guiones)
    .replace(/\b(20|23|24|27|30|33|34)[-\s]?\d{8}[-\s]?\d\b/g, '[CUIT]')
    // DNI y similares: «DNI 20.123.456», «D.N.I. N° 20123456», «documento nacional de identidad 20.123.456»
    .replace(/\b(D\.?\s?N\.?\s?I\.?|documento(?: nacional)?(?: de identidad)?|L\.?\s?E\.?|L\.?\s?C\.?)\s*(?:n[°º.]?\s*)?\d{1,2}\.?\d{3}\.?\d{3}\b/gi, '$1 [DNI]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\b(tel(?:[eé]fono)?\.?|cel(?:ular)?\.?|whatsapp)\s*:?\s*[+\d()\s-]{8,}/gi, '$1 [teléfono]')
}
