'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Badge, Button, DataTable, EmptyState, ErrorState, PageHeader, SkeletonRows, useAsync, Card } from '@/components/ui'
import { listClientes, listPedidos } from '@/lib/db'
import { brl } from '@/lib/money'

const FILTROS = [['', 'Todos'], ['rascunho', 'Rascunho'], ['confirmado', 'Confirmados'], ['faturado', 'Faturados'], ['cancelado', 'Cancelados']] as const

export default function Pedidos() {
  const [st, setSt] = useState(''); const r = useAsync(() => listPedidos(st), [st]); const c = useAsync(() => listClientes())
  const nome = (id: string) => c.data?.find(x => x.id === id)?.nome ?? '—'
  return (
    <>
      <PageHeader title="Pedidos de venda" subtitle="Do rascunho ao faturamento." actions={<Link href="/pedidos/novo"><Button>Novo pedido</Button></Link>} />
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
        {FILTROS.map(([v, l]) => <Button key={v} size="sm" variant={st === v ? 'primary' : 'secondary'} aria-pressed={st === v} onClick={() => setSt(v)}>{l}</Button>)}
      </div>
      {r.loading ? <SkeletonRows /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.data!.length === 0 ? (
        <Card><EmptyState title="Nenhum pedido ainda" text={st ? 'Não há pedidos nesta situação.' : 'Crie o primeiro pedido para começar.'} action={!st && <Link href="/pedidos/novo"><Button>Novo pedido</Button></Link>} /></Card>
      ) : (
        <DataTable caption="Lista de pedidos" rows={r.data!} cols={[
          { key: 'n', header: 'Nº', render: p => <Link className="font-medium text-accent underline" href={`/pedidos/${p.id}`}>{p.numero}</Link> },
          { key: 'c', header: 'Cliente', render: p => nome(p.clienteId) },
          { key: 'd', header: 'Data', hideOnMobile: true, render: p => new Date(p.criadoEm).toLocaleDateString('pt-BR') },
          { key: 's', header: 'Situação', render: p => <Badge kind={p.status} /> },
          { key: 't', header: 'Total', align: 'right', render: p => brl(p.totalCentavos) },
        ]} />
      )}
    </>
  )
}
