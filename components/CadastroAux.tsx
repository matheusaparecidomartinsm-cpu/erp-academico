'use client'
import { ReactNode, useState } from 'react'
import { Button, Card, DataTable, EmptyState, ErrorState, Field, Modal, SelectField, SkeletonRows, useToast, MsgErro } from './ui'

export type Campo = { nome: string; rotulo: string; tipo?: 'texto' | 'numero' | 'select' | 'ativo'; opcoes?: { valor: string; rotulo: string }[]; ajuda?: string }
type Props<T extends { id: string }> = {
  singular: string; plural: string; artigo?: 'o' | 'a'; campos: Campo[]
  dados?: T[] | null; carregando: boolean; erro?: string | null; recarregar: () => void
  colunas: { key: string; header: string; render: (t: T) => ReactNode; hideOnMobile?: boolean }[]
  inicial: (t: T | null) => Record<string, string>
  salvar: (valores: Record<string, string>, id?: string) => Promise<void>
  excluir?: (t: T) => Promise<void>
  vazio: string
}

export function CadastroAux<T extends { id: string; nome: string }>(p: Props<T>) {
  const toast = useToast(); const art = p.artigo ?? 'o'
  const [alvo, setAlvo] = useState<T | 'novo' | null>(null); const [v, setV] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [apagar, setApagar] = useState<T | null>(null)
  const abrir = (t: T | 'novo') => { setAlvo(t); setV(p.inicial(t === 'novo' ? null : t)); setErro(null) }
  async function ok() {
    setErro(null); setLoading(true)
    try { await p.salvar(v, alvo === 'novo' ? undefined : (alvo as T).id); toast('ok', `${p.singular} salv${art}.`); setAlvo(null); p.recarregar() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  async function remover() {
    setLoading(true); setErro(null)
    try { await p.excluir!(apagar!); toast('ok', `${p.singular} excluíd${art}.`); setApagar(null); p.recarregar() } catch (e) { setErro((e as Error).message) } finally { setLoading(false) }
  }
  const cols = [...p.colunas, { key: '_a', header: '', render: (t: T) => (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="secondary" onClick={() => abrir(t)} aria-label={`Editar ${t.nome}`}>Editar</Button>
      {p.excluir && <Button size="sm" variant="ghost" onClick={() => { setErro(null); setApagar(t) }} aria-label={`Excluir ${t.nome}`}>Excluir</Button>}
    </span>) }]
  return (
    <section aria-label={p.plural}>
      <div className="mb-3 flex justify-end"><Button onClick={() => abrir('novo')}>{`Nov${art} ${p.singular.toLowerCase()}`}</Button></div>
      {p.carregando ? <SkeletonRows rows={3} /> : p.erro ? <ErrorState message={p.erro} onRetry={p.recarregar} /> : p.dados!.length === 0 ? (
        <Card><EmptyState title={`Nenhum${art === 'a' ? 'a' : ''} ${p.singular.toLowerCase()}`} text={p.vazio} action={<Button onClick={() => abrir('novo')}>{`Nov${art} ${p.singular.toLowerCase()}`}</Button>} /></Card>
      ) : <DataTable caption={p.plural} rows={p.dados!} cols={cols.map(c => ({ ...c, align: c.key === '_a' ? 'right' as const : undefined }))} />}
      <Modal open={alvo !== null} title={alvo === 'novo' ? `Nov${art} ${p.singular.toLowerCase()}` : `Editar ${p.singular.toLowerCase()}`} onClose={() => setAlvo(null)}
        footer={<><Button variant="secondary" onClick={() => setAlvo(null)}>Voltar</Button><Button loading={loading} onClick={ok}>Salvar</Button></>}>
        <div className="flex flex-col gap-3 text-text">
          {p.campos.map(c => c.tipo === 'select' ? (
            <SelectField key={c.nome} label={c.rotulo} value={v[c.nome] ?? ''} onChange={e => setV({ ...v, [c.nome]: e.target.value })}>{c.opcoes!.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}</SelectField>
          ) : c.tipo === 'ativo' ? (
            <label key={c.nome} className="flex items-center gap-2"><input type="checkbox" checked={v[c.nome] === 'sim'} onChange={e => setV({ ...v, [c.nome]: e.target.checked ? 'sim' : 'nao' })} />{c.rotulo}</label>
          ) : <Field key={c.nome} label={c.rotulo} help={c.ajuda} inputMode={c.tipo === 'numero' ? 'numeric' : undefined} value={v[c.nome] ?? ''} onChange={e => setV({ ...v, [c.nome]: e.target.value })} />)}
          {erro && <MsgErro className="text-sm font-medium text-danger" texto={erro} />}
        </div>
      </Modal>
      <Modal open={apagar !== null} title={`Excluir ${p.singular.toLowerCase()}`} onClose={() => setApagar(null)} footer={<><Button variant="secondary" onClick={() => setApagar(null)}>Voltar</Button><Button variant="danger" loading={loading} onClick={remover}>Excluir</Button></>}>
        <div className="flex flex-col gap-2 text-text"><p>Excluir “{apagar?.nome}”? Lançamentos que usavam {art === 'a' ? 'esta' : 'este'} {p.singular.toLowerCase()} ficam sem classificação.</p>{erro && <MsgErro className="font-medium text-danger" texto={erro} />}</div>
      </Modal>
    </section>
  )
}
