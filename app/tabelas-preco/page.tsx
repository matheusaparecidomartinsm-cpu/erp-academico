'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Button, DataTable, EmptyState, ErrorState, Field, Modal, PageHeader, SkeletonRows, useAsync, useToast, MsgErro } from '@/components/ui'
import { criarTabelaPreco, listClientes, listTabelasPreco } from '@/lib/db'

export default function TabelasPreco() {
  const toast = useToast(); const r = useAsync(() => listTabelasPreco()); const cl = useAsync(() => listClientes())
  const [novo, setNovo] = useState(false); const [nome, setNome] = useState(''); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  async function criar() {
    setErro(null); setLoading(true)
    try { await criarTabelaPreco({ nome }); toast('ok', 'Tabela criada.'); setNovo(false); setNome(''); r.reload() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  const abrir = () => { setErro(null); setNome(''); setNovo(true) }
  return (
    <>
      <PageHeader title="Tabelas de preço" subtitle="Preços diferentes por tipo de cliente, como atacado ou varejo." actions={<Button onClick={abrir}>Nova tabela</Button>} />
      {r.loading ? <SkeletonRows rows={3} /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.data!.length === 0 ? (
        <EmptyState title="Nenhuma tabela de preço" text="Sem tabela, os pedidos usam o preço do cadastro do produto." action={<Button onClick={abrir}>Nova tabela</Button>} />
      ) : (
        <DataTable caption="Tabelas de preço" rows={r.data!} cols={[
          { key: 'n', header: 'Nome', render: t => <Link className="font-medium text-accent underline-offset-2 hover:underline" href={`/tabelas-preco/${t.id}`}>{t.nome}</Link> },
          { key: 'p', header: 'Produtos com preço', align: 'right', render: t => Object.keys(t.precos).length },
          { key: 'c', header: 'Clientes', align: 'right', hideOnMobile: true, render: t => cl.data?.filter(c => c.tabelaPrecoId === t.id).length ?? '…' },
        ]} />
      )}
      <Modal open={novo} title="Nova tabela de preço" onClose={() => setNovo(false)} footer={<><Button variant="secondary" onClick={() => setNovo(false)}>Voltar</Button><Button loading={loading} onClick={criar}>Criar tabela</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          <Field label="Nome" value={nome} onChange={e => setNome(e.target.value)} />
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
    </>
  )
}
