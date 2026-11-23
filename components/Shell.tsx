'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, Boxes, FileText, Menu, Moon, Package, Receipt, ShoppingCart, Sun, Tags, Warehouse, UserCheck, Building2, Upload, Download, Percent, HelpCircle, Users, Wallet, X, RotateCcw } from 'lucide-react'
import { ToastProvider } from './ui'
import { resetDemo, temEmpresa } from '@/lib/db'
import { MODO_REAL } from '@/lib/modo'
import { useRouter } from 'next/navigation'

const NAV = [
  { grupo: 'Geral', itens: [{ href: '/', rotulo: 'Início', icon: BarChart3 }] },
  { grupo: 'Vendas', itens: [{ href: '/pedidos', rotulo: 'Pedidos', icon: ShoppingCart }, { href: '/notas', rotulo: 'Notas fiscais', icon: FileText }, { href: '/tabelas-preco', rotulo: 'Tabelas de preço', icon: Tags }, { href: '/relatorios/comissao', rotulo: 'Comissões', icon: Percent }] },
  { grupo: 'Estoque', itens: [{ href: '/estoque', rotulo: 'Saldos e movimentos', icon: Boxes }, { href: '/estoque/locais', rotulo: 'Locais', icon: Warehouse }] },
  { grupo: 'Financeiro', itens: [{ href: '/financeiro/receber', rotulo: 'A receber', icon: Wallet }, { href: '/financeiro/pagar', rotulo: 'A pagar', icon: Receipt }, { href: '/financeiro/cadastros', rotulo: 'Classificações', icon: Tags }, { href: '/relatorios/financeiro', rotulo: 'Relatório', icon: BarChart3 }] },
  { grupo: 'Cadastros', itens: [{ href: '/clientes', rotulo: 'Clientes', icon: Users }, { href: '/produtos', rotulo: 'Produtos', icon: Package }, { href: '/vendedores', rotulo: 'Vendedores', icon: UserCheck }, { href: '/empresa', rotulo: 'Empresa', icon: Building2 }, { href: '/importar', rotulo: 'Importar', icon: Upload }, { href: '/exportar', rotulo: 'Exportar dados', icon: Download }, { href: '/ajuda', rotulo: 'Ajuda', icon: HelpCircle }] },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [dark, setDark] = useState(false)
  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    const s = localStorage.getItem('erp-tema'); const d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(d)
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  const SEM_MOLDURA = ['/login', '/esqueci-senha', '/redefinir-senha', '/onboarding']
  useEffect(() => {
    if (!MODO_REAL || SEM_MOLDURA.includes(path)) return
    temEmpresa().then(t => { if (!t) router.replace('/onboarding') }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  if (SEM_MOLDURA.includes(path)) return <ToastProvider>{children}</ToastProvider>
  const ativo = (h: string) => (h === '/' ? path === '/' : h === '/estoque' ? path === '/estoque' : path.startsWith(h))

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-4 p-3">
      {NAV.map(g => (
        <div key={g.grupo}>
          <p className="px-3 pb-1 text-xs font-medium text-text-muted">{g.grupo}</p>
          {g.itens.map(i => (
            <Link key={i.href} href={i.href} aria-current={ativo(i.href) ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 ${ativo(i.href) ? 'bg-accent-soft font-semibold text-on-accent-soft' : 'text-text hover:bg-surface-2'}`}>
              <i.icon className="h-4 w-4" aria-hidden />{i.rotulo}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
  return (
    <ToastProvider>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-2">Pular para o conteúdo</a>
      <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b border-border bg-surface px-4">
        <button className="rounded-md p-2 hover:bg-surface-2 lg:hidden" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link href="/" className="text-lg font-semibold">ERP Acadêmico</Link>
        <span className="hidden rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-on-warning-soft sm:inline">{MODO_REAL ? 'Protótipo — use dados fictícios' : 'Protótipo — dados fictícios (demonstração)'}</span>
        <div className="ml-auto flex items-center gap-1">
          {MODO_REAL ? <Link href="/conta" className="rounded-md px-2 py-2 text-xs text-text-muted hover:bg-surface-2">Minha conta</Link> : (
            <button aria-label="Restaurar exemplo" className="flex items-center gap-1 rounded-md px-2 py-2 text-xs text-text-muted hover:bg-surface-2" onClick={() => { if (confirm('Restaurar os dados de exemplo? As alterações feitas serão perdidas.')) resetDemo() }}>
              <RotateCcw className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Restaurar exemplo</span>
            </button>)}
          <button className="rounded-md p-2 hover:bg-surface-2" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => { setDark(d => { localStorage.setItem('erp-tema', d ? 'light' : 'dark'); return !d }) }}>
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-header hidden h-[calc(100vh-theme(spacing.header))] w-sidebar shrink-0 overflow-y-auto border-r border-border bg-surface lg:block">{nav}</aside>
        {open && <div className="fixed inset-x-0 bottom-0 top-header z-20 overflow-y-auto bg-surface lg:hidden">{nav}</div>}
        <main id="conteudo" className="min-w-0 flex-1 p-4 md:p-6"><div className="mx-auto max-w-content">{children}</div></main>
      </div>
    </ToastProvider>
  )
}
