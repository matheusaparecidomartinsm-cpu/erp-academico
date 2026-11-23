'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, Field } from '@/components/ui'
import { criarEmpresa, temEmpresa } from '@/lib/db'

export default function Onboarding() {
  const router = useRouter(); const [nome, setNome] = useState(''); const [exemplo, setExemplo] = useState(true)
  const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  useEffect(() => { temEmpresa().then(t => { if (t) router.replace('/') }).catch(() => {}) }, [router])
  async function criar(e: React.FormEvent) {
    e.preventDefault(); setErro(null); setLoading(true)
    try { await criarEmpresa(nome, exemplo); router.replace('/'); router.refresh() } catch (err) { setErro((err as Error).message) } finally { setLoading(false) }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form onSubmit={criar} noValidate className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-md">
        <div><h1 className="text-xl">Crie sua empresa</h1><p className="mt-1 text-text-muted">Tudo no sistema pertence a uma empresa. Você será o administrador.</p></div>
        <Field label="Nome da empresa" value={nome} onChange={e => setNome(e.target.value)} error={erro} />
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4" checked={exemplo} onChange={e => setExemplo(e.target.checked)} />
          <span>Começar com dados de exemplo fictícios (clientes, produtos, estoque e alguns pedidos)</span></label>
        <Button type="submit" loading={loading}>Criar empresa</Button>
      </form>
    </main>
  )
}
