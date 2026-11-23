import type { Financeiro, ItemPedido } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
/** Data local (fuso do usuário) em aaaa-mm-dd. */
export const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const mesLocal = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
export const addDias = (iso: string, d: number) => {
  const dt = new Date(iso + 'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate() + d); return dt.toISOString().slice(0, 10)
}
export const totalItem = (i: ItemPedido) => Math.max(0, Math.round(i.quantidade * i.precoCentavos) - i.descontoCentavos)
export const pagoDe = (f: Financeiro) => f.baixas.filter(b => !b.estornadaEm).reduce((s, b) => s + b.valorCentavos, 0)
export const vencido = (f: Financeiro) => (f.status === 'aberto' || f.status === 'parcial') && f.vencimento < hoje()
