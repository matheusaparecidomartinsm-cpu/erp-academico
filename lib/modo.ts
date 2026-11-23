/** Modo real = há URL do Supabase configurada. Sem ela, o app roda em demonstração (dados no navegador). */
export const MODO_REAL = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
