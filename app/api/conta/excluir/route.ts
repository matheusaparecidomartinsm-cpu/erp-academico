import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

const corpo = z.object({ confirmacao: z.literal('EXCLUIR') })

// Exclui os dados do usuário (função no banco, com as regras dele) e depois o login (chave de serviço, só no servidor).
export async function POST(req: NextRequest) {
  // proteção contra envio a partir de outro site (CSRF): a origem precisa ser este mesmo site
  const origem = req.headers.get('origin')
  if (!origem || new URL(origem).host !== req.headers.get('host')) return NextResponse.json({ erro: 'Requisição não permitida.' }, { status: 403 })
  if (!corpo.safeParse(await req.json().catch(() => null)).success) return NextResponse.json({ erro: 'Digite EXCLUIR para confirmar.' }, { status: 400 })

  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Sua sessão expirou. Entre de novo.' }, { status: 401 })

  const { error: eDados } = await sb.rpc('excluir_meus_dados')
  if (eDados) return NextResponse.json({ erro: eDados.message }, { status: 400 })

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) return NextResponse.json({ erro: 'Servidor sem chave de serviço configurada (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: eLogin } = await admin.auth.admin.deleteUser(user.id)
  if (eLogin) return NextResponse.json({ erro: 'Os dados foram apagados, mas não foi possível apagar o login. Tente de novo.' }, { status: 500 })
  await sb.auth.signOut()
  return NextResponse.json({ ok: true })
}
