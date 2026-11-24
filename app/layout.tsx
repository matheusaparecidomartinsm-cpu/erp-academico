import './globals.css'
import type { Metadata } from 'next'
import Shell from '@/components/Shell'

export const metadata: Metadata = { title: 'Nexo', description: 'Nexo: vendas, estoque e financeiro conectados. Protótipo acadêmico com dados fictícios.' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR"><body><Shell>{children}</Shell></body></html>
  )
}
