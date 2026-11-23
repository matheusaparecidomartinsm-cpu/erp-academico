'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button, Card, Field, PageHeader, SelectField, useAsync, useToast, MsgErro } from './ui'
import { atualizarCliente, criarCliente, listTabelasPreco } from '@/lib/db'
import type { Cliente } from '@/lib/types'

/** Cadastro de cliente: cria ou edita (nome, documento, e-mail, bloqueio, tabela de preço). */
export function ClienteForm({ cliente }: { cliente?: Cliente }) {
  const router = useRouter(); const toast = useToast(); const editando = !!cliente
  const tabs = useAsync(() => listTabelasPreco())
  const [f, setF] = useState({ nome: cliente?.nome ?? '', documento: cliente?.documento ?? '', email: cliente?.email ?? '', bloqueado: cliente?.bloqueado ?? false, ativo: cliente?.ativo ?? true, tabelaPrecoId: cliente?.tabelaPrecoId ?? '' })
  const [erro, setErro] = useState<string | null>(null); const [salvando, setSalvando] = useState(false); const trava = useRef(false)
  const set = (k: 'nome' | 'documento' | 'email') => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (trava.current) return; trava.current = true; setErro(null); setSalvando(true)
    try {
      const c = editando ? await atualizarCliente(cliente!.id, { ...f, tabelaPrecoId: f.tabelaPrecoId || undefined }) : await criarCliente(f)
      toast('ok', editando ? `Cliente ${c.nome} atualizado.` : `Cliente ${c.nome} cadastrado.`); router.push('/clientes')
    } catch (err) { trava.current = false; setErro((err as Error).message) } finally { setSalvando(false) }
  }
  return (
    <>
      <PageHeader title={editando ? `Cliente ${cliente!.codigo}` : 'Novo cliente'} subtitle={editando ? cliente!.nome : undefined} />
      <Card className="max-w-xl">
        <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
          <Field label="Nome" value={f.nome} onChange={set('nome')} error={erro && /nome/i.test(erro) ? erro : null} />
          <Field label="CPF ou CNPJ" help="Opcional, mas não pode repetir." value={f.documento} onChange={set('documento')} error={erro && /documento/i.test(erro) ? erro : null} />
          <Field label="E-mail" type="email" value={f.email} onChange={set('email')} error={erro && /e-mail/i.test(erro) ? erro : null} />
          {editando && <>
            <SelectField label="Tabela de preço" value={f.tabelaPrecoId} onChange={e => setF({ ...f, tabelaPrecoId: e.target.value })}>
              <option value="">Preço do cadastro do produto</option>{(tabs.data ?? []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </SelectField>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.bloqueado} onChange={e => setF({ ...f, bloqueado: e.target.checked })} /><span>Bloqueado para vendas<br /><span className="text-sm text-text-muted">Pedidos novos podem ser salvos, mas não confirmados.</span></span></label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} />Cliente ativo</label>
          </>}
          {erro && !/nome|documento|e-mail/i.test(erro) && <MsgErro className="text-danger" texto={erro} />}
          <div className="flex gap-2"><Button type="submit" loading={salvando}>{editando ? 'Salvar alterações' : 'Salvar cliente'}</Button><Button type="button" variant="secondary" onClick={() => router.push('/clientes')}>Cancelar</Button></div>
        </form>
      </Card>
    </>
  )
}
