'use client'
import { useState } from 'react'
import { Badge, Button, Card, DataTable, ErrorState, Field, Modal, PageHeader, SkeletonRows, useAsync, useToast, MsgErro } from '@/components/ui'
import { atualizarLocal, criarLocal, listLocais } from '@/lib/db'
import type { Local } from '@/lib/types'

export default function Locais() {
  const toast = useToast(); const r = useAsync(() => listLocais())
  const [alvo, setAlvo] = useState<Local | 'novo' | null>(null); const [nome, setNome] = useState(''); const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const abrir = (l: Local | 'novo') => { setAlvo(l); setNome(l === 'novo' ? '' : l.nome); setAtivo(l === 'novo' ? true : l.ativo); setErro(null) }
  async function salvar() {
    setErro(null); setLoading(true)
    try {
      if (alvo === 'novo') { await criarLocal({ nome }); toast('ok', 'Local criado.') } else { await atualizarLocal((alvo as Local).id, { nome, ativo }); toast('ok', 'Local atualizado.') }
      setAlvo(null); r.reload()
    } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  return (
    <>
      <PageHeader title="Locais de estoque" subtitle="Depósitos, filiais ou prateleiras onde o saldo fica guardado." actions={<Button onClick={() => abrir('novo')}>Novo local</Button>} />
      {r.loading ? <SkeletonRows rows={3} /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : (
        <DataTable caption="Locais de estoque" rows={r.data!} cols={[
          { key: 'n', header: 'Nome', render: l => <span className="font-medium">{l.nome}</span> },
          { key: 'p', header: 'Uso', hideOnMobile: true, render: l => l.padrao ? 'Padrão dos pedidos' : '—' },
          { key: 's', header: 'Situação', render: l => <Badge kind={l.ativo ? 'ativo' : 'inativo'} /> },
          { key: 'x', header: '', align: 'right', render: l => <Button size="sm" variant="secondary" onClick={() => abrir(l)} aria-label={`Editar ${l.nome}`}>Editar</Button> },
        ]} />
      )}
      <Card className="mt-4 max-w-xl text-sm text-text-muted">Um pedido baixa o estoque do local escolhido nele (o padrão, se você não escolher). Para mover saldo entre locais, use “Transferir” na tela de estoque.</Card>
      <Modal open={!!alvo} title={alvo === 'novo' ? 'Novo local' : 'Editar local'} onClose={() => setAlvo(null)} footer={<><Button variant="secondary" onClick={() => setAlvo(null)}>Voltar</Button><Button loading={loading} onClick={salvar}>Salvar</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          <Field label="Nome" value={nome} onChange={e => setNome(e.target.value)} />
          {alvo !== 'novo' && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={ativo} onChange={e => setAtivo(e.target.checked)} />Local ativo</label>}
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
    </>
  )
}
