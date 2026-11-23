'use client'
import { useEffect, useState } from 'react'
import { Button, Card, ErrorState, Field, PageHeader, SkeletonRows, useAsync, useToast, MsgErro } from '@/components/ui'
import { atualizarEmpresa, getEmpresa } from '@/lib/db'

export default function Empresa() {
  const toast = useToast(); const r = useAsync(() => getEmpresa())
  const [nome, setNome] = useState(''); const [cnpj, setCnpj] = useState(''); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  useEffect(() => { if (r.data) { setNome(r.data.nome); setCnpj(r.data.cnpj) } }, [r.data])
  async function salvar() {
    setErro(null); setLoading(true)
    try { await atualizarEmpresa({ nome, cnpj }); toast('ok', 'Dados da empresa salvos.'); r.reload() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  return (
    <>
      <PageHeader title="Empresa" subtitle="Dados da sua empresa. Este protótipo trabalha com uma empresa por conta." />
      {r.loading ? <SkeletonRows rows={2} /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : (
        <Card className="flex max-w-xl flex-col gap-3 text-text">
          <Field label="Nome da empresa" value={nome} onChange={e => setNome(e.target.value)} />
          <Field label="CNPJ" help="Opcional; 14 dígitos." inputMode="numeric" value={cnpj} onChange={e => setCnpj(e.target.value)} />
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
          <div><Button loading={loading} onClick={salvar}>Salvar</Button></div>
        </Card>
      )}
    </>
  )
}
