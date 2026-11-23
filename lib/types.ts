export type Cliente = { id: string; codigo: number; nome: string; documento: string; email: string; bloqueado: boolean; ativo: boolean; tabelaPrecoId?: string }
export type Produto = { id: string; codigo: number; descricao: string; grupo: string; unidade: string; precoCentavos: number; controlaEstoque: boolean; ativo: boolean }
export type Local = { id: string; nome: string; ativo: boolean; padrao: boolean }
export type TabelaPreco = { id: string; nome: string; precos: Record<string, number> }
export type Vendedor = { id: string; nome: string; ativo: boolean; comissaoBps?: number }
export type Natureza = { id: string; nome: string; tipo: 'receita' | 'despesa' }
export type Centro = { id: string; nome: string }
export type ContaBancaria = { id: string; nome: string; banco: string }
export type TipoPagamento = { id: string; nome: string; parcelas: number; diasEntre: number }
export type Empresa = { nome: string; cnpj: string }
export type Classificacao = { naturezaId?: string; centroId?: string; contaId?: string; tipoPagamentoId?: string }
export type AuxTabela = 'naturezas' | 'centros_resultado' | 'contas_bancarias' | 'tipos_pagamento'
export type Movimento = { id: string; produtoId: string; localId: string; tipo: 'entrada' | 'saida' | 'ajuste' | 'estorno'; quantidade: number; origem: string; motivo?: string; em: string }
export type PedidoStatus = 'rascunho' | 'confirmado' | 'faturado' | 'cancelado'
export type ItemPedido = { produtoId: string; quantidade: number; precoCentavos: number; descontoCentavos: number }
export type Pedido = {
  id: string; numero: number; clienteId: string; status: PedidoStatus; itens: ItemPedido[]
  totalCentavos: number; observacao?: string; notaId?: string; localId: string; vendedorId?: string
  parcelas: number; diasEntre: number; criadoEm: string; motivoCancelamento?: string
}
export type Nota = { id: string; numero: number; serie: number; pedidoId: string; tipo: 'venda'; status: 'emitida' | 'cancelada'; totalCentavos: number; impostosCentavos: number; emitidaEm: string }
export type Baixa = { id: string; valorCentavos: number; jurosCentavos: number; em: string; estornadaEm?: string }
export type FinStatus = 'aberto' | 'parcial' | 'baixado' | 'cancelado'
export type Financeiro = {
  id: string; tipo: 'receita' | 'despesa'; descricao: string; clienteId?: string; notaId?: string; pedidoId?: string
  parcela: number; totalParcelas: number; valorCentavos: number; vencimento: string; status: FinStatus; baixas: Baixa[]
} & Classificacao
export type DB = {
  clientes: Cliente[]; produtos: Produto[]; locais: Local[]; tabelas: TabelaPreco[]; movimentos: Movimento[]; pedidos: Pedido[]; notas: Nota[]; financeiros: Financeiro[]
  vendedores?: Vendedor[]; naturezas?: Natureza[]; centros?: Centro[]; contas?: ContaBancaria[]; tiposPagamento?: TipoPagamento[]; empresa?: Empresa
  seq: { cliente: number; produto: number; pedido: number; nota: number; id: number }
}
export type Dashboard = { vendasMesCentavos: number; receberVencidoCentavos: number; itensSemSaldo: number; pedidosAbertos: number }
