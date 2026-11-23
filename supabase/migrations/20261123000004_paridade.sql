-- Fecha lacunas de paridade: locais de estoque, tabelas de preço, edição de cadastros e pedidos,
-- receita manual e estorno de baixa. Escritas continuam só por funções com checagem de login, empresa e papel.

alter table clientes add column tabela_preco_id uuid references tabelas_preco(id) on delete set null;
alter table financeiro_baixas add column estornada_em timestamptz, add column estornada_por uuid references auth.users(id) on delete set null;
create index on financeiro_baixas (financeiro_id) where estornada_em is null;

-- ================= Estoque por local =================
create or replace function _local_padrao(p_org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from locais_estoque where org_id = p_org order by ativo desc, created_at limit 1
$$;

create or replace function _saldo_local(p_produto uuid, p_local uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select saldo from estoque_saldos where produto_id = p_produto and local_id = p_local), 0)
$$;

create or replace function _local_valido(p_org uuid, p_local uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if p_local is null then return _local_padrao(p_org); end if;
  if not exists (select 1 from locais_estoque where id = p_local and org_id = p_org and ativo) then raise exception 'Escolha um local de estoque válido.'; end if;
  return p_local;
end $$;

create or replace function _checar_estoque(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; loc uuid;
begin
  select coalesce(local_id, _local_padrao(org_id)) into loc from pedidos where id = p_pedido;
  for r in
    select pr.descricao, sum(i.quantidade) as pedido, _saldo_local(pr.id, loc) as saldo
    from pedido_itens i join produtos pr on pr.id = i.produto_id
    where i.pedido_id = p_pedido and pr.controla_estoque
    group by pr.id, pr.descricao
  loop
    if r.saldo < r.pedido then
      raise exception 'Saldo insuficiente de "%": % disponível, % pedido.', r.descricao, trim_scale(r.saldo), trim_scale(r.pedido);
    end if;
  end loop;
end $$;

create or replace function criar_local(p_org uuid, p_nome text) returns locais_estoque
language plpgsql security definer set search_path = public as $$
declare l locais_estoque;
begin
  perform _exige_papel(p_org, array['admin']);
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome do local.'; end if;
  if exists (select 1 from locais_estoque where org_id = p_org and lower(nome) = lower(trim(p_nome))) then raise exception 'Já existe um local com este nome.'; end if;
  insert into locais_estoque (org_id, nome) values (p_org, trim(p_nome)) returning * into l;
  return l;
end $$;

create or replace function atualizar_local(p_local uuid, p_nome text, p_ativo boolean) returns locais_estoque
language plpgsql security definer set search_path = public as $$
declare l locais_estoque;
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into l from locais_estoque where id = p_local for update;
  if not found or not is_member(l.org_id) then raise exception 'Local não encontrado.'; end if;
  perform _exige_papel(l.org_id, array['admin']);
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome do local.'; end if;
  if exists (select 1 from locais_estoque where org_id = l.org_id and id <> l.id and lower(nome) = lower(trim(p_nome))) then raise exception 'Já existe um local com este nome.'; end if;
  if not p_ativo then
    if exists (select 1 from estoque_saldos where local_id = l.id and saldo > 0) then raise exception 'Este local ainda tem saldo. Transfira o estoque antes de desativá-lo.'; end if;
    if not exists (select 1 from locais_estoque where org_id = l.org_id and id <> l.id and ativo) then raise exception 'É preciso manter pelo menos um local ativo.'; end if;
  end if;
  update locais_estoque set nome = trim(p_nome), ativo = p_ativo, updated_at = now() where id = l.id returning * into l;
  return l;
end $$;

drop function ajustar_estoque(uuid, uuid, numeric, text);
create or replace function ajustar_estoque(p_org uuid, p_produto uuid, p_quantidade numeric, p_motivo text, p_local uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare pr produtos; loc uuid;
begin
  perform _exige_papel(p_org, array['admin','estoquista']);
  select * into pr from produtos where id = p_produto and org_id = p_org;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not pr.controla_estoque then raise exception 'Este produto não controla estoque.'; end if;
  if p_quantidade is null or p_quantidade = 0 then raise exception 'Informe uma quantidade diferente de zero.'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Informe o motivo do ajuste.'; end if;
  loc := _local_valido(p_org, p_local);
  perform 1 from estoque_saldos where produto_id = p_produto order by local_id for update;
  if _saldo_local(p_produto, loc) + p_quantidade < 0 then raise exception 'O ajuste deixaria o saldo negativo.'; end if;
  insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, motivo, created_by)
  values (p_org, p_produto, loc, 'ajuste', p_quantidade, 'manual', trim(p_motivo), auth.uid());
end $$;

create or replace function transferir_estoque(p_org uuid, p_produto uuid, p_de uuid, p_para uuid, p_quantidade numeric) returns void
language plpgsql security definer set search_path = public as $$
declare pr produtos; ld locais_estoque; lp locais_estoque;
begin
  perform _exige_papel(p_org, array['admin','estoquista']);
  select * into pr from produtos where id = p_produto and org_id = p_org;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not pr.controla_estoque then raise exception 'Este produto não controla estoque.'; end if;
  select * into ld from locais_estoque where id = p_de and org_id = p_org and ativo;
  select * into lp from locais_estoque where id = p_para and org_id = p_org and ativo;
  if ld.id is null or lp.id is null then raise exception 'Escolha o local de origem e o de destino.'; end if;
  if ld.id = lp.id then raise exception 'Origem e destino precisam ser diferentes.'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  perform 1 from estoque_saldos where produto_id = p_produto order by local_id for update;
  if _saldo_local(p_produto, ld.id) < p_quantidade then raise exception 'Saldo insuficiente em "%": % disponível.', ld.nome, trim_scale(_saldo_local(p_produto, ld.id)); end if;
  insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, motivo, created_by)
  values (p_org, p_produto, ld.id, 'saida', -p_quantidade, 'transferencia', 'Transferência para ' || lp.nome, auth.uid()),
         (p_org, p_produto, lp.id, 'entrada', p_quantidade, 'transferencia', 'Transferência de ' || ld.nome, auth.uid());
end $$;

-- ================= Tabelas de preço =================
create or replace function criar_tabela_preco(p_org uuid, p_nome text) returns tabelas_preco
language plpgsql security definer set search_path = public as $$
declare t tabelas_preco;
begin
  perform _exige_papel(p_org, array['admin']);
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome da tabela.'; end if;
  if exists (select 1 from tabelas_preco where org_id = p_org and lower(nome) = lower(trim(p_nome))) then raise exception 'Já existe uma tabela com este nome.'; end if;
  insert into tabelas_preco (org_id, nome) values (p_org, trim(p_nome)) returning * into t;
  return t;
end $$;

create or replace function _tabela_travada(p_tabela uuid) returns tabelas_preco
language plpgsql security definer set search_path = public as $$
declare t tabelas_preco;
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into t from tabelas_preco where id = p_tabela for update;
  if not found or not is_member(t.org_id) then raise exception 'Tabela não encontrada.'; end if;
  perform _exige_papel(t.org_id, array['admin']);
  return t;
end $$;

create or replace function definir_preco(p_tabela uuid, p_produto uuid, p_valor_centavos integer) returns void
language plpgsql security definer set search_path = public as $$
declare t tabelas_preco;
begin
  t := _tabela_travada(p_tabela);
  if not exists (select 1 from produtos where id = p_produto and org_id = t.org_id) then raise exception 'Produto não encontrado.'; end if;
  if p_valor_centavos is null or p_valor_centavos < 0 then raise exception 'O preço não pode ser negativo.'; end if;
  insert into precos (tabela_id, produto_id, valor_centavos) values (t.id, p_produto, p_valor_centavos)
  on conflict (tabela_id, produto_id) do update set valor_centavos = excluded.valor_centavos;
end $$;

create or replace function remover_preco(p_tabela uuid, p_produto uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tabelas_preco;
begin
  t := _tabela_travada(p_tabela);
  delete from precos where tabela_id = t.id and produto_id = p_produto;
end $$;

create or replace function excluir_tabela_preco(p_tabela uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tabelas_preco;
begin
  t := _tabela_travada(p_tabela);
  delete from tabelas_preco where id = t.id;   -- clientes ficam sem tabela (set null); preços saem em cascata
end $$;

-- ================= Edição de cadastros =================
drop function criar_cliente(uuid, text, text, text);
create or replace function criar_cliente(p_org uuid, p_nome text, p_documento text, p_email text) returns clientes
language plpgsql security definer set search_path = public as $$
declare c clientes; doc text := nullif(trim(coalesce(p_documento, '')), '');
begin
  perform _exige_papel(p_org, array['admin','vendedor']);
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome do cliente.'; end if;
  if nullif(trim(coalesce(p_email, '')), '') is not null and trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if doc is not null and exists (select 1 from clientes where org_id = p_org and documento = doc) then raise exception 'Já existe um cliente com este documento.'; end if;
  insert into clientes (org_id, codigo, nome, documento, email)
  values (p_org, _prox(p_org, 'cliente'), trim(p_nome), doc, nullif(trim(coalesce(p_email, '')), '')) returning * into c;
  return c;
end $$;

create or replace function atualizar_cliente(p_cliente uuid, p_nome text, p_documento text, p_email text, p_bloqueado boolean, p_ativo boolean, p_tabela uuid default null) returns clientes
language plpgsql security definer set search_path = public as $$
declare c clientes; doc text := nullif(trim(coalesce(p_documento, '')), '');
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into c from clientes where id = p_cliente for update;
  if not found or not is_member(c.org_id) then raise exception 'Cliente não encontrado.'; end if;
  perform _exige_papel(c.org_id, array['admin','vendedor']);
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome do cliente.'; end if;
  if nullif(trim(coalesce(p_email, '')), '') is not null and trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if doc is not null and exists (select 1 from clientes where org_id = c.org_id and documento = doc and id <> c.id) then raise exception 'Já existe um cliente com este documento.'; end if;
  if p_tabela is not null and not exists (select 1 from tabelas_preco where id = p_tabela and org_id = c.org_id) then raise exception 'Tabela de preço não encontrada.'; end if;
  update clientes set nome = trim(p_nome), documento = doc, email = nullif(trim(coalesce(p_email, '')), ''),
    bloqueado = coalesce(p_bloqueado, false), ativo = coalesce(p_ativo, true), tabela_preco_id = p_tabela, updated_at = now()
  where id = c.id returning * into c;
  return c;
end $$;

create or replace function atualizar_produto(p_produto uuid, p_descricao text, p_grupo text, p_unidade text, p_preco_centavos integer, p_ativo boolean) returns produtos
language plpgsql security definer set search_path = public as $$
declare p produtos; g uuid; gn text := coalesce(nullif(trim(coalesce(p_grupo, '')), ''), 'Sem grupo');
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into p from produtos where id = p_produto for update;
  if not found or not is_member(p.org_id) then raise exception 'Produto não encontrado.'; end if;
  perform _exige_papel(p.org_id, array['admin']);
  if length(trim(coalesce(p_descricao, ''))) = 0 then raise exception 'Informe a descrição do produto.'; end if;
  if p_preco_centavos is null or p_preco_centavos < 0 then raise exception 'O preço não pode ser negativo.'; end if;
  insert into grupos_produto (org_id, nome) values (p.org_id, gn) on conflict (org_id, nome) do update set nome = excluded.nome returning id into g;
  update produtos set descricao = trim(p_descricao), grupo_id = g, unidade = coalesce(nullif(trim(coalesce(p_unidade, '')), ''), 'UN'),
    preco_centavos = p_preco_centavos, ativo = coalesce(p_ativo, true), updated_at = now()
  where id = p.id returning * into p;
  return p;
end $$;

-- ================= Pedidos (criar e alterar rascunho) =================
create or replace function _gravar_itens(p_org uuid, p_pedido uuid, p_itens jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare it record; pr produtos; tot integer := 0; lt integer;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Inclua pelo menos um item.'; end if;
  for it in select * from jsonb_to_recordset(p_itens) as x(produto_id uuid, quantidade numeric, preco_centavos integer, desconto_centavos integer) loop
    select * into pr from produtos where id = it.produto_id and org_id = p_org;
    if not found then raise exception 'Produto não encontrado.'; end if;
    if it.quantidade is null or it.quantidade <= 0 then raise exception 'Informe a quantidade de "%".', pr.descricao; end if;
    if coalesce(it.preco_centavos, -1) < 0 or coalesce(it.desconto_centavos, 0) < 0 then raise exception 'Preço e desconto não podem ser negativos.'; end if;
    if coalesce(it.desconto_centavos, 0) > round(it.quantidade * it.preco_centavos) then raise exception 'O desconto de "%" é maior que o total do item.', pr.descricao; end if;
    lt := greatest(0, round(it.quantidade * it.preco_centavos)::integer - coalesce(it.desconto_centavos, 0));
    insert into pedido_itens (pedido_id, produto_id, quantidade, preco_unit_centavos, desconto_centavos, total_centavos)
    values (p_pedido, pr.id, it.quantidade, it.preco_centavos, coalesce(it.desconto_centavos, 0), lt);
    tot := tot + lt;
  end loop;
  return tot;
end $$;

drop function criar_pedido(uuid, uuid, jsonb, text);
create or replace function criar_pedido(p_org uuid, p_cliente uuid, p_itens jsonb, p_obs text default null, p_local uuid default null) returns pedidos
language plpgsql security definer set search_path = public as $$
declare ped pedidos; loc uuid;
begin
  perform _exige_papel(p_org, array['admin','vendedor']);
  if not exists (select 1 from clientes where id = p_cliente and org_id = p_org) then raise exception 'Escolha um cliente.'; end if;
  loc := _local_valido(p_org, p_local);
  insert into pedidos (org_id, numero, cliente_id, status, observacao, local_id, created_by)
  values (p_org, _prox(p_org, 'pedido'), p_cliente, 'rascunho', nullif(trim(coalesce(p_obs, '')), ''), loc, auth.uid()) returning * into ped;
  update pedidos set total_centavos = _gravar_itens(p_org, ped.id, p_itens) where id = ped.id returning * into ped;
  return ped;
end $$;

create or replace function atualizar_pedido(p_pedido uuid, p_cliente uuid, p_itens jsonb, p_obs text default null, p_local uuid default null) returns pedidos
language plpgsql security definer set search_path = public as $$
declare ped pedidos; loc uuid;
begin
  ped := _pedido_travado(p_pedido, array['admin','vendedor']);
  if ped.status <> 'rascunho' then raise exception 'Só é possível alterar um pedido em rascunho.'; end if;
  if not exists (select 1 from clientes where id = p_cliente and org_id = ped.org_id) then raise exception 'Escolha um cliente.'; end if;
  loc := _local_valido(ped.org_id, p_local);
  delete from pedido_itens where pedido_id = ped.id;
  update pedidos set cliente_id = p_cliente, local_id = loc, observacao = nullif(trim(coalesce(p_obs, '')), ''),
    total_centavos = _gravar_itens(ped.org_id, ped.id, p_itens), updated_at = now() where id = ped.id returning * into ped;
  return ped;
end $$;

-- ================= Financeiro: receita manual e estorno de baixa =================
create or replace function lancar_receita(p_org uuid, p_cliente uuid, p_descricao text, p_valor_centavos integer, p_vencimento date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exige_papel(p_org, array['admin','financeiro']);
  if length(trim(coalesce(p_descricao, ''))) = 0 then raise exception 'Informe a descrição.'; end if;
  if p_valor_centavos is null or p_valor_centavos <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_vencimento is null then raise exception 'Informe o vencimento.'; end if;
  if p_cliente is not null and not exists (select 1 from clientes where id = p_cliente and org_id = p_org) then raise exception 'Cliente não encontrado.'; end if;
  insert into financeiros (org_id, tipo, descricao, cliente_id, valor_centavos, vencimento) values (p_org, 'receita', trim(p_descricao), p_cliente, p_valor_centavos, p_vencimento);
end $$;

create or replace function baixar_financeiro(p_financeiro uuid, p_valor_centavos integer, p_juros_centavos integer default 0) returns void
language plpgsql security definer set search_path = public as $$
declare f financeiros; pago integer; restante integer;
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into f from financeiros where id = p_financeiro for update;
  if not found or not is_member(f.org_id) then raise exception 'Lançamento não encontrado.'; end if;
  perform _exige_papel(f.org_id, array['admin','financeiro']);
  if f.status = 'cancelado' then raise exception 'Lançamento cancelado.'; end if;
  if f.status = 'baixado' then raise exception 'Lançamento já baixado.'; end if;
  if p_valor_centavos is null or p_valor_centavos <= 0 then raise exception 'Informe o valor da baixa.'; end if;
  select coalesce(sum(valor_centavos), 0) into pago from financeiro_baixas where financeiro_id = f.id and estornada_em is null;
  restante := f.valor_centavos - pago;
  if p_valor_centavos > restante then raise exception 'O valor é maior que o saldo em aberto.'; end if;
  insert into financeiro_baixas (financeiro_id, valor_centavos, juros_centavos, created_by) values (f.id, p_valor_centavos, greatest(0, coalesce(p_juros_centavos, 0)), auth.uid());
  update financeiros set status = case when pago + p_valor_centavos >= valor_centavos then 'baixado' else 'parcial' end, updated_at = now() where id = f.id;
end $$;

create or replace function estornar_baixa(p_baixa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b financeiro_baixas; f financeiros; pago integer;
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into b from financeiro_baixas where id = p_baixa;
  if not found then raise exception 'Baixa não encontrada.'; end if;
  select * into f from financeiros where id = b.financeiro_id for update;
  if not is_member(f.org_id) then raise exception 'Baixa não encontrada.'; end if;
  perform _exige_papel(f.org_id, array['admin','financeiro']);
  if f.status = 'cancelado' then raise exception 'Lançamento cancelado.'; end if;
  select * into b from financeiro_baixas where id = p_baixa for update;
  if b.estornada_em is not null then raise exception 'Esta baixa já foi estornada.'; end if;
  update financeiro_baixas set estornada_em = now(), estornada_por = auth.uid() where id = b.id;
  select coalesce(sum(valor_centavos), 0) into pago from financeiro_baixas where financeiro_id = f.id and estornada_em is null;
  update financeiros set status = case when pago = 0 then 'aberto' when pago >= valor_centavos then 'baixado' else 'parcial' end, updated_at = now() where id = f.id;
end $$;

create or replace function cancelar_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare ped pedidos; it record;
begin
  ped := _pedido_travado(p_pedido, array['admin']);
  if ped.status = 'cancelado' then raise exception 'O pedido já está cancelado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Informe o motivo do cancelamento.'; end if;
  if ped.status = 'faturado' then
    if exists (select 1 from financeiros f join financeiro_baixas b on b.financeiro_id = f.id where f.pedido_id = ped.id and f.tipo = 'receita' and b.estornada_em is null) then
      raise exception 'Há parcelas com recebimento. Estorne os recebimentos em Contas a receber antes de cancelar o pedido.';
    end if;
    update financeiros set status = 'cancelado', updated_at = now() where pedido_id = ped.id and tipo = 'receita';
    update notas_fiscais set status = 'cancelada', cancelada_em = now() where pedido_id = ped.id and tipo = 'venda' and status = 'emitida';
    for it in select i.*, pr.controla_estoque from pedido_itens i join produtos pr on pr.id = i.produto_id where i.pedido_id = ped.id loop
      if it.controla_estoque then
        insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, origem_id, created_by)
        values (ped.org_id, it.produto_id, coalesce(ped.local_id, _local_padrao(ped.org_id)), 'estorno', it.quantidade, 'cancelamento', ped.id, auth.uid());
      end if;
    end loop;
  end if;
  update pedidos set status = 'cancelado', motivo_cancelamento = trim(p_motivo), updated_at = now() where id = ped.id;
end $$;

create or replace function dashboard(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_member(p_org) then raise exception 'Você não tem permissão para esta ação.'; end if;
  return jsonb_build_object(
    'vendas_mes_centavos', coalesce((select sum(total_centavos) from notas_fiscais where org_id = p_org and status = 'emitida' and tipo = 'venda'
        and date_trunc('month', emitida_em at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo')), 0),
    'receber_vencido_centavos', coalesce((select sum(f.valor_centavos - coalesce((select sum(b.valor_centavos) from financeiro_baixas b where b.financeiro_id = f.id and b.estornada_em is null), 0))
        from financeiros f where f.org_id = p_org and f.tipo = 'receita' and f.status in ('aberto','parcial') and f.vencimento < _hoje()), 0),
    'itens_sem_saldo', (select count(*) from produtos p where p.org_id = p_org and p.controla_estoque and p.ativo and _saldo(p_org, p.id) <= 0),
    'pedidos_abertos', (select count(*) from pedidos where org_id = p_org and status in ('rascunho','confirmado'))
  );
end $$;

-- cadastros novos só escrevem por funções (sem escrita direta de tabelas/locais/preços; clientes e produtos também passam a ser por função)
drop policy clientes_w on clientes;
drop policy produtos_w on produtos;
drop policy tabelas_preco_w on tabelas_preco;
drop policy locais_estoque_w on locais_estoque;
drop policy pr_w on precos;
revoke insert, update, delete on clientes, produtos, tabelas_preco, locais_estoque, precos, grupos_produto from anon, authenticated;
drop policy grupos_produto_w on grupos_produto;

-- ================= Permissões de execução =================
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  criar_org(text, boolean), criar_cliente(uuid, text, text, text), atualizar_cliente(uuid, text, text, text, boolean, boolean, uuid),
  criar_produto(uuid, text, text, text, integer, boolean), atualizar_produto(uuid, text, text, text, integer, boolean),
  criar_local(uuid, text), atualizar_local(uuid, text, boolean), ajustar_estoque(uuid, uuid, numeric, text, uuid), transferir_estoque(uuid, uuid, uuid, uuid, numeric),
  criar_tabela_preco(uuid, text), definir_preco(uuid, uuid, integer), remover_preco(uuid, uuid), excluir_tabela_preco(uuid),
  criar_pedido(uuid, uuid, jsonb, text, uuid), atualizar_pedido(uuid, uuid, jsonb, text, uuid), confirmar_pedido(uuid),
  faturar_pedido(uuid, integer, integer), cancelar_pedido(uuid, text), lancar_despesa(uuid, text, integer, date), lancar_receita(uuid, uuid, text, integer, date),
  baixar_financeiro(uuid, integer, integer), estornar_baixa(uuid), dashboard(uuid), excluir_meus_dados(),
  is_member(uuid), tem_papel(uuid, text[])
to authenticated;
