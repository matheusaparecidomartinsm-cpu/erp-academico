import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
type CookieToSet = { name: string; value: string; options: CookieOptions }

/** Cliente do Supabase para rotas do servidor, usando a sessão do usuário (cookies). */
export function supabaseServer() {
  const store = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: CookieToSet[]) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)) } catch { /* chamado de Server Component: ignorar */ } },
    },
  })
}
