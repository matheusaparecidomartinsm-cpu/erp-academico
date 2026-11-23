// Camada de dados SIMULADA (localStorage). Todas as funções são async com a mesma assinatura que a
// versão real (Supabase) terá; trocar a implementação não muda nenhuma tela.
// Regras de negócio: estoque não negativo, faturar/cancelar atômicos, uma NF por pedido.
import type { Vendedor, Natureza, Centro, ContaBancaria, TipoPagamento, Empresa, Classificacao, AuxTabela, Cliente, DB, Dashboard, Financeiro, ItemPedido, Local, Movimento, Nota, Pedido, Produto, TabelaPreco } from './types'
import { MAX_CENTAVOS, MSG_LIMITE } from './money'
import { addDias, hoje, mesLocal, pagoDe, totalItem, vencido } from './util'
export { hoje, pagoDe, totalItem, vencido }

const KEY = 'erp-academico-v2'
const memory: { db: DB | null; raw: string | null } = { db: null, raw: null }


const agora = () => new Date().toISOString()

function seed(): DB {
  const d0 = hoje()
  const clientes: Cliente[] = [
    { id: 'cli-1', codigo: 1, nome: 'Mercado Exemplo Ltda', documento: '11.111.111/0001-11', email: 'compras@mercadoexemplo.test', bloqueado: false, ativo: true },
    { id: 'cli-2', codigo: 2, nome: 'Padaria Modelo ME', documento: '22.222.222/0001-22', email: 'contato@padariamodelo.test', bloqueado: false, ativo: true },
    { id: 'cli-3', codigo: 3, nome: 'Lanchonete Teste', documento: '33.333.333/0001-33', email: 'oi@lanchoneteteste.test', bloqueado: false, ativo: true },
    { id: 'cli-4', codigo: 4, nome: 'Restaurante Fictício Ltda', documento: '44.444.444/0001-44', email: 'financeiro@ficticio.test', bloqueado: true, ativo: true },
  ]
  const produtos: Produto[] = [
    { id: 'pro-1', codigo: 1, descricao: 'Caixa de papelão 30x20 cm', grupo: 'Embalagens', unidade: 'UN', precoCentavos: 450, controlaEstoque: true, ativo: true },
    { id: 'pro-2', codigo: 2, descricao: 'Copo de papel 200 ml (pacote c/ 50)', grupo: 'Descartáveis', unidade: 'PCT', precoCentavos: 1290, controlaEstoque: true, ativo: true },
    { id: 'pro-3', codigo: 3, descricao: 'Sacola kraft média', grupo: 'Embalagens', unidade: 'UN', precoCentavos: 210, controlaEstoque: true, ativo: true },
    { id: 'pro-4', codigo: 4, descricao: 'Bandeja de papel-cartão 500 g', grupo: 'Embalagens', unidade: 'UN', precoCentavos: 320, controlaEstoque: true, ativo: true },
    { id: 'pro-5', codigo: 5, descricao: 'Fita adesiva 48 mm', grupo: 'Insumos', unidade: 'UN', precoCentavos: 780, controlaEstoque: true, ativo: true },
    { id: 'pro-6', codigo: 6, descricao: 'Guardanapo folha simples (pacote c/ 100)', grupo: 'Descartáveis', unidade: 'PCT', precoCentavos: 590, controlaEstoque: true, ativo: true },
    { id: 'pro-7', codigo: 7, descricao: 'Etiqueta adesiva personalizada', grupo: 'Serviços', unidade: 'UN', precoCentavos: 90, controlaEstoque: false, ativo: true },
    { id: 'pro-8', codigo: 8, descricao: 'Tampa de papel 90 mm (pacote c/ 50)', grupo: 'Descartáveis', unidade: 'PCT', precoCentavos: 980, controlaEstoque: true, ativo: true },
  ]
  const ent = (p: string, q: number, i: number): Movimento => ({ id: 'mov-' + i, produtoId: p, localId: 'loc-1', tipo: 'entrada', quantidade: q, origem: 'manual', motivo: 'Saldo inicial', em: agora() })
  const movimentos: Movimento[] = [ent('pro-1', 500, 1), ent('pro-2', 120, 2), ent('pro-3', 800, 3), ent('pro-4', 60, 4), ent('pro-5', 0.001, 5), ent('pro-6', 200, 6), ent('pro-8', 15, 7)]
  movimentos.splice(4, 1) // fita adesiva começa SEM saldo (mostra o estado "sem saldo")
  const locais: Local[] = [{ id: 'loc-1', nome: 'Depósito principal', ativo: true, padrao: true }]
  const db: DB = { clientes, produtos, locais, tabelas: [], movimentos, pedidos: [], notas: [], financeiros: [], seq: { cliente: 5, produto: 9, pedido: 1, nota: 1, id: 100 } }
  // pedido 1: faturado em 2 parcelas (uma vencida) — criado pelas próprias regras
  const p1 = criarPedidoSync(db, { clienteId: 'cli-1', itens: [{ produtoId: 'pro-1', quantidade: 100, precoCentavos: 450, descontoCentavos: 0 }, { produtoId: 'pro-2', quantidade: 20, precoCentavos: 1290, descontoCentavos: 500 }] })
  confirmarSync(db, p1.id); faturarSync(db, p1.id, 2, 30)
  const fin = db.financeiros.filter(f => f.pedidoId === p1.id)
  fin[0].vencimento = addDias(d0, -12) // parcela 1 vencida
  fin[1].vencimento = addDias(d0, 18)
  const p2 = criarPedidoSync(db, { clienteId: 'cli-2', itens: [{ produtoId: 'pro-3', quantidade: 200, precoCentavos: 210, descontoCentavos: 0 }] })
  confirmarSync(db, p2.id)
  criarPedidoSync(db, { clienteId: 'cli-3', itens: [{ produtoId: 'pro-6', quantidade: 30, precoCentavos: 590, descontoCentavos: 0 }] })
  db.financeiros.push({ id: 'fin-d1', tipo: 'despesa', descricao: 'Aluguel do galpão', parcela: 1, totalParcelas: 1, valorCentavos: 350000, vencimento: addDias(d0, 5), status: 'aberto', baixas: [] })
  db.financeiros.push({ id: 'fin-d2', tipo: 'despesa', descricao: 'Energia elétrica', parcela: 1, totalParcelas: 1, valorCentavos: 84250, vencimento: addDias(d0, -3), status: 'aberto', baixas: [] })
  return db
}

// ---------- persistência ----------
function load(): DB {
  // Outra aba pode ter gravado depois da nossa última leitura: confere o texto salvo antes de confiar na cópia em memória.
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (raw && raw !== memory.raw) { memory.db = JSON.parse(raw) as DB; memory.raw = raw; return memory.db }
      if (raw && memory.db) return memory.db
    } catch { /* usa a cópia em memória ou o exemplo */ }
  }
  if (memory.db) return memory.db
  memory.db = seed(); persist(memory.db); return memory.db
}
// Dados salvos por versões anteriores não têm os cadastros auxiliares: completa com os exemplos.
function aux(db: DB) {
  db.vendedores ??= [{ id: 'ven-1', nome: 'Ana Souza', ativo: true }, { id: 'ven-2', nome: 'Bruno Lima', ativo: true }]
  db.naturezas ??= [{ id: 'nat-1', nome: 'Venda de mercadorias', tipo: 'receita' }, { id: 'nat-2', nome: 'Aluguel', tipo: 'despesa' }, { id: 'nat-3', nome: 'Energia e água', tipo: 'despesa' }]
  db.centros ??= [{ id: 'cen-1', nome: 'Comercial' }, { id: 'cen-2', nome: 'Administrativo' }]
  db.contas ??= [{ id: 'con-1', nome: 'Conta principal', banco: 'Banco Exemplo' }]
  db.tiposPagamento ??= [{ id: 'tip-1', nome: 'À vista', parcelas: 1, diasEntre: 0 }, { id: 'tip-2', nome: '30/60 dias', parcelas: 2, diasEntre: 30 }]
  db.empresa ??= { nome: 'Empresa Exemplo Ltda', cnpj: '' }
  return db as Required<DB>
}
function persist(db: DB) {
  memory.db = db
  if (typeof window !== 'undefined') {
    try { const txt = JSON.stringify(db); window.localStorage.setItem(KEY, txt); memory.raw = txt; window.dispatchEvent(new Event('erp-changed')) } catch { /* cheio/privado */ }
  }
}
export function resetDemo() { memory.db = null; memory.raw = null; if (typeof window !== 'undefined') window.localStorage.removeItem(KEY); load() ; if (typeof window !== 'undefined') window.dispatchEvent(new Event('erp-changed')) }
export function __resetMemoryForTests() { memory.db = null; memory.raw = null }

const nid = (db: DB, p: string) => `${p}-${++db.seq.id}`
export const saldoDe = (db: DB, produtoId: string) =>
  Math.round(db.movimentos.filter(m => m.produtoId === produtoId).reduce((s, m) => s + m.quantidade, 0) * 1000) / 1000
export const saldoLocal = (db: DB, produtoId: string, localId: string) =>
  Math.round(db.movimentos.filter(m => m.produtoId === produtoId && m.localId === localId).reduce((s, m) => s + m.quantidade, 0) * 1000) / 1000
const localPadrao = (db: DB) => (db.locais.find(l => l.ativo) ?? db.locais[0]).id
function localValido(db: DB, id?: string): string {
  if (!id) return localPadrao(db)
  const l = db.locais.find(x => x.id === id)
  if (!l || !l.ativo) throw new Error('Escolha um local de estoque válido.')
  return l.id
}
const totalItens = (itens: ItemPedido[]) => itens.reduce((s, i) => s + Math.max(0, Math.round(i.quantidade * i.precoCentavos) - i.descontoCentavos), 0)

// ---------- regras (síncronas, operam sobre um DB; as públicas clonam e salvam => atômico) ----------
function validarItens(db: DB, itens: ItemPedido[]) {
  if (itens.length === 0) throw new Error('Inclua pelo menos um item.')
  for (const i of itens) {
    const p = db.produtos.find(x => x.id === i.produtoId)
    if (!p) throw new Error('Produto não encontrado.')
    if (!(i.quantidade > 0)) throw new Error(`Informe a quantidade de "${p.descricao}".`)
    if (i.precoCentavos < 0 || i.descontoCentavos < 0) throw new Error('Preço e desconto não podem ser negativos.')
    if (i.descontoCentavos > Math.round(i.quantidade * i.precoCentavos)) throw new Error(`O desconto de "${p.descricao}" é maior que o total do item.`)
  }
}
function checarEstoque(db: DB, itens: ItemPedido[], localId: string) {
  const porProduto = new Map<string, number>()
  for (const i of itens) porProduto.set(i.produtoId, (porProduto.get(i.produtoId) ?? 0) + i.quantidade)
  for (const [pid, q] of porProduto) {
    const p = db.produtos.find(x => x.id === pid)!
    if (p.controlaEstoque && saldoLocal(db, pid, localId) < q) throw new Error(`Saldo insuficiente de "${p.descricao}": ${saldoLocal(db, pid, localId)} disponível, ${q} pedido.`)
  }
}
function criarPedidoSync(db: DB, input: { clienteId: string; itens: ItemPedido[]; observacao?: string; localId?: string }): Pedido {
  const c = db.clientes.find(x => x.id === input.clienteId)
  if (!c) throw new Error('Escolha um cliente.')
  const localId = localValido(db, input.localId)
  validarItens(db, input.itens)
  const p: Pedido = {
    id: 'ped-' + db.seq.pedido, numero: 1000 + db.seq.pedido++, clienteId: c.id, localId, status: 'rascunho', itens: input.itens.map(i => ({ ...i })),
    totalCentavos: totalItens(input.itens), observacao: input.observacao, parcelas: 1, diasEntre: 30, criadoEm: agora(),
  }
  db.pedidos.unshift(p); return p
}
function pedidoDe(db: DB, id: string) { const p = db.pedidos.find(x => x.id === id); if (!p) throw new Error('Pedido não encontrado.'); return p }
function confirmarSync(db: DB, id: string) {
  const p = pedidoDe(db, id)
  if (p.status !== 'rascunho') throw new Error('Só é possível confirmar um pedido em rascunho.')
  const c = db.clientes.find(x => x.id === p.clienteId)!
  if (c.bloqueado) throw new Error(`O cliente "${c.nome}" está bloqueado.`)
  checarEstoque(db, p.itens, p.localId); p.status = 'confirmado'
}
function faturarSync(db: DB, id: string, parcelas: number, diasEntre: number) {
  const p = pedidoDe(db, id)
  if (p.status !== 'confirmado') throw new Error('Só é possível faturar um pedido confirmado.')
  if (db.notas.some(n => n.pedidoId === p.id && n.status === 'emitida')) throw new Error('Este pedido já tem nota emitida.')
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 12) throw new Error('Parcelas devem ficar entre 1 e 12.')
  if (!Number.isInteger(diasEntre) || diasEntre < 0 || diasEntre > 120) throw new Error('Dias entre parcelas inválido.')
  checarEstoque(db, p.itens, p.localId)
  const nota: Nota = { id: 'nf-' + db.seq.nota, numero: db.seq.nota++, serie: 1, pedidoId: p.id, tipo: 'venda', status: 'emitida', totalCentavos: p.totalCentavos, impostosCentavos: Math.round(p.totalCentavos * 0.12), emitidaEm: agora() }
  db.notas.unshift(nota)
  for (const i of p.itens) {
    const pr = db.produtos.find(x => x.id === i.produtoId)!
    if (pr.controlaEstoque) db.movimentos.push({ id: nid(db, 'mov'), produtoId: i.produtoId, localId: p.localId, tipo: 'saida', quantidade: -i.quantidade, origem: 'nota:' + nota.id, em: agora() })
  }
  const base = Math.floor(p.totalCentavos / parcelas); const resto = p.totalCentavos - base * parcelas
  for (let k = 1; k <= parcelas; k++) {
    db.financeiros.push({
      id: nid(db, 'fin'), tipo: 'receita', descricao: `Pedido ${p.numero} — NF ${nota.numero}`, clienteId: p.clienteId, notaId: nota.id, pedidoId: p.id,
      parcela: k, totalParcelas: parcelas, valorCentavos: base + (k === parcelas ? resto : 0), vencimento: addDias(hoje(), diasEntre * k), status: 'aberto', baixas: [],
    })
  }
  p.status = 'faturado'; p.notaId = nota.id; p.parcelas = parcelas; p.diasEntre = diasEntre
  return nota
}
function cancelarSync(db: DB, id: string, motivo: string) {
  const p = pedidoDe(db, id)
  if (p.status === 'cancelado') throw new Error('O pedido já está cancelado.')
  if (!motivo.trim()) throw new Error('Informe o motivo do cancelamento.')
  if (p.status === 'faturado') {
    const fins = db.financeiros.filter(f => f.pedidoId === p.id && f.tipo === 'receita')
    if (fins.some(f => f.baixas.some(b => !b.estornadaEm))) throw new Error('Há parcelas com recebimento. Estorne os recebimentos em Contas a receber antes de cancelar o pedido.')
    for (const f of fins) f.status = 'cancelado'
    const nota = db.notas.find(n => n.id === p.notaId)
    if (nota) nota.status = 'cancelada'
    for (const i of p.itens) {
      const pr = db.produtos.find(x => x.id === i.produtoId)!
      if (pr.controlaEstoque) db.movimentos.push({ id: nid(db, 'mov'), produtoId: i.produtoId, localId: p.localId, tipo: 'estorno', quantidade: i.quantidade, origem: 'cancelamento:' + p.id, em: agora() })
    }
  }
  p.status = 'cancelado'; p.motivoCancelamento = motivo.trim()
}

/** Roda uma regra numa cópia; só salva se não lançar erro (atomicidade). */
function transacao<T>(fn: (db: DB) => T): T {
  const copia: DB = JSON.parse(JSON.stringify(load()))
  const r = fn(copia); persist(copia); return r
}
const tick = <T,>(v: T): Promise<T> => Promise.resolve(v)

// ---------- API pública (mesma forma da versão real) ----------
export async function listClientes(q = ''): Promise<Cliente[]> {
  const t = q.trim().toLowerCase()
  return tick(load().clientes.filter(c => !t || c.nome.toLowerCase().includes(t) || c.documento.includes(t) || String(c.codigo) === t))
}
export async function getCliente(id: string) { return tick(load().clientes.find(c => c.id === id) ?? null) }
export async function criarCliente(i: { nome: string; documento: string; email: string }): Promise<Cliente> {
  return tick(transacao(db => {
    if (!i.nome.trim()) throw new Error('Informe o nome do cliente.')
    if (i.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email.trim())) throw new Error('Informe um e-mail válido.')
    const doc = i.documento.trim()
    if (doc && db.clientes.some(c => c.documento === doc)) throw new Error('Já existe um cliente com este documento.')
    const c: Cliente = { id: nid(db, 'cli'), codigo: db.seq.cliente++, nome: i.nome.trim(), documento: doc, email: i.email.trim(), bloqueado: false, ativo: true }
    db.clientes.push(c); return c
  }))
}
export async function atualizarCliente(id: string, i: { nome: string; documento: string; email: string; bloqueado: boolean; ativo: boolean; tabelaPrecoId?: string }): Promise<Cliente> {
  return tick(transacao(db => {
    const c = db.clientes.find(x => x.id === id); if (!c) throw new Error('Cliente não encontrado.')
    if (!i.nome.trim()) throw new Error('Informe o nome do cliente.')
    if (i.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email.trim())) throw new Error('Informe um e-mail válido.')
    const doc = i.documento.trim()
    if (doc && db.clientes.some(x => x.id !== id && x.documento === doc)) throw new Error('Já existe um cliente com este documento.')
    if (i.tabelaPrecoId && !db.tabelas.some(t => t.id === i.tabelaPrecoId)) throw new Error('Tabela de preço não encontrada.')
    Object.assign(c, { nome: i.nome.trim(), documento: doc, email: i.email.trim(), bloqueado: i.bloqueado, ativo: i.ativo, tabelaPrecoId: i.tabelaPrecoId || undefined })
    return { ...c }
  }))
}
export async function atualizarProduto(id: string, i: { descricao: string; grupo: string; unidade: string; precoCentavos: number; ativo: boolean }): Promise<Produto> {
  return tick(transacao(db => {
    const p = db.produtos.find(x => x.id === id); if (!p) throw new Error('Produto não encontrado.')
    if (!i.descricao.trim()) throw new Error('Informe a descrição do produto.')
    if (!(i.precoCentavos >= 0)) throw new Error('O preço não pode ser negativo.')
    Object.assign(p, { descricao: i.descricao.trim(), grupo: i.grupo.trim() || 'Sem grupo', unidade: i.unidade.trim() || 'UN', precoCentavos: i.precoCentavos, ativo: i.ativo })
    return { ...p }
  }))
}
export async function getProduto(id: string) { return tick(load().produtos.find(p => p.id === id) ?? null) }

// ---- locais de estoque ----
export async function listLocais(): Promise<Local[]> { return tick(load().locais.map(l => ({ ...l, padrao: l.id === localPadrao(load()) }))) }
export async function criarLocal(i: { nome: string }): Promise<Local> {
  return tick(transacao(db => {
    const nome = i.nome.trim(); if (!nome) throw new Error('Informe o nome do local.')
    if (db.locais.some(l => l.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe um local com este nome.')
    const l: Local = { id: nid(db, 'loc'), nome, ativo: true, padrao: false }; db.locais.push(l); return l
  }))
}
export async function atualizarLocal(id: string, i: { nome: string; ativo: boolean }): Promise<void> {
  return tick(transacao(db => {
    const l = db.locais.find(x => x.id === id); if (!l) throw new Error('Local não encontrado.')
    const nome = i.nome.trim(); if (!nome) throw new Error('Informe o nome do local.')
    if (db.locais.some(x => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe um local com este nome.')
    if (!i.ativo) {
      if (db.produtos.some(p => saldoLocal(db, p.id, id) > 0)) throw new Error('Este local ainda tem saldo. Transfira o estoque antes de desativá-lo.')
      if (!db.locais.some(x => x.id !== id && x.ativo)) throw new Error('É preciso manter pelo menos um local ativo.')
    }
    l.nome = nome; l.ativo = i.ativo
  }))
}
export async function transferirEstoque(i: { produtoId: string; deLocalId: string; paraLocalId: string; quantidade: number }): Promise<void> {
  return tick(transacao(db => {
    const p = db.produtos.find(x => x.id === i.produtoId); if (!p) throw new Error('Produto não encontrado.')
    if (!p.controlaEstoque) throw new Error('Este produto não controla estoque.')
    const de = db.locais.find(l => l.id === i.deLocalId && l.ativo), para = db.locais.find(l => l.id === i.paraLocalId && l.ativo)
    if (!de || !para) throw new Error('Escolha o local de origem e o de destino.')
    if (de.id === para.id) throw new Error('Origem e destino precisam ser diferentes.')
    if (!(i.quantidade > 0)) throw new Error('Informe uma quantidade maior que zero.')
    if (saldoLocal(db, p.id, de.id) < i.quantidade) throw new Error(`Saldo insuficiente em "${de.nome}": ${saldoLocal(db, p.id, de.id)} disponível.`)
    db.movimentos.push({ id: nid(db, 'mov'), produtoId: p.id, localId: de.id, tipo: 'saida', quantidade: -i.quantidade, origem: 'transferencia', motivo: 'Transferência para ' + para.nome, em: agora() })
    db.movimentos.push({ id: nid(db, 'mov'), produtoId: p.id, localId: para.id, tipo: 'entrada', quantidade: i.quantidade, origem: 'transferencia', motivo: 'Transferência de ' + de.nome, em: agora() })
  }))
}

// ---- tabelas de preço ----
export async function listTabelasPreco(): Promise<TabelaPreco[]> { return tick(load().tabelas) }
export async function criarTabelaPreco(i: { nome: string }): Promise<TabelaPreco> {
  return tick(transacao(db => {
    const nome = i.nome.trim(); if (!nome) throw new Error('Informe o nome da tabela.')
    if (db.tabelas.some(t => t.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe uma tabela com este nome.')
    const t: TabelaPreco = { id: nid(db, 'tab'), nome, precos: {} }; db.tabelas.push(t); return t
  }))
}
export async function definirPreco(tabelaId: string, produtoId: string, centavos: number): Promise<void> {
  return tick(transacao(db => {
    const t = db.tabelas.find(x => x.id === tabelaId); if (!t) throw new Error('Tabela não encontrada.')
    if (!db.produtos.some(p => p.id === produtoId)) throw new Error('Produto não encontrado.')
    if (!(centavos >= 0)) throw new Error('O preço não pode ser negativo.')
    t.precos[produtoId] = centavos
  }))
}
export async function removerPreco(tabelaId: string, produtoId: string): Promise<void> {
  return tick(transacao(db => { const t = db.tabelas.find(x => x.id === tabelaId); if (!t) throw new Error('Tabela não encontrada.'); delete t.precos[produtoId] }))
}
export async function excluirTabelaPreco(tabelaId: string): Promise<void> {
  return tick(transacao(db => {
    if (!db.tabelas.some(x => x.id === tabelaId)) throw new Error('Tabela não encontrada.')
    db.tabelas = db.tabelas.filter(x => x.id !== tabelaId); db.clientes.forEach(c => { if (c.tabelaPrecoId === tabelaId) c.tabelaPrecoId = undefined })
  }))
}

export async function listProdutos(q = ''): Promise<(Produto & { saldo: number; saldos: Record<string, number> })[]> {
  const db = load(); const t = q.trim().toLowerCase()
  return tick(db.produtos.filter(p => !t || p.descricao.toLowerCase().includes(t) || String(p.codigo) === t || p.grupo.toLowerCase().includes(t)).map(p => ({ ...p, saldo: saldoDe(db, p.id), saldos: Object.fromEntries(db.locais.map(l => [l.id, saldoLocal(db, p.id, l.id)])) })))
}
export async function criarProduto(i: { descricao: string; grupo: string; unidade: string; precoCentavos: number; controlaEstoque: boolean }): Promise<Produto> {
  return tick(transacao(db => {
    if (!i.descricao.trim()) throw new Error('Informe a descrição do produto.')
    if (i.precoCentavos < 0) throw new Error('O preço não pode ser negativo.')
    if (i.precoCentavos > MAX_CENTAVOS) throw new Error(MSG_LIMITE)
    const p: Produto = { id: nid(db, 'pro'), codigo: db.seq.produto++, descricao: i.descricao.trim(), grupo: i.grupo.trim() || 'Sem grupo', unidade: i.unidade.trim() || 'UN', precoCentavos: i.precoCentavos, controlaEstoque: i.controlaEstoque, ativo: true }
    db.produtos.push(p); return p
  }))
}
export async function ajustarEstoque(i: { produtoId: string; quantidade: number; motivo: string; localId?: string }) {
  return tick(transacao(db => {
    const p = db.produtos.find(x => x.id === i.produtoId); if (!p) throw new Error('Produto não encontrado.')
    if (!p.controlaEstoque) throw new Error('Este produto não controla estoque.')
    if (i.quantidade === 0 || !Number.isFinite(i.quantidade)) throw new Error('Informe uma quantidade diferente de zero.')
    if (!i.motivo.trim()) throw new Error('Informe o motivo do ajuste.')
    const localId = localValido(db, i.localId)
    if (saldoLocal(db, p.id, localId) + i.quantidade < 0) throw new Error('O ajuste deixaria o saldo negativo.')
    db.movimentos.push({ id: nid(db, 'mov'), produtoId: p.id, localId, tipo: 'ajuste', quantidade: i.quantidade, origem: 'manual', motivo: i.motivo.trim(), em: agora() })
  }))
}
export async function listMovimentos(produtoId?: string): Promise<Movimento[]> {
  return tick(load().movimentos.filter(m => !produtoId || m.produtoId === produtoId).slice().reverse())
}
export async function listPedidos(status?: string): Promise<Pedido[]> { return tick(load().pedidos.filter(p => !status || p.status === status)) }
export async function getPedido(id: string) { return tick(load().pedidos.find(p => p.id === id) ?? null) }
export async function criarPedido(i: { clienteId: string; itens: ItemPedido[]; observacao?: string; localId?: string }) { return tick(transacao(db => criarPedidoSync(db, i))) }
export async function atualizarPedido(id: string, i: { clienteId: string; itens: ItemPedido[]; observacao?: string; localId?: string }): Promise<Pedido> {
  return tick(transacao(db => {
    const p = pedidoDe(db, id)
    if (p.status !== 'rascunho') throw new Error('Só é possível alterar um pedido em rascunho.')
    if (!db.clientes.some(c => c.id === i.clienteId)) throw new Error('Escolha um cliente.')
    const localId = localValido(db, i.localId); validarItens(db, i.itens)
    Object.assign(p, { clienteId: i.clienteId, localId, observacao: i.observacao, itens: i.itens.map(x => ({ ...x })), totalCentavos: totalItens(i.itens) })
    return { ...p }
  }))
}
export async function confirmarPedido(id: string) { return tick(transacao(db => { confirmarSync(db, id) })) }
export async function faturarPedido(id: string, parcelas: number, diasEntre: number) { return tick(transacao(db => faturarSync(db, id, parcelas, diasEntre))) }
export async function cancelarPedido(id: string, motivo: string) { return tick(transacao(db => cancelarSync(db, id, motivo))) }
export async function listNotas(): Promise<Nota[]> { return tick(load().notas) }
export async function getNota(id: string) { return tick(load().notas.find(n => n.id === id) ?? null) }
export async function listFinanceiros(tipo: 'receita' | 'despesa', status?: string): Promise<Financeiro[]> {
  return tick(load().financeiros.filter(f => f.tipo === tipo && (!status || f.status === status)).sort((a, b) => a.vencimento.localeCompare(b.vencimento)))
}
export async function lancarDespesa(i: { descricao: string; valorCentavos: number; vencimento: string }) {
  return tick(transacao(db => {
    if (!i.descricao.trim()) throw new Error('Informe a descrição.')
    if (!(i.valorCentavos > 0)) throw new Error('Informe um valor maior que zero.')
    if (i.valorCentavos > MAX_CENTAVOS) throw new Error(MSG_LIMITE)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.vencimento)) throw new Error('Informe o vencimento.')
    db.financeiros.push({ id: nid(db, 'fin'), tipo: 'despesa', descricao: i.descricao.trim(), parcela: 1, totalParcelas: 1, valorCentavos: i.valorCentavos, vencimento: i.vencimento, status: 'aberto', baixas: [] })
  }))
}
export async function lancarReceita(i: { clienteId?: string; descricao: string; valorCentavos: number; vencimento: string }) {
  return tick(transacao(db => {
    if (!i.descricao.trim()) throw new Error('Informe a descrição.')
    if (!(i.valorCentavos > 0)) throw new Error('Informe um valor maior que zero.')
    if (i.valorCentavos > MAX_CENTAVOS) throw new Error(MSG_LIMITE)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.vencimento)) throw new Error('Informe o vencimento.')
    if (i.clienteId && !db.clientes.some(c => c.id === i.clienteId)) throw new Error('Cliente não encontrado.')
    db.financeiros.push({ id: nid(db, 'fin'), tipo: 'receita', descricao: i.descricao.trim(), clienteId: i.clienteId || undefined, parcela: 1, totalParcelas: 1, valorCentavos: i.valorCentavos, vencimento: i.vencimento, status: 'aberto', baixas: [] })
  }))
}
export async function estornarBaixa(financeiroId: string, baixaId: string) {
  return tick(transacao(db => {
    const f = db.financeiros.find(x => x.id === financeiroId); if (!f) throw new Error('Lançamento não encontrado.')
    if (f.status === 'cancelado') throw new Error('Lançamento cancelado.')
    const b = f.baixas.find(x => x.id === baixaId); if (!b) throw new Error('Baixa não encontrada.')
    if (b.estornadaEm) throw new Error('Esta baixa já foi estornada.')
    b.estornadaEm = agora()
    const pago = pagoDe(f); f.status = pago === 0 ? 'aberto' : pago >= f.valorCentavos ? 'baixado' : 'parcial'
  }))
}
export async function baixarFinanceiro(id: string, valorCentavos: number, jurosCentavos = 0) {
  return tick(transacao(db => {
    const f = db.financeiros.find(x => x.id === id); if (!f) throw new Error('Lançamento não encontrado.')
    if (f.status === 'cancelado') throw new Error('Lançamento cancelado.')
    if (f.status === 'baixado') throw new Error('Lançamento já baixado.')
    if (!(valorCentavos > 0)) throw new Error('Informe o valor da baixa.')
    const restante = f.valorCentavos - pagoDe(f)
    if (valorCentavos > restante) throw new Error('O valor é maior que o saldo em aberto.')
    f.baixas.push({ id: nid(db, 'bx'), valorCentavos, jurosCentavos: Math.max(0, jurosCentavos), em: agora() })
    f.status = pagoDe(f) >= f.valorCentavos ? 'baixado' : 'parcial'
  }))
}
export async function dashboard(): Promise<Dashboard> {
  const db = load(); const mes = hoje().slice(0, 7)
  return tick({
    vendasMesCentavos: db.notas.filter(n => n.status === 'emitida' && mesLocal(n.emitidaEm) === mes).reduce((s, n) => s + n.totalCentavos, 0),
    receberVencidoCentavos: db.financeiros.filter(f => f.tipo === 'receita' && vencido(f)).reduce((s, f) => s + f.valorCentavos - pagoDe(f), 0),
    itensSemSaldo: db.produtos.filter(p => p.controlaEstoque && saldoDe(db, p.id) <= 0).length,
    pedidosAbertos: db.pedidos.filter(p => p.status === 'rascunho' || p.status === 'confirmado').length,
  })
}

// ---- cadastros auxiliares ----
const nomeOk = (n: string) => { const t = n.trim(); if (!t) throw new Error('Informe o nome.'); if (t.length > 120) throw new Error('O nome pode ter até 120 caracteres.'); return t }
const repetido = (lista: { id: string; nome: string }[], id: string | undefined, nome: string, msg: string) => { if (lista.some(x => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) throw new Error(msg) }
export async function listVendedores(): Promise<Vendedor[]> { return tick(aux(load()).vendedores.map(v => ({ ...v }))) }
export async function salvarVendedor(i: { id?: string; nome: string; ativo: boolean; comissaoBps?: number }): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const nome = nomeOk(i.nome); repetido(db.vendedores, i.id, nome, 'Já existe um vendedor com este nome.')
    if (i.comissaoBps !== undefined && !(Number.isInteger(i.comissaoBps) && i.comissaoBps >= 0 && i.comissaoBps <= 10000)) throw new Error('Comissão deve ficar entre 0% e 100%.')
    if (!i.id) db.vendedores.push({ id: nid(raw, 'ven'), nome, ativo: i.ativo, comissaoBps: i.comissaoBps ?? 0 })
    else { const v = db.vendedores.find(x => x.id === i.id); if (!v) throw new Error('Vendedor não encontrado.'); v.nome = nome; v.ativo = i.ativo; if (i.comissaoBps !== undefined) v.comissaoBps = i.comissaoBps }
  }))
}
export async function listNaturezas(): Promise<Natureza[]> { return tick(aux(load()).naturezas.map(v => ({ ...v }))) }
export async function salvarNatureza(i: { id?: string; nome: string; tipo: 'receita' | 'despesa' }): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const nome = nomeOk(i.nome)
    if (i.tipo !== 'receita' && i.tipo !== 'despesa') throw new Error('Escolha se a natureza é de receita ou de despesa.')
    repetido(db.naturezas, i.id, nome, 'Já existe uma natureza com este nome.')
    if (!i.id) db.naturezas.push({ id: nid(raw, 'nat'), nome, tipo: i.tipo })
    else { const v = db.naturezas.find(x => x.id === i.id); if (!v) throw new Error('Natureza não encontrada.'); v.nome = nome; v.tipo = i.tipo }
  }))
}
export async function listCentros(): Promise<Centro[]> { return tick(aux(load()).centros.map(v => ({ ...v }))) }
export async function salvarCentro(i: { id?: string; nome: string }): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const nome = nomeOk(i.nome); repetido(db.centros, i.id, nome, 'Já existe um centro de resultado com este nome.')
    if (!i.id) db.centros.push({ id: nid(raw, 'cen'), nome })
    else { const v = db.centros.find(x => x.id === i.id); if (!v) throw new Error('Centro de resultado não encontrado.'); v.nome = nome }
  }))
}
export async function listContas(): Promise<ContaBancaria[]> { return tick(aux(load()).contas.map(v => ({ ...v }))) }
export async function salvarConta(i: { id?: string; nome: string; banco: string }): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const nome = nomeOk(i.nome); repetido(db.contas, i.id, nome, 'Já existe uma conta com este nome.')
    if (!i.id) db.contas.push({ id: nid(raw, 'con'), nome, banco: i.banco.trim() })
    else { const v = db.contas.find(x => x.id === i.id); if (!v) throw new Error('Conta não encontrada.'); v.nome = nome; v.banco = i.banco.trim() }
  }))
}
export async function listTiposPagamento(): Promise<TipoPagamento[]> { return tick(aux(load()).tiposPagamento.map(v => ({ ...v }))) }
export async function salvarTipoPagamento(i: { id?: string; nome: string; parcelas: number; diasEntre: number }): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const nome = nomeOk(i.nome)
    if (!Number.isInteger(i.parcelas) || i.parcelas < 1 || i.parcelas > 48) throw new Error('Parcelas: informe de 1 a 48.')
    if (!Number.isInteger(i.diasEntre) || i.diasEntre < 0) throw new Error('Dias entre parcelas não pode ser negativo.')
    repetido(db.tiposPagamento, i.id, nome, 'Já existe um tipo de pagamento com este nome.')
    if (!i.id) db.tiposPagamento.push({ id: nid(raw, 'tip'), nome, parcelas: i.parcelas, diasEntre: i.diasEntre })
    else { const v = db.tiposPagamento.find(x => x.id === i.id); if (!v) throw new Error('Tipo de pagamento não encontrado.'); Object.assign(v, { nome, parcelas: i.parcelas, diasEntre: i.diasEntre }) }
  }))
}
export async function excluirCadastroAux(tabela: AuxTabela, id: string): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw)
    const mapa = { naturezas: ['naturezas', 'naturezaId'], centros_resultado: ['centros', 'centroId'], contas_bancarias: ['contas', 'contaId'], tipos_pagamento: ['tiposPagamento', 'tipoPagamentoId'] } as const
    const m = mapa[tabela]; if (!m) throw new Error('Este cadastro não pode ser excluído; inative-o.')
    const lista = db[m[0]] as { id: string }[]; const k = lista.findIndex(x => x.id === id); if (k < 0) throw new Error('Registro não encontrado.')
    lista.splice(k, 1)
    for (const f of db.financeiros) if (f[m[1]] === id) delete f[m[1]]
  }))
}
export async function getEmpresa(): Promise<Empresa> { return tick({ ...aux(load()).empresa }) }
export async function atualizarEmpresa(i: Empresa): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const nome = nomeOk(i.nome); const cnpj = i.cnpj.replace(/\D/g, '')
    if (cnpj && cnpj.length !== 14) throw new Error('O CNPJ precisa ter 14 dígitos.')
    db.empresa = { nome, cnpj }
  }))
}
export async function definirVendedorPedido(pedidoId: string, vendedorId: string | null): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const p = raw.pedidos.find(x => x.id === pedidoId); if (!p) throw new Error('Pedido não encontrado.')
    if (p.status === 'cancelado') throw new Error('Pedido cancelado não pode ser alterado.')
    if (vendedorId && !db.vendedores.some(v => v.id === vendedorId && v.ativo)) throw new Error('Escolha um vendedor ativo.')
    p.vendedorId = vendedorId || undefined
  }))
}
export async function classificarFinanceiro(id: string, c: Classificacao): Promise<void> {
  return tick(transacao(raw => {
    const db = aux(raw); const f = raw.financeiros.find(x => x.id === id); if (!f) throw new Error('Lançamento não encontrado.')
    if (f.status === 'cancelado') throw new Error('Lançamento cancelado não pode ser alterado.')
    if (c.naturezaId) { const n = db.naturezas.find(x => x.id === c.naturezaId); if (!n) throw new Error('Natureza inválida.'); if (n.tipo !== f.tipo) throw new Error(`Esta natureza é de ${n.tipo}; o lançamento é de ${f.tipo}.`) }
    if (c.centroId && !db.centros.some(x => x.id === c.centroId)) throw new Error('Centro de resultado inválido.')
    if (c.contaId && !db.contas.some(x => x.id === c.contaId)) throw new Error('Conta bancária inválida.')
    if (c.tipoPagamentoId && !db.tiposPagamento.some(x => x.id === c.tipoPagamentoId)) throw new Error('Tipo de pagamento inválido.')
    f.naturezaId = c.naturezaId || undefined; f.centroId = c.centroId || undefined; f.contaId = c.contaId || undefined; f.tipoPagamentoId = c.tipoPagamentoId || undefined
  }))
}
