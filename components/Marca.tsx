/** Marca do Nexo: dois nós ligados por um traço, formando um "N". Desenho próprio. */
export function Selo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className} fill="none">
      <path d="M8 24V8l16 16V8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="3" className="fill-nexo-ponto" />
      <circle cx="24" cy="24" r="3" className="fill-nexo-ponto" />
    </svg>
  )
}
export function Marca({ tamanho = 'md', className = '' }: { tamanho?: 'md' | 'lg'; className?: string }) {
  const g = tamanho === 'lg'
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-[0.12em] ${g ? 'text-2xl' : 'text-lg'} ${className}`}>
      <Selo className={g ? 'h-11 w-11' : 'h-8 w-8'} />NEXO
    </span>
  )
}
