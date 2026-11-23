'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Button, Field } from '@/components/ui'
import { supabase } from '@/lib/supabase/client'
import { msgAuth } from '@/lib/auth-msg'

export default function EsqueciSenha() {
  const [email, setEmail] = useState(''); const [erro, setErro] = useState<string | null>(null); const [ok, setOk] = useState(false); const [loading, setLoading] = useState(false)
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErro('Informe um e-mail válido.')
    setLoading(true)
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha` })
    setLoading(false)
    if (error && /rate limit/i.test(error.message)) return setErro(msgAuth(error.message))
    setOk(true)   // mesma resposta exista ou não a conta (não revela quem tem cadastro)
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form onSubmit={enviar} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-md">
        <h1 className="text-xl">Redefinir senha</h1>
        {ok ? <p role="status" className="rounded-md bg-success-soft p-3 text-on-success-soft">Se este e-mail tiver cadastro, você vai receber um link para criar uma nova senha.</p> : <>
          <p className="text-text-muted">Informe o e-mail da conta e enviaremos um link.</p>
          <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} error={erro} />
          <Button type="submit" loading={loading}>Enviar link</Button></>}
        <Link href="/login" className="text-center text-sm text-accent underline">Voltar para entrar</Link>
      </form>
    </main>
  )
}
