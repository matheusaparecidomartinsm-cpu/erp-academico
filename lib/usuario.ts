// Login por nome de usuário. O Supabase Auth identifica a conta por e-mail, então o usuário vira um endereço
// interno (nunca recebe mensagem). Por isso a confirmação de e-mail precisa estar desligada no projeto.
export const DOMINIO_USUARIO = 'usuario.erp-academico.app'
const REGRA = /^[a-z0-9][a-z0-9._-]{2,29}$/

export const normalizaUsuario = (s: string) => s.trim().toLowerCase()
/** Mensagem de erro, ou null quando o usuário é válido (3 a 30 caracteres: letras, números, ponto, hífen, sublinhado). */
export function validaUsuario(s: string): string | null {
  const u = normalizaUsuario(s)
  if (u === '') return 'Informe o usuário.'
  if (!REGRA.test(u)) return 'Usuário com 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.'
  return null
}
export const emailDeUsuario = (s: string) => `${normalizaUsuario(s)}@${DOMINIO_USUARIO}`
/** Mostra só o usuário; contas antigas com e-mail de verdade continuam aparecendo inteiras. */
export const usuarioDeEmail = (email: string) => email.endsWith('@' + DOMINIO_USUARIO) ? email.slice(0, -(DOMINIO_USUARIO.length + 1)) : email
