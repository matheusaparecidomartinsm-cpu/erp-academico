'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Badge, Button, DataTable, EmptyState, ErrorState, BuscaCard, PageHeader, SkeletonRows, useAsync } from '@/components/ui'
import { Users } from 'lucide-react'
import { listClientes } from '@/lib/db'

export default function Clientes() {
  const [q, setQ] = useState(''); const r = useAsync(() => listClientes(q), [q])
  return (
    <>
      <PageHeader icon={Users} title="Clientes" subtitle="Quem compra de você." actions={<Link href="/clientes/novo"><Button>Novo cliente</Button></Link>} />
      <BuscaCard value={q} onChange={setQ} placeholder="Nome, documento ou código" />
      {r.loading ? <SkeletonRows /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.data!.length === 0 ? (
        <EmptyState title="Nenhum cliente encontrado" text={q ? 'Tente outro termo de busca.' : 'Cadastre o primeiro cliente.'} action={!q && <Link href="/clientes/novo"><Button>Novo cliente</Button></Link>} />
      ) : (
        <DataTable caption="Lista de clientes" rows={r.data!} cols={[
          { key: 'c', header: 'Cód.', render: c => c.codigo },
          { key: 'n', header: 'Nome', render: c => <Link className="font-medium text-accent underline-offset-2 hover:underline" href={`/clientes/${c.id}`}>{c.nome}</Link> },
          { key: 'd', header: 'Documento', hideOnMobile: true, render: c => c.documento || '—' },
          { key: 'e', header: 'E-mail', hideOnMobile: true, render: c => c.email || '—' },
          { key: 's', header: 'Situação', render: c => <Badge kind={c.bloqueado ? 'bloqueado' : 'ativo'} /> },
        ]} />
      )}
    </>
  )
}
