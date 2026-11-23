import { test, expect } from './fixtures'
import { readFileSync } from 'fs'

test('F1-1 importar clientes por CSV: prévia aponta erros e grava só as boas linhas', async ({ page }) => {
  await page.goto('/importar')
  await page.getByLabel('Ou cole o conteúdo aqui').fill('Nome;CPF/CNPJ;E-mail\nImp Um;901;um@x.com\n;902;\nImp Dois;903;ruim\nImp Tres;904;')
  await expect(page.getByText('Prévia: 2 linha(s) boa(s) e 2 com problema')).toBeVisible()
  await expect(page.getByText('Falta o nome.')).toBeVisible(); await expect(page.getByText('E-mail inválido.')).toBeVisible()
  await page.getByRole('button', { name: 'Importar 2 linha(s)' }).dblclick()
  await expect(page.getByText('2 importada(s).')).toBeVisible()
  await page.goto('/clientes'); await expect(page.locator('tr', { hasText: 'Imp Um' })).toHaveCount(1); await expect(page.locator('tr', { hasText: 'Imp Tres' })).toHaveCount(1)
})

test('F1-2 importar produtos por arquivo, e arquivo sem coluna de preço dá erro claro', async ({ page }) => {
  await page.goto('/importar'); await page.getByRole('button', { name: 'Produtos' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'p.csv', mimeType: 'text/csv', buffer: Buffer.from('Descrição;Preço\nProduto Csv;7,90') })
  await expect(page.getByText('Prévia: 1 linha(s) boa(s) e 0 com problema')).toBeVisible()
  await page.getByRole('button', { name: 'Importar 1 linha(s)' }).click(); await expect(page.getByText('1 importada(s).')).toBeVisible()
  await page.getByLabel('Ou cole o conteúdo aqui').fill('Descrição;Grupo\nA;B')
  await expect(page.getByRole('alert').filter({ hasText: 'coluna "preço"' })).toBeVisible()
})

test('F1-3 importar: documento repetido com cliente existente é recusado na prévia', async ({ page }) => {
  await page.goto('/importar'); await page.getByLabel('Ou cole o conteúdo aqui').fill('Nome;Documento\nA;777\nB;777')
  await expect(page.getByText('Documento repetido', { exact: false })).toBeVisible()
})

test('F2 relatório financeiro mostra totais e exporta CSV', async ({ page }) => {
  await page.goto('/financeiro/receber'); await page.getByRole('button', { name: 'Lançar receita' }).click()
  await page.getByLabel('Descrição').fill('Receita relatório'); await page.getByLabel(/Valor/).fill('250,00'); await page.getByLabel(/Vencimento/).fill('2030-03-10')
  await page.getByRole('button', { name: 'Lançar' }).last().click(); await expect(page.getByText('Receita lançada.').first()).toBeVisible()
  await page.goto('/relatorios/financeiro')
  await page.getByLabel('De').fill('2030-03-01'); await page.getByLabel('Até').fill('2030-03-31')
  await expect(page.getByRole('heading', { name: 'Receitas', exact: true })).toBeVisible()
  await expect(page.getByText('R$ 250,00').first()).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()])
  const txt = readFileSync(await dl.path()!, 'utf8'); expect(txt).toContain('Quadro;Tipo;Item;Previsto;Realizado'); expect(txt).toContain('250')
  await page.getByLabel('De').fill('2031-01-01'); await page.getByLabel('Até').fill('2031-01-31')
  await expect(page.getByText('Nada neste período')).toBeVisible()
  await page.getByLabel('De').fill('2032-01-01'); await expect(page.getByRole('alert').filter({ hasText: 'período válido' })).toBeVisible()
})

test('F3 exportar meus dados baixa os cinco CSVs', async ({ page }) => {
  await page.goto('/exportar')
  for (const [nome, cab] of [['Clientes', 'Código;Nome'], ['Produtos', 'Código;Descrição'], ['Pedidos', 'Número;Status'], ['Movimentos de estoque', 'Data;Produto'], ['Financeiro (a receber e a pagar)', 'Tipo;Descrição']]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: `Baixar ${nome}` }).click()])
    expect(readFileSync(await dl.path()!, 'utf8')).toContain(cab)
  }
})
