'use client'
import Link from 'next/link'
import { proximoPasso, type Passo } from '@/lib/ajuda'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { AlertCircle, CheckCircle2, CircleDashed, CircleDot, Ban, Clock, Loader2, MinusCircle, X, Inbox } from 'lucide-react'

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }
const BV = {
  primary: 'bg-accent text-on-accent hover:brightness-90',
  secondary: 'bg-surface text-text border border-border-input hover:bg-surface-2',
  ghost: 'bg-transparent text-accent hover:bg-accent-soft',
  danger: 'bg-danger text-on-danger hover:brightness-90',
}
const BS = { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-12 px-5' }
export function Button({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...r }: BtnProps) {
  return (
    <button {...r} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed ${BV[variant]} ${BS[size]} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}
    </button>
  )
}

/* ---------- Field ---------- */
type FieldBase = { label: string; help?: string; error?: string | null; suffix?: string }
export function Field({ label, help, error, suffix, className = '', ...r }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId(); const hid = id + '-h'; const eid = id + '-e'
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <input id={id} {...r} aria-invalid={!!error || undefined} aria-describedby={[help ? hid : '', error ? eid : ''].join(' ').trim() || undefined}
          className={`h-10 w-full rounded-md bg-surface px-3 text-text disabled:opacity-50 read-only:bg-surface-2 ${error ? 'border-2 border-danger' : 'border border-border-input'} ${suffix ? 'pr-12' : ''}`} />
        {suffix && <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-text-muted">{suffix}</span>}
      </div>
      {help && !error && <span id={hid} className="text-xs text-text-muted">{help}</span>}
      {error && <span id={eid} className="flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="h-3 w-3" aria-hidden />{error}</span>}
    </div>
  )
}
export function SelectField({ label, error, children, className = '', ...r }: { label: string; error?: string | null } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select id={id} {...r} aria-invalid={!!error || undefined} className={`h-10 w-full rounded-md bg-surface px-3 text-text ${error ? 'border-2 border-danger' : 'border border-border-input'}`}>{children}</select>
      {error && <span className="flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="h-3 w-3" aria-hidden />{error}</span>}
    </div>
  )
}

/* ---------- Badge ---------- */
const BADGES: Record<string, { cls: string; icon: ReactNode; label: string }> = {
  rascunho: { cls: 'bg-surface-2 text-text', icon: <CircleDashed className="h-3 w-3" />, label: 'Rascunho' },
  confirmado: { cls: 'bg-accent-soft text-on-accent-soft', icon: <CircleDot className="h-3 w-3" />, label: 'Confirmado' },
  faturado: { cls: 'bg-success-soft text-on-success-soft', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Faturado' },
  cancelado: { cls: 'bg-danger-soft text-on-danger-soft', icon: <Ban className="h-3 w-3" />, label: 'Cancelado' },
  cancelada: { cls: 'bg-danger-soft text-on-danger-soft', icon: <Ban className="h-3 w-3" />, label: 'Cancelada' },
  emitida: { cls: 'bg-success-soft text-on-success-soft', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Emitida' },
  aberto: { cls: 'bg-surface-2 text-text', icon: <Clock className="h-3 w-3" />, label: 'Em aberto' },
  parcial: { cls: 'bg-warning-soft text-on-warning-soft', icon: <MinusCircle className="h-3 w-3" />, label: 'Parcial' },
  baixado: { cls: 'bg-success-soft text-on-success-soft', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Baixado' },
  vencido: { cls: 'bg-danger-soft text-on-danger-soft', icon: <AlertCircle className="h-3 w-3" />, label: 'Vencido' },
  bloqueado: { cls: 'bg-danger-soft text-on-danger-soft', icon: <Ban className="h-3 w-3" />, label: 'Bloqueado' },
  ativo: { cls: 'bg-success-soft text-on-success-soft', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Ativo' },
  inativo: { cls: 'bg-surface-2 text-text', icon: <Ban className="h-3 w-3" />, label: 'Inativo' },
  semsaldo: { cls: 'bg-danger-soft text-on-danger-soft', icon: <AlertCircle className="h-3 w-3" />, label: 'Sem saldo' },
}
export function Badge({ kind }: { kind: string }) {
  const b = BADGES[kind] ?? BADGES.rascunho
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.icon}{b.label}</span>
}

/* ---------- Layout helpers ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl">{title}</h1>{subtitle && <p className="mt-1 text-text-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`rounded-lg border border-border bg-surface p-4 shadow-sm ${className}`}>{children}</div>

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center text-text-muted">
      <Inbox className="mb-1 h-8 w-8" aria-hidden /><strong className="text-md text-text">{title}</strong><p>{text}</p>{action && <div className="mt-3">{action}</div>}
    </div>
  )
}
/** Mensagem de erro de formulário: o texto do erro e, quando conhecemos, o que a pessoa pode fazer a seguir. */
export function MsgErro({ texto, className = '' }: { texto: string; className?: string }) {
  const p = proximoPasso(texto)
  return (
    <div role="alert" className={className}>
      <p>{texto}</p>
      {p && <p className="mt-1 text-sm font-normal text-text-muted"><strong className="text-text">O que fazer:</strong> {p.fazer}{p.href && <> <Link className="font-semibold text-accent underline" href={p.href}>{p.link}</Link></>}</p>}
    </div>
  )
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <AlertCircle className="h-8 w-8 text-danger" aria-hidden /><strong>Não foi possível carregar.</strong><p className="text-text-muted">{message}</p>{proximoPasso(message) && <p className="text-sm text-text-muted"><strong className="text-text">O que fazer:</strong> {proximoPasso(message)!.fazer}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Tentar de novo</Button>}
    </div>
  )
}
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div aria-hidden className="flex flex-col gap-2 p-4">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-9" />)}</div>
}

/* ---------- Table ---------- */
export type Col<T> = { key: string; header: string; align?: 'right'; hideOnMobile?: boolean; render: (row: T) => ReactNode }
export function DataTable<T extends { id: string }>({ cols, rows, footer, caption }: { cols: Col<T>[]; rows: T[]; footer?: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{cols.map(c => (
          <th key={c.key} scope="col" className={`h-9 bg-surface-2 px-3 text-xs font-semibold text-text-muted ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}>{c.header}</th>
        ))}</tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} className="border-t border-border hover:bg-surface-2/60">{cols.map(c => (
            <td key={c.key} className={`h-11 px-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}>{c.render(r)}</td>
          ))}</tr>
        ))}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}

/* ---------- Toast ---------- */
type Toast = { id: number; kind: 'ok' | 'erro'; text: string; passo?: Passo | null }
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random(); setList(l => [...l, { id, kind, text, passo: kind === 'erro' ? proximoPasso(text) : null }])
    if (kind === 'ok') setTimeout(() => setList(l => l.filter(t => t.id !== id)), 5000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="region" aria-label="Avisos">
        {list.map(t => (
          <div key={t.id} role={t.kind === 'erro' ? 'alert' : 'status'}
            className={`flex items-start gap-2 rounded-md border border-border border-l-4 bg-surface p-3 shadow-md ${t.kind === 'ok' ? 'border-l-success' : 'border-l-danger'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 text-danger" aria-hidden />}
            <span className="flex-1">{t.text}{t.passo && <span className="mt-1 block text-sm text-text-muted"><strong className="text-text">O que fazer:</strong> {t.passo.fazer}{t.passo.href && <> <a className="font-semibold text-accent underline" href={t.passo.href}>{t.passo.link}</a></>}</span>}</span>
            <button aria-label="Fechar aviso" className="text-text-muted" onClick={() => setList(l => l.filter(x => x.id !== t.id))}><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Modal (foco preso, Esc fecha, devolve o foco) ---------- */
export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null); const tid = useId(); const last = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    last.current = document.activeElement as HTMLElement
    const el = ref.current!; const f = () => Array.from(el.querySelectorAll<HTMLElement>('button, input, select, textarea, [href]')).filter(x => !x.hasAttribute('disabled'))
    f()[0]?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab') { const a = f(); if (!a.length) return; const first = a[0], end = a[a.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus() } else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus() } }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); last.current?.focus() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tid} className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-lg">
        <h2 id={tid} className="mb-2 text-lg">{title}</h2>
        <div className="mb-4 text-text-muted">{children}</div>
        <div className="flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  )
}

/* ---------- Dados assíncronos ---------- */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, set] = useState<{ data?: T; loading: boolean; error?: string }>({ loading: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    let vivo = true
    set(s => ({ ...s, loading: s.data === undefined, error: undefined }))
    fn().then(d => { if (vivo) set({ data: d, loading: false }) }).catch(e => { if (vivo) set({ loading: false, error: (e as Error).message }) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  useEffect(() => { const h = () => setN(x => x + 1); window.addEventListener('erp-changed', h); return () => window.removeEventListener('erp-changed', h) }, [])
  return { ...state, reload: () => setN(x => x + 1) }
}
