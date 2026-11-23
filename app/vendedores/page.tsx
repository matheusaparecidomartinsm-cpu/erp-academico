'use client'
import { Badge, PageHeader, useAsync } from '@/components/ui'
import { CadastroAux } from '@/components/CadastroAux'
import { listVendedores, salvarVendedor } from '@/lib/db'
import { fmtPercentual, parsePercentual } from '@/lib/comissao'

export default function Vendedores() {
  const r = useAsync(() => listVendedores())
  return (
    <>
      <PageHeader title="Vendedores" subtitle="Quem fechou a venda. Escolha o vendedor no detalhe do pedido." />
      <CadastroAux singular="Vendedor" plural="Vendedores" campos={[{ nome: 'nome', rotulo: 'Nome' }, { nome: 'comissao', rotulo: 'Comissão (%)', tipo: 'numero', ajuda: 'Percentual sobre o total de cada pedido faturado. Use 0 para não pagar comissão.' }, { nome: 'ativo', rotulo: 'Ativo', tipo: 'ativo' }]}
        dados={r.data} carregando={r.loading} erro={r.error} recarregar={r.reload}
        colunas={[{ key: 'n', header: 'Nome', render: v => <span className="font-medium">{v.nome}</span> }, { key: 'c', header: 'Comissão', render: v => fmtPercentual(v.comissaoBps ?? 0) }, { key: 's', header: 'Situação', render: v => <Badge kind={v.ativo ? 'ativo' : 'inativo'} /> }]}
        inicial={v => ({ nome: v?.nome ?? '', comissao: v?.comissaoBps ? String(v.comissaoBps / 100).replace('.', ',') : '', ativo: v && !v.ativo ? 'nao' : 'sim' })}
        salvar={(f, id) => { const bps = parsePercentual(f.comissao ?? ''); if (bps === null) throw new Error('Comissão deve ficar entre 0% e 100%.'); return salvarVendedor({ id, nome: f.nome, ativo: f.ativo === 'sim', comissaoBps: bps }) }}
        vazio="Cadastre quem vende para registrar a autoria dos pedidos." />
    </>
  )
}
