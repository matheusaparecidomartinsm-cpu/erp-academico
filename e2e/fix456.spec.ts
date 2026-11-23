import { test, expect, alerta, novoPedido, faturar, semViolacoes } from './fixtures'
import { readFileSync } from 'fs'
const num = (s: string) => Math.round(parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) * 100)

test('F4-1 financeiro: parcela quitada aparece em Quitados, sai de Em aberto e volta ao estornar', async ({ page }) => {
  await page.goto('/financeiro/receber'); await page.getByRole('button', { name: 'Lançar receita' }).click()
  await page.getByLabel('Descrição').fill('Quitável'); await page.getByLabel(/Valor/).fill('80,00'); await page.getByLabel(/Vencimento/).fill('2030-01-15')
  await page.getByRole('button', { name: /Lançar/ }).last().click(); await expect(page.getByText('Quitável')).toBeVisible()
  await page.getByRole('button', { name: 'Receber: Quitável' }).click(); await page.getByRole('dialog').getByRole('button', { name: /^Confirmar/ }).click()
  await expect(page.locator('tr', { hasText: 'Quitável' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Quitados' }).click(); await expect(page.locator('tr', { hasText: 'Quitável' })).toHaveCount(1)
  await page.getByRole('button', { name: /Ver baixas e estornar: Quitável/ }).click(); await page.getByRole('button', { name: /Estornar baixa/ }).click()
  await expect(page.getByRole('dialog').getByText('Estornada')).toBeVisible(); await page.getByRole('button', { name: 'Fechar' }).first().click()
  await page.getByRole('button', { name: 'Em aberto' }).click(); await expect(page.locator('tr', { hasText: 'Quitável' })).toHaveCount(1)
})

test('F4-2 financeiro: Quitados vazio explica o que acontece', async ({ page }) => {
  await page.goto('/financeiro/pagar'); await page.getByRole('button', { name: 'Quitados' }).click()
  await expect(page.getByText(/Nenhum lançamento quitado/).or(page.locator('tr').nth(1))).toBeVisible()
})

test('F5-1 vendedor: comissão inválida é recusada com dica; 2,5 salva e aparece na lista', async ({ page }) => {
  await page.goto('/vendedores'); await page.getByRole('button', { name: 'Novo vendedor' }).first().click()
  await page.getByLabel('Nome').fill('Dora Comissão'); await page.getByLabel('Comissão (%)').fill('150'); await page.getByRole('button', { name: 'Salvar' }).dblclick()
  await expect(alerta(page)).toContainText('Comissão deve ficar entre 0% e 100%'); await expect(alerta(page)).toContainText('O que fazer')
  await page.getByLabel('Comissão (%)').fill('2,5'); await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.locator('tr', { hasText: 'Dora Comissão' })).toContainText('2,5%')
  await expect(page.locator('tr', { hasText: 'Dora Comissão' })).toHaveCount(1)
})

test('F5-2 comissões: pedido faturado do vendedor gera total × percentual; cancelado e sem vendedor não geram', async ({ page }) => {
  await page.goto('/vendedores'); await page.getByRole('button', { name: 'Novo vendedor' }).first().click()
  await page.getByLabel('Nome').fill('Eva Vendas'); await page.getByLabel('Comissão (%)').fill('5'); await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('cell', { name: 'Eva Vendas', exact: true })).toBeVisible()
  await novoPedido(page, 'Mercado Exemplo Ltda', 'Bandeja de papel-cartão 500 g', '2')
  await page.getByLabel('Vendedor').selectOption({ label: 'Eva Vendas' }); await faturar(page)
  await expect(page.getByText(/Nota .* emitida|emitida/i).first()).toBeVisible()
  await novoPedido(page, 'Padaria Modelo ME', 'Bandeja de papel-cartão 500 g', '1'); await faturar(page)   // sem vendedor
  await page.goto('/relatorios/comissao')
  const eva = page.locator('section', { hasText: 'Eva Vendas' })
  await expect(eva).toBeVisible(); await expect(eva).toContainText('× 5%')
  const cel = await eva.locator('tbody tr').first().locator('td').allInnerTexts()
  const total = num(cel[2]), comissao = num(cel[3]); expect(comissao).toBe(Math.round(total * 0.05))
  await expect(page.locator('section', { hasText: 'Sem vendedor' })).toContainText('não geram comissão')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
  const txt = readFileSync(await dl.path()!, 'utf8'); expect(txt).toContain('Vendedor;Pedido;Data da nota'); expect(txt).toContain('Eva Vendas')
  await page.getByLabel('De', { exact: true }).fill('2000-01-01'); await page.getByLabel('Até', { exact: true }).fill('2000-01-31')
  await expect(page.getByText('Nenhum pedido faturado neste período')).toBeVisible()
  await page.getByLabel('De', { exact: true }).fill('2031-01-01'); await expect(page.getByRole('alert').filter({ hasText: 'período válido' })).toBeVisible()
})

test('F6-1 erro conhecido (ajuste que deixaria o saldo negativo) mostra o que fazer, com link', async ({ page }) => {
  await page.goto('/estoque'); await page.getByRole('button', { name: 'Ajustar estoque' }).first().click()
  await page.getByLabel('Produto').selectOption({ index: 1 }); await page.getByLabel('Quantidade').fill('-99999'); await page.getByLabel('Motivo').fill('teste')
  await page.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(alerta(page)).toContainText('saldo negativo'); await expect(alerta(page)).toContainText('O que fazer'); await expect(alerta(page).getByRole('link')).toBeVisible()
})

test('F6-2 erro desconhecido não ganha dica inventada', async ({ page }) => {
  await page.goto('/tabelas-preco'); await page.getByRole('button', { name: 'Nova tabela' }).first().click()
  await page.getByLabel('Nome').fill(''); await page.getByRole('button', { name: 'Criar tabela' }).click()
  await expect(alerta(page)).toBeVisible(); await expect(page.getByText('O que fazer:')).toHaveCount(0)
})

test('F6-3 página de Ajuda lista os passos e os erros, e passa no axe em desktop e 390px', async ({ page }) => {
  await page.goto('/ajuda'); await expect(page.getByRole('heading', { name: 'Passo a passo' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Erros comuns e o que fazer' })).toBeVisible(); await expect(page.getByText('Saldo insuficiente no pedido ou no ajuste')).toBeVisible()
  expect(await semViolacoes(page)).toEqual([])
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto('/ajuda')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); expect(await semViolacoes(page)).toEqual([])
})
