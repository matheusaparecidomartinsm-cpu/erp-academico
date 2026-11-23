'use client'
import { useMemo, useRef, useState } from 'react'
import { Button, Card, DataTable, PageHeader, useAsync, useToast } from '@/components/ui'
import { baixarCsv, LIMITE_BYTES, LIMITE_LINHAS, parseCsv } from '@/lib/csv'
import { analisarClientes, analisarProdutos, type LinhaCliente, type LinhaProduto } from '@/lib/importacao'
import { criarCliente, criarProduto, listClientes } from '@/lib/db'

type Tipo = 'clientes' | 'produtos'
const MODELOS: Record<Tipo, string[][]> = {
  clientes: [['Nome', 'CPF ou CNPJ', 'E-mail'], ['Padaria Exemplo', '12.345.678/0001-90', 'contato@padaria.test']],
  produtos: [['Descrição', 'Grupo', 'Unidade', 'Preço', 'Controla estoque'], ['Copo de papel 200 ml', 'Descartáveis', 'PCT', '12,50', 'sim']],
}

export default function Importar() {
  const toast = useToast(); const cl = useAsync(() => listClientes())
  const [tipo, setTipo] = useState<Tipo>('clientes'); const [texto, setTexto] = useState(''); const [aviso, setAviso] = useState<string | null>(null)
  const [fazendo, setFazendo] = useState(false); const [resultado, setResultado] = useState<{ ok: number; falhas: { n: number; motivo: string }[] } | null>(null)
  const trava = useRef(false)

  const analise = useMemo(() => {
    if (!texto.trim()) return null
    const linhas = parseCsv(texto)
    if (linhas.length - 1 > LIMITE_LINHAS) return { grande: true, linhas: [] as (LinhaCliente | LinhaProduto)[], erroGeral: undefined as string | undefined }
    const a: { linhas: (LinhaCliente | LinhaProduto)[]; erroGeral?: string } = tipo === 'clientes' ? analisarClientes(linhas, (cl.data ?? []).map(c => c.documento)) : analisarProdutos(linhas)
    return { grande: false, linhas: a.linhas, erroGeral: a.erroGeral }
  }, [texto, tipo, cl.data])
  const linhas = analise?.linhas ?? []
  const erroGeral = analise?.erroGeral
  const validas = linhas.filter(l => l.dados).length

  async function lerArquivo(f?: File) {
    setAviso(null); setResultado(null); if (!f) return
    if (f.size > LIMITE_BYTES) { setAviso('Arquivo maior que 1 MB. Divida em partes menores.'); return }
    setTexto(await f.text())
  }
  async function importar() {
    if (trava.current || validas === 0) return
    trava.current = true; setFazendo(true); setResultado(null)
    let ok = 0; const falhas: { n: number; motivo: string }[] = []
    for (const l of linhas) {
      if (!l.dados) continue
      try {
        if (tipo === 'clientes') await criarCliente(l.dados as LinhaCliente['dados'] & object); else await criarProduto(l.dados as LinhaProduto['dados'] & object)
        ok++
      } catch (e) { falhas.push({ n: l.n, motivo: (e as Error).message }) }
    }
    setResultado({ ok, falhas }); setFazendo(false); trava.current = false
    if (ok) { toast('ok', `${ok} ${tipo === 'clientes' ? 'cliente(s)' : 'produto(s)'} importado(s).`); setTexto(''); cl.reload() }
  }

  return (
    <>
      <PageHeader title="Importar cadastros" subtitle="Traga clientes ou produtos de uma planilha. Nada é gravado antes de você conferir a prévia." />
      <div role="group" aria-label="O que importar" className="mb-4 flex gap-2">
        {(['clientes', 'produtos'] as Tipo[]).map(t => <button key={t} type="button" aria-pressed={tipo === t} onClick={() => { setTipo(t); setTexto(''); setResultado(null); setAviso(null) }}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tipo === t ? 'bg-accent text-on-accent' : 'bg-surface-2 text-text'}`}>{t === 'clientes' ? 'Clientes' : 'Produtos'}</button>)}
      </div>
      <Card className="mb-4 flex max-w-3xl flex-col gap-3 text-text">
        <p>Primeira linha com os nomes das colunas: {tipo === 'clientes' ? <strong>Nome, CPF ou CNPJ, E-mail</strong> : <strong>Descrição, Grupo, Unidade, Preço, Controla estoque</strong>}. Serve CSV com ponto e vírgula ou vírgula, até {LIMITE_LINHAS} linhas.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">Arquivo CSV<input type="file" accept=".csv,.txt,text/csv" onChange={e => lerArquivo(e.target.files?.[0])} className="text-sm font-normal" /></label>
          <Button variant="secondary" onClick={() => baixarCsv(`modelo-${tipo}.csv`, MODELOS[tipo])}>Baixar modelo</Button>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">Ou cole o conteúdo aqui
          <textarea value={texto} onChange={e => { setTexto(e.target.value); setResultado(null) }} rows={5} className="w-full rounded-md border border-border-input bg-surface p-2 font-mono text-sm font-normal text-text" />
        </label>
        {aviso && <p role="alert" className="text-sm font-medium text-danger">{aviso}</p>}
      </Card>

      {analise?.grande && <p role="alert" className="mb-3 font-medium text-danger">O arquivo tem mais de {LIMITE_LINHAS} linhas. Divida em partes menores.</p>}
      {erroGeral && <p role="alert" className="mb-3 font-medium text-danger">{erroGeral}</p>}
      {linhas.length > 0 && (<>
        <h2 className="mb-2 text-md font-semibold">Prévia: {validas} linha(s) boa(s) e {linhas.length - validas} com problema</h2>
        <DataTable caption="Prévia da importação" rows={linhas.slice(0, 200).map(l => ({ ...l, id: String(l.n) }))} cols={[
          { key: 'n', header: 'Linha', render: l => l.n },
          { key: 'd', header: tipo === 'clientes' ? 'Nome' : 'Descrição', render: l => l.bruto[0] || '—' },
          { key: 'r', header: 'Situação', render: l => l.erro ? <span className="font-medium text-danger">{l.erro}</span> : <span className="text-text-muted">Pronta</span> },
        ]} />
        {linhas.length > 200 && <p className="mt-2 text-sm text-text-muted">Mostrando as 200 primeiras linhas; todas serão processadas.</p>}
        <div className="mt-4"><Button loading={fazendo} disabled={validas === 0} onClick={importar}>{`Importar ${validas} linha(s)`}</Button></div>
      </>)}
      {resultado && (
        <Card className="mt-4 text-text" >
          <p role="status" className="font-semibold">{resultado.ok} importada(s){resultado.falhas.length ? `, ${resultado.falhas.length} recusada(s) na gravação` : ''}.</p>
          {resultado.falhas.length > 0 && <ul className="ml-4 mt-2 list-disc text-sm">{resultado.falhas.slice(0, 20).map(f => <li key={f.n}>Linha {f.n}: {f.motivo}</li>)}</ul>}
        </Card>
      )}
    </>
  )
}
