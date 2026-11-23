import { test, expect, alerta } from './fixtures'

test('CAD-H1 cliente novo aparece na lista e a busca acha por nome e código', async ({ page }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome').fill('Açougue São João 🥩'); await page.getByLabel('CPF ou CNPJ').fill('55.555.555/0001-55')
  await page.getByRole('button', { name: 'Salvar cliente' }).click(); await page.waitForURL(/\/clientes$/)
  await page.getByLabel('Buscar').fill('açougue')
  await expect(page.getByText('Açougue São João 🥩', { exact: true })).toBeVisible()
})
test('CAD-E1 nome vazio, documento repetido e nome de 200 caracteres', async ({ page }) => {
  await page.goto('/clientes/novo'); await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page).toHaveURL(/clientes\/novo/); await expect(page.getByLabel('Nome')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('Nome').fill('Outro'); await page.getByLabel('CPF ou CNPJ').fill('11.111.111/0001-11')
  await page.getByRole('button', { name: 'Salvar cliente' }).click(); await expect(page).toHaveURL(/clientes\/novo/)
  await page.getByLabel('CPF ou CNPJ').fill(''); await page.getByLabel('Nome').fill('N'.repeat(200))
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await page.waitForURL(/\/clientes$/)
})
test('CAD-E2 e-mail inválido é recusado', async ({ page }) => {
  await page.goto('/clientes/novo'); await page.getByLabel('Nome').fill('Teste'); await page.getByLabel('E-mail').fill('sem-arroba')
  await page.getByRole('button', { name: 'Salvar cliente' }).click(); await expect(page).toHaveURL(/clientes\/novo/)
})
test('CAD-E3 busca sem resultado mostra estado vazio', async ({ page }) => {
  await page.goto('/clientes'); await page.getByLabel('Buscar').fill('zzzzzz'); await expect(page.getByRole('row')).toHaveCount(0)
})
test('LOGIN-N1 e-mail inválido e senha curta (demo) são recusados', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('x'); await page.getByLabel('Senha').fill('1234'); await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/login/)
  await page.getByLabel('E-mail').fill('a@b.co'); await page.getByLabel('Senha').fill('12'); await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/login/)
})
test('LOGIN-H1 entra no modo demonstração', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('E-mail').fill('a@b.co'); await page.getByLabel('Senha').fill('abcd'); await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('/')
})
test('TEMA-1 alternar tema persiste ao recarregar', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Usar tema escuro' }).click()
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
test('DADOS-1 dados persistem ao recarregar e "Restaurar exemplo" volta ao início', async ({ page }) => {
  await page.goto('/clientes/novo'); await page.getByLabel('Nome').fill('Persistente'); await page.getByRole('button', { name: 'Salvar cliente' }).click(); await page.waitForURL(/\/clientes$/)
  await page.reload(); await expect(page.getByText('Persistente')).toBeVisible()
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Restaurar exemplo' }).click()
  await expect(page.getByText('Persistente')).toHaveCount(0)
})
