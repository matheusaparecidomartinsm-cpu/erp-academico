'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, ErrorState, Field, PageHeader, SelectField, SkeletonRows, useAsync, useToast, MsgErro } from './ui'
import { atualizarPedido, confirmarPedido, criarPedido, listClientes, listLocais, listProdutos, listTabelasPreco } from '@/lib/db'
import type { Pedido } from '@/lib/types'
import { brl, parseMoney, parseQtd, qtdFmt } from '@/lib/money'

type Linha = { key: number; produtoId: string; qtd: string; preco: string; desc: string }
let k = 1
const nova = (): Linha => ({ key: k++, produtoId: '', qtd: '1', preco: '', desc: '' })
const fmt = (c: number) => (c / 100).toFixed(2).replace('.', ',')

/** Formulário de pedido: serve para criar e para alterar um pedido em rascunho. */
export function PedidoForm({ pedido }: { pedido?: Pedido }) {
  const router = useRouter(); const toast = useToast(); const editando = !!pedido
  const cl = useAsync(() => listClientes()); const pr = useAsync(() => listProdutos()); const lc = useAsync(() => listLocais()); const tb = useAsync(() => listTabelasPreco())
  const [clienteId, setClienteId] = useState(pedido?.clienteId ?? ''); const [obs, setObs] = useState(pedido?.observacao ?? '')
  const [localId, setLocalId] = useState(pedido?.localId ?? '')
  const [linhas, setLinhas] = useState<Linha[]>(() => pedido ? pedido.itens.map(i => ({ key: k++, produtoId: i.produtoId, qtd: String(i.quantidade).replace('.', ','), preco: fmt(i.precoCentavos), desc: i.descontoCentavos ? fmt(i.descontoCentavos) : '' })) : [nova()])
  const trava = useRef(false); const [erros, setErros] = useState<Record<string, string>>({}); const [salvando, setSalvando] = useState<'' | 'rascunho' | 'confirmar'>('')
  const upd = (key: number, p: Partial<Linha>) => setLinhas(ls => ls.map(l => l.key === key ? { ...l, ...p } : l))
  const prod = (id: string) => pr.data?.find(p => p.id === id)
  const locaisAtivos = (lc.data ?? []).filter(l => l.ativo)
  const localAtual = localId || locaisAtivos.find(l => l.padrao)?.id || locaisAtivos[0]?.id || ''

  /** Preço sugerido: o da tabela do cliente, se houver preço para o produto; senão o do cadastro. */
  function sugerido(cliente: string, produtoId: string): string {
    const p = prod(produtoId); if (!p) return ''
    const c = cl.data?.find(x => x.id === cliente); const t = c?.tabelaPrecoId ? tb.data?.find(x => x.id === c.tabelaPrecoId) : undefined
    return fmt(t?.precos[produtoId] ?? p.precoCentavos)
  }
  const escolher = (key: number, id: string) => upd(key, { produtoId: id, preco: sugerido(clienteId, id) })
  function trocarCliente(novoId: string) {
    // reaplica o preço sugerido nas linhas em que o usuário não mexeu no preço
    setLinhas(ls => ls.map(l => l.produtoId && l.preco === sugerido(clienteId, l.produtoId) ? { ...l, preco: sugerido(novoId, l.produtoId) } : l))
    setClienteId(novoId)
  }
  const totalLinha = (l: Linha) => { const q = parseQtd(l.qtd), p = parseMoney(l.preco), d = l.desc.trim() ? parseMoney(l.desc) : 0; return q && p !== null && d !== null ? Math.max(0, Math.round(q * p) - d) : 0 }
  const total = linhas.reduce((s, l) => s + totalLinha(l), 0)
  const tabelaDoCliente = (() => { const c = cl.data?.find(x => x.id === clienteId); return c?.tabelaPrecoId ? tb.data?.find(x => x.id === c.tabelaPrecoId)?.nome : undefined })()

  async function salvar(confirmar: boolean) {
    const er: Record<string, string> = {}
    if (!clienteId) er.cliente = 'Escolha o cliente.'
    const itens = linhas.map(l => ({ l, q: parseQtd(l.qtd), p: parseMoney(l.preco), d: l.desc.trim() ? parseMoney(l.desc) : 0 }))
    itens.forEach(({ l, q, p, d }) => {
      if (!l.produtoId) er['p' + l.key] = 'Escolha o produto.'
      else if (q === null) er['q' + l.key] = 'Quantidade inválida.'
      else if (p === null) er['v' + l.key] = 'Preço inválido.'
      else if (d === null) er['d' + l.key] = 'Desconto inválido.'
    })
    setErros(er); if (Object.keys(er).length) return
    if (trava.current) return; trava.current = true
    setSalvando(confirmar ? 'confirmar' : 'rascunho')
    try {
      const dados = { clienteId, observacao: obs, localId: localAtual || undefined, itens: itens.map(({ l, q, p, d }) => ({ produtoId: l.produtoId, quantidade: q!, precoCentavos: p!, descontoCentavos: d! })) }
      const ped = editando ? await atualizarPedido(pedido!.id, dados) : await criarPedido(dados)
      const num = pedido?.numero ?? ped.numero
      if (confirmar) { try { await confirmarPedido(ped.id); toast('ok', `Pedido ${num} ${editando ? 'alterado' : 'criado'} e confirmado.`) } catch (e) { toast('erro', `Pedido ${num} salvo como rascunho: ${(e as Error).message}`) } }
      else toast('ok', `Pedido ${num} ${editando ? 'alterado' : 'salvo como rascunho'}.`)
      router.push(`/pedidos/${ped.id}`)
    } catch (e) { trava.current = false; setErros({ geral: (e as Error).message }) } finally { setSalvando('') }
  }
  if (cl.loading || pr.loading || lc.loading || tb.loading) return <SkeletonRows />
  const falha = cl.error ?? pr.error ?? lc.error ?? tb.error
  if (falha) return <ErrorState message={falha} />
  return (
    <>
      <PageHeader title={editando ? `Alterar pedido ${pedido!.numero}` : 'Novo pedido'} subtitle={editando ? 'Só pedidos em rascunho podem ser alterados.' : 'Escolha o cliente e adicione os itens.'} />
      <Card className="mb-4"><div className="flex flex-wrap gap-4">
        <SelectField label="Cliente" className="min-w-64 max-w-md flex-1" value={clienteId} onChange={e => trocarCliente(e.target.value)} error={erros.cliente}>
          <option value="">Escolha o cliente…</option>{cl.data!.filter(c => c.ativo || c.id === clienteId).map(c => <option key={c.id} value={c.id}>{c.nome}{c.bloqueado ? ' (bloqueado)' : ''}</option>)}
        </SelectField>
        {locaisAtivos.length > 1 && <SelectField label="Sai do estoque" className="min-w-52" value={localAtual} onChange={e => setLocalId(e.target.value)}>
          {locaisAtivos.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </SelectField>}
      </div>
      {tabelaDoCliente && <p className="mt-2 text-sm text-text-muted">Preços sugeridos pela tabela “{tabelaDoCliente}”. Você pode ajustar cada linha.</p>}
      </Card>
      <Card className="mb-4">
        <h2 className="mb-3 text-md font-semibold">Itens</h2>
        <div className="flex flex-col gap-4">
          {linhas.map((l, i) => { const p = prod(l.produtoId); return (
            <fieldset key={l.key} className="grid grid-cols-2 items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0 md:grid-cols-12">
              <legend className="sr-only">Item {i + 1}</legend>
              <SelectField label="Produto" className="col-span-2 md:col-span-4" value={l.produtoId} onChange={e => escolher(l.key, e.target.value)} error={erros['p' + l.key]}>
                <option value="">Escolha…</option>{pr.data!.filter(x => x.ativo || x.id === l.produtoId).map(x => <option key={x.id} value={x.id}>{x.descricao}</option>)}
              </SelectField>
              <Field label="Qtd." inputMode="decimal" className="md:col-span-2" help={p?.controlaEstoque ? `Saldo: ${qtdFmt(p.saldos[localAtual] ?? 0)} ${p.unidade}` : undefined} value={l.qtd} onChange={e => upd(l.key, { qtd: e.target.value })} error={erros['q' + l.key]} />
              <Field label="Preço unit." inputMode="decimal" suffix="R$" className="md:col-span-2" value={l.preco} onChange={e => upd(l.key, { preco: e.target.value })} error={erros['v' + l.key]} />
              <Field label="Desconto" inputMode="decimal" suffix="R$" className="md:col-span-2" value={l.desc} onChange={e => upd(l.key, { desc: e.target.value })} error={erros['d' + l.key]} />
              <div className="col-span-2 flex items-end justify-between gap-2 md:col-span-2 md:flex-col md:items-end">
                <div className="text-right"><p className="text-xs text-text-muted">Total do item</p><p className="font-semibold tabular-nums">{brl(totalLinha(l))}</p></div>
                {linhas.length > 1 && <Button size="sm" variant="ghost" aria-label={`Remover item ${i + 1}`} onClick={() => setLinhas(ls => ls.filter(x => x.key !== l.key))}><Trash2 className="h-4 w-4" aria-hidden />Remover</Button>}
              </div>
            </fieldset>) })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={() => setLinhas(ls => [...ls, nova()])}><Plus className="h-4 w-4" aria-hidden />Adicionar item</Button>
          <p className="text-lg font-semibold tabular-nums">Total: {brl(total)}</p>
        </div>
      </Card>
      <Card className="mb-4"><Field label="Observação (opcional)" value={obs} onChange={e => setObs(e.target.value)} /></Card>
      {erros.geral && <MsgErro className="mb-3 font-medium text-danger" texto={erros.geral} />}
      <div className="flex flex-wrap gap-2">
        <Button loading={salvando === 'confirmar'} disabled={!!salvando} onClick={() => salvar(true)}>Salvar e confirmar</Button>
        <Button variant="secondary" loading={salvando === 'rascunho'} disabled={!!salvando} onClick={() => salvar(false)}>{editando ? 'Salvar alterações' : 'Salvar como rascunho'}</Button>
        <Button variant="ghost" onClick={() => router.push(editando ? `/pedidos/${pedido!.id}` : '/pedidos')}>Cancelar</Button>
      </div>
    </>
  )
}
