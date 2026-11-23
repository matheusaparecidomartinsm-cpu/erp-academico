// Comissão por vendedor: percentual do total de cada pedido faturado no período (data da nota). Pedido cancelado não conta.
import type { Nota, Pedido, Vendedor } from './types'

export const MAX_BPS = 10000 // 100,00%
export type LinhaComissao = { pedidoId: string; numero: number; data: string; totalCentavos: number; comissaoCentavos: number }
export type ComissaoVendedor = { vendedorId: string | null; nome: string; bps: number; linhas: LinhaComissao[]; baseCentavos: number; comissaoCentavos: number }

/** "2,5" -> 250; vazio -> 0; fora de 0 a 100 ou com mais de 2 casas -> null. */
export function parsePercentual(s: string): number | null {
  const t = s.trim().replace('%', '').replace(/\s/g, '').replace(',', '.')
  if (t === '') return 0
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const bps = Math.round(parseFloat(t) * 100)
  return bps > MAX_BPS ? null : bps
}
export const fmtPercentual = (bps: number) => `${(bps / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`

export function montarComissao(pedidos: Pedido[], notas: Nota[], vendedores: Vendedor[], de: string, ate: string): ComissaoVendedor[] {
  const nota = new Map(notas.map(n => [n.id, n])); const mapa = new Map<string, ComissaoVendedor>()
  const get = (id: string | null) => {
    const v = vendedores.find(x => x.id === id); const k = id ?? '_'
    if (!mapa.has(k)) mapa.set(k, { vendedorId: id, nome: id ? (v?.nome ?? 'Vendedor removido') : 'Sem vendedor', bps: id ? (v?.comissaoBps ?? 0) : 0, linhas: [], baseCentavos: 0, comissaoCentavos: 0 })
    return mapa.get(k)!
  }
  for (const p of pedidos) {
    if (p.status !== 'faturado') continue
    const n = p.notaId ? nota.get(p.notaId) : undefined
    if (n && n.status === 'cancelada') continue
    const data = (n?.emitidaEm ?? p.criadoEm).slice(0, 10)
    if (data < de || data > ate) continue
    const g = get(p.vendedorId ?? null); const c = Math.round(p.totalCentavos * g.bps / 10000)
    g.linhas.push({ pedidoId: p.id, numero: p.numero, data, totalCentavos: p.totalCentavos, comissaoCentavos: c })
    g.baseCentavos += p.totalCentavos; g.comissaoCentavos += c
  }
  for (const g of mapa.values()) g.linhas.sort((a, b) => a.numero - b.numero)
  return [...mapa.values()].sort((a, b) => b.comissaoCentavos - a.comissaoCentavos || a.nome.localeCompare(b.nome))
}
