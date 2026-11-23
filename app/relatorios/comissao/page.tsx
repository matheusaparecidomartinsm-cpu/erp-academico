'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button, Card, DataTable, EmptyState, ErrorState, Field, PageHeader, SkeletonRows, useAsync } from '@/components/ui'
import { baixarCsv } from '@/lib/csv'
import { fmtPercentual, montarComissao } from '@/lib/comissao'
import { listNotas, listPedidos, listVendedores } from '@/lib/db'
import { brl, dataBR } from '@/lib/money'
import { hoje } from '@/lib/util'

const ini = (iso: string) => iso.slice(0, 8) + '01'
const fim = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }

export default function Comissoes() {
  const r = useAsync(async () => ({ pedidos: await listPedidos(), notas: await listNotas(), vendedores: await listVendedores() }))
  const [de, setDe] = useState(ini(hoje())); const [ate, setAte] = useState(fim(hoje()))
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(de) && /^\d{4}-\d{2}-\d{2}$/.test(ate) && de <= ate
  const grupos = useMemo(() => (r.data && ok ? montarComissao(r.data.pedidos, r.data.notas, r.data.vendedores, de, ate) : null), [r.data, de, ate, ok])
  const total = (grupos ?? []).reduce((s, g) => s + g.comissaoCentavos, 0)

  function exportar() {
    if (!grupos) return
    baixarCsv(`comissoes-${de}-a-${ate}.csv`, [['Vendedor', 'Pedido', 'Data da nota', 'Total do pedido', 'Percentual', 'Comissão'],
      ...grupos.flatMap(g => g.linhas.map(l => [g.nome, l.numero, l.data, l.totalCentavos / 100, fmtPercentual(g.bps), l.comissaoCentavos / 100]))])
  }
  return (
    <>
      <PageHeader title="Comissões" subtitle="Percentual de cada vendedor sobre o total dos pedidos faturados no período, pela data da nota. Pedido cancelado não conta." actions={<Button variant="secondary" disabled={!grupos || grupos.length === 0} onClick={exportar}>Exportar CSV</Button>} />
      <Card className="mb-4 flex flex-wrap items-end gap-3 text-text">
        <Field label="De" type="date" value={de} onChange={e => setDe(e.target.value)} />
        <Field label="Até" type="date" value={ate} onChange={e => setAte(e.target.value)} />
        {!ok && <p role="alert" className="text-sm font-medium text-danger">Informe um período válido: a data inicial não pode ser depois da final.</p>}
      </Card>
      {r.loading ? <SkeletonRows rows={4} /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : !grupos ? null : grupos.length === 0 ? (
        <EmptyState title="Nenhum pedido faturado neste período" text="A comissão nasce quando um pedido é faturado. Tente um período maior ou fature um pedido." />
      ) : (<>
        <Card className="mb-4 text-text"><h2 className="text-sm text-text-muted">Comissão total no período</h2><p className="text-lg font-semibold tabular-nums">{brl(total)}</p></Card>
        {grupos.map(g => (
          <section key={g.vendedorId ?? '_'} aria-labelledby={`v-${g.vendedorId ?? 'sem'}`} className="mb-6">
            <h2 id={`v-${g.vendedorId ?? 'sem'}`} className="text-md font-semibold">{g.nome}</h2>
            <p className="mb-2 text-sm text-text-muted">
              {g.vendedorId === null ? 'Pedidos sem vendedor escolhido não geram comissão. Escolha o vendedor no detalhe do pedido.'
                : g.bps === 0 ? <>Percentual 0%: nada a pagar. Defina o percentual em <Link className="font-semibold text-accent underline" href="/vendedores">Vendedores</Link>.</>
                : <>Base {brl(g.baseCentavos)} × {fmtPercentual(g.bps)} = <strong className="text-text">{brl(g.comissaoCentavos)}</strong>. Cada pedido é arredondado ao centavo e os centavos são somados.</>}
            </p>
            <DataTable caption={`Pedidos de ${g.nome}`} rows={g.linhas.map(l => ({ ...l, id: l.pedidoId }))} cols={[
              { key: 'p', header: 'Pedido', render: l => <Link className="font-semibold text-accent underline" href={`/pedidos/${l.pedidoId}`}>#{l.numero}</Link> },
              { key: 'd', header: 'Data da nota', render: l => dataBR(l.data) },
              { key: 't', header: 'Total do pedido', align: 'right', render: l => brl(l.totalCentavos) },
              { key: 'c', header: 'Comissão', align: 'right', render: l => brl(l.comissaoCentavos) },
            ]} />
          </section>
        ))}
      </>)}
    </>
  )
}
