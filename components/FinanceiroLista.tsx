'use client'
import { useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Field, Modal, PageHeader, SelectField, SkeletonRows, useAsync, useToast, MsgErro } from './ui'
import { baixarFinanceiro, classificarFinanceiro, estornarBaixa, lancarDespesa, lancarReceita, listCentros, listClientes, listContas, listFinanceiros, listNaturezas, listTiposPagamento, pagoDe, vencido } from '@/lib/db'
import type { Financeiro } from '@/lib/types'
import { brl, dataBR, parseMoney } from '@/lib/money'

export function FinanceiroLista({ tipo }: { tipo: 'receita' | 'despesa' }) {
  const receber = tipo === 'receita'; const toast = useToast()
  const [filtro, setFiltro] = useState<'abertos' | 'quitados' | 'todos'>('abertos')
  const r = useAsync(() => listFinanceiros(tipo), [tipo]); const cl = useAsync(() => listClientes())
  const [alvo, setAlvo] = useState<Financeiro | null>(null); const [valor, setValor] = useState(''); const [juros, setJuros] = useState(''); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const [novo, setNovo] = useState(false); const [nd, setNd] = useState({ descricao: '', valor: '', venc: '', cliente: '' })
  const nats = useAsync(() => listNaturezas()); const cens = useAsync(() => listCentros()); const ctas = useAsync(() => listContas()); const tips = useAsync(() => listTiposPagamento())
  const [classif, setClassif] = useState<Financeiro | null>(null); const [cv, setCv] = useState({ nat: '', cen: '', con: '', tip: '' })
  const abrirClassif = (f: Financeiro) => { setClassif(f); setCv({ nat: f.naturezaId ?? '', cen: f.centroId ?? '', con: f.contaId ?? '', tip: f.tipoPagamentoId ?? '' }); setErro(null) }
  async function salvarClassif() {
    setLoading(true); setErro(null)
    try { await classificarFinanceiro(classif!.id, { naturezaId: cv.nat, centroId: cv.cen, contaId: cv.con, tipoPagamentoId: cv.tip }); toast('ok', 'Classificação salva.'); setClassif(null); r.reload() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  const nomeDe = (lista: { id: string; nome: string }[] | undefined, id?: string) => lista?.find(x => x.id === id)?.nome
  const [estorno, setEstorno] = useState<string | null>(null)   // id do lançamento cujas baixas estão abertas no modal
  const fEstorno = r.data?.find(f => f.id === estorno)
  const linhas = (r.data ?? []).filter(f => filtro === 'todos' || (filtro === 'quitados' ? f.status === 'baixado' : f.status === 'aberto' || f.status === 'parcial'))
  const aberto = (f: Financeiro) => f.valorCentavos - pagoDe(f)
  const totalAberto = linhas.filter(f => f.status === 'aberto' || f.status === 'parcial').reduce((s, f) => s + aberto(f), 0)
  const abrirBaixa = (f: Financeiro) => { setAlvo(f); setValor((aberto(f) / 100).toFixed(2).replace('.', ',')); setJuros(''); setErro(null) }
  async function baixar() {
    const v = parseMoney(valor); if (v === null) return setErro('Informe o valor, por exemplo 100,00.')
    const j = juros.trim() ? parseMoney(juros) : 0; if (j === null) return setErro('Juros inválidos.')
    setLoading(true)
    try { await baixarFinanceiro(alvo!.id, v, j); toast('ok', receber ? 'Recebimento registrado.' : 'Pagamento registrado.'); setAlvo(null) } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  async function lancar() {
    const v = parseMoney(nd.valor); if (v === null) return setErro('Informe o valor, por exemplo 100,00.')
    setLoading(true)
    try {
      if (receber) await lancarReceita({ clienteId: nd.cliente || undefined, descricao: nd.descricao, valorCentavos: v, vencimento: nd.venc })
      else await lancarDespesa({ descricao: nd.descricao, valorCentavos: v, vencimento: nd.venc })
      toast('ok', receber ? 'Receita lançada.' : 'Despesa lançada.'); setNovo(false); setNd({ descricao: '', valor: '', venc: '', cliente: '' })
    } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  async function estornar(bid: string) {
    setLoading(true); setErro(null)
    try { await estornarBaixa(estorno!, bid); toast('ok', 'Baixa estornada. O valor voltou para o saldo em aberto.') } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  const nome = (f: Financeiro) => f.clienteId ? cl.data?.find(c => c.id === f.clienteId)?.nome ?? '' : ''
  return (
    <>
      <PageHeader title={receber ? 'Contas a receber' : 'Contas a pagar'} subtitle={receber ? 'Parcelas geradas pelas vendas faturadas.' : 'Despesas da empresa.'}
        actions={<Button onClick={() => { setErro(null); setNovo(true) }}>{receber ? 'Lançar receita' : 'Lançar despesa'}</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filtro">
        <Button size="sm" variant={filtro === 'abertos' ? 'primary' : 'secondary'} aria-pressed={filtro === 'abertos'} onClick={() => setFiltro('abertos')}>Em aberto</Button>
        <Button size="sm" variant={filtro === 'quitados' ? 'primary' : 'secondary'} aria-pressed={filtro === 'quitados'} onClick={() => setFiltro('quitados')}>Quitados</Button>
        <Button size="sm" variant={filtro === 'todos' ? 'primary' : 'secondary'} aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Button>
      </div>
      {r.loading ? <SkeletonRows /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : linhas.length === 0 ? (
        <Card><EmptyState title={receber ? 'Nada a receber' : 'Nenhuma despesa'} text={filtro === 'abertos' ? 'Não há lançamentos em aberto.' : filtro === 'quitados' ? 'Nenhum lançamento quitado ainda. Quando uma parcela for paga por inteiro, ela aparece aqui.' : 'Ainda não há lançamentos.'} /></Card>
      ) : (
        <DataTable caption={receber ? 'Contas a receber' : 'Contas a pagar'} rows={linhas} footer={<tr className="border-t border-border bg-surface-2 font-semibold"><td className="h-11 px-3" colSpan={receber ? 3 : 2}>Total em aberto</td><td className="px-3 text-right tabular-nums">{brl(totalAberto)}</td><td colSpan={2} /></tr>} cols={[
          { key: 'd', header: 'Descrição', render: f => <><span className="font-medium">{f.descricao}</span>{(f.naturezaId || f.centroId) && <span className="block text-xs text-text-muted">{[nomeDe(nats.data, f.naturezaId), nomeDe(cens.data, f.centroId)].filter(Boolean).join(' · ')}</span>}{f.totalParcelas > 1 && <span className="text-text-muted"> · {f.parcela}/{f.totalParcelas}</span>}</> },
          ...(receber ? [{ key: 'c', header: 'Cliente', hideOnMobile: true, render: (f: Financeiro) => nome(f) }] : []),
          { key: 'v', header: 'Vencimento', render: f => dataBR(f.vencimento) },
          { key: 'a', header: 'Em aberto', align: 'right' as const, render: f => f.status === 'cancelado' ? '—' : brl(aberto(f)) },
          { key: 's', header: 'Situação', render: f => <Badge kind={vencido(f) ? 'vencido' : f.status} /> },
          { key: 'x', header: '', align: 'right' as const, render: f => <span className="inline-flex gap-1">
            {(f.status === 'aberto' || f.status === 'parcial') && <Button size="sm" variant="secondary" onClick={() => abrirBaixa(f)} aria-label={`${receber ? 'Receber' : 'Pagar'}: ${f.descricao}`}>{receber ? 'Receber' : 'Pagar'}</Button>}
            {f.status !== 'cancelado' && <Button size="sm" variant="ghost" onClick={() => abrirClassif(f)} aria-label={`Classificar: ${f.descricao}`}>Classificar</Button>}
            {f.status !== 'cancelado' && f.baixas.length > 0 && <Button size="sm" variant="ghost" onClick={() => { setErro(null); setEstorno(f.id) }} aria-label={`Ver baixas e estornar: ${f.descricao}`}>Baixas</Button>}
          </span> },
        ]} />
      )}
      <Modal open={!!alvo} title={receber ? 'Registrar recebimento' : 'Registrar pagamento'} onClose={() => setAlvo(null)} footer={<><Button variant="secondary" onClick={() => setAlvo(null)}>Voltar</Button><Button loading={loading} onClick={baixar}>Confirmar</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          <p className="text-text-muted">{alvo?.descricao} — em aberto {alvo ? brl(aberto(alvo)) : ''}. Valor menor que o saldo gera baixa parcial.</p>
          <Field label="Valor" inputMode="decimal" suffix="R$" value={valor} onChange={e => setValor(e.target.value)} />
          <Field label="Juros (opcional)" inputMode="decimal" suffix="R$" value={juros} onChange={e => setJuros(e.target.value)} />
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
 <Modal open={!!classif} title="Classificar lançamento" onClose={() => setClassif(null)} footer={<><Button variant="secondary" onClick={() => setClassif(null)}>Voltar</Button><Button loading={loading} onClick={salvarClassif}>Salvar</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          <p className="text-text-muted">{classif?.descricao}</p>
          <SelectField label="Natureza" value={cv.nat} onChange={e => setCv({ ...cv, nat: e.target.value })}><option value="">Sem natureza</option>{(nats.data ?? []).filter(n => n.tipo === tipo).map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}</SelectField>
          <SelectField label="Centro de resultado" value={cv.cen} onChange={e => setCv({ ...cv, cen: e.target.value })}><option value="">Sem centro</option>{(cens.data ?? []).map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}</SelectField>
          <SelectField label="Conta bancária" value={cv.con} onChange={e => setCv({ ...cv, con: e.target.value })}><option value="">Sem conta</option>{(ctas.data ?? []).map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}</SelectField>
          <SelectField label="Tipo de pagamento" value={cv.tip} onChange={e => setCv({ ...cv, tip: e.target.value })}><option value="">Sem tipo</option>{(tips.data ?? []).map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}</SelectField>
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
      <Modal open={!!fEstorno} title="Baixas do lançamento" onClose={() => setEstorno(null)} footer={<Button variant="secondary" onClick={() => setEstorno(null)}>Fechar</Button>}>
        <div className="flex flex-col gap-3 text-text">
          <p className="text-text-muted">{fEstorno?.descricao}. Estornar devolve o valor ao saldo em aberto; o histórico fica registrado.</p>
          <ul className="flex flex-col gap-2">
            {fEstorno?.baixas.map(b => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                <span className={b.estornadaEm ? 'text-text-muted line-through' : ''}>{new Date(b.em).toLocaleDateString('pt-BR')} · {brl(b.valorCentavos)}{b.jurosCentavos ? ` (+ ${brl(b.jurosCentavos)} de juros)` : ''}</span>
                {b.estornadaEm ? <span className="text-sm text-text-muted">Estornada</span> : <Button size="sm" variant="secondary" disabled={loading} onClick={() => estornar(b.id)} aria-label={`Estornar baixa de ${brl(b.valorCentavos)}`}>Estornar</Button>}
              </li>))}
          </ul>
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
      <Modal open={novo} title={receber ? 'Lançar receita' : 'Lançar despesa'} onClose={() => setNovo(false)} footer={<><Button variant="secondary" onClick={() => setNovo(false)}>Voltar</Button><Button loading={loading} onClick={lancar}>Lançar</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          <Field label="Descrição" value={nd.descricao} onChange={e => setNd({ ...nd, descricao: e.target.value })} />
          {receber && <SelectField label="Cliente (opcional)" value={nd.cliente} onChange={e => setNd({ ...nd, cliente: e.target.value })}><option value="">Sem cliente</option>{(cl.data ?? []).filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectField>}
          <Field label="Valor" inputMode="decimal" suffix="R$" value={nd.valor} onChange={e => setNd({ ...nd, valor: e.target.value })} />
          <Field label="Vencimento" type="date" value={nd.venc} onChange={e => setNd({ ...nd, venc: e.target.value })} />
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
    </>
  )
}
