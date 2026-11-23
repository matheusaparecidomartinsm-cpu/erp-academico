import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
type CookieToSet = { name: string; value: string; options: CookieOptions }

const PUBLICAS = ['/login', '/esqueci-senha', '/auth/callback']

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()   // modo demonstração: sem login
  let res = NextResponse.next({ request: req })
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: CookieToSet[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await sb.auth.getUser()   // valida o token no servidor (não confia só no cookie)
  const publica = PUBLICAS.some(p => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(p + '/'))
  if (!user && !publica) {
    const to = req.nextUrl.clone(); to.pathname = '/login'; to.search = ''
    return NextResponse.redirect(to)
  }
  if (user && req.nextUrl.pathname === '/login') {
    const to = req.nextUrl.clone(); to.pathname = '/'; to.search = ''
    return NextResponse.redirect(to)
  }
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'] }
