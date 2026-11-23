import { test, expect, semViolacoes } from './fixtures'
const ROTAS = ['/ajuda', '/relatorios/comissao', '/importar', '/exportar', '/relatorios/financeiro', '/', '/clientes', '/clientes/novo', '/produtos', '/produtos/novo', '/estoque', '/pedidos', '/pedidos/novo', '/pedidos/ped-1', '/pedidos/ped-2', '/notas', '/financeiro/receber', '/financeiro/pagar', '/login', '/estoque/locais', '/tabelas-preco', '/clientes/cli-1', '/produtos/pro-1', '/pedidos/ped-2/editar', '/vendedores', '/empresa', '/financeiro/cadastros']
for (const tema of ['light', 'dark']) for (const r of ROTAS) {
  test(`A11Y ${tema} ${r}: sem violações sérias (axe)`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('tema', t), tema)
    await page.goto(r); await expect(page.locator('main, #conteudo').first()).toBeVisible(); await page.waitForTimeout(400)
    if (tema === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    expect(await semViolacoes(page)).toEqual([])
  })
}
for (const r of ROTAS) test(`A11Y-390 ${r}: sem violações sérias (axe) em tela estreita`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto(r); await expect(page.locator('main, #conteudo').first()).toBeVisible(); await page.waitForTimeout(400)
  expect(await semViolacoes(page)).toEqual([])
})
for (const r of ROTAS) test(`MOBILE ${r}: sem rolagem horizontal em 390px`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto(r); await page.waitForTimeout(400)
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); expect(w[0]).toBeLessThanOrEqual(w[1])
})
test('TECLADO-1 pular para o conteúdo e foco visível', async ({ page }) => {
  await page.goto('/clientes'); await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
})
test('MODAL-1 Esc fecha o modal e devolve o foco', async ({ page }) => {
  await page.goto('/estoque'); const b = page.getByRole('button', { name: 'Ajustar estoque' }); await b.click()
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(b).toBeFocused()
})
