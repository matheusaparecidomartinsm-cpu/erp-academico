import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', timeout: 30_000, fullyParallel: true, workers: 4, reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] } },
  webServer: { command: 'npx next start -p 3100', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 60_000 },
})
