'use client'
import Link from 'next/link'
import { Badge, DataTable, EmptyState, ErrorState, PageHeader, SkeletonRows, useAsync, Card } from '@/components/ui'
import { listNotas, listPedidos } from '@/lib/db'
import { brl } from '@/lib/money'

export default function Notas() {
  const n = useAsync(listNotas); const p = useAsync(() => listPedidos())
  return (
    <>
      <PageHeader title="Notas fiscais" subtitle="Notas de venda emitidas. Neste protótipo as notas são simuladas, sem validade fiscal." />
      {n.loading ? <SkeletonRows /> : n.error ? <ErrorState message={n.error} onRetry={n.reload} /> : n.data!.length === 0 ? (
        <Card><EmptyState title="Nenhuma nota emitida" text="Fature um pedido confirmado para emitir a primeira nota." /></Card>
      ) : (
        <DataTable caption="Notas fiscais" rows={n.data!} cols={[
          { key: 'n', header: 'Número', render: x => `${x.serie}-${x.numero}` },
          { key: 'p', header: 'Pedido', render: x => { const ped = p.data?.find(q => q.id === x.pedidoId); return ped ? <Link className="text-accent underline" href={`/pedidos/${ped.id}`}>{ped.numero}</Link> : '—' } },
          { key: 'e', header: 'Emitida em', hideOnMobile: true, render: x => new Date(x.emitidaEm).toLocaleDateString('pt-BR') },
          { key: 'i', header: 'Impostos (simulados)', hideOnMobile: true, align: 'right', render: x => brl(x.impostosCentavos) },
          { key: 't', header: 'Total', align: 'right', render: x => brl(x.totalCentavos) },
          { key: 's', header: 'Situação', render: x => <Badge kind={x.status} /> },
        ]} />
      )}
    </>
  )
}
