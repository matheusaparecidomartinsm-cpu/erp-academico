'use client'
import { useState } from 'react'
import { Button, Card, PageHeader, useToast, MsgErro } from '@/components/ui'
import { baixarCsv, type Celula } from '@/lib/csv'
import { listClientes, listFinanceiros, listMovimentos, listPedidos, listProdutos, pagoDe } from '@/lib/db'

const reais = (c: number) => c / 100
const CONJUNTOS: { id: string; titulo: string; texto: string; gerar: () => Promise<Celula[][]> }[] = [
  { id: 'clientes', titulo: 'Clientes', texto: 'Código, nome, documento, e-mail e situação.', gerar: async () => [['Código', 'Nome', 'Documento', 'E-mail', 'Bloqueado', 'Ativo'], ...(await listClientes()).map(c => [c.codigo, c.nome, c.documento, c.email, c.bloqueado ? 'sim' : 'não', c.ativo ? 'sim' : 'não'])] },
  { id: 'produtos', titulo: 'Produtos', texto: 'Descrição, grupo, unidade, preço e saldo.', gerar: async () => [['Código', 'Descrição', 'Grupo', 'Unidade', 'Preço', 'Controla estoque', 'Saldo', 'Ativo'], ...(await listProdutos()).map(p => [p.codigo, p.descricao, p.grupo, p.unidade, reais(p.precoCentavos), p.controlaEstoque ? 'sim' : 'não', p.controlaEstoque ? p.saldo : null, p.ativo ? 'sim' : 'não'])] },
  { id: 'pedidos', titulo: 'Pedidos', texto: 'Uma linha por pedido, com status e total.', gerar: async () => [['Número', 'Status', 'Cliente (id)', 'Total', 'Criado em', 'Observação'], ...(await listPedidos()).map(p => [p.numero, p.status, p.clienteId, reais(p.totalCentavos), p.criadoEm.slice(0, 10), p.observacao ?? ''])] },
  { id: 'estoque', titulo: 'Movimentos de estoque', texto: 'Entradas, saídas, ajustes e estornos.', gerar: async () => [['Data', 'Produto (id)', 'Tipo', 'Quantidade', 'Origem', 'Motivo'], ...(await listMovimentos()).map(m => [m.em.slice(0, 10), m.produtoId, m.tipo, m.quantidade, m.origem, m.motivo ?? ''])] },
  { id: 'financeiro', titulo: 'Financeiro (a receber e a pagar)', texto: 'Parcelas, vencimento, valor, recebido ou pago e status.', gerar: async () => [['Tipo', 'Descrição', 'Parcela', 'Vencimento', 'Valor', 'Pago ou recebido', 'Status'], ...[...await listFinanceiros('receita'), ...await listFinanceiros('despesa')].map(f => [f.tipo === 'receita' ? 'receber' : 'pagar', f.descricao, `${f.parcela}/${f.totalParcelas}`, f.vencimento, reais(f.valorCentavos), reais(pagoDe(f)), f.status])] },
]

export default function Exportar() {
  const toast = useToast(); const [ocupado, setOcupado] = useState<string | null>(null); const [erro, setErro] = useState<string | null>(null)
  async function baixar(c: typeof CONJUNTOS[number]) {
    if (ocupado) return
    setOcupado(c.id); setErro(null)
    try { baixarCsv(`${c.id}.csv`, await c.gerar()); toast('ok', `Arquivo ${c.id}.csv gerado.`) } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) }
  }
  return (
    <>
      <PageHeader title="Exportar meus dados" subtitle="Seus dados são seus: baixe quando quiser, sem custo. Os arquivos abrem no Excel e no Planilhas." />
      {erro && <MsgErro className="mb-3 font-medium text-danger" texto={erro} />}
      <ul className="grid max-w-3xl gap-3">
        {CONJUNTOS.map(c => (
          <li key={c.id}><Card className="flex items-center justify-between gap-3 text-text">
            <div><h2 className="text-md font-semibold">{c.titulo}</h2><p className="text-sm text-text-muted">{c.texto}</p></div>
            <Button variant="secondary" loading={ocupado === c.id} onClick={() => baixar(c)} aria-label={`Baixar ${c.titulo}`}>Baixar CSV</Button>
          </Card></li>
        ))}
      </ul>
    </>
  )
}
