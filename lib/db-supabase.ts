import { MAX_CENTAVOS, MSG_LIMITE } from './money'
// Camada de dados REAL (Supabase). Mesmas funções e formatos da versão de demonstração (db-demo.ts).
// Regras de negócio e permissões ficam no banco (migrações em supabase/); aqui só chamamos e traduzimos.
import { supabase } from './supabase/client'
import type { AuxTabela, Baixa, Centro, Classificacao, Cliente, ContaBancaria, Dashboard, Empresa, Financeiro, ItemPedido, Local, Movimento, Natureza, Nota, Pedido, Produto, TabelaPreco, TipoPagamento, Vendedor } from './types'
import { hoje, mesLocal, pagoDe, totalItem, vencido } from './util'
export { hoje, pagoDe, totalItem, vencido }

export const SEM_EMPRESA = 'SEM_EMPRESA'

function traduz(msg: string): string {
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para esta ação.'
  if (/invalid input syntax for type uuid/i.test(msg)) return 'Registro não encontrado.'
  if (/JWT|not authenticated|Auth session missing/i.test(msg)) return 'Sua sessão expirou. Entre de novo.'
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return 'Sem conexão com o servidor. Tente de novo.'
  return msg
}
function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(traduz(r.error.message))
  return r.data as T
}

let orgCache: string | null = null
export async function orgId(): Promise<string> {
  if (orgCache) return orgCache
  const r = await supabase().from('org_members').select('org_id').limit(1)
  const rows = unwrap(r) as { org_id: string }[]
  if (!rows.length) throw new Error(SEM_EMPRESA)
  return (orgCache = rows[0].org_id)
}
export function limparCache() { orgCache = null }
const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('erp-changed')) }
async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await supabase().rpc(fn, args)
  const v = unwrap(r as { data: T | null; error: { message: string } | null }); changed(); return v
}

/* ---------- empresa ---------- */
export async function criarEmpresa(nome: string, comExemplo: boolean) { limparCache(); const id = await rpc<string>('criar_org', { p_nome: nome, p_exemplo: comExemplo }); orgCache = id; return id }
export async function temEmpresa(): Promise<boolean> {
  try { await orgId(); return true } catch (e) { if ((e as Error).message === SEM_EMPRESA) return false; throw e }
}

/* ---------- mapeadores ---------- */
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const cliente = (r: Row): Cliente => ({ id: r.id, codigo: r.codigo, nome: r.nome, documento: r.documento ?? '', email: r.email ?? '', bloqueado: r.bloqueado, ativo: r.ativo, tabelaPrecoId: r.tabela_preco_id ?? undefined })
const itemP = (r: Row): ItemPedido => ({ produtoId: r.produto_id, quantidade: Number(r.quantidade), precoCentavos: r.preco_unit_centavos, descontoCentavos: r.desconto_centavos })
const pedido = (r: Row): Pedido => ({
  id: r.id, numero: r.numero, clienteId: r.cliente_id, localId: r.local_id ?? '', status: r.status, itens: (r.pedido_itens ?? []).map(itemP), totalCentavos: r.total_centavos,
  vendedorId: r.vendedor_id ?? undefined, observacao: r.observacao ?? undefined, parcelas: r.parcelas, diasEntre: r.dias_entre, criadoEm: r.created_at, motivoCancelamento: r.motivo_cancelamento ?? undefined,
})
const nota = (r: Row): Nota => ({ id: r.id, numero: r.numero, serie: r.serie, pedidoId: r.pedido_id, tipo: 'venda', status: r.status, totalCentavos: r.total_centavos, impostosCentavos: r.impostos_centavos, emitidaEm: r.emitida_em })
const fin = (r: Row): Financeiro => ({
  id: r.id, tipo: r.tipo, descricao: r.descricao ?? '', clienteId: r.cliente_id ?? undefined, notaId: r.nota_id ?? undefined, pedidoId: r.pedido_id ?? undefined,
  naturezaId: r.natureza_id ?? undefined, centroId: r.centro_resultado_id ?? undefined, contaId: r.conta_bancaria_id ?? undefined, tipoPagamentoId: r.tipo_pagamento_id ?? undefined,
  parcela: r.parcela, totalParcelas: r.total_parcelas, valorCentavos: r.valor_centavos, vencimento: r.vencimento, status: r.status,
  baixas: (r.financeiro_baixas ?? []).map((b: Row): Baixa => ({ id: b.id, valorCentavos: b.valor_centavos, jurosCentavos: b.juros_centavos, em: b.baixado_em, estornadaEm: b.estornada_em ?? undefined })),
})

/* ---------- API pública (mesma da demo) ---------- */
export async function listClientes(q = ''): Promise<Cliente[]> {
  const rows = unwrap(await supabase().from('clientes').select('*').order('codigo').limit(2000)) as Row[]
  const t = q.trim().toLowerCase()
  return rows.map(cliente).filter(c => !t || c.nome.toLowerCase().includes(t) || c.documento.includes(t) || String(c.codigo) === t)
}
export async function getCliente(id: string) {
  const r = await supabase().from('clientes').select('*').eq('id', id).maybeSingle()
  if (r.error) return null
  return r.data ? cliente(r.data) : null
}
export async function criarCliente(i: { nome: string; documento: string; email: string }): Promise<Cliente> {
  return cliente(await rpc<Row>('criar_cliente', { p_org: await orgId(), p_nome: i.nome, p_documento: i.documento, p_email: i.email }))
}
export async function listProdutos(q = ''): Promise<(Produto & { saldo: number; saldos: Record<string, number> })[]> {
  const [p, s] = await Promise.all([
    supabase().from('produtos').select('*, grupos_produto(nome)').order('codigo').limit(2000),
    supabase().from('estoque_saldos').select('produto_id, saldo'),
  ])
  const prods = unwrap(p) as Row[]; const saldos = unwrap(s) as Row[]
  const mapa = new Map<string, number>(); const porLocal = new Map<string, Record<string, number>>()
  saldos.forEach(x => { mapa.set(x.produto_id, (mapa.get(x.produto_id) ?? 0) + Number(x.saldo)); porLocal.set(x.produto_id, { ...(porLocal.get(x.produto_id) ?? {}), [x.local_id]: Number(x.saldo) }) })
  const t = q.trim().toLowerCase()
  return prods.map(r => ({
    id: r.id, codigo: r.codigo, descricao: r.descricao, grupo: r.grupos_produto?.nome ?? 'Sem grupo', unidade: r.unidade, precoCentavos: r.preco_centavos,
    controlaEstoque: r.controla_estoque, ativo: r.ativo, saldo: Math.round((mapa.get(r.id) ?? 0) * 1000) / 1000, saldos: porLocal.get(r.id) ?? {},
  })).filter(p => !t || p.descricao.toLowerCase().includes(t) || String(p.codigo) === t || p.grupo.toLowerCase().includes(t))
}
export async function criarProduto(i: { descricao: string; grupo: string; unidade: string; precoCentavos: number; controlaEstoque: boolean }): Promise<Produto> {
  if (i.precoCentavos > MAX_CENTAVOS) throw new Error(MSG_LIMITE)
  const r = await rpc<Row>('criar_produto', { p_org: await orgId(), p_descricao: i.descricao, p_grupo: i.grupo, p_unidade: i.unidade, p_preco_centavos: i.precoCentavos, p_controla: i.controlaEstoque })
  return { id: r.id, codigo: r.codigo, descricao: r.descricao, grupo: i.grupo || 'Sem grupo', unidade: r.unidade, precoCentavos: r.preco_centavos, controlaEstoque: r.controla_estoque, ativo: r.ativo }
}
export async function ajustarEstoque(i: { produtoId: string; quantidade: number; motivo: string; localId?: string }) {
  await rpc('ajustar_estoque', { p_org: await orgId(), p_produto: i.produtoId, p_quantidade: i.quantidade, p_motivo: i.motivo, p_local: i.localId ?? null })
}
export async function listMovimentos(produtoId?: string): Promise<Movimento[]> {
  let q = supabase().from('estoque_movimentos').select('*').order('created_at', { ascending: false }).limit(200)
  if (produtoId) q = q.eq('produto_id', produtoId)
  return (unwrap(await q) as Row[]).map(r => ({ id: r.id, produtoId: r.produto_id, localId: r.local_id, tipo: r.tipo, quantidade: Number(r.quantidade), origem: r.origem_tipo ?? 'manual', motivo: r.motivo ?? undefined, em: r.created_at }))
}
export async function listPedidos(status?: string): Promise<Pedido[]> {
  let q = supabase().from('pedidos').select('*, pedido_itens(*)').order('numero', { ascending: false }).limit(500)
  if (status) q = q.eq('status', status)
  return (unwrap(await q) as Row[]).map(pedido)
}
export async function getPedido(id: string) {
  const r = await supabase().from('pedidos').select('*, pedido_itens(*)').eq('id', id).maybeSingle()
  if (r.error) return null
  return r.data ? pedido(r.data) : null
}
export async function criarPedido(i: { clienteId: string; itens: ItemPedido[]; observacao?: string; localId?: string }): Promise<Pedido> {
  const r = await rpc<Row>('criar_pedido', {
    p_org: await orgId(), p_cliente: i.clienteId, p_obs: i.observacao ?? null, p_local: i.localId ?? null,
    p_itens: i.itens.map(x => ({ produto_id: x.produtoId, quantidade: x.quantidade, preco_centavos: x.precoCentavos, desconto_centavos: x.descontoCentavos })),
  })
  return { ...pedido(r), itens: i.itens }
}
export async function confirmarPedido(id: string) { await rpc('confirmar_pedido', { p_pedido: id }) }
export async function faturarPedido(id: string, parcelas: number, diasEntre: number): Promise<Nota> { return nota(await rpc<Row>('faturar_pedido', { p_pedido: id, p_parcelas: parcelas, p_dias: diasEntre })) }
export async function cancelarPedido(id: string, motivo: string) { await rpc('cancelar_pedido', { p_pedido: id, p_motivo: motivo }) }
export async function listNotas(): Promise<Nota[]> { return (unwrap(await supabase().from('notas_fiscais').select('*').order('emitida_em', { ascending: false }).limit(500)) as Row[]).map(nota) }
export async function getNota(id: string) {
  const r = await supabase().from('notas_fiscais').select('*').eq('id', id).maybeSingle()
  if (r.error) return null
  return r.data ? nota(r.data) : null
}
export async function listFinanceiros(tipo: 'receita' | 'despesa', status?: string): Promise<Financeiro[]> {
  let q = supabase().from('financeiros').select('*, financeiro_baixas(*)').eq('tipo', tipo).order('vencimento').limit(1000)
  if (status) q = q.eq('status', status)
  return (unwrap(await q) as Row[]).map(fin)
}
export async function lancarDespesa(i: { descricao: string; valorCentavos: number; vencimento: string }) {
  if (i.valorCentavos > MAX_CENTAVOS) throw new Error(MSG_LIMITE)
  await rpc('lancar_despesa', { p_org: await orgId(), p_descricao: i.descricao, p_valor_centavos: i.valorCentavos, p_vencimento: i.vencimento || null })
}
export async function baixarFinanceiro(id: string, valorCentavos: number, jurosCentavos = 0) { await rpc('baixar_financeiro', { p_financeiro: id, p_valor_centavos: valorCentavos, p_juros_centavos: jurosCentavos }) }
export async function dashboard(): Promise<Dashboard> {
  const d = await rpc<Row>('dashboard', { p_org: await orgId() })
  return { vendasMesCentavos: d.vendas_mes_centavos, receberVencidoCentavos: d.receber_vencido_centavos, itensSemSaldo: d.itens_sem_saldo, pedidosAbertos: d.pedidos_abertos }
}
const itensJson = (itens: ItemPedido[]) => itens.map(x => ({ produto_id: x.produtoId, quantidade: x.quantidade, preco_centavos: x.precoCentavos, desconto_centavos: x.descontoCentavos }))
export async function atualizarPedido(id: string, i: { clienteId: string; itens: ItemPedido[]; observacao?: string; localId?: string }): Promise<Pedido> {
  const r = await rpc<Row>('atualizar_pedido', { p_pedido: id, p_cliente: i.clienteId, p_itens: itensJson(i.itens), p_obs: i.observacao ?? null, p_local: i.localId ?? null })
  return { ...pedido(r), itens: i.itens }
}
export async function atualizarCliente(id: string, i: { nome: string; documento: string; email: string; bloqueado: boolean; ativo: boolean; tabelaPrecoId?: string }): Promise<Cliente> {
  return cliente(await rpc<Row>('atualizar_cliente', { p_cliente: id, p_nome: i.nome, p_documento: i.documento, p_email: i.email, p_bloqueado: i.bloqueado, p_ativo: i.ativo, p_tabela: i.tabelaPrecoId || null }))
}
export async function atualizarProduto(id: string, i: { descricao: string; grupo: string; unidade: string; precoCentavos: number; ativo: boolean }): Promise<Produto> {
  const r = await rpc<Row>('atualizar_produto', { p_produto: id, p_descricao: i.descricao, p_grupo: i.grupo, p_unidade: i.unidade, p_preco_centavos: i.precoCentavos, p_ativo: i.ativo })
  return { id: r.id, codigo: r.codigo, descricao: r.descricao, grupo: i.grupo || 'Sem grupo', unidade: r.unidade, precoCentavos: r.preco_centavos, controlaEstoque: r.controla_estoque, ativo: r.ativo }
}
export async function getProduto(id: string): Promise<Produto | null> {
  const r = await supabase().from('produtos').select('*, grupos_produto(nome)').eq('id', id).maybeSingle()
  if (r.error || !r.data) return null
  const x = r.data as Row
  return { id: x.id, codigo: x.codigo, descricao: x.descricao, grupo: x.grupos_produto?.nome ?? 'Sem grupo', unidade: x.unidade, precoCentavos: x.preco_centavos, controlaEstoque: x.controla_estoque, ativo: x.ativo }
}

/* ---- locais de estoque ---- */
const localMap = (r: Row, padraoId: string): Local => ({ id: r.id, nome: r.nome, ativo: r.ativo, padrao: r.id === padraoId })
export async function listLocais(): Promise<Local[]> {
  const rows = unwrap(await supabase().from('locais_estoque').select('*').order('created_at')) as Row[]
  const padrao = (rows.find(r => r.ativo) ?? rows[0])?.id ?? ''
  return rows.map(r => localMap(r, padrao))
}
export async function criarLocal(i: { nome: string }): Promise<Local> { return localMap(await rpc<Row>('criar_local', { p_org: await orgId(), p_nome: i.nome }), '') }
export async function atualizarLocal(id: string, i: { nome: string; ativo: boolean }): Promise<void> { await rpc('atualizar_local', { p_local: id, p_nome: i.nome, p_ativo: i.ativo }) }
export async function transferirEstoque(i: { produtoId: string; deLocalId: string; paraLocalId: string; quantidade: number }): Promise<void> {
  await rpc('transferir_estoque', { p_org: await orgId(), p_produto: i.produtoId, p_de: i.deLocalId, p_para: i.paraLocalId, p_quantidade: i.quantidade })
}

/* ---- tabelas de preço ---- */
export async function listTabelasPreco(): Promise<TabelaPreco[]> {
  const [t, p] = await Promise.all([supabase().from('tabelas_preco').select('*').order('nome'), supabase().from('precos').select('*')])
  const tabs = unwrap(t) as Row[]; const precos = unwrap(p) as Row[]
  return tabs.map(x => ({ id: x.id, nome: x.nome, precos: Object.fromEntries(precos.filter(y => y.tabela_id === x.id).map(y => [y.produto_id, y.valor_centavos])) }))
}
export async function criarTabelaPreco(i: { nome: string }): Promise<TabelaPreco> { const r = await rpc<Row>('criar_tabela_preco', { p_org: await orgId(), p_nome: i.nome }); return { id: r.id, nome: r.nome, precos: {} } }
export async function definirPreco(tabelaId: string, produtoId: string, centavos: number) { await rpc('definir_preco', { p_tabela: tabelaId, p_produto: produtoId, p_valor_centavos: centavos }) }
export async function removerPreco(tabelaId: string, produtoId: string) { await rpc('remover_preco', { p_tabela: tabelaId, p_produto: produtoId }) }
export async function excluirTabelaPreco(tabelaId: string) { await rpc('excluir_tabela_preco', { p_tabela: tabelaId }) }

/* ---- financeiro ---- */
export async function lancarReceita(i: { clienteId?: string; descricao: string; valorCentavos: number; vencimento: string }) {
  if (i.valorCentavos > MAX_CENTAVOS) throw new Error(MSG_LIMITE)
  await rpc('lancar_receita', { p_org: await orgId(), p_cliente: i.clienteId || null, p_descricao: i.descricao, p_valor_centavos: i.valorCentavos, p_vencimento: i.vencimento || null })
}
export async function estornarBaixa(_financeiroId: string, baixaId: string) { await rpc('estornar_baixa', { p_baixa: baixaId }) }

export function resetDemo() { /* não existe no modo real */ }
void mesLocal

// ---- cadastros auxiliares ----
export async function listVendedores(): Promise<Vendedor[]> { return (unwrap(await supabase().from('vendedores').select('*').order('nome')) as Row[]).map(r => ({ id: r.id, nome: r.nome, ativo: r.ativo, comissaoBps: r.comissao_bps ?? 0 })) }
export async function salvarVendedor(i: { id?: string; nome: string; ativo: boolean; comissaoBps?: number }): Promise<void> { await rpc('salvar_vendedor', { p_org: await orgId(), p_id: i.id ?? null, p_nome: i.nome, p_ativo: i.ativo, p_comissao_bps: i.comissaoBps ?? null }) }
export async function listNaturezas(): Promise<Natureza[]> { return (unwrap(await supabase().from('naturezas').select('*').order('nome')) as Row[]).map(r => ({ id: r.id, nome: r.nome, tipo: r.tipo })) }
export async function salvarNatureza(i: { id?: string; nome: string; tipo: 'receita' | 'despesa' }): Promise<void> { await rpc('salvar_natureza', { p_org: await orgId(), p_id: i.id ?? null, p_nome: i.nome, p_tipo: i.tipo }) }
export async function listCentros(): Promise<Centro[]> { return (unwrap(await supabase().from('centros_resultado').select('*').order('nome')) as Row[]).map(r => ({ id: r.id, nome: r.nome })) }
export async function salvarCentro(i: { id?: string; nome: string }): Promise<void> { await rpc('salvar_centro', { p_org: await orgId(), p_id: i.id ?? null, p_nome: i.nome }) }
export async function listContas(): Promise<ContaBancaria[]> { return (unwrap(await supabase().from('contas_bancarias').select('*').order('nome')) as Row[]).map(r => ({ id: r.id, nome: r.nome, banco: r.banco ?? '' })) }
export async function salvarConta(i: { id?: string; nome: string; banco: string }): Promise<void> { await rpc('salvar_conta', { p_org: await orgId(), p_id: i.id ?? null, p_nome: i.nome, p_banco: i.banco }) }
export async function listTiposPagamento(): Promise<TipoPagamento[]> { return (unwrap(await supabase().from('tipos_pagamento').select('*').order('nome')) as Row[]).map(r => ({ id: r.id, nome: r.nome, parcelas: r.parcelas, diasEntre: r.dias_entre_parcelas })) }
export async function salvarTipoPagamento(i: { id?: string; nome: string; parcelas: number; diasEntre: number }): Promise<void> { await rpc('salvar_tipo_pagamento', { p_org: await orgId(), p_id: i.id ?? null, p_nome: i.nome, p_parcelas: i.parcelas, p_dias: i.diasEntre }) }
export async function excluirCadastroAux(tabela: AuxTabela, id: string): Promise<void> { await rpc('excluir_cadastro_aux', { p_org: await orgId(), p_tabela: tabela, p_id: id }) }
export async function getEmpresa(): Promise<Empresa> {
  const r = unwrap(await supabase().from('orgs').select('nome, cnpj').eq('id', await orgId()).maybeSingle()) as Row | null
  return { nome: r?.nome ?? '', cnpj: r?.cnpj ?? '' }
}
export async function atualizarEmpresa(i: Empresa): Promise<void> { await rpc('atualizar_empresa', { p_org: await orgId(), p_nome: i.nome, p_cnpj: i.cnpj }) }
export async function definirVendedorPedido(pedidoId: string, vendedorId: string | null): Promise<void> { await rpc('definir_vendedor_pedido', { p_pedido: pedidoId, p_vendedor: vendedorId }) }
export async function classificarFinanceiro(id: string, c: Classificacao): Promise<void> {
  await rpc('classificar_financeiro', { p_fin: id, p_natureza: c.naturezaId || null, p_centro: c.centroId || null, p_conta: c.contaId || null, p_tipo: c.tipoPagamentoId || null })
}
