/**
 * Logging.
 *
 * Lo que se protege acá es sobre todo una cosa: que **nunca se loguee el dato
 * de la persona**. Los logs terminan en consolas compartidas, capturas de
 * pantalla y, si algún día hay un servicio externo, en servidores de terceros.
 * Una dirección o un monto ahí es una filtración esperando el momento.
 *
 * Lo segundo: que loguear no pueda romper la app. Un logger que tira una
 * excepción convierte un bug chico en una pantalla en blanco.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  log, redactContext, messageOf, setSink, recentLogs, clearLogs,
  type LogEntry,
} from '@/lib/observability/logger'

beforeEach(() => {
  clearLogs()
  setSink(null)
  vi.restoreAllMocks()
  // La consola no nos interesa acá, y ensucia la salida de los tests.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('privacidad', () => {
  it('NO loguea la dirección, el precio ni el nombre', () => {
    const ctx = redactContext({
      address: 'Av. Los Robles 432',
      price: 185_000,
      name: 'Francisco',
      email: 'alguien@ejemplo.com',
      phone: '+54 9 11 5555-0000',
    })
    expect(ctx).toEqual({})
  })

  it('sí deja pasar los identificadores y estados', () => {
    const ctx = redactContext({
      operationId: 'op-1', status: 'SENT', count: 3, retry: true,
    })
    expect(ctx).toEqual({ operationId: 'op-1', status: 'SENT', count: 3, retry: true })
  })

  it('una clave nueva queda afuera por omisión', () => {
    // Lista blanca, no negra: lo que no está previsto no entra por descuido.
    expect(redactContext({ campoNuevoConDatos: 'algo' })).toEqual({})
  })

  it('descarta objetos anidados aunque la clave esté permitida', () => {
    // Un objeto puede traer cualquier cosa adentro.
    expect(redactContext({ status: { secreto: 'x' } })).toEqual({})
  })

  it('el contexto de un log real pasa por el filtro', () => {
    log.error('document.upload.failed', new Error('boom'), {
      documentId: 'd-1',
      address: 'Av. Siempreviva 742',
    })
    const [entry] = recentLogs()
    expect(entry.context).toEqual({ documentId: 'd-1' })
  })

  it('sin contexto no explota', () => {
    expect(() => log.info('algo.paso')).not.toThrow()
    expect(recentLogs()[0].context).toEqual({})
  })
})

describe('mensajes de error', () => {
  it('saca el mensaje de un Error', () => {
    expect(messageOf(new Error('no se pudo subir'))).toBe('no se pudo subir')
  })

  it('acepta un string tal cual', () => {
    expect(messageOf('falló')).toBe('falló')
  })

  it('cualquier otra cosa no rompe', () => {
    expect(messageOf(null)).toBe('Error desconocido')
    expect(messageOf({ raro: true })).toBe('Error desconocido')
    expect(messageOf(undefined)).toBe('Error desconocido')
  })
})

describe('el buffer', () => {
  it('guarda lo que pasó, en orden', () => {
    log.info('uno')
    log.warn('dos')
    expect(recentLogs().map(e => e.event)).toEqual(['uno', 'dos'])
  })

  it('no crece sin límite', () => {
    for (let i = 0; i < 80; i++) log.info(`evento-${i}`)
    const logs = recentLogs()
    expect(logs).toHaveLength(50)
    // Se van los más viejos, quedan los últimos.
    expect(logs[logs.length - 1].event).toBe('evento-79')
  })

  it('devuelve una copia, no el buffer interno', () => {
    log.info('uno')
    const copy = recentLogs()
    copy.push({ level: 'info', event: 'intruso', context: {}, at: 0 })
    expect(recentLogs()).toHaveLength(1)
  })

  it('cada entrada trae su nivel y su momento', () => {
    const before = Date.now()
    log.error('algo.fallo', new Error('x'))
    const [e] = recentLogs()
    expect(e.level).toBe('error')
    expect(e.at).toBeGreaterThanOrEqual(before)
  })
})

describe('destino externo', () => {
  it('recibe cada evento', () => {
    const seen: LogEntry[] = []
    setSink(e => seen.push(e))
    log.warn('cuidado', 'algo raro')
    expect(seen).toHaveLength(1)
    expect(seen[0].event).toBe('cuidado')
  })

  it('un sink que explota NO rompe la app', () => {
    // Es el punto entero: loguear nunca puede ser la causa de una caída.
    setSink(() => { throw new Error('el servicio se cayó') })
    expect(() => log.error('algo', new Error('x'))).not.toThrow()
  })

  it('aunque el sink falle, el evento queda en el buffer', () => {
    setSink(() => { throw new Error('caído') })
    log.info('igual.queda')
    expect(recentLogs().map(e => e.event)).toContain('igual.queda')
  })

  it('se puede desconectar', () => {
    const seen: LogEntry[] = []
    setSink(e => seen.push(e))
    setSink(null)
    log.info('nadie.escucha')
    expect(seen).toHaveLength(0)
  })
})

describe('consola', () => {
  it('los errores se ven', () => {
    log.error('roto', new Error('x'))
    expect(console.error).toHaveBeenCalled()
  })

  it('los info NO ensucian la consola', () => {
    // Un info por cada acción sería ruido que tapa lo que importa.
    log.info('rutina')
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
