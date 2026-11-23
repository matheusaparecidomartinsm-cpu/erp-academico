'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Field } from '@/components/ui'
import { MODO_REAL } from '@/lib/modo'
import { supabase } from '@/lib/supabase/client'
import { msgAuth } from '@/lib/auth-msg'
import { emailDeUsuario, validaUsuario } from '@/lib/usuario'

export default function Login() {
  const router = useRouter()
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [usuario, setUsuario] = useState(''); const [senha, setSenha] = useState('')
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
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form onSubmit={enviar} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-md">
        <div>
          <h1 className="text-xl">{modo === 'entrar' ? 'Entrar no ERP Acadêmico' : 'Criar conta'}</h1>
          <p className="mt-1 text-text-muted">{MODO_REAL ? 'Protótipo de faculdade. Use dados fictícios.' : 'Modo demonstração: qualquer usuário (3+ letras) e senha de 4+ caracteres funcionam.'}</p>
        </div>
        <Field label="Usuário" autoComplete="username" autoCapitalize="none" spellCheck={false} value={usuario} onChange={e => setUsuario(e.target.value)} />
        <Field label="Senha" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} help={modo === 'criar' ? 'Mínimo de 8 caracteres.' : undefined}
          value={senha} onChange={e => setSenha(e.target.value)} error={erro} />
        {aviso && <p role="status" className="rounded-md bg-success-soft p-3 text-on-success-soft">{aviso}</p>}
        <Button type="submit" loading={carregando}>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</Button>
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
