import { test, expect, novoPedido, faturar } from './fixtures'
// Duplo clique em todo botão que grava não pode gravar duas vezes.
test('DC-1 cliente', async ({ page }) => {
  await page.goto('/clientes/novo'); await page.getByLabel('Nome').fill('Duplo Cliente')
  await page.getByRole('button', { name: 'Salvar cliente' }).dblclick(); await page.waitForURL(/\/clientes$/)
  await expect(page.locator('tr', { hasText: 'Duplo Cliente' })).toHaveCount(1)
})
test('DC-2 produto', async ({ page }) => {
  await page.goto('/produtos/novo'); await page.getByLabel('Descrição').fill('Duplo Produto'); await page.getByLabel('Preço de venda').fill('1')
  await page.getByRole('button', { name: 'Salvar produto' }).dblclick(); await page.waitForURL(/\/produtos$/)
  await expect(page.locator('tr', { hasText: 'Duplo Produto' })).toHaveCount(1)
})
test('DC-3 ajuste de estoque entra uma vez só', async ({ page }) => {
  await page.goto('/estoque'); await page.getByRole('button', { name: 'Ajustar estoque' }).click()
  await page.getByLabel('Produto').selectOption({ label: 'Bandeja de papel-cartão 500 g' }); await page.getByLabel('Quantidade').fill('10'); await page.getByLabel('Motivo').fill('dc')
  await page.getByRole('button', { name: 'Registrar ajuste' }).dblclick(); await expect(page.getByText('Ajuste registrado.').first()).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()).toContainText('70')
})
test('DC-4 emitir nota emite uma nota e um conjunto de parcelas', async ({ page }) => {
  await novoPedido(page, 'Padaria Modelo ME', 'Bandeja de papel-cartão 500 g', '10')
  await page.getByRole('button', { name: 'Faturar' }).click(); await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Parcelas', { exact: true }).selectOption('2'); await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Emitir nota' }).dblclick(); await expect(page.getByText('Parcelas a receber')).toBeVisible()
  await page.goto('/estoque'); await expect(page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()).toContainText('50')
  await page.goto('/financeiro/receber'); await expect(page.locator('tr', { hasText: /Pedido 1004 — NF \d+ · \d\/2/ })).toHaveCount(2)
})
test('DC-5 baixa com duplo clique baixa uma vez', async ({ page }) => {
  await page.goto('/financeiro/pagar'); await page.getByRole('button', { name: /Pagar: Aluguel/ }).click()
  const v = await page.getByLabel('Valor').inputValue(); expect(v).not.toBe('')
  await page.getByLabel('Valor').fill('100,00'); await page.getByRole('button', { name: 'Confirmar' }).dblclick()
  await expect(page.getByText('Pagamento registrado').first()).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Aluguel' })).toContainText(/\d/)
})
test('DC-6 lançar despesa uma vez', async ({ page }) => {
  await page.goto('/financeiro/pagar'); await page.getByRole('button', { name: 'Lançar despesa' }).click()
  await page.getByLabel('Descrição').fill('Despesa Dupla'); await page.getByLabel('Valor').fill('10,00'); await page.getByLabel('Vencimento').fill('2026-12-10')
  await page.getByRole('button', { name: 'Lançar', exact: true }).dblclick(); await expect(page.getByText('Despesa lançada.').first()).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Despesa Dupla' })).toHaveCount(1)
})
test('DC-7 confirmar pedido uma vez', async ({ page }) => {
  await novoPedido(page, 'Padaria Modelo ME', 'Bandeja de papel-cartão 500 g', '1', false)
  await page.getByRole('button', { name: 'Confirmar pedido' }).dblclick(); await expect(page.getByText('Confirmado').first()).toBeVisible()
})
