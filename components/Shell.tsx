'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, Boxes, FileText, Menu, Moon, Package, Receipt, ShoppingCart, Sun, Tags, Warehouse, UserCheck, Building2, Upload, Download, Percent, HelpCircle, Users, Wallet, X, RotateCcw } from 'lucide-react'
import { ToastProvider } from './ui'
import { resetDemo, temEmpresa } from '@/lib/db'
import { MODO_REAL } from '@/lib/modo'
import { useRouter } from 'next/navigation'
import { LogOut, UserCircle } from 'lucide-react'
import { Marca } from './Marca'
import { supabase } from '@/lib/supabase/client'
import { limparCache } from '@/lib/db-supabase'
import { usuarioDeEmail } from '@/lib/usuario'

const NAV = [
  { grupo: 'Geral', itens: [{ href: '/', rotulo: 'Início', icon: BarChart3 }] },
  { grupo: 'Vendas', itens: [{ href: '/pedidos', rotulo: 'Pedidos', icon: ShoppingCart }, { href: '/notas', rotulo: 'Notas fiscais', icon: FileText }, { href: '/tabelas-preco', rotulo: 'Tabelas de preço', icon: Tags }, { href: '/relatorios/comissao', rotulo: 'Comissões', icon: Percent }] },
  { grupo: 'Estoque', itens: [{ href: '/estoque', rotulo: 'Saldos e movimentos', icon: Boxes }, { href: '/estoque/locais', rotulo: 'Locais', icon: Warehouse }] },
  { grupo: 'Financeiro', itens: [{ href: '/financeiro/receber', rotulo: 'A receber', icon: Wallet }, { href: '/financeiro/pagar', rotulo: 'A pagar', icon: Receipt }, { href: '/financeiro/cadastros', rotulo: 'Classificações', icon: Tags }, { href: '/relatorios/financeiro', rotulo: 'Relatório', icon: BarChart3 }] },
  { grupo: 'Cadastros', itens: [{ href: '/clientes', rotulo: 'Clientes', icon: Users }, { href: '/produtos', rotulo: 'Produtos', icon: Package }, { href: '/vendedores', rotulo: 'Vendedores', icon: UserCheck }, { href: '/empresa', rotulo: 'Empresa', icon: Building2 }, { href: '/importar', rotulo: 'Importar', icon: Upload }, { href: '/exportar', rotulo: 'Exportar dados', icon: Download }, { href: '/ajuda', rotulo: 'Ajuda', icon: HelpCircle }] },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [dark, setDark] = useState(false)
  const [quem, setQuem] = useState<{ nome: string; papel: string }>({ nome: 'Demonstração', papel: 'Administrador' })
  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    const s = localStorage.getItem('erp-tema'); const d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(d)
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => {
    if (!MODO_REAL) return
    ;(async () => {
      try {
        const { data } = await supabase().auth.getUser(); const u = data.user; if (!u) return
        const m = await supabase().from('org_members').select('papel').eq('user_id', u.id).limit(1).maybeSingle()
        const nomes: Record<string, string> = { admin: 'Administrador', vendedor: 'Vendedor', financeiro: 'Financeiro', estoquista: 'Estoquista' }
        setQuem({ nome: usuarioDeEmail(u.email ?? ''), papel: nomes[(m.data as { papel?: string } | null)?.papel ?? ''] ?? '' })
      } catch { /* sem papel: mostra só o nome */ }
    })()
  }, [])
  async function sair() { if (MODO_REAL) { await supabase().auth.signOut({ scope: 'local' }); limparCache() } router.push('/login'); router.refresh() }
  const SEM_MOLDURA = ['/login', '/esqueci-senha', '/redefinir-senha', '/onboarding']
  useEffect(() => {
    if (!MODO_REAL || SEM_MOLDURA.includes(path)) return
    temEmpresa().then(t => { if (!t) router.replace('/onboarding') }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  if (SEM_MOLDURA.includes(path)) return <ToastProvider>{children}</ToastProvider>
  const ativo = (h: string) => (h === '/' ? path === '/' : h === '/estoque' ? path === '/estoque' : path.startsWith(h))

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-5 px-3 pb-6 pt-2">
      {NAV.map(g => (
        <div key={g.grupo}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-on-hero-muted">{g.grupo}</p>
          {g.itens.map(i => (
            <Link key={i.href} href={i.href} aria-current={ativo(i.href) ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-fast ${ativo(i.href) ? 'bg-hero-active font-semibold text-on-hero' : 'text-on-hero-muted hover:bg-hero-hover hover:text-on-hero'}`}>
              <i.icon className="h-4 w-4" aria-hidden />{i.rotulo}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
  const marca = (
    <Link href="/" className="flex flex-col items-center gap-2 px-5 pb-4 pt-6 text-on-hero">
      <Marca className="text-on-hero" />
      <span className="text-center text-xs text-on-hero-muted">Vendas, estoque e financeiro conectados.</span>
    </Link>
  )
  const usuario = (
    <div className="shrink-0 border-t border-hero-line/40 p-4">
      <p className="text-xs text-on-hero-muted">Logado como</p>
      <p className="mt-1 flex items-center gap-1 font-semibold text-on-hero"><UserCircle className="h-4 w-4" aria-hidden /><span className="truncate">{quem.nome || '—'}</span></p>
      {quem.papel && <span className="mt-1 inline-block rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-on-warning-soft">{quem.papel}</span>}
      <button onClick={sair} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-on-hero-muted/60 text-sm font-semibold text-on-hero hover:bg-hero-hover"><LogOut className="h-4 w-4" aria-hidden />Sair</button>
    </div>
  )
  return (
    <ToastProvider>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-2">Pular para o conteúdo</a>
      <div className="lg:flex">
        <aside className="hidden w-sidebar shrink-0 lg:block">
          <div className="sticky top-0 flex h-screen flex-col overflow-hidden bg-hero bg-gradient-to-b from-hero to-hero-2">{marca}<div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>{usuario}</div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b border-border bg-surface px-4">
            <button className="rounded-md p-2 hover:bg-surface-2 lg:hidden" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(o => !o)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" className="lg:hidden"><Marca className="text-text" /></Link>
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
          {open && <div className="fixed inset-x-0 bottom-0 top-header z-20 overflow-y-auto bg-hero bg-gradient-to-b from-hero to-hero-2 lg:hidden"><div className="flex min-h-full flex-col">{nav}{usuario}</div></div>}
          <main id="conteudo" className="p-4 md:p-8"><div className="mx-auto max-w-content">{children}</div></main>
        </div>
      </div>
    </ToastProvider>
  )
}
