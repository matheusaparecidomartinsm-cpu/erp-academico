'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Field, Modal, PageHeader, SelectField, SkeletonRows, useAsync, useToast, MsgErro } from '@/components/ui'
import { ajustarEstoque, listLocais, listMovimentos, listProdutos, transferirEstoque } from '@/lib/db'
import { qtdFmt } from '@/lib/money'
import type { Movimento } from '@/lib/types'

export default function Estoque() {
  const toast = useToast(); const prods = useAsync(() => listProdutos()); const movs = useAsync(() => listMovimentos()); const locs = useAsync(() => listLocais())
  const [modo, setModo] = useState<'' | 'ajuste' | 'transferencia'>('')
  const [pid, setPid] = useState(''); const [qtd, setQtd] = useState(''); const [motivo, setMotivo] = useState(''); const [local, setLocal] = useState(''); const [destino, setDestino] = useState('')
  const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const nome = (id: string) => prods.data?.find(p => p.id === id)?.descricao ?? id
  const nomeLocal = (id: string) => locs.data?.find(l => l.id === id)?.nome ?? ''
  const ativos = (locs.data ?? []).filter(l => l.ativo); const varios = (locs.data ?? []).length > 1
  const padrao = ativos.find(l => l.padrao)?.id ?? ativos[0]?.id ?? ''
  const abrir = (m: 'ajuste' | 'transferencia') => { setErro(null); setPid(''); setQtd(''); setMotivo(''); setLocal(padrao); setDestino(''); setModo(m) }
  async function salvar() {
    setErro(null); const n = parseFloat(qtd.replace(',', '.'))
    if (!pid) return setErro('Escolha o produto.')
    if (modo === 'transferencia') {
      if (!local || !destino) return setErro('Escolha o local de origem e o de destino.')
      if (!Number.isFinite(n) || n <= 0) return setErro('Informe uma quantidade maior que zero.')
    } else if (!Number.isFinite(n) || n === 0) return setErro('Informe uma quantidade diferente de zero (use - para saída).')
    setLoading(true)
    try {
      if (modo === 'transferencia') { await transferirEstoque({ produtoId: pid, deLocalId: local, paraLocalId: destino, quantidade: n }); toast('ok', 'Transferência registrada.') }
      else { await ajustarEstoque({ produtoId: pid, quantidade: n, motivo, localId: local || undefined }); toast('ok', 'Ajuste registrado.') }
      setModo(''); setQtd(''); setMotivo('')
    } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  const controlados = (prods.data ?? []).filter(p => p.controlaEstoque)
  return (
    <>
      <PageHeader title="Estoque" subtitle="Saldo por produto e local, e histórico de movimentos."
        actions={<><Link href="/estoque/locais"><Button variant="secondary">Locais</Button></Link>{varios && <Button variant="secondary" onClick={() => abrir('transferencia')}>Transferir</Button>}<Button onClick={() => abrir('ajuste')}>Ajustar estoque</Button></>} />
      <h2 className="mb-2 text-md font-semibold">Saldos</h2>
      {prods.loading || locs.loading ? <SkeletonRows /> : prods.error || locs.error ? <ErrorState message={(prods.error ?? locs.error)!} onRetry={prods.reload} /> : (
        <DataTable caption="Saldo por produto" rows={controlados} cols={[
          { key: 'd', header: 'Produto', render: p => <span className="font-medium">{p.descricao}</span> },
          { key: 'u', header: 'Un.', hideOnMobile: true, render: p => p.unidade },
          ...(varios ? ativos.map(l => ({ key: 'l' + l.id, header: l.nome, align: 'right' as const, hideOnMobile: true, render: (p: typeof controlados[number]) => qtdFmt(p.saldos[l.id] ?? 0) })) : []),
          { key: 's', header: varios ? 'Total' : 'Saldo', align: 'right', render: p => qtdFmt(p.saldo) },
          { key: 'x', header: 'Situação', render: p => p.saldo <= 0 ? <Badge kind="semsaldo" /> : <Badge kind="ativo" /> },
        ]} />
      )}
      <h2 className="mb-2 mt-6 text-md font-semibold">Movimentos</h2>
      {movs.loading ? <SkeletonRows rows={4} /> : movs.data!.length === 0 ? <Card><EmptyState title="Sem movimentos" text="As entradas, saídas e ajustes aparecem aqui." /></Card> : (
        <DataTable caption="Histórico de movimentos" rows={movs.data!.slice(0, 30)} cols={[
          { key: 'e', header: 'Quando', render: m => new Date(m.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
          { key: 'p', header: 'Produto', render: m => nome(m.produtoId) },
          ...(varios ? [{ key: 'lo', header: 'Local', hideOnMobile: true, render: (m: Movimento) => nomeLocal(m.localId) }] : []),
          { key: 't', header: 'Tipo', hideOnMobile: true, render: m => ({ entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', estorno: 'Estorno' })[m.tipo] },
          { key: 'q', header: 'Qtd.', align: 'right', render: m => (m.quantidade > 0 ? '+' : '') + qtdFmt(m.quantidade) },
          { key: 'o', header: 'Origem', hideOnMobile: true, render: m => m.motivo ?? m.origem },
        ]} />
      )}
      <Modal open={!!modo} title={modo === 'transferencia' ? 'Transferir entre locais' : 'Ajustar estoque'} onClose={() => setModo('')} footer={<><Button variant="secondary" onClick={() => setModo('')}>Voltar</Button><Button loading={loading} onClick={salvar}>{modo === 'transferencia' ? 'Transferir' : 'Registrar ajuste'}</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          <SelectField label="Produto" value={pid} onChange={e => setPid(e.target.value)}><option value="">Escolha…</option>{controlados.filter(p => p.ativo || p.id === pid).map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}</SelectField>
          {(varios || modo === 'transferencia') && <SelectField label={modo === 'transferencia' ? 'De (origem)' : 'Local'} value={local} onChange={e => setLocal(e.target.value)}>{modo === 'transferencia' && <option value="">Escolha…</option>}{ativos.map(l => <option key={l.id} value={l.id}>{l.nome}{pid ? ` — saldo ${qtdFmt(prods.data?.find(p => p.id === pid)?.saldos[l.id] ?? 0)}` : ''}</option>)}</SelectField>}
          {modo === 'transferencia' && <SelectField label="Para (destino)" value={destino} onChange={e => setDestino(e.target.value)}><option value="">Escolha…</option>{ativos.filter(l => l.id !== local).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelectField>}
          <Field label="Quantidade" help={modo === 'transferencia' ? undefined : 'Positiva entra, negativa sai.'} inputMode="decimal" value={qtd} onChange={e => setQtd(e.target.value)} />
          {modo === 'ajuste' && <Field label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} />}
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
    </>
  )
}
