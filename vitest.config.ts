import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Tests de la lógica de VARA Visit.
 *
 * Solo lógica pura: matching, precios, reglas de sesión. No levantan base ni
 * navegador a propósito — un test que necesita Supabase para correr termina
 * sin correrse nunca.
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
    include: ['tests/**/*.test.ts'],
  },
})
