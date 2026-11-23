'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Field } from '@/components/ui'
import { supabase } from '@/lib/supabase/client'
import { msgAuth } from '@/lib/auth-msg'

export default function RedefinirSenha() {
  const router = useRouter(); const [s1, setS1] = useState(''); const [s2, setS2] = useState(''); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null)
    if (s1.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (s1 !== s2) return setErro('As senhas não conferem.')
    setLoading(true)
    const { error } = await supabase().auth.updateUser({ password: s1 })
    setLoading(false)
    if (error) return setErro(msgAuth(error.message))
    router.push('/'); router.refresh()
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form onSubmit={salvar} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-md">
        <h1 className="text-xl">Nova senha</h1>
        <Field label="Nova senha" type="password" autoComplete="new-password" help="Mínimo de 8 caracteres." value={s1} onChange={e => setS1(e.target.value)} />
        <Field label="Repita a nova senha" type="password" autoComplete="new-password" value={s2} onChange={e => setS2(e.target.value)} error={erro} />
        <Button type="submit" loading={loading}>Salvar nova senha</Button>
      </form>
    </main>
  )
}
