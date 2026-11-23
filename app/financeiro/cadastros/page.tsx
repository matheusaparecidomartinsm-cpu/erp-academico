'use client'
import { useState } from 'react'
import { PageHeader, useAsync } from '@/components/ui'
import { CadastroAux } from '@/components/CadastroAux'
import { excluirCadastroAux, listCentros, listContas, listNaturezas, listTiposPagamento, salvarCentro, salvarConta, salvarNatureza, salvarTipoPagamento } from '@/lib/db'

const ABAS = [['naturezas', 'Naturezas'], ['centros', 'Centros de resultado'], ['contas', 'Contas bancárias'], ['tipos', 'Tipos de pagamento']] as const
type Aba = typeof ABAS[number][0]
const nome = (n: string) => ({ key: 'n', header: 'Nome', render: (t: { nome: string }) => <span className="font-medium">{t.nome}</span> })

function Naturezas() {
  const r = useAsync(() => listNaturezas())
  return <CadastroAux artigo="a" singular="Natureza" plural="Naturezas" campos={[{ nome: 'nome', rotulo: 'Nome' }, { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [{ valor: 'receita', rotulo: 'Receita' }, { valor: 'despesa', rotulo: 'Despesa' }] }]}
    dados={r.data} carregando={r.loading} erro={r.error} recarregar={r.reload}
    colunas={[nome(''), { key: 't', header: 'Tipo', render: t => t.tipo === 'receita' ? 'Receita' : 'Despesa' }]}
    inicial={t => ({ nome: t?.nome ?? '', tipo: t?.tipo ?? 'receita' })}
    salvar={(f, id) => salvarNatureza({ id, nome: f.nome, tipo: f.tipo as 'receita' | 'despesa' })} excluir={t => excluirCadastroAux('naturezas', t.id)}
    vazio="Naturezas dizem de onde vem ou para onde vai o dinheiro, como “Aluguel” ou “Venda de mercadorias”." />
}
function Centros() {
  const r = useAsync(() => listCentros())
  return <CadastroAux singular="Centro de resultado" plural="Centros de resultado" campos={[{ nome: 'nome', rotulo: 'Nome' }]}
    dados={r.data} carregando={r.loading} erro={r.error} recarregar={r.reload} colunas={[nome('')]} inicial={t => ({ nome: t?.nome ?? '' })}
    salvar={(f, id) => salvarCentro({ id, nome: f.nome })} excluir={t => excluirCadastroAux('centros_resultado', t.id)}
    vazio="Centros de resultado agrupam receitas e despesas por área, como Comercial ou Administrativo." />
}
function Contas() {
  const r = useAsync(() => listContas())
  return <CadastroAux artigo="a" singular="Conta bancária" plural="Contas bancárias" campos={[{ nome: 'nome', rotulo: 'Nome' }, { nome: 'banco', rotulo: 'Banco', ajuda: 'Opcional.' }]}
    dados={r.data} carregando={r.loading} erro={r.error} recarregar={r.reload} colunas={[nome(''), { key: 'b', header: 'Banco', render: t => t.banco || '—' }]}
    inicial={t => ({ nome: t?.nome ?? '', banco: t?.banco ?? '' })} salvar={(f, id) => salvarConta({ id, nome: f.nome, banco: f.banco })} excluir={t => excluirCadastroAux('contas_bancarias', t.id)}
    vazio="Cadastre as contas por onde o dinheiro entra e sai. Este protótipo trabalha só em reais." />
}
function Tipos() {
  const r = useAsync(() => listTiposPagamento())
  return <CadastroAux singular="Tipo de pagamento" plural="Tipos de pagamento" campos={[{ nome: 'nome', rotulo: 'Nome' }, { nome: 'parcelas', rotulo: 'Parcelas', tipo: 'numero' }, { nome: 'dias', rotulo: 'Dias entre parcelas', tipo: 'numero' }]}
    dados={r.data} carregando={r.loading} erro={r.error} recarregar={r.reload}
    colunas={[nome(''), { key: 'p', header: 'Parcelas', render: t => t.parcelas }, { key: 'd', header: 'Intervalo', hideOnMobile: true, render: t => `${t.diasEntre} dias` }]}
    inicial={t => ({ nome: t?.nome ?? '', parcelas: String(t?.parcelas ?? 1), dias: String(t?.diasEntre ?? 30) })}
    salvar={(f, id) => salvarTipoPagamento({ id, nome: f.nome, parcelas: Number(f.parcelas), diasEntre: Number(f.dias) })} excluir={t => excluirCadastroAux('tipos_pagamento', t.id)}
    vazio="Ex.: “À vista” (1 parcela) ou “30/60 dias” (2 parcelas, 30 dias entre elas)." />
}

export default function CadastrosFinanceiros() {
  const [aba, setAba] = useState<Aba>('naturezas')
  return (
    <>
      <PageHeader title="Classificações financeiras" subtitle="Naturezas, centros de resultado, contas e formas de pagamento usados nos lançamentos." />
      <div role="group" aria-label="Cadastro" className="mb-4 flex flex-wrap gap-2">
        {ABAS.map(([k, l]) => <button key={k} type="button" aria-pressed={aba === k} onClick={() => setAba(k)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${aba === k ? 'bg-accent text-on-accent' : 'bg-surface-2 text-text'}`}>{l}</button>)}
      </div>
      {aba === 'naturezas' ? <Naturezas /> : aba === 'centros' ? <Centros /> : aba === 'contas' ? <Contas /> : <Tipos />}
    </>
  )
}
