'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, User, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { MODO_REAL } from '@/lib/modo'
import { supabase } from '@/lib/supabase/client'
import { msgAuth } from '@/lib/auth-msg'
import { emailDeUsuario, validaUsuario } from '@/lib/usuario'

const campo = 'h-12 w-full rounded-md border border-border-input bg-surface-2 px-3 pt-4 text-text'
const rotulo = 'pointer-events-none absolute left-3 top-1.5 text-xs text-text-muted'

export default function Login() {
  const router = useRouter()
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [usuario, setUsuario] = useState(''); const [senha, setSenha] = useState(''); const [ver, setVer] = useState(false)
  const [erro, setErro] = useState<string | null>(null); const [aviso, setAviso] = useState<string | null>(null); const [carregando, setCarregando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(null); setAviso(null)
    const eU = validaUsuario(usuario); if (eU) return setErro(eU)
    if (modo === 'criar' && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (modo === 'entrar' && senha.length < 1) return setErro('Informe a senha.')
    setCarregando(true)
    try {
      if (!MODO_REAL) { if (senha.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres.'); router.push('/'); return }
      if (modo === 'entrar') {
        const { error } = await supabase().auth.signInWithPassword({ email: emailDeUsuario(usuario), password: senha })
        if (error) throw new Error(msgAuth(error.message))
        router.push('/'); router.refresh()
      } else {
        const { data, error } = await supabase().auth.signUp({ email: emailDeUsuario(usuario), password: senha })
        if (error) throw new Error(msgAuth(error.message))
        if (data.session) { router.push('/'); router.refresh() }
        else setAviso('Conta criada, mas o projeto ainda exige confirmação por e-mail e usuários não recebem e-mail. Desligue "Confirm email" no painel do Supabase.')
      }
    } catch (err) { setErro((err as Error).message) } finally { setCarregando(false) }
  }

  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,1fr)]">
      {/* Painel de apresentação: gráfico próprio, sem foto nem marca de terceiros */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-hero bg-gradient-to-br from-hero to-hero-2 px-6 py-8 text-on-hero sm:px-12 lg:py-14">
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full text-hero-line" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" fill="none">
          <g stroke="currentColor" strokeOpacity=".18">{[100, 200, 300, 400, 500].map(y => <line key={y} x1="0" x2="800" y1={y} y2={y} />)}</g>
          <g fill="currentColor">
            {[[430, 120], [520, 200], [610, 290], [700, 390]].map(([x, h], i) => <rect key={x} x={x} y={600 - h} width="56" height={h} rx="6" fillOpacity={0.14 + i * 0.08} />)}
          </g>
          <path d="M40 520 C 220 470, 330 500, 470 380 S 700 160, 790 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity=".4" />
          <path d="M600 600 L 800 400" stroke="currentColor" strokeWidth="2" strokeOpacity=".5" />
        </svg>
        <div className="relative flex items-center gap-3">
          <svg aria-hidden viewBox="0 0 32 32" className="h-9 w-9"><rect width="32" height="32" rx="7" className="fill-accent" /><path d="M9 10h14M9 16h14M9 22h8" className="stroke-on-accent" strokeWidth="3" strokeLinecap="round" /></svg>
          <span className="text-lg font-semibold">ERP Acadêmico</span>
        </div>
        <div className="relative my-10 max-w-xl lg:my-0">
          <h1 className="text-xl font-bold sm:text-2xl lg:text-[44px] lg:leading-[52px]">Vendas, estoque e financeiro no mesmo lugar.</h1>
          <p className="mt-4 text-md text-on-hero-muted">Do pedido ao recebimento, sem planilha solta: o saldo baixa na venda e o contas a receber nasce na nota.</p>
          <p className="mt-8 inline-flex rounded-full border border-hero-line px-4 py-2 text-sm text-on-hero-muted">Protótipo da disciplina de Engenharia de Requisitos</p>
        </div>
        <p className="relative hidden text-sm text-on-hero-muted lg:block">Dados fictícios. Nenhuma informação real deve ser cadastrada.</p>
      </section>

      <section className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8">
        <form onSubmit={enviar} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-lg">
          <div className="flex flex-col items-center gap-2 text-center">
            <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-2 text-text"><User className="h-8 w-8" /></span>
            <h2 className="text-lg">{modo === 'entrar' ? 'Bem-vindo(a)' : 'Criar conta'}</h2>
            <p className="text-text-muted">{MODO_REAL ? 'Entre com o seu usuário e a sua senha.' : 'Modo demonstração: qualquer usuário (3+ letras) e senha de 4+ caracteres funcionam.'}</p>
          </div>
          <div className="relative">
            <input id="usuario" aria-label="Usuário" placeholder=" " autoComplete="username" autoCapitalize="none" spellCheck={false} value={usuario} onChange={e => setUsuario(e.target.value)} className={campo} />
            <span aria-hidden className={rotulo}>Usuário</span>
          </div>
          <div>
            <div className="relative">
              <input id="senha" aria-label="Senha" type={ver ? 'text' : 'password'} placeholder=" " autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={e => setSenha(e.target.value)}
                aria-invalid={!!erro || undefined} aria-describedby={erro ? 'erro-login' : undefined} className={`${campo} pr-12`} />
              <span aria-hidden className={rotulo}>Senha</span>
              <button type="button" onClick={() => setVer(v => !v)} aria-pressed={ver} aria-label={ver ? 'Ocultar o que digitei' : 'Mostrar o que digitei'}
                className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:text-text">
                {ver ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </div>
            {modo === 'criar' && !erro && <p className="mt-1 text-xs text-text-muted">Mínimo de 8 caracteres.</p>}
            {erro && <p id="erro-login" role="alert" className="mt-1 flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="h-3 w-3" aria-hidden />{erro}</p>}
          </div>
          {aviso && <p role="status" className="rounded-md bg-success-soft p-3 text-on-success-soft">{aviso}</p>}
          <Button type="submit" loading={carregando} className="h-12 w-full">{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</Button>
          {MODO_REAL && (
            <div className="flex flex-col gap-2 text-center text-sm">
              <button type="button" className="text-accent underline" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(null); setAviso(null) }}>
                {modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
              </button>
              {modo === 'entrar' && <span className="text-text-muted">Esqueceu a senha? Crie outro usuário ou peça ao administrador do projeto.</span>}
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
