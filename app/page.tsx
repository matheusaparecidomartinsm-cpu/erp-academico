'use client'
import Link from 'next/link'
import { Card, ErrorState, PageHeader, useAsync } from '@/components/ui'
import { dashboard, listPedidos } from '@/lib/db'
import { brl } from '@/lib/money'
import { Badge, DataTable, EmptyState } from '@/components/ui'

export default function Inicio() {
  const d = useAsync(dashboard); const p = useAsync(() => listPedidos())
  const cards = d.data ? [
    { l: 'Vendas do mês', v: brl(d.data.vendasMesCentavos), href: '/notas' },
    { l: 'A receber vencido', v: brl(d.data.receberVencidoCentavos), href: '/financeiro/receber' },
    { l: 'Produtos sem saldo', v: String(d.data.itensSemSaldo), href: '/estoque' },
    { l: 'Pedidos em aberto', v: String(d.data.pedidosAbertos), href: '/pedidos' },
  ] : []
  return (
    <>
      <PageHeader title="Início" subtitle="Visão geral do que precisa de atenção hoje." />
      {d.error ? <ErrorState message={d.error} onRetry={d.reload} /> : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {d.loading ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24 rounded-lg" aria-hidden />) : cards.map(c => (
            <Card key={c.l}><p className="text-xs text-text-muted">{c.l}</p><p className="my-1 text-xl tabular-nums sm:text-xl">{c.v}</p><Link href={c.href} className="text-xs text-accent underline">Ver detalhes</Link></Card>
          ))}
        </div>
      )}
      <h2 className="mb-2 text-md font-semibold">Pedidos recentes</h2>
      {p.data && p.data.length === 0 ? <Card><EmptyState title="Nenhum pedido ainda" text="Crie o primeiro pedido para começar." action={<Link className="font-semibold text-accent underline" href="/pedidos/novo">Novo pedido</Link>} /></Card> : (
        <DataTable caption="Pedidos recentes" rows={(p.data ?? []).slice(0, 5)} cols={[
          { key: 'n', header: 'Nº', render: r => <Link className="text-accent underline" href={`/pedidos/${r.id}`}>{r.numero}</Link> },
          { key: 's', header: 'Situação', render: r => <Badge kind={r.status} /> },
          { key: 't', header: 'Total', align: 'right', render: r => brl(r.totalCentavos) },
        ]} />
      )}
    </>
  )
}
