export function msgAuth(m: string): string {
  if (/invalid login credentials/i.test(m)) return 'Usuário ou senha incorretos.'
  if (/email not confirmed/i.test(m)) return 'A conta pede confirmação por e-mail. Desligue "Confirm email" no painel do Supabase.'
  if (/already registered|already been registered/i.test(m)) return 'Este usuário já existe. Escolha outro ou entre com a senha dele.'
  if (/rate limit|too many|over_.*_rate_limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (/password should be at least|weak.?password/i.test(m)) return 'A senha é fraca demais. Use pelo menos 8 caracteres.'
  if (/same password/i.test(m)) return 'A nova senha precisa ser diferente da atual.'
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor. Tente de novo.'
  if (/expired|invalid.*(token|link|code)/i.test(m)) return 'O link expirou ou já foi usado. Peça um novo.'
  return m
}
