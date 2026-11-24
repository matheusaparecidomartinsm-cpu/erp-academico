'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { Marca } from '@/components/Marca'
import { Button } from '@/components/ui'
import { MODO_REAL } from '@/lib/modo'
import { supabase } from '@/lib/supabase/client'
import { msgAuth } from '@/lib/auth-msg'
import { emailDeUsuario, validaUsuario } from '@/lib/usuario'

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

  const campo = 'h-11 w-full rounded-md border border-border-input bg-surface px-3 text-text'
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-hero-active to-accent px-4 py-10">
      <form onSubmit={enviar} noValidate className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl bg-surface p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <Marca tamanho="lg" className="text-text" />
          <p className="text-sm text-accent">Vendas, estoque e financeiro conectados.</p>
          <h1 className="mt-2 text-sm font-normal text-text-muted">{modo === 'entrar' ? 'Entre com sua conta' : 'Crie sua conta'}</h1>
        </div>
        {!MODO_REAL && <p className="rounded-md bg-surface-2 p-2 text-center text-xs text-text-muted">Modo demonstração: qualquer usuário (3+ letras) e senha de 4+ caracteres funcionam.</p>}
        <div className="flex flex-col gap-1">
          <label htmlFor="usuario" className="text-sm font-semibold">Usuário</label>
          <input id="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} value={usuario} onChange={e => setUsuario(e.target.value)} className={campo} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="senha" className="text-sm font-semibold">Senha</label>
          <div className="relative">
            <input id="senha" type={ver ? 'text' : 'password'} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={e => setSenha(e.target.value)}
              aria-invalid={!!erro || undefined} aria-describedby={erro ? 'erro-login' : undefined} className={`${campo} pr-12`} />
            <button type="button" onClick={() => setVer(v => !v)} aria-pressed={ver} aria-label={ver ? 'Ocultar o que digitei' : 'Mostrar o que digitei'}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:text-text">
              {ver ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
          {modo === 'criar' && !erro && <p className="text-xs text-text-muted">Mínimo de 8 caracteres.</p>}
          {erro && <p id="erro-login" role="alert" className="flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="h-3 w-3" aria-hidden />{erro}</p>}
        </div>
        {aviso && <p role="status" className="rounded-md bg-success-soft p-3 text-on-success-soft">{aviso}</p>}
        <Button type="submit" loading={carregando} className="h-11 w-full"><LogIn className="h-4 w-4" aria-hidden />{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</Button>
        {MODO_REAL && (
          <div className="flex flex-col gap-2 text-center text-sm">
            <button type="button" className="text-accent underline" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(null); setAviso(null) }}>
              {modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
            </button>
            {modo === 'entrar' && <span className="text-text-muted">Esqueceu a senha? Crie outro usuário ou peça ao administrador do projeto.</span>}
          </div>
        )}
      </form>
    </main>
  )
}
