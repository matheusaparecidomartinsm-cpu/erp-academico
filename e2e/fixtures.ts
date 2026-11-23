import { test as base, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Toda página falha se houver erro de console, erro de página ou resposta 5xx.
export const test = base.extend<{ erros: string[] }>({
  erros: [async ({ page }, use) => {
    const erros: string[] = []
    page.on('console', m => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })
    page.on('pageerror', e => erros.push(`pageerror: ${e.message}`))
    page.on('response', r => { if (r.status() >= 500) erros.push(`5xx: ${r.status()} ${r.url()}`) })
    await use(erros)
    const offline = test.info().annotations.some(a => a.type === 'offline')
    expect(offline ? erros.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch RSC payload/.test(e)) : erros, 'erros de console/5xx').toEqual([])
  }, { auto: true }],
})
export { expect }
export async function semViolacoes(page: import('@playwright/test').Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}x ${v.nodes[0].target}`)
}
export async function novoPedido(page: import('@playwright/test').Page, cliente: string, produto: string, qtd: string, confirmar = true) {
  await page.goto('/pedidos/novo')
  await page.getByLabel('Cliente').selectOption({ label: cliente })
  await page.getByLabel('Produto').selectOption({ label: produto })
  await page.getByLabel('Qtd.').fill(qtd)
  await page.getByRole('button', { name: confirmar ? 'Salvar e confirmar' : 'Salvar como rascunho' }).click()
  await page.waitForURL(/\/pedidos\/ped-\d+/)
}
export async function faturar(page: import('@playwright/test').Page, parcelas = '1') {
  await page.getByRole('button', { name: 'Faturar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Parcelas', { exact: true }).selectOption(parcelas)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Emitir nota' }).click()
}

// alertas de verdade (ignora o anunciador de rota do Next)
export const alerta = (page: import('@playwright/test').Page) => page.locator('[role=alert]:not(#__next-route-announcer__)').first()
