// Próximo passo para as mensagens de erro mais comuns. A mesma lista alimenta o aviso na tela e a página de Ajuda.
export type Passo = { padrao: RegExp; quando: string; fazer: string; href?: string; link?: string }

export const PASSOS: Passo[] = [
  { padrao: /Saldo insuficiente|saldo negativo/, quando: 'Saldo insuficiente no pedido ou no ajuste', fazer: 'Dê entrada no estoque em Estoque > Ajustar, ou reduza a quantidade do item.', href: '/estoque', link: 'Ir para Estoque' },
  { padrao: /Já existe um cliente com este documento/, quando: 'Documento de cliente repetido', fazer: 'Procure o cliente na lista. Se for o mesmo, edite o cadastro em vez de criar outro.', href: '/clientes', link: 'Ver clientes' },
  { padrao: /e-mail válido/, quando: 'E-mail inválido', fazer: 'Use o formato nome@empresa.com.br ou deixe o campo em branco.' },
  { padrao: /Há parcelas com recebimento/, quando: 'Cancelar pedido que já recebeu dinheiro', fazer: 'Em A receber, ache as parcelas do pedido e estorne cada recebimento. Depois cancele o pedido.', href: '/financeiro/receber', link: 'Ir para A receber' },
  { padrao: /Este local ainda tem saldo/, quando: 'Desativar local de estoque com saldo', fazer: 'Transfira o saldo para outro local (Estoque > Transferir) e tente de novo.', href: '/estoque', link: 'Ir para Estoque' },
  { padrao: /Só é possível faturar um pedido confirmado/, quando: 'Faturar pedido ainda em rascunho', fazer: 'Abra o pedido e use Confirmar pedido primeiro.' },
  { padrao: /Só é possível (alterar|confirmar) um pedido em rascunho/, quando: 'Alterar pedido que já mudou de situação', fazer: 'Recarregue a página: o pedido foi confirmado, faturado ou cancelado em outra aba.' },
  { padrao: /Informe o motivo/, quando: 'Motivo em branco (cancelar, ajustar)', fazer: 'Escreva uma frase curta. Ela fica no histórico.' },
  { padrao: /passa do limite de R\$/, quando: 'Valor acima de R$ 10.000.000,00', fazer: 'Confira os zeros ou divida em mais de um lançamento.' },
  { padrao: /CNPJ precisa/, quando: 'CNPJ da empresa incompleto', fazer: 'Digite os 14 números, com ou sem pontos.', href: '/empresa', link: 'Ir para Empresa' },
  { padrao: /já foi estornada/, quando: 'Estornar baixa duas vezes', fazer: 'Atualize a lista: o estorno já aconteceu. Use o filtro Quitados ou Todos para ver o histórico.' },
  { padrao: /Lançamento já baixado/, quando: 'Dar baixa em parcela quitada', fazer: 'Não há nada a pagar. Use o filtro Quitados para ver os recebimentos.' },
  { padrao: /valor é maior que o saldo em aberto/, quando: 'Baixa maior que o saldo da parcela', fazer: 'Informe no máximo o valor que aparece em Em aberto.' },
  { padrao: /Origem e destino precisam ser diferentes/, quando: 'Transferência para o mesmo local', fazer: 'Escolha dois locais diferentes.' },
  { padrao: /Comissão deve ficar entre/, quando: 'Comissão fora de 0 a 100%', fazer: 'Digite um percentual de 0 a 100, por exemplo 2,5.' },
  { padrao: /permission|permissão|not authorized/i, quando: 'Sem permissão', fazer: 'O seu papel não pode fazer isso. Peça a quem administra a empresa para ajustar o papel.' },
  { padrao: /Failed to fetch|NetworkError|Load failed/i, quando: 'Sem conexão com o servidor', fazer: 'Confira a internet e tente de novo. Se continuar, saia e entre outra vez.' },
]

/** Devolve o próximo passo para uma mensagem de erro, ou null quando não há dica específica. */
export function proximoPasso(mensagem: string): Passo | null {
  return PASSOS.find(p => p.padrao.test(mensagem)) ?? null
}
