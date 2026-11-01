/**
 * Logger del bridge. Toda línea pasa por redactSecrets antes de imprimirse o guardarse.
 * Callers: index.ts, claude-runner.ts, openai-manager.ts. Sin datos persistentes propios.
 */

import { redactSecrets } from './validations'

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  /** Todo lo registrado (ya redactado), para guardarlo en el run. */
  readonly lines: string[]
}

export function createLogger(secrets: string[] = [], write: (line: string) => void = line => console.log(line)): Logger {
  const lines: string[] = []
  const emit = (level: string, message: string) => {
    const line = redactSecrets(`[${new Date().toISOString()}] ${level} ${message}`, secrets)
    lines.push(line)
    write(line)
  }
  return {
    info: m => emit('INFO ', m),
    warn: m => emit('WARN ', m),
    error: m => emit('ERROR', m),
    lines,
  }
}
