// Leitura e escrita de CSV, escritas aqui do zero. Aceita ; ou , como separador, aspas, "" dentro de aspas e quebras CRLF.

export const LIMITE_LINHAS = 500
export const LIMITE_BYTES = 1_000_000

function separadorDe(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
  let aspas = false, pv = 0, v = 0, tab = 0
  for (const ch of primeira) {
    if (ch === '"') aspas = !aspas
    else if (!aspas) { if (ch === ';') pv++; else if (ch === ',') v++; else if (ch === '\t') tab++ }
  }
  return tab > pv && tab > v ? '\t' : pv >= v && pv > 0 ? ';' : ','
}

/** Lê um CSV em linhas de células. Linhas totalmente vazias são ignoradas. */
export function parseCsv(textoBruto: string): string[][] {
  const texto = textoBruto.replace(/^﻿/, '')
  const sep = separadorDe(texto)
  const linhas: string[][] = []
  let linha: string[] = [], cel = '', aspas = false
  const fechaCel = () => { linha.push(cel); cel = '' }
  const fechaLinha = () => { fechaCel(); if (linha.some(c => c.trim() !== '')) linhas.push(linha); linha = [] }
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"') { if (texto[i + 1] === '"') { cel += '"'; i++ } else aspas = false } else cel += ch
    } else if (ch === '"' && cel === '') aspas = true
    else if (ch === sep) fechaCel()
    else if (ch === '\n') fechaLinha()
    else if (ch === '\r') { if (texto[i + 1] !== '\n') fechaLinha() }
    else cel += ch
  }
  if (cel !== '' || linha.length > 0) fechaLinha()
  return linhas
}

export type Celula = string | number | null | undefined

/**
 * Gera CSV (separador ;, quebra CRLF). Texto que começa com = + - @ ou tabulação ganha um apóstrofo na frente,
 * para que Excel e Planilhas não executem como fórmula. Números saem com vírgula decimal e sem essa proteção.
 */
export function toCsv(linhas: Celula[][]): string {
  const cel = (c: Celula): string => {
    if (c === null || c === undefined) return ''
    if (typeof c === 'number') return String(c).replace('.', ',')
    let s = c
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return linhas.map(l => l.map(cel).join(';')).join('\r\n') + '\r\n'
}

/** Baixa um CSV no navegador (com BOM, para o Excel reconhecer os acentos). Só roda no cliente. */
export function baixarCsv(nomeArquivo: string, linhas: Celula[][]) {
  const blob = new Blob(['﻿' + toCsv(linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = nomeArquivo; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
