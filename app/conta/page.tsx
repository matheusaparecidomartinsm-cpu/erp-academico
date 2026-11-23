'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, Card, Field, PageHeader } from '@/components/ui'
import { MODO_REAL } from '@/lib/modo'
import { supabase } from '@/lib/supabase/client'
import { limparCache } from '@/lib/db-supabase'

export default function Conta() {
  const router = useRouter(); const [email, setEmail] = useState('')
  const [conf, setConf] = useState(''); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  useEffect(() => { if (MODO_REAL) supabase().auth.getUser().then(r => setEmail(r.data.user?.email ?? '')) }, [])
  async function sair() { await supabase().auth.signOut({ scope: 'global' }); limparCache(); router.push('/login'); router.refresh() }
  async function excluir(e: React.FormEvent) {
    e.preventDefault(); setErro(null)
    if (conf !== 'EXCLUIR') return setErro('Digite EXCLUIR (em maiúsculas) para confirmar.')
    setLoading(true)
    try {
      const r = await fetch('/api/conta/excluir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmacao: conf }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.erro ?? 'Não foi possível excluir a conta.')
      await supabase().auth.signOut({ scope: 'local' }); limparCache(); router.push('/login'); router.refresh()
    } catch (err) { setErro((err as Error).message) } finally { setLoading(false) }
  }
  if (!MODO_REAL) return <><PageHeader title="Conta" /><Card>No modo demonstração não há conta. Configure o Supabase para usar login de verdade.</Card></>
  return (
    <>
      <PageHeader title="Minha conta" subtitle={email} />
      <Card className="mb-4 max-w-xl"><h2 className="mb-2 text-md font-semibold">Sair</h2><p className="mb-3 text-text-muted">Encerra a sessão em todos os aparelhos.</p><Button variant="secondary" onClick={sair}>Sair de todos os aparelhos</Button></Card>
      <Card className="max-w-xl">
        <h2 className="mb-2 text-md font-semibold text-danger">Excluir minha conta</h2>
        <p className="mb-3 text-text-muted">Apaga seu login e, se você for a única pessoa da empresa, todos os dados dela (clientes, produtos, pedidos, notas e financeiro). Não dá para desfazer.</p>
        <form onSubmit={excluir} noValidate className="flex flex-col gap-3">
          <Field label='Digite EXCLUIR para confirmar' value={conf} onChange={e => setConf(e.target.value)} error={erro} />
          <div><Button type="submit" variant="danger" loading={loading}>Excluir conta e dados</Button></div>
        </form>
      </Card>
    </>
  )
}
