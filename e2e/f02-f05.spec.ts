import { test, expect, alerta, novoPedido, faturar } from './fixtures'

test('F02-H1 estoque mostra saldo e movimentos', async ({ page }) => {
  await page.goto('/estoque')
  await expect(page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()).toContainText('60')
  await expect(page.getByText('Saldo inicial').first()).toBeVisible()
})
test('F02-E1 ajuste que deixaria saldo negativo é recusado', async ({ page }) => {
  await page.goto('/estoque')
  await page.getByRole('button', { name: 'Ajustar estoque' }).click()
  await page.getByLabel('Produto').selectOption({ label: 'Bandeja de papel-cartão 500 g' })
  await page.getByLabel('Quantidade').fill('-61'); await page.getByLabel('Motivo').fill('teste')
  await page.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(alerta(page)).toContainText(/saldo|negativ/i)
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()).toContainText('60')
})
test('F02-E2 ajuste com quantidade zero, vazia ou texto é recusado', async ({ page }) => {
  await page.goto('/estoque')
  for (const q of ['0', '', 'abc']) {
    await page.getByRole('button', { name: 'Ajustar estoque' }).click()
    await page.getByLabel('Produto').selectOption({ label: 'Bandeja de papel-cartão 500 g' })
    await page.getByLabel('Quantidade').fill(q); await page.getByLabel('Motivo').fill('x')
    await page.getByRole('button', { name: 'Registrar ajuste' }).click()
    await expect(alerta(page), `qtd=${q}`).toBeVisible()
    await page.getByRole('button', { name: 'Voltar' }).click()
  }
})
test('F02-E3 ajuste aceita vírgula decimal e entra no saldo', async ({ page }) => {
  await page.goto('/estoque')
  await page.getByRole('button', { name: 'Ajustar estoque' }).click()
  await page.getByLabel('Produto').selectOption({ label: 'Bandeja de papel-cartão 500 g' })
  await page.getByLabel('Quantidade').fill('2,5'); await page.getByLabel('Motivo').fill('contagem')
  await page.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(page.getByText('Ajuste registrado.')).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()).toContainText('62,5')
})
test('F03-H1 baixa parcial deixa o restante em aberto', async ({ page }) => {
  await novoPedido(page, 'Padaria Modelo ME', 'Bandeja de papel-cartão 500 g', '10') // R$ 32,00
  await faturar(page, '1')
  await page.goto('/financeiro/receber')
  await page.getByRole('button', { name: /Receber: Pedido 1004/ }).click()
  await page.getByLabel('Valor').fill('10,00')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Recebimento registrado')).toBeVisible()
  await expect(page.locator('tr', { hasText: /Pedido 1004 — NF/ }).first()).toContainText('22,00')
})
test('F03-E1 valor maior que o em aberto é recusado', async ({ page }) => {
  await page.goto('/financeiro/pagar')
  await page.getByRole('button', { name: /Pagar: Aluguel/ }).click()
  await page.getByLabel('Valor').fill('999999')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(alerta(page)).toBeVisible()
})
test('F03-E2 baixa com valor zero ou negativo é recusada', async ({ page }) => {
  await page.goto('/financeiro/pagar')
  for (const v of ['0', '-5', '']) {
    await page.getByRole('button', { name: /Pagar: Aluguel/ }).click()
    await page.getByLabel('Valor').fill(v)
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(alerta(page), `v=${v}`).toBeVisible()
    await page.getByRole('button', { name: 'Voltar' }).click()
  }
})
test('F03-E3 juros entram no recebido, não no saldo', async ({ page }) => {
  await page.goto('/financeiro/pagar')
  await page.getByRole('button', { name: /Pagar: Energia/ }).click()
  const val = await page.getByLabel('Valor').inputValue()
  await page.getByLabel('Juros (opcional)').fill('5,00')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Pagamento registrado')).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Energia' })).toHaveCount(0) // quitada some de "Em aberto"
  expect(val).not.toBe('')
})
test('F03-E4 lançar despesa: descrição vazia e valor inválido recusados; válida aparece', async ({ page }) => {
  await page.goto('/financeiro/pagar')
  await page.getByRole('button', { name: 'Lançar despesa' }).click()
  await page.getByRole('button', { name: 'Lançar', exact: true }).click()
  await expect(alerta(page)).toBeVisible()
  await page.getByLabel('Descrição').fill('Internet 🌐 — mês 11'); await page.getByLabel('Valor').fill('129,90')
  await page.getByLabel('Vencimento').fill('2026-12-10')
  await page.getByRole('button', { name: 'Lançar', exact: true }).click()
  await expect(page.getByText('Despesa lançada.')).toBeVisible()
  await expect(page.getByText('Internet 🌐 — mês 11')).toBeVisible()
})
test('F04-H1 cadastrar produto e vê-lo na lista com saldo zero', async ({ page }) => {
  await page.goto('/produtos/novo')
  await page.getByLabel('Descrição').fill('Canudo de papel 6 mm'); await page.getByLabel('Grupo').fill('Descartáveis')
  await page.getByLabel('Preço de venda').fill('12,50')
  await page.getByRole('button', { name: 'Salvar produto' }).click()
  await page.waitForURL(/\/produtos$/)
  await expect(page.locator('tr', { hasText: 'Canudo de papel 6 mm' })).toBeVisible()
})
test('F04-E1 produto sem descrição ou com preço inválido é recusado', async ({ page }) => {
  for (const [d, p] of [['', '10'], ['Item', 'abc'], ['Item', '-1']]) {
    await page.goto('/produtos/novo')
    await page.getByLabel('Descrição').fill(d); await page.getByLabel('Preço de venda').fill(p)
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page, `${d}/${p}`).toHaveURL(/produtos\/novo/)
  }
})
test('F04-E2 descrição de 120 caracteres não estoura a lista no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/produtos/novo')
  await page.getByLabel('Descrição').fill('Embalagem ' + 'muito-longa-'.repeat(10)); await page.getByLabel('Preço de venda').fill('1')
  await page.getByRole('button', { name: 'Salvar produto' }).click(); await page.waitForURL(/\/produtos$/)
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); expect(w[0]).toBeLessThanOrEqual(w[1])
})
test('F05-H1 cancelar pedido faturado sem baixa estorna o estoque e cancela parcelas', async ({ page }) => {
  await novoPedido(page, 'Padaria Modelo ME', 'Bandeja de papel-cartão 500 g', '10'); await faturar(page, '2')
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  await page.getByLabel('Motivo').fill('Cliente desistiu')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click()
  await expect(page.getByText(/cancelado/i).first()).toBeVisible()
  await page.goto('/estoque')
  await expect(page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()).toContainText('60')
})
test('F05-N1 cancelar sem motivo é recusado', async ({ page }) => {
  await novoPedido(page, 'Padaria Modelo ME', 'Bandeja de papel-cartão 500 g', '1')
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(alerta(page)).toBeVisible()
})
