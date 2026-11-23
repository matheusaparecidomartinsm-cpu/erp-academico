'use client'
import Link from 'next/link'
import { Card, DataTable, PageHeader } from '@/components/ui'
import { PASSOS } from '@/lib/ajuda'

const FLUXOS = [
  { titulo: 'Vender e faturar', texto: 'Crie o pedido (cliente, itens, vendedor), use Confirmar pedido e depois Faturar. O estoque baixa na confirmação e as parcelas nascem no faturamento.', href: '/pedidos', link: 'Ir para Pedidos' },
  { titulo: 'Receber ou pagar uma parcela', texto: 'Em A receber ou A pagar, abra Baixas na parcela e registre o valor. Para desfazer, estorne a baixa; o histórico fica guardado. Parcelas quitadas aparecem no filtro Quitados.', href: '/financeiro/receber', link: 'Ir para A receber' },
  { titulo: 'Trazer clientes e produtos de uma planilha', texto: 'Baixe o modelo, preencha, cole ou escolha o arquivo e confira a prévia. Só as linhas sem problema são gravadas, e só depois do seu clique.', href: '/importar', link: 'Ir para Importar' },
  { titulo: 'Ver o resultado do mês', texto: 'O Relatório financeiro compara o previsto (vencimento) com o realizado (baixas). Classifique os lançamentos por natureza para o quadro ficar completo.', href: '/relatorios/financeiro', link: 'Ir para o Relatório' },
  { titulo: 'Pagar comissão', texto: 'Defina o percentual em Vendedores, escolha o vendedor em cada pedido e consulte Comissões pelo período.', href: '/relatorios/comissao', link: 'Ir para Comissões' },
  { titulo: 'Levar seus dados embora', texto: 'Em Exportar dados você baixa clientes, produtos, pedidos, estoque e financeiro em CSV, sem custo.', href: '/exportar', link: 'Ir para Exportar' },
]

export default function Ajuda() {
  return (
    <>
      <PageHeader title="Ajuda" subtitle="Os caminhos principais e o que fazer quando o sistema recusa uma ação." />
      <h2 className="mb-2 text-md font-semibold">Passo a passo</h2>
      <ul className="mb-8 grid max-w-3xl gap-3">
        {FLUXOS.map(f => <li key={f.titulo}><Card className="text-text"><h3 className="font-semibold">{f.titulo}</h3><p className="text-text-muted">{f.texto}</p><Link className="mt-1 inline-block font-semibold text-accent underline" href={f.href}>{f.link}</Link></Card></li>)}
      </ul>
      <h2 className="mb-2 text-md font-semibold">Quando o sistema recusa uma ação</h2>
      <p className="mb-3 max-w-3xl text-text-muted">Essas são as mesmas dicas que aparecem junto do aviso de erro, no campo “O que fazer”.</p>
      <DataTable caption="Erros comuns e o que fazer" rows={PASSOS.map((p, i) => ({ ...p, id: String(i) }))} cols={[
        { key: 'q', header: 'Quando', render: p => p.quando },
        { key: 'f', header: 'O que fazer', render: p => <>{p.fazer}{p.href && <> <Link className="font-semibold text-accent underline" href={p.href}>{p.link}</Link></>}</> },
      ]} />
    </>
  )
}
