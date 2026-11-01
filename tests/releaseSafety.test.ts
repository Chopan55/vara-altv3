import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src')
const files = (dir = SRC, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}
const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join('/')
const read = (f: string) => readFileSync(f, 'utf8')

describe('ruta canónica del análisis: /analizar', () => {
  it('la pantalla existe y no hay una ruta paralela /dashboard/analizar', () => {
    expect(existsSync(path.join(SRC, 'app', 'analizar', 'page.tsx'))).toBe(true)
    expect(existsSync(path.join(SRC, 'app', 'dashboard', 'analizar'))).toBe(false)
  })

  it('ningún archivo genera ni enlaza /dashboard/analizar', () => {
    const bad = files().filter(f => read(f).includes('dashboard/analizar')).map(rel)
    expect(bad).toEqual([])
  })

  it('el menú de compra "Analizar propiedad" apunta a /analizar', () => {
    const shell = read(path.join(SRC, 'components', 'layout', 'AppShell.tsx'))
    expect(shell).toMatch(/href:\s*'\/analizar'[^}]*label:\s*'Analizar propiedad'/)
  })

  it('"Ya encontré una propiedad" de /empezar lleva a /analizar cuando V3 está activo', () => {
    const page = read(path.join(SRC, 'app', 'empezar', 'page.tsx'))
    expect(page).toMatch(/isEnabled\('buyWowV3'\)\s*\?\s*'\/analizar'/)
  })

  it('todo enlace interno a /analizar usa exactamente esa ruta', () => {
    const links = files().flatMap(f => [...read(f).matchAll(/['"`](\/[a-z-]*\/?analizar[^'"`]*)['"`]/g)].map(m => m[1]))
    for (const l of links) expect(l.startsWith('/analizar')).toBe(true)
  })
})

describe('secretos: solo en el servidor', () => {
  const SECRETS = ['OPENAI_API_KEY', 'BRIGHTDATA_API_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'CRON_SECRET', 'MARKET_SWEEP_SECRET', 'AI_ALLOWED_EMAILS']

  it('ningún archivo de navegador ("use client") lee variables privadas', () => {
    const offenders: string[] = []
    for (const f of files()) {
      const text = read(f)
      if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(text)) continue
      for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (!m[1].startsWith('NEXT_PUBLIC_') && m[1] !== 'NODE_ENV') offenders.push(`${rel(f)}: ${m[1]}`)
      }
      for (const s of SECRETS) if (text.includes(s)) offenders.push(`${rel(f)}: menciona ${s}`)
    }
    expect(offenders).toEqual([])
  })

  it('ninguna variable privada se publica con prefijo NEXT_PUBLIC_', () => {
    // Cada archivo se lee una sola vez (antes se leía una vez por secreto y, bajo carga, pasaba los 5 s).
    const bad = files().flatMap(f => {
      const text = read(f)
      return SECRETS.filter(s => text.includes(`NEXT_PUBLIC_${s}`)).map(s => `${rel(f)}: NEXT_PUBLIC_${s}`)
    })
    expect(bad).toEqual([])
  }, 30_000)

  it('el código fuente no contiene claves reales (patrones conocidos)', () => {
    const patterns: [string, RegExp][] = [
      ['clave secreta de Supabase', /sb_secret_[A-Za-z0-9_-]{16,}/],
      ['clave de OpenAI', /sk-[A-Za-z0-9_-]{20,}/],
      ['clave de Google', /AIza[0-9A-Za-z_-]{30,}/],
      ['JWT largo', /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/],
    ]
    const found: string[] = []
    for (const f of files()) {
      const text = read(f)
      for (const [name, re] of patterns) if (re.test(text)) found.push(`${rel(f)}: ${name}`)
    }
    expect(found).toEqual([])
  })
})
