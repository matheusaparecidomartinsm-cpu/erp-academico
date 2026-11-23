// Relatório financeiro: previsto (pelo vencimento) e realizado (pelas baixas, sem as estornadas), por natureza, centro e mês.
import type { Centro, Financeiro, Natureza } from './types'

export type Totais = { previstoCentavos: number; realizadoCentavos: number }
export type Grupo = Totais & { chave: string; nome: string }
export type Mes = { mes: string; receita: Totais; despesa: Totais; saldoPrevisto: number; saldoRealizado: number }
export type Relatorio = {
  receita: Totais; despesa: Totais; resultadoPrevisto: number; resultadoRealizado: number
  porNatureza: { receita: Grupo[]; despesa: Grupo[] }; porCentro: { receita: Grupo[]; despesa: Grupo[] }; porMes: Mes[]
  semClassificar: number
}
const zero = (): Totais => ({ previstoCentavos: 0, realizadoCentavos: 0 })
const soma = (a: Totais, b: Totais) => { a.previstoCentavos += b.previstoCentavos; a.realizadoCentavos += b.realizadoCentavos }

/** Valor realizado de um lançamento: baixas não estornadas, sem os juros (juros são tratados à parte e não entram aqui). */
export const realizado = (f: Financeiro) => f.baixas.filter(b => !b.estornadaEm).reduce((s, b) => s + b.valorCentavos, 0)

export function montarRelatorio(fins: Financeiro[], naturezas: Natureza[], centros: Centro[], de: string, ate: string): Relatorio {
  const nomeN = new Map(naturezas.map(n => [n.id, n.nome])); const nomeC = new Map(centros.map(c => [c.id, c.nome]))
  const r: Relatorio = { receita: zero(), despesa: zero(), resultadoPrevisto: 0, resultadoRealizado: 0, porNatureza: { receita: [], despesa: [] }, porCentro: { receita: [], despesa: [] }, porMes: [], semClassificar: 0 }
  const nat = { receita: new Map<string, Grupo>(), despesa: new Map<string, Grupo>() }; const cen = { receita: new Map<string, Grupo>(), despesa: new Map<string, Grupo>() }
  const meses = new Map<string, Mes>()
  const add = (m: Map<string, Grupo>, chave: string, nome: string, t: Totais) => { const g = m.get(chave) ?? { chave, nome, ...zero() }; soma(g, t); m.set(chave, g) }
  for (const f of fins) {
    if (f.status === 'cancelado' || f.vencimento < de || f.vencimento > ate) continue
    const t: Totais = { previstoCentavos: f.valorCentavos, realizadoCentavos: realizado(f) }
    soma(r[f.tipo], t)
    if (!f.naturezaId) r.semClassificar++
    add(nat[f.tipo], f.naturezaId ?? '_', f.naturezaId ? (nomeN.get(f.naturezaId) ?? 'Natureza removida') : 'Sem natureza', t)
    add(cen[f.tipo], f.centroId ?? '_', f.centroId ? (nomeC.get(f.centroId) ?? 'Centro removido') : 'Sem centro', t)
    const mes = f.vencimento.slice(0, 7); const m = meses.get(mes) ?? { mes, receita: zero(), despesa: zero(), saldoPrevisto: 0, saldoRealizado: 0 }
    soma(m[f.tipo], t); meses.set(mes, m)
  }
  const ordena = (m: Map<string, Grupo>) => [...m.values()].sort((a, b) => b.previstoCentavos - a.previstoCentavos || a.nome.localeCompare(b.nome))
  r.porNatureza = { receita: ordena(nat.receita), despesa: ordena(nat.despesa) }; r.porCentro = { receita: ordena(cen.receita), despesa: ordena(cen.despesa) }
  r.resultadoPrevisto = r.receita.previstoCentavos - r.despesa.previstoCentavos; r.resultadoRealizado = r.receita.realizadoCentavos - r.despesa.realizadoCentavos
  r.porMes = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map(m => ({ ...m, saldoPrevisto: m.receita.previstoCentavos - m.despesa.previstoCentavos, saldoRealizado: m.receita.realizadoCentavos - m.despesa.realizadoCentavos }))
  return r
}
