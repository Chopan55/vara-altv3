import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * ESLint (formato nuevo). Reemplaza al `.eslintrc.json` viejo, que ESLint 9 ya no lee.
 * `npm run lint` lo corre; la integración continua lo exige.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reglas estrictas de React 19: el código las cumple todas y la integración continua
      // no acepta avisos (--max-warnings 0). Para leer el navegador sin romper la hidratación
      // está useBrowserState/useHydrated; para cargas async al montar, useLoad.
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Comillas y apóstrofes dentro de textos JSX: React los dibuja bien.
      'react/no-unescaped-entities': 'off',
      // Convención del repo: un nombre con _ adelante se descarta a propósito
      // (p. ej. sacar lat/lng de un objeto antes de devolverlo).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true,
      }],
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    '.data/**',
    '.vercel/**',
    '.vercel.stale-bak/**',
    'next-env.d.ts',
    'coverage/**',
  ]),
])
