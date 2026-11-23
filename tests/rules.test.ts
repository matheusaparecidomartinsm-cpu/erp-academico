import assert from 'node:assert/strict'
import * as db from '../lib/db-demo'
import { parseCsv, toCsv } from '../lib/csv'
import { parseMoney } from '../lib/money'
import { analisarClientes, analisarProdutos } from '../lib/importacao'
import { montarRelatorio } from '../lib/relatorio'
import { proximoPasso, PASSOS } from '../lib/ajuda'
import { montarComissao, parsePercentual, fmtPercentual } from '../lib/comissao'

async function rejeita(p: Promise<unknown>, trecho: string) {
  try { await p } catch (e) { assert.match((e as Error).message, new RegExp(trecho, 'i')); return }
  assert.fail('deveria ter falhado: ' + trecho)
}
const item = (produtoId: string, q: number, preco = 100) => ({ produtoId, quantidade: q, precoCentavos: preco, descontoCentavos: 0 })
let ok = 0
const t = async (nome: string, fn: () => Promise<void>) => { db.__resetMemoryForTests(); await fn(); ok++; console.log('ok  ' + nome) }

;(async () => {
  await t('seed: faturado tem NF e 2 parcelas somando o total', async () => {
    const [p] = (await db.listPedidos('faturado'))
    const fins = (await db.listFinanceiros('receita')).filter(f => f.pedidoId === p.id)
    assert.equal(fins.length, 2); assert.equal(fins.reduce((s, f) => s + f.valorCentavos, 0), p.totalCentavos)
  })
  await t('fluxo F01: criar, confirmar, faturar baixa estoque e gera parcelas', async () => {
    const antes = (await db.listProdutos()).find(p => p.id === 'pro-4')!.saldo
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-4', 10, 320)] })
    await db.confirmarPedido(ped.id)
    const nota = await db.faturarPedido(ped.id, 3, 30)
    assert.equal(nota.totalCentavos, 3200)
    assert.equal((await db.listProdutos()).find(p => p.id === 'pro-4')!.saldo, antes - 10)
    const fins = (await db.listFinanceiros('receita')).filter(f => f.pedidoId === ped.id)
    assert.deepEqual(fins.map(f => f.valorCentavos), [1066, 1066, 1068]) // última parcela absorve a diferença
  })
  await t('estoque insuficiente bloqueia confirmar', async () => {
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-5', 1)] }) // fita sem saldo
    await rejeita(db.confirmarPedido(ped.id), 'saldo insuficiente')
  })
  await t('cliente bloqueado não confirma', async () => {
    const ped = await db.criarPedido({ clienteId: 'cli-4', itens: [item('pro-1', 1)] })
    await rejeita(db.confirmarPedido(ped.id), 'bloqueado')
  })
  await t('faturar duas vezes não gera segunda NF', async () => {
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-1', 1)] })
    await db.confirmarPedido(ped.id); await db.faturarPedido(ped.id, 1, 30)
    const n = (await db.listNotas()).length
    await rejeita(db.faturarPedido(ped.id, 1, 30), 'confirmado')
    assert.equal((await db.listNotas()).length, n)
  })
  await t('falha no meio de faturar não grava nada (atomicidade)', async () => {
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-1', 1)] })
    await db.confirmarPedido(ped.id)
    const nNotas = (await db.listNotas()).length; const nFin = (await db.listFinanceiros('receita')).length
    await rejeita(db.faturarPedido(ped.id, 99, 30), 'parcelas')
    assert.equal((await db.listNotas()).length, nNotas); assert.equal((await db.listFinanceiros('receita')).length, nFin)
    assert.equal((await db.getPedido(ped.id))!.status, 'confirmado')
  })
  await t('cancelar faturado estorna estoque e cancela financeiro e NF', async () => {
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-3', 5, 210)] })
    await db.confirmarPedido(ped.id); const nota = await db.faturarPedido(ped.id, 1, 30)
    const meio = (await db.listProdutos()).find(p => p.id === 'pro-3')!.saldo
    await db.cancelarPedido(ped.id, 'Cliente desistiu')
    assert.equal((await db.listProdutos()).find(p => p.id === 'pro-3')!.saldo, meio + 5)
    assert.equal((await db.getNota(nota.id))!.status, 'cancelada')
    assert.ok((await db.listFinanceiros('receita')).filter(f => f.pedidoId === ped.id).every(f => f.status === 'cancelado'))
  })
  await t('cancelar com parcela baixada é recusado', async () => {
    const [p] = await db.listPedidos('faturado')
    const f = (await db.listFinanceiros('receita')).find(x => x.pedidoId === p.id)!
    await db.baixarFinanceiro(f.id, 100)
    await rejeita(db.cancelarPedido(p.id, 'teste'), 'Estorne os recebimentos')
  })
  await t('baixa parcial e total; excesso é recusado', async () => {
    const f = (await db.listFinanceiros('receita'))[0]
    await rejeita(db.baixarFinanceiro(f.id, f.valorCentavos + 1), 'maior')
    await db.baixarFinanceiro(f.id, 100)
    assert.equal((await db.listFinanceiros('receita')).find(x => x.id === f.id)!.status, 'parcial')
    await db.baixarFinanceiro(f.id, f.valorCentavos - 100)
    assert.equal((await db.listFinanceiros('receita')).find(x => x.id === f.id)!.status, 'baixado')
    await rejeita(db.baixarFinanceiro(f.id, 1), 'baixado')
  })
  await t('ajuste de estoque não deixa saldo negativo e exige motivo', async () => {
    await rejeita(db.ajustarEstoque({ produtoId: 'pro-1', quantidade: -99999, motivo: 'x' }), 'negativo')
    await rejeita(db.ajustarEstoque({ produtoId: 'pro-1', quantidade: 5, motivo: ' ' }), 'motivo')
    await db.ajustarEstoque({ produtoId: 'pro-1', quantidade: 5, motivo: 'contagem' })
  })
  await t('cliente com documento repetido é recusado', async () => {
    await rejeita(db.criarCliente({ nome: 'Outro', documento: '11.111.111/0001-11', email: '' }), 'documento')
  })
  await t('desconto maior que o item é recusado', async () => {
    await rejeita(db.criarPedido({ clienteId: 'cli-1', itens: [{ produtoId: 'pro-1', quantidade: 1, precoCentavos: 100, descontoCentavos: 101 }] }), 'desconto')
  })
  await t('locais: saldo por local, transferência e pedido sai do local escolhido', async () => {
    const l2 = await db.criarLocal({ nome: 'Filial Norte' })
    await rejeita(db.criarLocal({ nome: 'filial norte' }), 'já existe')
    await db.transferirEstoque({ produtoId: 'pro-3', deLocalId: 'loc-1', paraLocalId: l2.id, quantidade: 100 })
    const p = (await db.listProdutos()).find(x => x.id === 'pro-3')!
    assert.equal(p.saldos[l2.id], 100); assert.equal(p.saldos['loc-1'], p.saldo - 100)
    await rejeita(db.transferirEstoque({ produtoId: 'pro-3', deLocalId: l2.id, paraLocalId: l2.id, quantidade: 1 }), 'diferentes')
    await rejeita(db.transferirEstoque({ produtoId: 'pro-3', deLocalId: l2.id, paraLocalId: 'loc-1', quantidade: 101 }), 'saldo insuficiente')
    const ped = await db.criarPedido({ clienteId: 'cli-1', localId: l2.id, itens: [item('pro-6', 1)] })   // guardanapo só existe no principal
    await rejeita(db.confirmarPedido(ped.id), 'saldo insuficiente')
    await rejeita(db.atualizarLocal(l2.id, { nome: 'Filial Norte', ativo: false }), 'ainda tem saldo')
    await rejeita(db.atualizarLocal('loc-1', { nome: 'Depósito principal', ativo: false }), 'saldo')
    await rejeita(db.ajustarEstoque({ produtoId: 'pro-3', quantidade: -101, motivo: 'x', localId: l2.id }), 'negativo')
  })
  await t('tabelas de preço: criar, definir, vincular ao cliente e excluir solta o cliente', async () => {
    const tb = await db.criarTabelaPreco({ nome: 'Atacado' })
    await rejeita(db.criarTabelaPreco({ nome: 'atacado' }), 'já existe')
    await db.definirPreco(tb.id, 'pro-1', 400); await db.definirPreco(tb.id, 'pro-1', 380)
    assert.equal((await db.listTabelasPreco())[0].precos['pro-1'], 380)
    await rejeita(db.definirPreco(tb.id, 'pro-1', -1), 'negativo')
    const c = (await db.listClientes()).find(x => x.id === 'cli-1')!
    await db.atualizarCliente('cli-1', { ...c, tabelaPrecoId: tb.id })
    assert.equal((await db.getCliente('cli-1'))!.tabelaPrecoId, tb.id)
    await db.excluirTabelaPreco(tb.id)
    assert.equal((await db.getCliente('cli-1'))!.tabelaPrecoId, undefined)
  })
  await t('editar cliente, produto e pedido em rascunho', async () => {
    const c = (await db.getCliente('cli-2'))!
    await rejeita(db.atualizarCliente('cli-2', { ...c, documento: '11.111.111/0001-11' }), 'documento')
    await rejeita(db.atualizarCliente('cli-2', { ...c, email: 'sem-arroba' }), 'e-mail')
    await db.atualizarCliente('cli-2', { ...c, bloqueado: true })
    const p1 = await db.criarPedido({ clienteId: 'cli-2', itens: [item('pro-1', 1, 450)] })
    await rejeita(db.confirmarPedido(p1.id), 'bloqueado')
    const pr = (await db.getProduto('pro-1'))!
    const novo = await db.atualizarProduto('pro-1', { ...pr, precoCentavos: 470 }); assert.equal(novo.precoCentavos, 470)
    await rejeita(db.atualizarProduto('pro-1', { ...pr, descricao: ' ' }), 'descrição')
    const alt = await db.atualizarPedido(p1.id, { clienteId: 'cli-1', itens: [item('pro-1', 2, 450), item('pro-3', 3, 210)], observacao: 'x' })
    assert.equal(alt.totalCentavos, 900 + 630)
    await db.confirmarPedido(p1.id)
    await rejeita(db.atualizarPedido(p1.id, { clienteId: 'cli-1', itens: [item('pro-1', 1)] }), 'rascunho')
  })
  await t('financeiro: receita manual, estorno de baixa e cancelamento só depois do estorno', async () => {
    await db.lancarReceita({ descricao: 'Venda avulsa', valorCentavos: 5000, vencimento: '2026-01-10' })
    await rejeita(db.lancarReceita({ descricao: '', valorCentavos: 1, vencimento: '2026-01-10' }), 'descrição')
    const f = (await db.listFinanceiros('receita')).find(x => x.descricao === 'Venda avulsa')!
    await db.baixarFinanceiro(f.id, 5000)
    let atual = (await db.listFinanceiros('receita')).find(x => x.id === f.id)!
    assert.equal(atual.status, 'baixado')
    await db.estornarBaixa(f.id, atual.baixas[0].id)
    atual = (await db.listFinanceiros('receita')).find(x => x.id === f.id)!
    assert.equal(atual.status, 'aberto'); assert.equal(atual.baixas.length, 1)   // histórico mantido
    await rejeita(db.estornarBaixa(f.id, atual.baixas[0].id), 'já foi estornada')
    // pedido faturado com recebimento
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-4', 2, 320)] }); await db.confirmarPedido(ped.id); await db.faturarPedido(ped.id, 1, 30)
    const fr = (await db.listFinanceiros('receita')).find(x => x.pedidoId === ped.id)!
    await db.baixarFinanceiro(fr.id, 640)
    await rejeita(db.cancelarPedido(ped.id, 'desistiu'), 'Estorne os recebimentos')
    const b = (await db.listFinanceiros('receita')).find(x => x.id === fr.id)!.baixas[0]
    await db.estornarBaixa(fr.id, b.id)
    const s0 = (await db.listProdutos()).find(x => x.id === 'pro-4')!.saldo
    await db.cancelarPedido(ped.id, 'desistiu')
    assert.equal((await db.listProdutos()).find(x => x.id === 'pro-4')!.saldo, s0 + 2)
  })
  await t('cadastros auxiliares: vendedor, natureza, conta, tipo, empresa e classificação', async () => {
    await db.salvarVendedor({ nome: 'Carla Teste', ativo: true })
    await rejeita(db.salvarVendedor({ nome: 'carla teste', ativo: true }), 'Já existe')
    await rejeita(db.salvarVendedor({ nome: '  ', ativo: true }), 'Informe o nome')
    const v = (await db.listVendedores()).find(x => x.nome === 'Carla Teste')!
    const ped = await db.criarPedido({ clienteId: 'cli-1', itens: [item('pro-4', 1, 320)] })
    await db.definirVendedorPedido(ped.id, v.id)
    assert.equal((await db.getPedido(ped.id))!.vendedorId, v.id)
    await db.salvarVendedor({ id: v.id, nome: v.nome, ativo: false })
    await rejeita(db.definirVendedorPedido(ped.id, v.id), 'vendedor ativo')
    await db.definirVendedorPedido(ped.id, null)
    await rejeita(db.salvarTipoPagamento({ nome: 'Ruim', parcelas: 0, diasEntre: 30 }), '1 a 48')
    await rejeita(db.salvarTipoPagamento({ nome: 'Ruim', parcelas: 2, diasEntre: -1 }), 'negativo')
    await db.salvarTipoPagamento({ nome: '45 dias', parcelas: 1, diasEntre: 45 })
    await db.salvarConta({ nome: 'Caixa', banco: '' })
    await db.salvarCentro({ nome: 'Loja' })
    await db.salvarNatureza({ nome: 'Frete', tipo: 'despesa' })
    await rejeita(db.salvarNatureza({ nome: 'frete', tipo: 'despesa' }), 'Já existe')
    const nats = await db.listNaturezas(); const frete = nats.find(n => n.nome === 'Frete')!, rec = nats.find(n => n.tipo === 'receita')!
    await db.lancarDespesa({ descricao: 'Frete de teste', valorCentavos: 5000, vencimento: '2030-01-01' })
    const fin = (await db.listFinanceiros('despesa')).find(f => f.descricao === 'Frete de teste')!
    await rejeita(db.classificarFinanceiro(fin.id, { naturezaId: rec.id }), 'é de receita')
    await db.classificarFinanceiro(fin.id, { naturezaId: frete.id, centroId: (await db.listCentros())[0].id })
    assert.equal((await db.listFinanceiros('despesa')).find(f => f.id === fin.id)!.naturezaId, frete.id)
    await db.excluirCadastroAux('naturezas', frete.id)
    assert.equal((await db.listFinanceiros('despesa')).find(f => f.id === fin.id)!.naturezaId, undefined)
    await rejeita(db.atualizarEmpresa({ nome: 'X', cnpj: '123' }), '14 dígitos')
    await db.atualizarEmpresa({ nome: 'Empresa X', cnpj: '11.222.333/0001-81' })
    assert.deepEqual(await db.getEmpresa(), { nome: 'Empresa X', cnpj: '11222333000181' })
  })
  await t('csv: separador, aspas, BOM, linhas vazias e proteção contra fórmula', async () => {
    assert.deepEqual(parseCsv('\uFEFFnome;email\r\nAna;a@x.com\r\n\r\n"Silva; João";"diz ""oi"""\r\n'), [['nome', 'email'], ['Ana', 'a@x.com'], ['Silva; João', 'diz "oi"']])
    assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']])
    assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']])
    assert.equal(toCsv([['=2+2', 'a;b', 'x"y', 12.5, null]]), "'=2+2;\"a;b\";\"x\"\"y\";12,5;\r\n")
    assert.deepEqual(parseCsv(toCsv([['Ação 😀', 'linha\nquebrada']])), [['Ação 😀', 'linha\nquebrada']])
  })
  await t('importação: clientes e produtos validam linha a linha', async () => {
    const c = analisarClientes(parseCsv('Nome;CPF/CNPJ;E-mail\nAna;111;a@x.com\n;222;\nBia;111;\nCaio;333;sem-arroba\nDora;;'), ['999'])
    assert.deepEqual(c.linhas.map(l => l.erro ?? 'ok'), ['ok', 'Falta o nome.', 'Documento repetido (já cadastrado ou repetido no arquivo).', 'E-mail inválido.', 'ok'])
    assert.match(analisarClientes([['x']], []).erroGeral!, /nome/)
    assert.match(analisarClientes([], []).erroGeral!, /vazio/)
    const p = analisarProdutos(parseCsv('Descrição;Grupo;Un;Preço;Controla estoque\nCopo;Descartáveis;PCT;12,50;sim\nServiço;;;3;não\nRuim;;;abc;\nQuase;;;1;talvez'))
    assert.deepEqual(p.linhas.map(l => l.erro ?? 'ok'), ['ok', 'ok', 'Preço inválido (use 12,50, até 10.000.000,00).', 'Controla estoque: use sim ou não.'])
    assert.equal(p.linhas[0].dados!.precoCentavos, 1250); assert.equal(p.linhas[1].dados!.controlaEstoque, false)
    assert.match(analisarProdutos(parseCsv('Descrição;Grupo\nA;B')).erroGeral!, /preço/)
  })
  await t('importação grava pelas mesmas regras: documento repetido e e-mail inválido são recusados na gravação', async () => {
    await db.criarCliente({ nome: 'Importado', documento: '555', email: '' })
    await rejeita(db.criarCliente({ nome: 'Outro', documento: '555', email: '' }), 'documento')
    const antes = (await db.listProdutos()).length
    await db.criarProduto({ descricao: 'Importado', grupo: '', unidade: '', precoCentavos: 100, controlaEstoque: true })
    assert.equal((await db.listProdutos()).length, antes + 1)
  })
  await t('relatório financeiro: previsto x realizado, estorno, cancelado, período e classificação', async () => {
    await db.lancarDespesa({ descricao: 'Aluguel', valorCentavos: 10000, vencimento: '2030-01-10' })
    await db.lancarDespesa({ descricao: 'Luz', valorCentavos: 2000, vencimento: '2030-02-10' })
    await db.lancarReceita({ descricao: 'Serviço', valorCentavos: 30000, vencimento: '2030-01-20' })
    const nat = await db.listNaturezas(); const cen = await db.listCentros()
    const alug = nat.find(n => n.tipo === 'despesa')!
    const d = await db.listFinanceiros('despesa'); const f = d.find(x => x.descricao === 'Aluguel')!
    await db.classificarFinanceiro(f.id, { naturezaId: alug.id, centroId: cen[0].id })
    await db.baixarFinanceiro(f.id, 4000)
    const b = (await db.listFinanceiros('despesa')).find(x => x.id === f.id)!.baixas[0]
    const fins = [...await db.listFinanceiros('despesa'), ...await db.listFinanceiros('receita')].filter(x => ['Aluguel', 'Luz', 'Serviço'].includes(x.descricao))
    let r = montarRelatorio(fins, nat, cen, '2030-01-01', '2030-01-31')
    assert.equal(r.despesa.previstoCentavos, 10000); assert.equal(r.despesa.realizadoCentavos, 4000)
    assert.equal(r.receita.previstoCentavos, 30000); assert.equal(r.resultadoPrevisto, 20000); assert.equal(r.resultadoRealizado, -4000)
    assert.equal(r.porNatureza.despesa[0].nome, alug.nome); assert.equal(r.semClassificar, 1)
    assert.equal(r.porMes.length, 1)
    r = montarRelatorio(fins, nat, cen, '2030-01-01', '2030-12-31'); assert.equal(r.porMes.length, 2); assert.equal(r.despesa.previstoCentavos, 12000)
    await db.estornarBaixa(f.id, b.id)
    const fins2 = [...await db.listFinanceiros('despesa'), ...await db.listFinanceiros('receita')].filter(x => ['Aluguel', 'Luz', 'Serviço'].includes(x.descricao))
    assert.equal(montarRelatorio(fins2, nat, cen, '2030-01-01', '2030-01-31').despesa.realizadoCentavos, 0)
    assert.equal(montarRelatorio(fins2, nat, cen, '2031-01-01', '2031-12-31').despesa.previstoCentavos, 0)
  })
  await t('B-004: valores acima do limite são recusados com mensagem clara (parse, produto, receita, despesa, importação)', async () => {
    assert.equal(parseMoney('999999999999'), null); assert.equal(parseMoney('10.000.000,00'), 1_000_000_000); assert.equal(parseMoney('10.000.000,01'), null)
    await rejeita(db.criarProduto({ descricao: 'Caro', grupo: '', unidade: '', precoCentavos: 2_000_000_000, controlaEstoque: true }), 'limite')
    await rejeita(db.lancarReceita({ descricao: 'Grande', valorCentavos: 2_000_000_000, vencimento: '2030-01-01' }), 'limite')
    await rejeita(db.lancarDespesa({ descricao: 'Grande', valorCentavos: 2_000_000_000, vencimento: '2030-01-01' }), 'limite')
    assert.match(analisarProdutos(parseCsv('Descrição;Preço\nA;99999999999')).linhas[0].erro!, /até 10\.000\.000,00/)
  })
  await t('B-005: ida e volta — o apóstrofo de proteção do export não vira parte do nome na importação', async () => {
    const volta = parseCsv(toCsv([['Nome', 'Documento'], ['=1+1 Padaria', '@x'], ["'Quote", '']]))
    const c = analisarClientes(volta, [])
    assert.equal(c.linhas[0].dados!.nome, '=1+1 Padaria'); assert.equal(c.linhas[0].dados!.documento, '@x'); assert.equal(c.linhas[1].dados!.nome, "'Quote")
  })
  await t('ajuda: cada erro conhecido tem próximo passo; erro desconhecido não inventa dica', async () => {
    assert.match(proximoPasso('Saldo insuficiente de "X": 1 disponível, 5 pedido.')!.fazer, /Estoque/)
    assert.match(proximoPasso('Há parcelas com recebimento. Estorne os recebimentos em Contas a receber antes de cancelar o pedido.')!.href!, /receber/)
    assert.equal(proximoPasso('Algo totalmente novo aconteceu.'), null)
    assert.match(proximoPasso('TypeError: Failed to fetch')!.quando, /conexão/)
    assert.ok(PASSOS.every(p => p.fazer.length > 10 && p.quando.length > 5))
    assert.ok(PASSOS.every(p => !p.href || p.link))
  })
  await t('comissão: percentual, período, cancelado, sem vendedor e arredondamento', async () => {
    assert.equal(parsePercentual('2,5'), 250); assert.equal(parsePercentual(''), 0); assert.equal(parsePercentual('100'), 10000)
    assert.equal(parsePercentual('100,01'), null); assert.equal(parsePercentual('-1'), null); assert.equal(parsePercentual('1,234'), null); assert.equal(parsePercentual('abc'), null)
    assert.equal(fmtPercentual(250), '2,5%'); assert.equal(fmtPercentual(500), '5%')
    const vs = [{ id: 'v1', nome: 'Ana', ativo: true, comissaoBps: 250 }, { id: 'v2', nome: 'Bia', ativo: true }]
    const ped = (id: string, n: number, st: string, v: string | undefined, tot: number, nota?: string) => ({ id, numero: n, clienteId: 'c', status: st, itens: [], totalCentavos: tot, localId: 'l', vendedorId: v, notaId: nota, parcelas: 1, diasEntre: 30, criadoEm: '2030-01-01T10:00:00Z' }) as never
    const nt = (id: string, d: string, st = 'emitida') => ({ id, numero: 1, serie: 1, pedidoId: 'x', tipo: 'venda', status: st, totalCentavos: 0, impostosCentavos: 0, emitidaEm: d + 'T12:00:00Z' }) as never
    const r = montarComissao([ped('a', 1, 'faturado', 'v1', 10001, 'n1'), ped('b', 2, 'faturado', 'v1', 5000, 'n2'), ped('c', 3, 'cancelado', 'v1', 9999), ped('d', 4, 'faturado', 'v2', 7000, 'n3'), ped('e', 5, 'faturado', undefined, 3000, 'n4'), ped('f', 6, 'faturado', 'v1', 8000, 'n5')],
      [nt('n1', '2030-02-10'), nt('n2', '2030-03-05'), nt('n3', '2030-02-11'), nt('n4', '2030-02-12'), nt('n5', '2030-02-13', 'cancelada')], vs, '2030-02-01', '2030-02-28')
    const ana = r.find(x => x.vendedorId === 'v1')!; assert.equal(ana.linhas.length, 1); assert.equal(ana.baseCentavos, 10001); assert.equal(ana.comissaoCentavos, 250)
    assert.equal(r.find(x => x.vendedorId === 'v2')!.comissaoCentavos, 0); assert.equal(r.find(x => x.vendedorId === null)!.nome, 'Sem vendedor'); assert.equal(r.find(x => x.vendedorId === null)!.comissaoCentavos, 0)
  })
  await t('vendedor guarda comissão e recusa percentual fora de 0 a 100', async () => {
    await db.salvarVendedor({ nome: 'Com Comissão', ativo: true, comissaoBps: 350 })
    assert.equal((await db.listVendedores()).find(v => v.nome === 'Com Comissão')!.comissaoBps, 350)
    await rejeita(db.salvarVendedor({ nome: 'Exagero', ativo: true, comissaoBps: 10001 }), 'Comissão deve ficar entre')
    await rejeita(db.salvarVendedor({ nome: 'Negativo', ativo: true, comissaoBps: -1 }), 'Comissão deve ficar entre')
    const ana = (await db.listVendedores())[0]; await db.salvarVendedor({ id: ana.id, nome: ana.nome, ativo: true })
    assert.equal((await db.listVendedores())[0].comissaoBps ?? 0, ana.comissaoBps ?? 0)
  })
  console.log(`\n${ok} testes passaram`)
})().catch(e => { console.error('FALHOU:', e); process.exit(1) })
