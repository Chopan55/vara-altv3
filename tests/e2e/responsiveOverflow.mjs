// Prueba de pantalla en celular. Uso: levantar la app (npm run build && npm start -- -p 3111) y correr
//   BASE=http://localhost:3111 node tests/e2e/responsiveOverflow.mjs
// Requiere `npx playwright install webkit chromium`. Falla si la página se ensancha más que la pantalla, aun sin el overflow-x del body.
import { chromium, webkit } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3111'
const PATHS = ['/analizar', '/onboarding', '/planes']
const WIDTHS = [320, 375, 390, 430]
let failures = 0
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch()
  for (const path of PATHS) for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    // Se anula el overflow-x del body para que el `clip` no esconda un desborde real.
    const { sw, cw } = await page.evaluate(() => {
      document.body.style.overflowX = 'visible'
      document.documentElement.style.overflowX = 'visible'
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }
    })
    if (sw > cw) { failures++; console.log(`FALLA ${name} ${path} ${width}px: scrollWidth ${sw} > ${cw}`) }
    await page.close()
  }
  await browser.close()
}
console.log(failures ? `${failures} fallas` : 'OK: sin desborde')
process.exit(failures ? 1 : 0)
