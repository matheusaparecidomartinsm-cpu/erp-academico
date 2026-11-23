'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button, Card, Field, PageHeader, useToast, MsgErro } from './ui'
import { atualizarProduto, criarProduto } from '@/lib/db'
import type { Produto } from '@/lib/types'
import { parseMoney } from '@/lib/money'

/** Cadastro de produto: cria ou edita. "Controlar estoque" só pode ser definido na criação. */
export function ProdutoForm({ produto }: { produto?: Produto }) {
  const router = useRouter(); const toast = useToast(); const editando = !!produto
  const [f, setF] = useState({ descricao: produto?.descricao ?? '', grupo: produto && produto.grupo !== 'Sem grupo' ? produto.grupo : '', unidade: produto?.unidade ?? 'UN', preco: produto ? (produto.precoCentavos / 100).toFixed(2).replace('.', ',') : '', controla: produto?.controlaEstoque ?? true, ativo: produto?.ativo ?? true })
  const [erros, setErros] = useState<Record<string, string>>({}); const [salvando, setSalvando] = useState(false); const trava = useRef(false)
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); const er: Record<string, string> = {}
    if (!f.descricao.trim()) er.descricao = 'Informe a descrição do produto.'
    const preco = parseMoney(f.preco); if (preco === null) er.preco = 'Informe o preço, por exemplo 12,50.'
    setErros(er); if (Object.keys(er).length) return
    if (trava.current) return; trava.current = true; setSalvando(true)
    try {
      const p = editando ? await atualizarProduto(produto!.id, { descricao: f.descricao, grupo: f.grupo, unidade: f.unidade, precoCentavos: preco!, ativo: f.ativo })
        : await criarProduto({ descricao: f.descricao, grupo: f.grupo, unidade: f.unidade, precoCentavos: preco!, controlaEstoque: f.controla })
      toast('ok', editando ? `Produto ${p.descricao} atualizado.` : `Produto ${p.descricao} cadastrado.`); router.push('/produtos')
    } catch (err) { trava.current = false; setErros({ geral: (err as Error).message }) } finally { setSalvando(false) }
  }
  return (
    <>
      <PageHeader title={editando ? `Produto ${produto!.codigo}` : 'Novo produto'} subtitle={editando ? produto!.descricao : undefined} />
      <Card className="max-w-xl">
        <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
          <Field label="Descrição" value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} error={erros.descricao} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Grupo" value={f.grupo} onChange={e => setF({ ...f, grupo: e.target.value })} />
            <Field label="Unidade" value={f.unidade} onChange={e => setF({ ...f, unidade: e.target.value })} />
          </div>
          <Field label="Preço de venda" inputMode="decimal" placeholder="0,00" suffix="R$" value={f.preco} onChange={e => setF({ ...f, preco: e.target.value })} error={erros.preco} />
          {editando
            ? <>
              <p className="text-sm text-text-muted">{produto!.controlaEstoque ? 'Este produto controla estoque.' : 'Este produto não controla estoque.'} Isso não pode ser mudado depois de cadastrado.</p>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} />Produto ativo (aparece nos novos pedidos)</label></>
            : <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={f.controla} onChange={e => setF({ ...f, controla: e.target.checked })} />Controlar estoque deste produto</label>}
          {erros.geral && <MsgErro className="text-danger" texto={erros.geral} />}
          <div className="flex gap-2"><Button type="submit" loading={salvando}>{editando ? 'Salvar alterações' : 'Salvar produto'}</Button><Button type="button" variant="secondary" onClick={() => router.push('/produtos')}>Cancelar</Button></div>
        </form>
      </Card>
    </>
  )
}
