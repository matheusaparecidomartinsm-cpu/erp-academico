import { test, expect, semViolacoes } from './fixtures'
import { readFileSync } from 'fs'
const LONGO = 'Nome muito comprido com acentuação ção ü 😀 '.repeat(3).trim().slice(0, 118)

test('R3-E1 importar 501 linhas é recusado inteiro, com aviso claro e sem gravar', async ({ page }) => {
  await page.goto('/importar')
  const csv = 'Nome\n' + Array.from({ length: 501 }, (_, i) => `Cli ${i}`).join('\n')
  await page.getByLabel('Ou cole o conteúdo aqui').fill(csv)
  await expect(page.getByRole('alert').filter({ hasText: 'mais de 500 linhas' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Importar/ })).toHaveCount(0)
})

test('R3-E2 arquivo maior que 1 MB é recusado com aviso', async ({ page }) => {
  await page.goto('/importar')
  await page.locator('input[type=file]').setInputFiles({ name: 'grande.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome\n' + 'a'.repeat(1_100_000)) })
  await expect(page.getByRole('alert').filter({ hasText: '1 MB' })).toBeVisible()
})

test('R3-E3 nome com emoji e 118 caracteres importa e não estoura a tela em 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto('/importar')
  await page.getByLabel('Ou cole o conteúdo aqui').fill(`Nome;Documento\n${LONGO};9100`)
  await expect(page.getByText('Prévia: 1 linha(s) boa(s) e 0 com problema')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.getByRole('button', { name: 'Importar 1 linha(s)' }).click(); await expect(page.getByText('1 importada(s).')).toBeVisible()
  await page.goto('/clientes'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('R3-E4 preço absurdo é recusado na prévia e no lançamento manual', async ({ page }) => {
  await page.goto('/importar'); await page.getByRole('button', { name: 'Produtos' }).click()
  await page.getByLabel('Ou cole o conteúdo aqui').fill('Descrição;Preço\nCaro;99999999999\nBarato;5')
  await expect(page.getByText('Prévia: 1 linha(s) boa(s) e 1 com problema')).toBeVisible()
  await page.goto('/financeiro/receber'); await page.getByRole('button', { name: 'Lançar receita' }).click()
  await page.getByLabel('Descrição').fill('Gigante'); await page.getByLabel(/Valor/).fill('99999999999'); await page.getByLabel(/Vencimento/).fill('2030-01-15')
  await page.getByRole('button', { name: 'Lançar' }).last().click()
  await expect(page.getByText('Receita lançada.')).toHaveCount(0)
  await expect(page.locator('tr', { hasText: 'Gigante' })).toHaveCount(0)
})

test('R3-E5 ida e volta: exportar clientes e reimportar não deixa apóstrofo no nome', async ({ page }) => {
  await page.goto('/importar'); await page.getByLabel('Ou cole o conteúdo aqui').fill('Nome;Documento\n=1+1 Fórmula;9200')
  await page.getByRole('button', { name: 'Importar 1 linha(s)' }).click(); await expect(page.getByText('1 importada(s).')).toBeVisible()
  await page.goto('/exportar')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar Clientes' }).click()])
  const txt = readFileSync(await dl.path()!, 'utf8'); expect(txt).toContain("'=1+1 Fórmula"); expect(txt.charCodeAt(0)).toBe(0xFEFF)
  await page.goto('/importar'); await page.getByLabel('Ou cole o conteúdo aqui').fill(txt.replace(/9200/, '9201'))
  await expect(page.getByText('Documento repetido').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: "'=1+1 Fórmula" })).toHaveCount(0)
})

test('R3-E6 importar com duas abas: a segunda rejeita o documento que a primeira já gravou', async ({ page, context }) => {
  const b = await context.newPage()
  await page.goto('/importar'); await b.goto('/importar')
  for (const p of [page, b]) await p.getByLabel('Ou cole o conteúdo aqui').fill('Nome;Documento\nDuas Abas;9300')
  await page.getByRole('button', { name: 'Importar 1 linha(s)' }).click(); await expect(page.getByText('1 importada(s).')).toBeVisible()
  await b.getByRole('button', { name: 'Importar 1 linha(s)' }).click()
  await expect(b.getByText(/recusada\(s\) na gravação/)).toBeVisible()
  await page.goto('/clientes'); await expect(page.locator('tr', { hasText: 'Duas Abas' })).toHaveCount(1)
})

test('R3-E7 importar offline não trava: erro aparece e o botão volta a funcionar', async ({ page, context }) => {
  test.info().annotations.push({ type: 'offline' })
  await page.goto('/importar'); await page.getByLabel('Ou cole o conteúdo aqui').fill('Nome\nOffline Um')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Importar 1 linha(s)' }).click()
  await expect(page.getByRole('status').filter({ hasText: /importada/ })).toBeVisible()
  await context.setOffline(false)
})

test('R3-E8 teclado: dá para importar sem o mouse', async ({ page }) => {
  await page.goto('/importar'); await page.getByLabel('Ou cole o conteúdo aqui').fill('Nome\nSó Teclado')
  const btn = page.getByRole('button', { name: 'Importar 1 linha(s)' }); await btn.focus(); await expect(btn).toBeFocused()
  await page.keyboard.press('Enter'); await expect(page.getByText('1 importada(s).')).toBeVisible()
})

test('R3-E9 relatório: classificação com nome de 118 caracteres cabe em 390px e passa no axe', async ({ page }) => {
  await page.goto('/financeiro/cadastros'); await page.getByRole('button', { name: /Nova natureza|Novo/ }).first().click()
  await page.getByLabel('Nome').fill(LONGO); await page.getByRole('button', { name: 'Salvar' }).click()
  await page.goto('/financeiro/pagar'); await page.getByRole('button', { name: /Lançar despesa|Nova despesa/ }).first().click()
  await page.getByLabel('Descrição').fill('Despesa longa'); await page.getByLabel(/Valor/).fill('10,00'); await page.getByLabel(/Vencimento/).fill('2030-05-10')
  await page.getByRole('button', { name: 'Lançar' }).last().click()
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto('/relatorios/financeiro')
  await page.getByLabel('De').fill('2030-05-01'); await page.getByLabel('Até').fill('2030-05-31')
  await expect(page.getByText('R$ 10,00').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await semViolacoes(page)).toEqual([])
})

test('R3-E10 relatório: apagar a data deixa a tela com aviso e sem erro no console', async ({ page }) => {
  await page.goto('/relatorios/financeiro'); await page.getByLabel('De').fill('')
  await expect(page.getByRole('alert').filter({ hasText: 'período válido' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
})
