'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ProdutoForm } from '@/components/ProdutoForm'
import { EmptyState, ErrorState, SkeletonRows, useAsync } from '@/components/ui'
import { getProduto } from '@/lib/db'

export default function EditarProduto() {
  const { id } = useParams<{ id: string }>(); const r = useAsync(() => getProduto(id), [id])
  if (r.loading) return <SkeletonRows />
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />
  if (!r.data) return <EmptyState title="Produto não encontrado" text="Ele pode ter sido removido ou o link está incorreto." action={<Link className="font-semibold text-accent underline" href="/produtos">Voltar aos produtos</Link>} />
  return <ProdutoForm produto={r.data} />
}
