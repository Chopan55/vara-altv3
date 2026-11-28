# Responsive E2E contract

Playwright is not installed in this repository and is not added without safely
regenerating `package-lock.json`. When a Playwright runner is available, save
the following as `responsiveOverflow.spec.ts` and run it in Chromium and WebKit.

```ts
import { test, expect } from '@playwright/test'

for (const width of [320, 375, 390, 430]) {
  test.describe(`mobile width ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } })

    for (const state of ['', '&test=1']) {
      test(`/analizar ${state || 'idle'} has no horizontal overflow`, async ({ page }) => {
        await page.goto(`/analizar?v3=1${state}`)
        await expect.poll(() => page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))).toEqual({ scrollWidth: width, clientWidth: width })
      })
    }

    test('/onboarding has no horizontal overflow with focus', async ({ page }) => {
      await page.goto('/onboarding')
      await page.locator('input').first().focus()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  })
}
```
