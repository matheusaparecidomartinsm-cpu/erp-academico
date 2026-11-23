'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EmptyState, ErrorState, SkeletonRows, useAsync } from '@/components/ui'
import { PedidoForm } from '@/components/PedidoForm'
import { getPedido } from '@/lib/db'

export default function EditarPedido() {
  const { id } = useParams<{ id: string }>(); const r = useAsync(() => getPedido(id), [id])
  if (r.loading) return <SkeletonRows />
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />
  if (!r.data) return <EmptyState title="Pedido não encontrado" text="Ele pode ter sido removido ou o link está incorreto." action={<Link className="font-semibold text-accent underline" href="/pedidos">Voltar aos pedidos</Link>} />
  if (r.data.status !== 'rascunho') return <EmptyState title="Este pedido não pode ser alterado" text="Só pedidos em rascunho podem ser alterados. Para os demais, cancele e crie outro." action={<Link className="font-semibold text-accent underline" href={`/pedidos/${id}`}>Voltar ao pedido</Link>} />
  return <PedidoForm pedido={r.data} />
}
