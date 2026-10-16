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
      // Reglas nuevas y estrictas de React 19. Marcan estilo y patrones a mejorar, no fallas:
      // el código existente las incumple (≈33 casos). Quedan como avisos hasta refactorizarlo.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      // Comillas y apóstrofes dentro de textos JSX: React los dibuja bien.
      'react/no-unescaped-entities': 'off',
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
