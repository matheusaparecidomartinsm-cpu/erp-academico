// Fachada: o app inteiro importa daqui. Com chaves do Supabase configuradas usa o banco real;
// sem elas, usa a demonstração (dados no navegador). Os dois têm as mesmas funções e formatos.
import * as demo from './db-demo'
import * as real from './db-supabase'
import { MODO_REAL } from './modo'

const d = MODO_REAL ? real : demo
export const listClientes = d.listClientes
export const getCliente = d.getCliente
export const criarCliente = d.criarCliente
export const listProdutos = d.listProdutos
export const criarProduto = d.criarProduto
export const ajustarEstoque = d.ajustarEstoque
export const listMovimentos = d.listMovimentos
export const listPedidos = d.listPedidos
export const getPedido = d.getPedido
export const criarPedido = d.criarPedido
export const confirmarPedido = d.confirmarPedido
export const faturarPedido = d.faturarPedido
export const cancelarPedido = d.cancelarPedido
export const listNotas = d.listNotas
export const getNota = d.getNota
export const listFinanceiros = d.listFinanceiros
export const lancarDespesa = d.lancarDespesa
export const baixarFinanceiro = d.baixarFinanceiro
export const dashboard = d.dashboard
export const atualizarCliente = d.atualizarCliente
export const atualizarProduto = d.atualizarProduto
export const getProduto = d.getProduto
export const atualizarPedido = d.atualizarPedido
export const listLocais = d.listLocais
export const criarLocal = d.criarLocal
export const atualizarLocal = d.atualizarLocal
export const transferirEstoque = d.transferirEstoque
export const listTabelasPreco = d.listTabelasPreco
export const criarTabelaPreco = d.criarTabelaPreco
export const definirPreco = d.definirPreco
export const removerPreco = d.removerPreco
export const excluirTabelaPreco = d.excluirTabelaPreco
export const lancarReceita = d.lancarReceita
export const estornarBaixa = d.estornarBaixa
export const listVendedores = d.listVendedores
export const salvarVendedor = d.salvarVendedor
export const listNaturezas = d.listNaturezas
export const salvarNatureza = d.salvarNatureza
export const listCentros = d.listCentros
export const salvarCentro = d.salvarCentro
export const listContas = d.listContas
export const salvarConta = d.salvarConta
export const listTiposPagamento = d.listTiposPagamento
export const salvarTipoPagamento = d.salvarTipoPagamento
export const excluirCadastroAux = d.excluirCadastroAux
export const getEmpresa = d.getEmpresa
export const atualizarEmpresa = d.atualizarEmpresa
export const definirVendedorPedido = d.definirVendedorPedido
export const classificarFinanceiro = d.classificarFinanceiro
export const resetDemo = d.resetDemo
export { hoje, pagoDe, totalItem, vencido } from './util'
// Só existem no modo real:
export const criarEmpresa = real.criarEmpresa
export const temEmpresa = MODO_REAL ? real.temEmpresa : async () => true
