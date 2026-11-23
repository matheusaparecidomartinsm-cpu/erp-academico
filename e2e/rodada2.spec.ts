import { test, expect, alerta } from './fixtures'
const LONGO = 'Nome muito comprido com acentuação ção ü 😀 '.repeat(3).trim().slice(0, 118)

test('R2-DC1 transferência entre locais com duplo clique move uma vez só', async ({ page }) => {
  await page.goto('/estoque/locais'); await page.getByRole('button', { name: 'Novo local' }).first().click()
  await page.getByLabel('Nome').fill('Loja B'); await page.getByRole('button', { name: /Salvar|Criar/ }).click()
  await page.goto('/estoque'); await page.getByRole('button', { name: /Transferir/ }).click()
  await page.getByLabel('Produto').selectOption({ label: 'Bandeja de papel-cartão 500 g' })
  await page.getByLabel('De (origem)').selectOption({ index: 1 }); await page.getByLabel('Para (destino)').selectOption({ index: 1 })
  await page.getByLabel('Quantidade').fill('10')
  await page.getByRole('button', { name: /Transferir|Registrar/ }).last().dblclick()
  await expect(page.getByText(/transferên/i).first()).toBeVisible()
  const linha = page.locator('tr', { hasText: 'Bandeja de papel-cartão 500 g' }).first()
  await expect(linha).toContainText('10'); await expect(linha).not.toContainText('20')
})

test('R2-DC2 lançar receita com duplo clique cria um lançamento', async ({ page }) => {
  await page.goto('/financeiro/receber'); await page.getByRole('button', { name: 'Lançar receita' }).click()
  await page.getByLabel('Descrição').fill('Receita dupla'); await page.getByLabel(/Valor/).fill('10,00'); await page.getByLabel(/Vencimento/).fill('2030-01-15')
  await page.getByRole('button', { name: 'Lançar' }).last().dblclick()
  await expect(page.getByText('Receita lançada.').first()).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Receita dupla' })).toHaveCount(1)
})

test('R2-DC3 vendedor e tabela de preço com duplo clique criam um registro', async ({ page }) => {
  await page.goto('/vendedores'); await page.getByRole('button', { name: 'Novo vendedor' }).first().click()
  await page.getByLabel('Nome').fill('Duplo Vendedor'); await page.getByRole('button', { name: 'Salvar' }).dblclick()
  await expect(page.locator('tr', { hasText: 'Duplo Vendedor' })).toHaveCount(1)
  await page.goto('/tabelas-preco'); await page.getByRole('button', { name: 'Nova tabela' }).first().click()
  await page.getByLabel('Nome').fill('Tabela Dupla'); await page.getByRole('button', { name: 'Criar tabela' }).dblclick()
  await expect(page.locator('tr', { hasText: 'Tabela Dupla' })).toHaveCount(1)
})

test('R2-DC4 estornar com duplo clique não dá erro nem estorna duas vezes', async ({ page }) => {
  await page.goto('/financeiro/receber'); await page.getByRole('button', { name: 'Todos' }).click()
  await page.getByRole('button', { name: /^Receber:/ }).first().click(); await page.getByRole('dialog').getByRole('button', { name: /^Confirmar/ }).click()
  await page.getByRole('button', { name: 'Todos' }).click()
  await page.getByRole('button', { name: /Ver baixas e estornar/ }).first().click()
  await page.getByRole('button', { name: /Estornar baixa/ }).first().dblclick()
  await expect(page.getByRole('dialog').getByText('Estornada').first()).toBeVisible()
  await expect(alerta(page)).toHaveCount(0)
})

test('R2-E1 nomes de 118 caracteres com emoji não estouram as telas novas (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  for (const [rota, botao] of [['/vendedores', 'Novo vendedor'], ['/estoque/locais', 'Novo local'], ['/tabelas-preco', 'Nova tabela']] as const) {
    await page.goto(rota); await page.getByRole('button', { name: botao }).first().click()
    await page.getByLabel('Nome').fill(LONGO); await page.getByRole('button', { name: /Salvar|Criar/ }).click()
    await expect(page.getByText(LONGO.slice(0, 20)).first()).toBeVisible()
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); expect(w[0], rota).toBeLessThanOrEqual(w[1])
  }
})

test('R2-E2 nome com 121 caracteres é recusado em vendedor e centro', async ({ page }) => {
  await page.goto('/vendedores'); await page.getByRole('button', { name: 'Novo vendedor' }).first().click()
  await page.getByLabel('Nome').fill('a'.repeat(121)); await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(alerta(page)).toContainText('120')
})

test('R2-E3 desativar local com saldo é recusado; local sem saldo desativa e some do pedido', async ({ page }) => {
  await page.goto('/estoque/locais'); await page.getByRole('button', { name: /Editar Depósito principal/ }).click()
  await page.getByLabel('Local ativo').uncheck(); await page.getByRole('button', { name: /Salvar/ }).click()
  await expect(alerta(page)).toBeVisible()
})

test('R2-E4 tabela de preço com preço negativo ou texto é recusada', async ({ page }) => {
  await page.goto('/tabelas-preco'); await page.getByRole('button', { name: 'Nova tabela' }).first().click()
  await page.getByLabel('Nome').fill('Teste preço'); await page.getByRole('button', { name: 'Criar tabela' }).click()
  await page.getByRole('link', { name: 'Teste preço' }).click()
  const linha = page.getByRole('row').nth(1)
  for (const v of ['-5', 'abc', '']) {
    await linha.getByRole('textbox').fill(v); await linha.getByRole('button', { name: /Salvar preço/ }).click()
    await expect(linha.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  }
})

test('R2-E5 alterar pedido em duas abas: a segunda salva e a primeira não perde o pedido', async ({ browser }) => {
  const ctx = await browser.newContext(); const a = await ctx.newPage(); const b = await ctx.newPage()
  await a.goto('/pedidos/novo'); await a.getByLabel('Cliente').selectOption({ label: 'Mercado Exemplo Ltda' }); await a.getByLabel('Produto').selectOption({ label: 'Bandeja de papel-cartão 500 g' })
  await a.getByLabel('Qtd.').fill('1'); await a.getByRole('button', { name: 'Salvar como rascunho' }).click(); await a.waitForURL(/\/pedidos\/ped-\d+/)
  const url = a.url()
  await b.goto(url + '/editar'); await expect(b.getByLabel('Qtd.').first()).toBeVisible()
  await a.getByRole('button', { name: 'Confirmar pedido' }).click(); await expect(a.getByText('Pedido confirmado.').first()).toBeVisible()
  // a aba B ainda mostra a edição com dados antigos; o pedido já foi confirmado na A
  await b.getByLabel('Qtd.').first().fill('2'); await b.getByRole('button', { name: /Salvar/ }).first().click()
  await expect(alerta(b)).toContainText(/rascunho|confirmad|alterar/i)
  await a.reload(); await expect(a.getByText('Confirmado').first()).toBeVisible()
  await ctx.close()
})
