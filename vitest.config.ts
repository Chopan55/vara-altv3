import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Tests de la lógica de VARA Visit.
 *
 * Lógica pura (matching, precios, reglas de sesión) más `tests/db`: la suite de
 * seguridad, que corre contra un Postgres real en memoria (PGlite). No necesita
 * Supabase, Docker ni red, así que corre en cualquier máquina y en CI. Ningún
 * test toca una base real.
 *
 * El alias `@` replica el `paths` de tsconfig.json, que vitest no lee solo.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // tools/vara-agent: tests del bridge de agentes; usan dobles, sin red ni dependencias propias.
    include: ['tests/**/*.test.ts', 'tools/vara-agent/tests/**/*.test.ts'],
  },
})
