// Análise (sem gravar nada) das linhas de um CSV de clientes ou de produtos. A gravação usa as mesmas funções dos formulários.
import { parseMoney } from './money'

export type LinhaCliente = { n: number; bruto: string[]; erro?: string; dados?: { nome: string; documento: string; email: string } }
export type LinhaProduto = { n: number; bruto: string[]; erro?: string; dados?: { descricao: string; grupo: string; unidade: string; precoCentavos: number; controlaEstoque: boolean } }
export type Analise<T> = { linhas: T[]; erroGeral?: string }

/** Desfaz a proteção que o nosso export põe na frente de texto que parece fórmula (= + - @). */
const solta = (c: string) => c.replace(/^'(?=[=+\-@])/, '')
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const ALIAS = {
  nome: ['nome', 'cliente', 'razaosocial'], documento: ['documento', 'cpf', 'cnpj', 'cpfcnpj', 'cpfoucnpj'], email: ['email'],
  descricao: ['descricao', 'produto', 'nome'], grupo: ['grupo', 'categoria'], unidade: ['unidade', 'un'], preco: ['preco', 'precodevenda', 'valor', 'precounitario'],
  estoque: ['controlaestoque', 'estoque', 'controleestoque'],
} as const

function mapa(cab: string[], campos: readonly (keyof typeof ALIAS)[]) {
  const n = cab.map(norm); const idx: Partial<Record<keyof typeof ALIAS, number>> = {}
  for (const c of campos) { const i = n.findIndex(h => (ALIAS[c] as readonly string[]).includes(h)); if (i >= 0) idx[c] = i }
  return idx
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function analisarClientes(linhas: string[][], documentosExistentes: string[]): Analise<LinhaCliente> {
  if (linhas.length === 0) return { linhas: [], erroGeral: 'O arquivo está vazio.' }
  const idx = mapa(linhas[0], ['nome', 'documento', 'email'])
  if (idx.nome === undefined) return { linhas: [], erroGeral: 'Não achei a coluna "nome" na primeira linha.' }
  const vistos = new Set(documentosExistentes.map(d => d.trim()).filter(Boolean))
  const out: LinhaCliente[] = linhas.slice(1).map((bruto, k) => {
    const n = k + 2; const get = (i?: number) => (i === undefined ? '' : solta((bruto[i] ?? '').trim()))
    const nome = get(idx.nome), documento = get(idx.documento), email = get(idx.email)
    if (!nome) return { n, bruto, erro: 'Falta o nome.' }
    if (nome.length > 200) return { n, bruto, erro: 'Nome com mais de 200 caracteres.' }
    if (email && !EMAIL.test(email)) return { n, bruto, erro: 'E-mail inválido.' }
    if (documento) { if (vistos.has(documento)) return { n, bruto, erro: 'Documento repetido (já cadastrado ou repetido no arquivo).' }; vistos.add(documento) }
    return { n, bruto, dados: { nome, documento, email } }
  })
  return { linhas: out }
}

export function analisarProdutos(linhas: string[][]): Analise<LinhaProduto> {
  if (linhas.length === 0) return { linhas: [], erroGeral: 'O arquivo está vazio.' }
  const idx = mapa(linhas[0], ['descricao', 'grupo', 'unidade', 'preco', 'estoque'])
  if (idx.descricao === undefined) return { linhas: [], erroGeral: 'Não achei a coluna "descrição" na primeira linha.' }
  if (idx.preco === undefined) return { linhas: [], erroGeral: 'Não achei a coluna "preço" na primeira linha.' }
  const out: LinhaProduto[] = linhas.slice(1).map((bruto, k) => {
    const n = k + 2; const get = (i?: number) => (i === undefined ? '' : solta((bruto[i] ?? '').trim()))
    const descricao = get(idx.descricao)
    if (!descricao) return { n, bruto, erro: 'Falta a descrição.' }
    if (descricao.length > 200) return { n, bruto, erro: 'Descrição com mais de 200 caracteres.' }
    const preco = parseMoney(get(idx.preco))
    if (preco === null) return { n, bruto, erro: 'Preço inválido (use 12,50, até 10.000.000,00).' }
    const est = norm(get(idx.estoque))
    if (est && !['sim', 's', '1', 'nao', 'n', '0', 'true', 'false'].includes(est)) return { n, bruto, erro: 'Controla estoque: use sim ou não.' }
    return { n, bruto, dados: { descricao, grupo: get(idx.grupo), unidade: get(idx.unidade), precoCentavos: preco, controlaEstoque: !['nao', 'n', '0', 'false'].includes(est) } }
  })
  return { linhas: out }
}
