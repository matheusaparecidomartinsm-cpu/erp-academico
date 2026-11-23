import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// Destino dos links de e-mail (confirmação de conta e redefinição de senha).
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const destino = next.startsWith('/') && !next.startsWith('//') ? next : '/'   // evita redirecionamento para outro site
  if (code) {
    const { error } = await supabaseServer().auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(origin + destino)
  }
  return NextResponse.redirect(origin + '/login?erro=link')
}
