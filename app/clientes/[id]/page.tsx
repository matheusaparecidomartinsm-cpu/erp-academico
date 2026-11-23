'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ClienteForm } from '@/components/ClienteForm'
import { EmptyState, ErrorState, SkeletonRows, useAsync } from '@/components/ui'
import { getCliente } from '@/lib/db'

export default function EditarCliente() {
  const { id } = useParams<{ id: string }>(); const r = useAsync(() => getCliente(id), [id])
  if (r.loading) return <SkeletonRows />
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />
  if (!r.data) return <EmptyState title="Cliente não encontrado" text="Ele pode ter sido removido ou o link está incorreto." action={<Link className="font-semibold text-accent underline" href="/clientes">Voltar aos clientes</Link>} />
  return <ClienteForm cliente={r.data} />
}
