-- Cadastros auxiliares: vendedores, naturezas, centros de resultado, contas bancárias, tipos de pagamento
-- e dados da empresa. As tabelas já existem (migração 1); aqui entram as funções de escrita e a classificação
-- de pedidos (vendedor) e de lançamentos financeiros. Escrita direta é revogada; tudo passa por funções.

revoke insert, update, delete on vendedores, naturezas, centros_resultado, contas_bancarias, tipos_pagamento from anon, authenticated;
drop policy if exists vendedores_w on vendedores; drop policy if exists naturezas_w on naturezas; drop policy if exists centros_resultado_w on centros_resultado;
drop policy if exists contas_bancarias_w on contas_bancarias; drop policy if exists tipos_pagamento_w on tipos_pagamento;

create or replace function _nome_ok(p_nome text) returns text
language plpgsql immutable as $$
begin
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome.'; end if;
  if length(trim(p_nome)) > 120 then raise exception 'O nome pode ter até 120 caracteres.'; end if;
  return trim(p_nome);
end $$;

-- vendedores (inativar em vez de excluir: o histórico de pedidos continua apontando para eles)
create or replace function salvar_vendedor(p_org uuid, p_id uuid, p_nome text, p_ativo boolean) returns vendedores
language plpgsql security definer set search_path = public as $$
declare v vendedores; n text := _nome_ok(p_nome);
begin
  perform _exige_papel(p_org, array['admin']);
  if exists (select 1 from vendedores where org_id = p_org and lower(nome) = lower(n) and id is distinct from p_id) then raise exception 'Já existe um vendedor com este nome.'; end if;
  if p_id is null then insert into vendedores (org_id, nome, ativo) values (p_org, n, coalesce(p_ativo, true)) returning * into v;
  else update vendedores set nome = n, ativo = coalesce(p_ativo, ativo), updated_at = now() where id = p_id and org_id = p_org returning * into v;
    if not found then raise exception 'Vendedor não encontrado.'; end if;
  end if;
  return v;
end $$;

create or replace function salvar_natureza(p_org uuid, p_id uuid, p_nome text, p_tipo text) returns naturezas
language plpgsql security definer set search_path = public as $$
declare v naturezas; n text := _nome_ok(p_nome);
begin
  perform _exige_papel(p_org, array['admin']);
  if p_tipo not in ('receita', 'despesa') then raise exception 'Escolha se a natureza é de receita ou de despesa.'; end if;
  if exists (select 1 from naturezas where org_id = p_org and lower(nome) = lower(n) and id is distinct from p_id) then raise exception 'Já existe uma natureza com este nome.'; end if;
  if p_id is null then insert into naturezas (org_id, nome, tipo) values (p_org, n, p_tipo) returning * into v;
  else update naturezas set nome = n, tipo = p_tipo where id = p_id and org_id = p_org returning * into v;
    if not found then raise exception 'Natureza não encontrada.'; end if;
  end if;
  return v;
end $$;

create or replace function salvar_centro(p_org uuid, p_id uuid, p_nome text) returns centros_resultado
language plpgsql security definer set search_path = public as $$
declare v centros_resultado; n text := _nome_ok(p_nome);
begin
  perform _exige_papel(p_org, array['admin']);
  if exists (select 1 from centros_resultado where org_id = p_org and lower(nome) = lower(n) and id is distinct from p_id) then raise exception 'Já existe um centro de resultado com este nome.'; end if;
  if p_id is null then insert into centros_resultado (org_id, nome) values (p_org, n) returning * into v;
  else update centros_resultado set nome = n where id = p_id and org_id = p_org returning * into v;
    if not found then raise exception 'Centro de resultado não encontrado.'; end if;
  end if;
  return v;
end $$;

create or replace function salvar_conta(p_org uuid, p_id uuid, p_nome text, p_banco text) returns contas_bancarias
language plpgsql security definer set search_path = public as $$
declare v contas_bancarias; n text := _nome_ok(p_nome);
begin
  perform _exige_papel(p_org, array['admin']);
  if exists (select 1 from contas_bancarias where org_id = p_org and lower(nome) = lower(n) and id is distinct from p_id) then raise exception 'Já existe uma conta com este nome.'; end if;
  if p_id is null then insert into contas_bancarias (org_id, nome, banco) values (p_org, n, nullif(trim(coalesce(p_banco, '')), '')) returning * into v;
  else update contas_bancarias set nome = n, banco = nullif(trim(coalesce(p_banco, '')), '') where id = p_id and org_id = p_org returning * into v;
    if not found then raise exception 'Conta não encontrada.'; end if;
  end if;
  return v;
end $$;

create or replace function salvar_tipo_pagamento(p_org uuid, p_id uuid, p_nome text, p_parcelas integer, p_dias integer) returns tipos_pagamento
language plpgsql security definer set search_path = public as $$
declare v tipos_pagamento; n text := _nome_ok(p_nome);
begin
  perform _exige_papel(p_org, array['admin']);
  if p_parcelas is null or p_parcelas < 1 or p_parcelas > 48 then raise exception 'Parcelas: informe de 1 a 48.'; end if;
  if p_dias is null or p_dias < 0 then raise exception 'Dias entre parcelas não pode ser negativo.'; end if;
  if exists (select 1 from tipos_pagamento where org_id = p_org and lower(nome) = lower(n) and id is distinct from p_id) then raise exception 'Já existe um tipo de pagamento com este nome.'; end if;
  if p_id is null then insert into tipos_pagamento (org_id, nome, parcelas, dias_entre_parcelas) values (p_org, n, p_parcelas, p_dias) returning * into v;
  else update tipos_pagamento set nome = n, parcelas = p_parcelas, dias_entre_parcelas = p_dias where id = p_id and org_id = p_org returning * into v;
    if not found then raise exception 'Tipo de pagamento não encontrado.'; end if;
  end if;
  return v;
end $$;

-- exclusão: só de naturezas, centros, contas e tipos (lançamentos que os usavam ficam sem classificação)
create or replace function excluir_cadastro_aux(p_org uuid, p_tabela text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exige_papel(p_org, array['admin']);
  if p_tabela = 'naturezas' then delete from naturezas where id = p_id and org_id = p_org;
  elsif p_tabela = 'centros_resultado' then delete from centros_resultado where id = p_id and org_id = p_org;
  elsif p_tabela = 'contas_bancarias' then delete from contas_bancarias where id = p_id and org_id = p_org;
  elsif p_tabela = 'tipos_pagamento' then delete from tipos_pagamento where id = p_id and org_id = p_org;
  else raise exception 'Este cadastro não pode ser excluído; inative-o.'; end if;
  if not found then raise exception 'Registro não encontrado.'; end if;
end $$;

-- dados da empresa
create or replace function atualizar_empresa(p_org uuid, p_nome text, p_cnpj text) returns orgs
language plpgsql security definer set search_path = public as $$
declare o orgs;
begin
  perform _exige_papel(p_org, array['admin']);
  update orgs set nome = _nome_ok(p_nome), cnpj = nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), ''), updated_at = now() where id = p_org returning * into o;
  if o.cnpj is not null and length(o.cnpj) <> 14 then raise exception 'O CNPJ precisa ter 14 dígitos.'; end if;
  return o;
end $$;

-- vendedor do pedido (qualquer status, menos cancelado)
create or replace function definir_vendedor_pedido(p_pedido uuid, p_vendedor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos;
begin
  select * into p from pedidos where id = p_pedido for update;
  if not found or not is_member(p.org_id) then raise exception 'Pedido não encontrado.'; end if;
  perform _exige_papel(p.org_id, array['admin', 'vendedor']);
  if p.status = 'cancelado' then raise exception 'Pedido cancelado não pode ser alterado.'; end if;
  if p_vendedor is not null and not exists (select 1 from vendedores where id = p_vendedor and org_id = p.org_id and ativo) then raise exception 'Escolha um vendedor ativo.'; end if;
  update pedidos set vendedor_id = p_vendedor, updated_at = now() where id = p_pedido;
end $$;

-- classificação de um lançamento (natureza, centro, conta, tipo de pagamento); campos vazios limpam
create or replace function classificar_financeiro(p_fin uuid, p_natureza uuid, p_centro uuid, p_conta uuid, p_tipo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f financeiros; nat naturezas;
begin
  select * into f from financeiros where id = p_fin for update;
  if not found or not is_member(f.org_id) then raise exception 'Lançamento não encontrado.'; end if;
  perform _exige_papel(f.org_id, array['admin', 'financeiro']);
  if f.status = 'cancelado' then raise exception 'Lançamento cancelado não pode ser alterado.'; end if;
  if p_natureza is not null then
    select * into nat from naturezas where id = p_natureza and org_id = f.org_id;
    if not found then raise exception 'Natureza inválida.'; end if;
    if nat.tipo <> f.tipo then raise exception 'Esta natureza é de %; o lançamento é de %.', nat.tipo, f.tipo; end if;
  end if;
  if p_centro is not null and not exists (select 1 from centros_resultado where id = p_centro and org_id = f.org_id) then raise exception 'Centro de resultado inválido.'; end if;
  if p_conta is not null and not exists (select 1 from contas_bancarias where id = p_conta and org_id = f.org_id) then raise exception 'Conta bancária inválida.'; end if;
  if p_tipo is not null and not exists (select 1 from tipos_pagamento where id = p_tipo and org_id = f.org_id) then raise exception 'Tipo de pagamento inválido.'; end if;
  update financeiros set natureza_id = p_natureza, centro_resultado_id = p_centro, conta_bancaria_id = p_conta, tipo_pagamento_id = p_tipo, updated_at = now() where id = p_fin;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  criar_org(text, boolean), criar_cliente(uuid, text, text, text), atualizar_cliente(uuid, text, text, text, boolean, boolean, uuid),
  criar_produto(uuid, text, text, text, integer, boolean), atualizar_produto(uuid, text, text, text, integer, boolean),
  criar_local(uuid, text), atualizar_local(uuid, text, boolean), ajustar_estoque(uuid, uuid, numeric, text, uuid), transferir_estoque(uuid, uuid, uuid, uuid, numeric),
  criar_tabela_preco(uuid, text), definir_preco(uuid, uuid, integer), remover_preco(uuid, uuid), excluir_tabela_preco(uuid),
  criar_pedido(uuid, uuid, jsonb, text, uuid), atualizar_pedido(uuid, uuid, jsonb, text, uuid), confirmar_pedido(uuid),
  faturar_pedido(uuid, integer, integer), cancelar_pedido(uuid, text), lancar_despesa(uuid, text, integer, date), lancar_receita(uuid, uuid, text, integer, date),
  baixar_financeiro(uuid, integer, integer), estornar_baixa(uuid), dashboard(uuid), excluir_meus_dados(),
  is_member(uuid), tem_papel(uuid, text[]),
  salvar_vendedor(uuid, uuid, text, boolean), salvar_natureza(uuid, uuid, text, text), salvar_centro(uuid, uuid, text),
  salvar_conta(uuid, uuid, text, text), salvar_tipo_pagamento(uuid, uuid, text, integer, integer),
  excluir_cadastro_aux(uuid, text, uuid), atualizar_empresa(uuid, text, text),
  definir_vendedor_pedido(uuid, uuid), classificar_financeiro(uuid, uuid, uuid, uuid, uuid)
to authenticated;
