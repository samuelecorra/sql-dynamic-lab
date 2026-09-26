import { expect, test, type Page } from '@playwright/test'
import { exercises } from '../../src/exercises'

async function edit(page: Page, sql: string) {
  const editor = page.getByRole('textbox', { name: 'SQL query editor' })
  await editor.focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate((text) => navigator.clipboard.writeText(text), sql)
  await page.keyboard.press('ControlOrMeta+V')
}
async function waitReady(page: Page) {
  await expect(page.getByRole('button', { name: /^Run/ })).toBeEnabled()
  await expect(page.getByRole('textbox', { name: 'SQL query editor' })).toBeVisible()
}

test('all three exercises: incorrect answers fail, canonical answers pass, and X-Ray explains stages', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const origin = new URL(test.info().project.use.baseURL!).origin
  page.on('request', (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:'))
      external.push(r.url())
  })
  await page.goto('/')
  await waitReady(page)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  const wrong = [
    exercises[0].reference.replace('COUNT(*) > 5', 'COUNT(*) >= 5'),
    "SELECT DISTINCT CFCliente FROM ORDINE WHERE Data BETWEEN '2025-01-01' AND '2025-12-31'",
    "SELECT DISTINCT CFCliente FROM ORDINE WHERE MetodoPagamento = 'Carta di credito'",
  ]
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i]
    await page.getByRole('navigation').getByRole('button').nth(i).click()
    await waitReady(page)
    await edit(page, wrong[i])
    await expect(page.getByRole('status')).toHaveText('Up to date')
    await page.getByRole('button', { name: 'Check answer' }).click()
    await expect(page.getByRole('heading', { name: 'The result needs another look' })).toBeVisible()
    await page.getByRole('button', { name: 'Show result differences' }).click()
    await expect(page.getByRole('heading', { name: /Unexpected/ })).toBeVisible()
    await page
      .locator('.results-panel')
      .screenshot({ path: `artifacts/exercise-${i + 1}-incorrect.png` })
    await edit(page, exercise.reference)
    await expect(page.getByRole('status')).toHaveText('Up to date')
    await page.getByRole('button', { name: 'Check answer' }).click()
    await expect(page.getByRole('heading', { name: 'Semantically correct' })).toBeVisible()
    await page
      .locator('.results-panel')
      .screenshot({ path: `artifacts/exercise-${i + 1}-correct.png` })
    await page.getByRole('tab', { name: 'Query X-Ray' }).click()
    await expect(page.locator('.pipeline-item')).toHaveCount(i === 2 ? 3 : 5)
    await page.locator('.pipeline-item').last().getByRole('button').click()
    await expect(page.locator('.result-content tbody tr')).toHaveCount(
      i === 0 ? 1 : i === 1 ? 2 : 3,
    )
  }
  await expect(page.getByText('of 3 completed')).toContainText('3 of 3 completed')
  await page.reload()
  await waitReady(page)
  await expect(page.getByText('of 3 completed')).toContainText('3 of 3 completed')
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('editor shortcut, live updates, hints, table explorer, reset and preferences', async ({
  page,
}) => {
  await page.goto('/')
  await waitReady(page)
  await page.getByLabel('Live', { exact: true }).uncheck()
  await edit(page, 'SELECT 42 AS Answer, NULL AS Unknown;')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('tab', { name: 'Final result' }).click()
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'NULL', exact: true })).toBeVisible()
  await page.getByLabel('Live', { exact: true }).check()
  await edit(page, 'SELECT Nome FROM CLIENTE WHERE 0;')
  await expect(page.getByText('No rows returned.')).toBeVisible()
  await edit(page, 'SELECT Nome FROM')
  await expect(page.getByRole('status')).toHaveText('Continue writing…')
  await expect(page.locator('.notice[role="alert"]')).toHaveCount(0)
  await page.getByRole('button', { name: /^Run/ }).click()
  await expect(page.locator('.notice[role="alert"]')).toBeVisible()
  await page.getByRole('button', { name: 'Reset query' }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'Reveal a hint' }).click()
  await expect(page.getByText(exercises[0].hints[0])).toBeVisible()
  await page.getByRole('button', { name: /Exam Mode/ }).click()
  await page.getByRole('button', { name: 'Switch color theme' }).click()
  await page.getByRole('button', { name: 'Inspect ORDINE rows' }).click()
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(37)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Reset database' }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.reload()
  await waitReady(page)
  await expect(page.getByText(exercises[0].hints[0])).toBeVisible()
  await expect(page.getByRole('button', { name: /Exam Mode/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.screenshot({ path: 'artifacts/lab-light.png', fullPage: true })
})

test('CTE alternative remains correct despite exam warning, solution needs explicit action', async ({
  page,
}) => {
  await page.goto('/')
  await waitReady(page)
  await page.getByRole('navigation').getByRole('button').nth(1).click()
  await waitReady(page)
  await page.getByRole('button', { name: /Exam Mode/ }).click()
  await edit(page, exercises[1].alternative!)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.getByRole('heading', { name: 'Semantically correct' })).toBeVisible()
  await expect(page.getByText(/NO CTE exercise:/)).toBeVisible()
  await page.getByRole('button', { name: 'Show solution & explanation' }).click()
  await expect(page.getByRole('heading', { name: 'Equivalent alternative' })).toBeVisible()
  await page.getByRole('button', { name: 'Load canonical query into editor' }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('tab', { name: 'Query X-Ray' }).click()
  await expect(page.locator('.pipeline-item')).toHaveCount(5)
})

test('worker timeout keeps UI responsive and recovers', async ({ page }) => {
  await page.goto('/')
  await waitReady(page)
  await page.getByLabel('Live', { exact: true }).uncheck()
  await edit(
    page,
    'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n) SELECT SUM(x) FROM n;',
  )
  await page.getByRole('button', { name: /^Run/ }).click()
  await page.getByRole('button', { name: 'Reveal a hint' }).click()
  await expect(page.getByText(exercises[0].hints[0])).toBeVisible()
  await expect(page.locator('.notice[role="alert"]')).toContainText(
    'Query stopped after the time limit',
  )
  await edit(page, 'SELECT COUNT(*) AS Total FROM ORDINE;')
  await page.getByRole('button', { name: /^Run/ }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.getByRole('tab', { name: 'Final result' }).click()
  await expect(page.getByRole('cell', { name: '37', exact: true })).toBeVisible()
})

test('layout at desktop, laptop and mobile widths', async ({ page }) => {
  await page.goto('/')
  await waitReady(page)
  await edit(page, exercises[0].reference)
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await page.locator('.pipeline-item').nth(2).getByRole('button').click()
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await expect(page.getByRole('button', { name: 'Check answer' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({ path: `artifacts/lab-${width}.png`, fullPage: true })
  }
})
