'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button, Card, DataTable, EmptyState, ErrorState, Field, PageHeader, SkeletonRows, useAsync } from '@/components/ui'
import { baixarCsv } from '@/lib/csv'
import { listCentros, listFinanceiros, listNaturezas } from '@/lib/db'
import { brl } from '@/lib/money'
import { montarRelatorio, type Grupo } from '@/lib/relatorio'
import { hoje } from '@/lib/util'

const mesDe = (iso: string, delta: number) => { const [y, m] = iso.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return d.toISOString().slice(0, 10) }
const fimDoMes = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
const nomeMes = (m: string) => { const [y, mm] = m.split('-'); return `${mm}/${y}` }

export default function RelatorioFinanceiro() {
  const r = useAsync(async () => ({ fins: [...await listFinanceiros('receita'), ...await listFinanceiros('despesa')], nat: await listNaturezas(), cen: await listCentros() }))
  const inicio = mesDe(hoje(), -2)
  const [de, setDe] = useState(inicio); const [ate, setAte] = useState(fimDoMes(mesDe(hoje(), 2)))
  const periodoOk = /^\d{4}-\d{2}-\d{2}$/.test(de) && /^\d{4}-\d{2}-\d{2}$/.test(ate) && de <= ate
  const rel = useMemo(() => (r.data && periodoOk ? montarRelatorio(r.data.fins, r.data.nat, r.data.cen, de, ate) : null), [r.data, de, ate, periodoOk])

  function exportar() {
    if (!rel) return
    const g = (titulo: string, tipo: string, lista: Grupo[]) => lista.map(x => [titulo, tipo, x.nome, x.previstoCentavos / 100, x.realizadoCentavos / 100])
    baixarCsv(`relatorio-financeiro-${de}-a-${ate}.csv`, [
      ['Quadro', 'Tipo', 'Item', 'Previsto', 'Realizado'],
      ['Resumo', 'receita', 'Total', rel.receita.previstoCentavos / 100, rel.receita.realizadoCentavos / 100],
      ['Resumo', 'despesa', 'Total', rel.despesa.previstoCentavos / 100, rel.despesa.realizadoCentavos / 100],
      ['Resumo', 'resultado', 'Receitas menos despesas', rel.resultadoPrevisto / 100, rel.resultadoRealizado / 100],
      ...g('Natureza', 'receita', rel.porNatureza.receita), ...g('Natureza', 'despesa', rel.porNatureza.despesa),
      ...g('Centro', 'receita', rel.porCentro.receita), ...g('Centro', 'despesa', rel.porCentro.despesa),
      ...rel.porMes.flatMap(m => [['Mês', 'receita', nomeMes(m.mes), m.receita.previstoCentavos / 100, m.receita.realizadoCentavos / 100], ['Mês', 'despesa', nomeMes(m.mes), m.despesa.previstoCentavos / 100, m.despesa.realizadoCentavos / 100]]),
    ])
  }
  const tabela = (titulo: string, lista: Grupo[]) => (
    <DataTable caption={titulo} rows={lista.map(x => ({ ...x, id: x.chave }))} cols={[
      { key: 'n', header: 'Item', render: x => x.nome }, { key: 'p', header: 'Previsto', align: 'right', render: x => brl(x.previstoCentavos) }, { key: 'r', header: 'Realizado', align: 'right', render: x => brl(x.realizadoCentavos) }]} />
  )
  const cor = (v: number) => (v < 0 ? 'text-danger' : 'text-text')

  return (
    <>
      <PageHeader title="Relatório financeiro" subtitle="Previsto vem do vencimento; realizado vem do que foi pago ou recebido (baixas estornadas ficam de fora)." actions={<Button variant="secondary" disabled={!rel} onClick={exportar}>Exportar CSV</Button>} />
      <Card className="mb-4 flex flex-wrap items-end gap-3 text-text">
        <Field label="De" type="date" value={de} onChange={e => setDe(e.target.value)} />
        <Field label="Até" type="date" value={ate} onChange={e => setAte(e.target.value)} />
        {!periodoOk && <p role="alert" className="text-sm font-medium text-danger">Informe um período válido: a data inicial não pode ser depois da final.</p>}
      </Card>
      {r.loading ? <SkeletonRows rows={4} /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : !rel ? null : rel.receita.previstoCentavos + rel.despesa.previstoCentavos === 0 ? (
        <EmptyState title="Nada neste período" text="Não há lançamentos com vencimento entre as datas escolhidas. Tente um período maior." />
      ) : (<>
        <ul className="mb-4 grid gap-3 sm:grid-cols-3">
          <li><Card className="text-text"><h2 className="text-sm text-text-muted">Receitas</h2><p className="text-lg font-semibold tabular-nums">{brl(rel.receita.previstoCentavos)}</p><p className="text-sm text-text-muted">recebido: {brl(rel.receita.realizadoCentavos)}</p></Card></li>
          <li><Card className="text-text"><h2 className="text-sm text-text-muted">Despesas</h2><p className="text-lg font-semibold tabular-nums">{brl(rel.despesa.previstoCentavos)}</p><p className="text-sm text-text-muted">pago: {brl(rel.despesa.realizadoCentavos)}</p></Card></li>
          <li><Card className="text-text"><h2 className="text-sm text-text-muted">Resultado</h2><p className={`text-lg font-semibold tabular-nums ${cor(rel.resultadoPrevisto)}`}>{brl(rel.resultadoPrevisto)}</p><p className={`text-sm ${rel.resultadoRealizado < 0 ? 'text-danger' : 'text-text-muted'}`}>realizado: {brl(rel.resultadoRealizado)}</p></Card></li>
        </ul>
        {rel.semClassificar > 0 && <p className="mb-3 text-sm text-text-muted">{rel.semClassificar} lançamento(s) sem natureza. Classifique em <Link className="font-semibold text-accent underline" href="/financeiro/receber">A receber</Link> ou <Link className="font-semibold text-accent underline" href="/financeiro/pagar">A pagar</Link> para o quadro por natureza ficar completo.</p>}
        <h2 className="mb-2 mt-4 text-md font-semibold">Fluxo de caixa por mês</h2>
        <DataTable caption="Fluxo de caixa por mês" rows={rel.porMes.map(m => ({ ...m, id: m.mes }))} cols={[
          { key: 'm', header: 'Mês', render: m => nomeMes(m.mes) },
          { key: 'e', header: 'Entradas previstas', align: 'right', hideOnMobile: true, render: m => brl(m.receita.previstoCentavos) },
          { key: 's', header: 'Saídas previstas', align: 'right', hideOnMobile: true, render: m => brl(m.despesa.previstoCentavos) },
          { key: 'sp', header: 'Saldo previsto', align: 'right', render: m => <span className={cor(m.saldoPrevisto)}>{brl(m.saldoPrevisto)}</span> },
          { key: 'sr', header: 'Saldo realizado', align: 'right', render: m => <span className={cor(m.saldoRealizado)}>{brl(m.saldoRealizado)}</span> },
        ]} />
        <h2 className="mb-2 mt-6 text-md font-semibold">Receitas por natureza</h2>{tabela('Receitas por natureza', rel.porNatureza.receita)}
        <h2 className="mb-2 mt-6 text-md font-semibold">Despesas por natureza</h2>{tabela('Despesas por natureza', rel.porNatureza.despesa)}
        <h2 className="mb-2 mt-6 text-md font-semibold">Receitas por centro de resultado</h2>{tabela('Receitas por centro de resultado', rel.porCentro.receita)}
        <h2 className="mb-2 mt-6 text-md font-semibold">Despesas por centro de resultado</h2>{tabela('Despesas por centro de resultado', rel.porCentro.despesa)}
      </>)}
    </>
  )
}
