'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Field, Modal, PageHeader, SelectField, SkeletonRows, useAsync, useToast, MsgErro } from '@/components/ui'
import { cancelarPedido, confirmarPedido, definirVendedorPedido, faturarPedido, getCliente, getPedido, listFinanceiros, listProdutos, listTiposPagamento, listVendedores, totalItem, vencido } from '@/lib/db'
import { brl, dataBR, qtdFmt } from '@/lib/money'
import { addDiasPublic } from '@/lib/datas'

export default function PedidoDetalhe() {
  const { id } = useParams<{ id: string }>(); const toast = useToast()
  const ped = useAsync(() => getPedido(id), [id]); const prods = useAsync(() => listProdutos())
  const cli = useAsync(async () => (ped.data ? getCliente(ped.data.clienteId) : null), [ped.data?.clienteId])
  const fins = useAsync(() => listFinanceiros('receita')); const vends = useAsync(() => listVendedores()); const tipos = useAsync(() => listTiposPagamento())
  const [wizard, setWizard] = useState(0) // 0 fechado; 1..3 passos
  const [parc, setParc] = useState('1'); const [dias, setDias] = useState('30'); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const [cancelando, setCancelando] = useState(false); const [motivo, setMotivo] = useState('')

  if (ped.loading) return <SkeletonRows />
  if (ped.error) return <ErrorState message={ped.error} onRetry={ped.reload} />
  const p = ped.data
  if (!p) return <EmptyState title="Pedido não encontrado" text="Ele pode ter sido removido ou o link está incorreto." action={<Link className="font-semibold text-accent underline" href="/pedidos">Voltar aos pedidos</Link>} />
  const prod = (pid: string) => prods.data?.find(x => x.id === pid)
  const parcelas = fins.data?.filter(f => f.pedidoId === p.id) ?? []
  const n = Math.max(1, parseInt(parc) || 1); const d = Math.max(0, parseInt(dias) || 0)
  const sim = Array.from({ length: Math.min(n, 12) }, (_, i) => { const base = Math.floor(p.totalCentavos / n); const resto = p.totalCentavos - base * n; return { id: String(i), k: i + 1, valor: base + (i + 1 === n ? resto : 0), venc: addDiasPublic(d * (i + 1)) } })
  const faltaSaldo = p.itens.filter(i => { const x = prod(i.produtoId); return x?.controlaEstoque && (x.saldos[p.localId] ?? 0) < i.quantidade })

  async function acao(fn: () => Promise<unknown>, ok: string) {
    setLoading(true); setErro(null)
    try { await fn(); toast('ok', ok); return true } catch (e) { const m = (e as Error).message; setErro(m); toast('erro', m); return false } finally { setLoading(false) }
  }
  const passos = ['Conferir itens', 'Pagamento', 'Revisar e emitir']
  return (
    <>
      <PageHeader title={`Pedido ${p.numero}`} subtitle={`Cliente: ${cli.data?.nome ?? '…'} · criado em ${new Date(p.criadoEm).toLocaleDateString('pt-BR')}`}
        actions={<>
          {p.status === 'rascunho' && <Button loading={loading} onClick={() => acao(() => confirmarPedido(p.id), 'Pedido confirmado.')}>Confirmar pedido</Button>}
          {p.status === 'rascunho' && <Link href={`/pedidos/${p.id}/editar`}><Button variant="secondary">Alterar pedido</Button></Link>}
          {p.status === 'confirmado' && <Button onClick={() => { setWizard(1); setErro(null) }}>Faturar</Button>}
          {(p.status === 'rascunho' || p.status === 'confirmado' || p.status === 'faturado') && <Button variant="danger" onClick={() => { setCancelando(true); setErro(null); setMotivo('') }}>Cancelar pedido</Button>}
        </>} />
      <div className="mb-4 flex flex-wrap items-end gap-3"><Badge kind={p.status} />{p.motivoCancelamento && <span className="text-text-muted">Motivo: {p.motivoCancelamento}</span>}
        {p.status !== 'cancelado' && <div className="w-56"><SelectField label="Vendedor" value={p.vendedorId ?? ''} onChange={e => acao(async () => { await definirVendedorPedido(p.id, e.target.value || null); ped.reload() }, 'Vendedor atualizado.')}>
          <option value="">Sem vendedor</option>{(vends.data ?? []).filter(v => v.ativo || v.id === p.vendedorId).map(v => <option key={v.id} value={v.id}>{v.nome}{v.ativo ? '' : ' (inativo)'}</option>)}</SelectField></div>}</div>
      {erro && !wizard && !cancelando && <MsgErro className="mb-3 font-medium text-danger" texto={erro} />}
      {p.status === 'rascunho' && cli.data?.bloqueado && <p role="alert" className="mb-3 font-medium text-danger">Este cliente está bloqueado: não será possível confirmar o pedido.</p>}
      <DataTable caption="Itens do pedido" rows={p.itens.map((i, ix) => ({ ...i, id: String(ix) }))} footer={<tr className="border-t border-border bg-surface-2 font-semibold"><td className="h-11 px-3" colSpan={3}>Total</td><td className="px-3 text-right tabular-nums">{brl(p.totalCentavos)}</td></tr>} cols={[
        { key: 'p', header: 'Produto', render: i => prod(i.produtoId)?.descricao ?? i.produtoId },
        { key: 'q', header: 'Qtd.', align: 'right', render: i => `${qtdFmt(i.quantidade)} ${prod(i.produtoId)?.unidade ?? ''}` },
        { key: 'u', header: 'Preço unit.', align: 'right', hideOnMobile: true, render: i => brl(i.precoCentavos) },
        { key: 't', header: 'Total', align: 'right', render: i => brl(totalItem(i)) },
      ]} />
      {p.status === 'faturado' && (<>
        <h2 className="mb-2 mt-6 text-md font-semibold">Parcelas a receber</h2>
        <DataTable caption="Parcelas do pedido" rows={parcelas} cols={[
          { key: 'k', header: 'Parcela', render: f => `${f.parcela}/${f.totalParcelas}` },
          { key: 'v', header: 'Vencimento', render: f => dataBR(f.vencimento) },
          { key: 'a', header: 'Valor', align: 'right', render: f => brl(f.valorCentavos) },
          { key: 's', header: 'Situação', render: f => <Badge kind={vencido(f) ? 'vencido' : f.status} /> },
        ]} />
        <p className="mt-2 text-text-muted">Nota fiscal simulada emitida. <Link className="text-accent underline" href="/notas">Ver notas</Link> · <Link className="text-accent underline" href="/financeiro/receber">Ir para contas a receber</Link></p>
      </>)}

      <Modal open={wizard > 0} title={`Faturar pedido ${p.numero}`} onClose={() => setWizard(0)} footer={
        <>
          <Button variant="secondary" onClick={() => (wizard === 1 ? setWizard(0) : setWizard(wizard - 1))}>{wizard === 1 ? 'Fechar' : 'Voltar'}</Button>
          {wizard < 3 ? <Button disabled={wizard === 1 && faltaSaldo.length > 0} onClick={() => setWizard(wizard + 1)}>Continuar</Button>
            : <Button loading={loading} onClick={async () => { if (await acao(() => faturarPedido(p.id, n, d), `Pedido ${p.numero} faturado.`)) setWizard(0) }}>Emitir nota</Button>}
        </>}>
        <ol className="mb-4 flex gap-2 text-xs font-semibold" aria-label="Passos">
          {passos.map((t, i) => <li key={t} aria-current={wizard === i + 1 ? 'step' : undefined} className={`flex flex-1 items-center gap-1 rounded-md px-2 py-2 ${wizard === i + 1 ? 'bg-accent text-on-accent' : wizard > i + 1 ? 'bg-success-soft text-on-success-soft' : 'bg-surface-2 text-text'}`}>{wizard > i + 1 && <Check className="h-3 w-3" aria-hidden />}{i + 1}. {t}</li>)}
        </ol>
        <div className="text-text">
          {wizard === 1 && (faltaSaldo.length ? <div role="alert" className="text-danger"><p className="font-semibold">Falta estoque:</p><ul className="ml-4 list-disc">{faltaSaldo.map(i => <li key={i.produtoId}>{prod(i.produtoId)?.descricao}: saldo {qtdFmt(prod(i.produtoId)!.saldo)}, pedido {qtdFmt(i.quantidade)}</li>)}</ul><p className="mt-2 text-text-muted">Ajuste o estoque em Estoque e tente de novo.</p></div>
            : <p>Todos os {p.itens.length} item(ns) têm saldo suficiente. Total do pedido: <strong>{brl(p.totalCentavos)}</strong>.</p>)}
          {wizard === 2 && <div className="grid grid-cols-2 gap-3">{(tipos.data?.length ?? 0) > 0 && <div className="col-span-2"><SelectField label="Tipo de pagamento (preenche as parcelas)" value="" onChange={e => { const t = tipos.data?.find(x => x.id === e.target.value); if (t) { setParc(String(t.parcelas)); setDias(String(t.diasEntre)) } }}><option value="">Escolher…</option>{tipos.data!.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</SelectField></div>}<SelectField label="Parcelas" value={parc} onChange={e => setParc(e.target.value)}>{[1, 2, 3, 4, 5, 6, 10, 12].map(x => <option key={x} value={x}>{x}x</option>)}</SelectField><Field label="Dias entre parcelas" inputMode="numeric" value={dias} onChange={e => setDias(e.target.value)} /></div>}
          {wizard === 3 && <div><p className="mb-2">Serão geradas {n} parcela(s) a receber e a saída de estoque dos itens:</p><ul className="mb-2">{sim.map(s => <li key={s.id} className="tabular-nums">{s.k}/{n} · {dataBR(s.venc)} · {brl(s.valor)}</li>)}</ul><p className="text-xs text-text-muted">A nota é simulada, sem validade fiscal.</p></div>}
          {erro && wizard > 0 && <MsgErro className="mt-3 text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>

      <Modal open={cancelando} title={`Cancelar pedido ${p.numero}?`} onClose={() => setCancelando(false)} footer={
        <><Button variant="secondary" onClick={() => setCancelando(false)}>Voltar</Button><Button variant="danger" loading={loading} onClick={async () => { if (await acao(() => cancelarPedido(p.id, motivo), `Pedido ${p.numero} cancelado.`)) setCancelando(false) }}>Cancelar pedido</Button></>}>
        <p className="mb-3">{p.status === 'faturado' ? 'A nota será cancelada, o estoque devolvido e as parcelas canceladas. Isso não pode ser desfeito.' : 'O pedido deixa de valer. Isso não pode ser desfeito.'}</p>
        <div className="text-text"><Field label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} />{erro && cancelando && <MsgErro className="mt-2 text-sm font-medium text-danger" texto={erro} />}</div>
      </Modal>
    </>
  )
}
