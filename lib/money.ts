export const brl = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const qtdFmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

/** "1.234,56" ou "12,5" -> centavos. Retorna null se inválido. */
/** Maior valor aceito em qualquer campo de dinheiro: R$ 10.000.000,00 (o banco guarda centavos em inteiro de 32 bits). */
export const MAX_CENTAVOS = 1_000_000_000
export const MSG_LIMITE = 'O valor passa do limite de R$ 10.000.000,00.'

export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  if (t === '' || !/^\d+(\.\d{1,2})?$/.test(t)) return null
  const c = Math.round(parseFloat(t) * 100)
  return c > MAX_CENTAVOS ? null : c
}

export function parseQtd(s: string): number | null {
  const t = s.trim().replace(/\./g, '').replace(',', '.')
  if (t === '' || !/^\d+(\.\d{1,3})?$/.test(t)) return null
  const n = parseFloat(t)
  return n > 0 ? n : null
}

export const dataBR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
