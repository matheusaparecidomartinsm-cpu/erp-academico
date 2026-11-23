'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, PageHeader, SkeletonRows, useAsync } from '@/components/ui'
import { listProdutos } from '@/lib/db'
import { brl, qtdFmt } from '@/lib/money'

export default function Produtos() {
  const [q, setQ] = useState(''); const r = useAsync(() => listProdutos(q), [q])
  return (
    <>
      <PageHeader title="Produtos" subtitle="O que você vende." actions={<Link href="/produtos/novo"><Button>Novo produto</Button></Link>} />
      <div className="mb-3 max-w-sm"><Field label="Buscar" placeholder="Descrição, grupo ou código" value={q} onChange={e => setQ(e.target.value)} /></div>
      {r.loading ? <SkeletonRows /> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.data!.length === 0 ? (
        <EmptyState title="Nenhum produto encontrado" text={q ? 'Tente outro termo de busca.' : 'Cadastre o primeiro produto.'} action={!q && <Link href="/produtos/novo"><Button>Novo produto</Button></Link>} />
      ) : (
        <DataTable caption="Lista de produtos" rows={r.data!} cols={[
          { key: 'c', header: 'Cód.', render: p => p.codigo },
          { key: 'd', header: 'Descrição', render: p => <Link className="font-medium text-accent underline-offset-2 hover:underline" href={`/produtos/${p.id}`}>{p.descricao}</Link> },
          { key: 'g', header: 'Grupo', hideOnMobile: true, render: p => p.grupo },
          { key: 'p', header: 'Preço', align: 'right', render: p => brl(p.precoCentavos) },
          { key: 'a', header: 'Situação', hideOnMobile: true, render: p => <Badge kind={p.ativo ? 'ativo' : 'inativo'} /> },
          { key: 's', header: 'Saldo', align: 'right', render: p => !p.controlaEstoque ? <span className="text-text-muted">não controla</span> : p.saldo <= 0 ? <Badge kind="semsaldo" /> : `${qtdFmt(p.saldo)} ${p.unidade}` },
        ]} />
      )}
    </>
  )
}
