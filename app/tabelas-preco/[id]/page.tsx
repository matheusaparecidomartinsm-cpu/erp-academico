'use client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, SkeletonRows, useAsync, useToast, MsgErro } from '@/components/ui'
import { definirPreco, excluirTabelaPreco, listProdutos, listTabelasPreco, removerPreco } from '@/lib/db'
import { brl, parseMoney } from '@/lib/money'
import type { Produto, TabelaPreco } from '@/lib/types'

const fmt = (c: number) => (c / 100).toFixed(2).replace('.', ',')

function Linha({ tabela, produto, onMudou }: { tabela: TabelaPreco; produto: Produto; onMudou: () => void }) {
  const toast = useToast(); const atual = tabela.precos[produto.id]
  const [v, setV] = useState(atual !== undefined ? fmt(atual) : ''); const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  async function salvar() {
    const c = parseMoney(v); if (c === null) return setErro('Informe o preço, por exemplo 12,50.')
    setErro(null); setLoading(true)
    try { await definirPreco(tabela.id, produto.id, c); toast('ok', `Preço de ${produto.descricao} salvo.`); onMudou() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  async function remover() {
    setLoading(true)
    try { await removerPreco(tabela.id, produto.id); setV(''); toast('ok', 'Preço removido: volta ao preço do cadastro.'); onMudou() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="px-3 py-2 text-left font-medium">{produto.descricao}</th>
      <td className="px-3 py-2 text-right tabular-nums text-text-muted">{brl(produto.precoCentavos)}</td>
      <td className="px-3 py-2"><Field label={`Preço na tabela: ${produto.descricao}`} className="[&_label]:sr-only" inputMode="decimal" suffix="R$" placeholder="usa o cadastro" value={v} onChange={e => setV(e.target.value)} error={erro} /></td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <Button size="sm" loading={loading} onClick={salvar} aria-label={`Salvar preço de ${produto.descricao}`}>Salvar</Button>{' '}
        {atual !== undefined && <Button size="sm" variant="ghost" disabled={loading} onClick={remover} aria-label={`Remover preço de ${produto.descricao}`}>Remover</Button>}
      </td>
    </tr>
  )
}

export default function TabelaPrecoDetalhe() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const toast = useToast()
  const tb = useAsync(() => listTabelasPreco()); const pr = useAsync(() => listProdutos())
  const [excluir, setExcluir] = useState(false); const [erro, setErro] = useState<string | null>(null)
  if (tb.loading || pr.loading) return <SkeletonRows />
  if (tb.error || pr.error) return <ErrorState message={(tb.error ?? pr.error)!} onRetry={tb.reload} />
  const t = tb.data!.find(x => x.id === id)
  if (!t) return <EmptyState title="Tabela não encontrada" text="Ela pode ter sido excluída." action={<Link className="font-semibold text-accent underline" href="/tabelas-preco">Voltar às tabelas</Link>} />
  async function apagar() { try { await excluirTabelaPreco(t!.id); toast('ok', 'Tabela excluída.'); router.push('/tabelas-preco') } catch (e) { setErro((e as Error).message) } }
  return (
    <>
      <PageHeader title={t.nome} subtitle="Preço vazio significa que vale o preço do cadastro do produto." actions={<Button variant="danger" onClick={() => { setErro(null); setExcluir(true) }}>Excluir tabela</Button>} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left"><caption className="sr-only">Preços da tabela {t.nome}</caption>
          <thead><tr className="text-sm text-text-muted"><th scope="col" className="px-3 py-2">Produto</th><th scope="col" className="px-3 py-2 text-right">Preço do cadastro</th><th scope="col" className="px-3 py-2">Preço nesta tabela</th><th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{pr.data!.filter(p => p.ativo || t.precos[p.id] !== undefined).map(p => <Linha key={p.id + (t.precos[p.id] ?? '')} tabela={t} produto={p} onMudou={tb.reload} />)}</tbody>
        </table>
      </Card>
      <Modal open={excluir} title="Excluir tabela" onClose={() => setExcluir(false)} footer={<><Button variant="secondary" onClick={() => setExcluir(false)}>Voltar</Button><Button variant="danger" onClick={apagar}>Excluir</Button></>}>
        <div className="flex flex-col gap-2 text-text"><p>Os clientes que usam “{t.nome}” passam a usar o preço do cadastro do produto. Pedidos já feitos não mudam.</p>{erro && <MsgErro className="font-medium text-danger" texto={erro} />}</div>
      </Modal>
    </>
  )
}
