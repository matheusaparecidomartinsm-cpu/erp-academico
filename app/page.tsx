'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Box, Truck, ArrowDownLeft, Wallet, AlertTriangle, Plus } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader, useAsync } from '@/components/ui'
import { dashboard, listPedidos, listFinanceiros } from '@/lib/db'
import { brl } from '@/lib/money'

const hojeISO = () => new Date().toISOString().slice(0, 10)
const mesesAtras = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10) }

function Rosca({ partes, total }: { partes: { l: string; v: number; cor: string }[]; total: number }) {
  const r = 52; const c = 2 * Math.PI * r; let acum = 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label={`${total} no período: ${partes.map(p => `${p.v} ${p.l.toLowerCase()}`).join(', ')}`}>
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="16" className="stroke-surface-2" />
        {total > 0 && partes.map(p => { const f = p.v / total; const seg = <circle key={p.l} cx="70" cy="70" r={r} fill="none" strokeWidth="16" stroke={p.cor} strokeDasharray={`${f * c} ${c}`} strokeDashoffset={-acum * c} transform="rotate(-90 70 70)" />; acum += f; return f > 0 ? seg : null })}
        <text x="70" y="72" textAnchor="middle" className="fill-text text-[28px] font-bold">{total}</text>
        <text x="70" y="90" textAnchor="middle" className="fill-text-muted text-[10px]">no período</text>
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-2 text-sm">
        {partes.map(p => <li key={p.l} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} />{p.l}<span className="ml-auto tabular-nums">{p.v}</span></li>)}
      </ul>
    </div>
  )
}

export default function Inicio() {
  const [de, setDe] = useState(mesesAtras(5)); const [ate, setAte] = useState(hojeISO())
  const [ini, setIni] = useState(de); const [fim, setFim] = useState(ate)
  const d = useAsync(dashboard); const p = useAsync(() => listPedidos()); const rec = useAsync(() => listFinanceiros('receita')); const des = useAsync(() => listFinanceiros('despesa'))
  const dentro = (iso: string) => { const x = iso.slice(0, 10); return x >= ini && x <= fim }
  const calc = useMemo(() => {
    const pedidos = (p.data ?? []).filter(x => dentro(x.criadoEm))
    const entregues = pedidos.filter(x => x.status === 'faturado').length
    const aberto = pedidos.filter(x => x.status === 'rascunho' || x.status === 'confirmado').length
    const cancel = pedidos.filter(x => x.status === 'cancelado').length
    const baixas = (l: typeof rec.data) => (l ?? []).flatMap(f => f.baixas.filter(b => !b.estornadaEm && dentro(b.em)).map(b => ({ mes: b.em.slice(0, 7), v: b.valorCentavos })))
    const ent = baixas(rec.data); const sai = baixas(des.data)
    const somaE = ent.reduce((s, x) => s + x.v, 0); const somaS = sai.reduce((s, x) => s + x.v, 0)
    const meses: string[] = []; for (let m = new Date(ini + 'T12:00:00'); m.toISOString().slice(0, 7) <= fim.slice(0, 7) && meses.length < 24; m.setMonth(m.getMonth() + 1, 1)) meses.push(m.toISOString().slice(0, 7))
    const serie = meses.map(m => ({ m, e: ent.filter(x => x.mes === m).reduce((s, x) => s + x.v, 0), s: sai.filter(x => x.mes === m).reduce((s, x) => s + x.v, 0) }))
    return { pedidos, entregues, aberto, cancel, somaE, somaS, serie }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.data, rec.data, des.data, ini, fim])
  const max = Math.max(1, ...calc.serie.flatMap(x => [x.e, x.s]))
  const carregando = d.loading || p.loading || rec.loading || des.loading
  const erro = d.error || p.error || rec.error || des.error
  const kpis = [
    { l: 'Pedidos entregues', v: String(calc.entregues), nota: 'Faturados no período', Icon: Box, href: '/pedidos' },
    { l: 'Faltam entregar', v: String(calc.aberto), nota: 'Rascunhos e confirmados', Icon: Truck, href: '/pedidos' },
    { l: 'Recebimentos', v: brl(calc.somaE), nota: 'Entradas efetivamente recebidas', Icon: ArrowDownLeft, href: '/financeiro/receber' },
    { l: 'Saldo do período', v: brl(calc.somaE - calc.somaS), nota: 'Recebimentos menos pagamentos', Icon: Wallet, href: '/relatorios/financeiro' },
  ]
  return (
    <>
      <PageHeader eyebrow="Visão da operação" title="Painel de vendas" subtitle="Do pedido ao recebimento. Acompanhe tudo em um só lugar." actions={<Link href="/pedidos/novo"><Button><Plus className="h-4 w-4" aria-hidden />Novo pedido</Button></Link>} />
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm" onSubmit={e => { e.preventDefault(); if (de && ate && de <= ate) { setIni(de); setFim(ate) } }}>
        <label className="flex flex-col gap-1 text-sm font-semibold">Início do período<input type="date" value={de} onChange={e => setDe(e.target.value)} className="h-10 rounded-md border border-border-input bg-surface px-3 font-normal" /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Fim do período<input type="date" value={ate} onChange={e => setAte(e.target.value)} className="h-10 rounded-md border border-border-input bg-surface px-3 font-normal" /></label>
        <Button type="submit">Aplicar período</Button>
        <Button type="button" variant="secondary" onClick={() => { const a = mesesAtras(5), b = hojeISO(); setDe(a); setAte(b); setIni(a); setFim(b) }}>Últimos 6 meses</Button>
        {de > ate && <p role="alert" className="text-xs font-medium text-danger">O início não pode ser depois do fim.</p>}
      </form>
      {erro ? <Card><ErrorState message={erro} onRetry={() => { d.reload(); p.reload(); rec.reload(); des.reload() }} /></Card> : carregando ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-28 rounded-xl" aria-hidden />)}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(k => (
              <Card key={k.l}>
                <div className="flex items-start justify-between"><p className="text-sm text-text-muted">{k.l}</p><k.Icon className="h-5 w-5 text-nexo-ponto" aria-hidden /></div>
                <p className="my-2 text-xl font-bold tabular-nums">{k.v}</p>
                <Link href={k.href} className="text-xs text-text-muted hover:text-accent hover:underline">{k.nota}</Link>
              </Card>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-baseline justify-between"><h2 className="text-md font-semibold">Pedidos do período</h2><Link href="/pedidos" className="text-sm text-accent underline">Ver pedidos</Link></div>
              <Rosca total={calc.pedidos.length} partes={[{ l: 'Entregues', v: calc.entregues, cor: '#2FA597' }, { l: 'A entregar', v: calc.aberto, cor: '#D18A24' }, { l: 'Cancelados', v: calc.cancel, cor: '#9AA5B4' }]} />
            </Card>
            <Card className="p-5">
              <div className="mb-4 flex items-baseline justify-between"><h2 className="text-md font-semibold">Atenção agora</h2></div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between gap-3"><span>Vendas do mês</span><strong className="tabular-nums">{brl(d.data?.vendasMesCentavos ?? 0)}</strong></li>
                <li className="flex items-center justify-between gap-3"><span>A receber vencido</span><Link href="/financeiro/receber" className="font-bold tabular-nums text-danger underline">{brl(d.data?.receberVencidoCentavos ?? 0)}</Link></li>
                <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Produtos sem saldo</span><Link href="/estoque" className="font-bold tabular-nums underline">{d.data?.itensSemSaldo ?? 0}</Link></li>
                <li className="flex items-center justify-between gap-3"><span>Pedidos em aberto (total)</span><Link href="/pedidos" className="font-bold tabular-nums underline">{d.data?.pedidosAbertos ?? 0}</Link></li>
              </ul>
            </Card>
          </div>
          <Card className="mb-4 p-5">
            <div className="mb-3 flex items-baseline justify-between"><h2 className="text-md font-semibold">Entradas e saídas de dinheiro</h2><Link href="/relatorios/financeiro" className="text-sm text-accent underline">Abrir relatório</Link></div>
            <p className="mb-3 flex gap-4 text-sm"><span><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-nexo-ponto" />Entradas <strong className="tabular-nums">{brl(calc.somaE)}</strong></span><span><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#D18A24' }} />Saídas <strong className="tabular-nums">{brl(calc.somaS)}</strong></span></p>
            {calc.somaE + calc.somaS === 0 ? <p className="py-6 text-center text-text-muted">Nenhum pagamento realizado neste período.</p> : (
              <>
                <div className="flex h-40 items-end gap-3" aria-hidden>
                  {calc.serie.map(x => (
                    <div key={x.m} className="flex h-full flex-1 flex-col justify-end"><div className="flex flex-1 items-end justify-center gap-1">
                      <div className="w-1/3 rounded-t bg-nexo-ponto" style={{ height: `${(x.e / max) * 100}%` }} /><div className="w-1/3 rounded-t" style={{ height: `${(x.s / max) * 100}%`, background: '#D18A24' }} />
                    </div><span className="mt-1 text-center text-[11px] text-text-muted">{x.m.slice(5)}/{x.m.slice(2, 4)}</span></div>
                  ))}
                </div>
                <details className="mt-3 text-sm"><summary className="cursor-pointer">Consultar valores mensais</summary>
                  <ul className="mt-2 space-y-1">{calc.serie.map(x => <li key={x.m} className="tabular-nums">{x.m.slice(5)}/{x.m.slice(0, 4)}: entradas {brl(x.e)}, saídas {brl(x.s)}</li>)}</ul></details>
              </>
            )}
          </Card>
          <h2 className="mb-2 text-md font-semibold">Pedidos recentes</h2>
          {(p.data ?? []).length === 0 ? <Card><EmptyState title="Nenhum pedido ainda" text="Crie o primeiro pedido para começar." action={<Link className="font-semibold text-accent underline" href="/pedidos/novo">Novo pedido</Link>} /></Card> : (
            <DataTable caption="Pedidos recentes" rows={(p.data ?? []).slice(0, 5)} cols={[
              { key: 'n', header: 'Nº', render: r => <Link className="text-accent underline" href={`/pedidos/${r.id}`}>{r.numero}</Link> },
              { key: 's', header: 'Situação', render: r => <Badge kind={r.status} /> },
              { key: 't', header: 'Total', align: 'right', render: r => brl(r.totalCentavos) },
            ]} />
          )}
        </>
      )}
    </>
  )
}
