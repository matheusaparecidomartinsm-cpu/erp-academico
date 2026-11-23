-- Regras de negócio no banco. Todas SECURITY DEFINER com search_path fixo; cada uma confere
-- login + pertencimento à empresa + papel ANTES de mexer em qualquer dado. Cada chamada é uma
-- transação: se algo falha, nada é gravado.

create or replace function _hoje() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function _exige_papel(p_org uuid, p_papeis text[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  if not tem_papel(p_org, p_papeis) then raise exception 'Você não tem permissão para esta ação.'; end if;
end $$;

create or replace function _prox(p_org uuid, p_nome text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into contadores (org_id, nome, valor) values (p_org, p_nome, 1)
  on conflict (org_id, nome) do update set valor = contadores.valor + 1
  returning valor into v;
  return v;
end $$;

create or replace function _local_padrao(p_org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from locais_estoque where org_id = p_org order by created_at limit 1
$$;

create or replace function _saldo(p_org uuid, p_produto uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(saldo), 0) from estoque_saldos where org_id = p_org and produto_id = p_produto
$$;

create or replace function _checar_estoque(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select pr.descricao, sum(i.quantidade) as pedido, _saldo(pr.org_id, pr.id) as saldo
    from pedido_itens i join produtos pr on pr.id = i.produto_id
    where i.pedido_id = p_pedido and pr.controla_estoque
    group by pr.id, pr.descricao, pr.org_id
  loop
    if r.saldo < r.pedido then
      raise exception 'Saldo insuficiente de "%": % disponível, % pedido.', r.descricao, trim_scale(r.saldo), trim_scale(r.pedido);
    end if;
  end loop;
end $$;

-- ================= Empresa =================
create or replace function criar_org(p_nome text, p_exemplo boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); o uuid;
begin
  if v is null then raise exception 'Faça login para continuar.'; end if;
  if exists (select 1 from org_members where user_id = v) then raise exception 'Você já tem uma empresa.'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome da empresa.'; end if;
  insert into orgs (nome) values (trim(p_nome)) returning id into o;
  insert into org_members (org_id, user_id, papel) values (o, v, 'admin');
  insert into locais_estoque (org_id, nome) values (o, 'Depósito principal');
  insert into contadores (org_id, nome, valor) values (o, 'pedido', 1000), (o, 'nota', 0), (o, 'cliente', 0), (o, 'produto', 0);
  if p_exemplo then perform _popular_exemplo(o); end if;
  return o;
end $$;

-- ================= Cadastros =================
create or replace function criar_cliente(p_org uuid, p_nome text, p_documento text, p_email text) returns clientes
language plpgsql security definer set search_path = public as $$
declare c clientes; doc text := nullif(trim(coalesce(p_documento, '')), '');
begin
  perform _exige_papel(p_org, array['admin','vendedor']);
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome do cliente.'; end if;
  if nullif(trim(coalesce(p_email, '')), '') is not null and trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if doc is not null and exists (select 1 from clientes where org_id = p_org and documento = doc) then
    raise exception 'Já existe um cliente com este documento.';
  end if;
  insert into clientes (org_id, codigo, nome, documento, email)
  values (p_org, _prox(p_org, 'cliente'), trim(p_nome), doc, nullif(trim(coalesce(p_email, '')), '')) returning * into c;
  return c;
end $$;

create or replace function criar_produto(p_org uuid, p_descricao text, p_grupo text, p_unidade text, p_preco_centavos integer, p_controla boolean) returns produtos
language plpgsql security definer set search_path = public as $$
declare p produtos; g uuid; gn text := coalesce(nullif(trim(coalesce(p_grupo, '')), ''), 'Sem grupo');
begin
  perform _exige_papel(p_org, array['admin']);
  if length(trim(coalesce(p_descricao, ''))) = 0 then raise exception 'Informe a descrição do produto.'; end if;
  if p_preco_centavos is null or p_preco_centavos < 0 then raise exception 'O preço não pode ser negativo.'; end if;
  insert into grupos_produto (org_id, nome) values (p_org, gn) on conflict (org_id, nome) do update set nome = excluded.nome returning id into g;
  insert into produtos (org_id, codigo, descricao, grupo_id, unidade, preco_centavos, controla_estoque)
  values (p_org, _prox(p_org, 'produto'), trim(p_descricao), g, coalesce(nullif(trim(coalesce(p_unidade, '')), ''), 'UN'), p_preco_centavos, coalesce(p_controla, true))
  returning * into p;
  return p;
end $$;

-- ================= Estoque =================
create or replace function ajustar_estoque(p_org uuid, p_produto uuid, p_quantidade numeric, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare pr produtos;
begin
  perform _exige_papel(p_org, array['admin','estoquista']);
  select * into pr from produtos where id = p_produto and org_id = p_org;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not pr.controla_estoque then raise exception 'Este produto não controla estoque.'; end if;
  if p_quantidade is null or p_quantidade = 0 then raise exception 'Informe uma quantidade diferente de zero.'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Informe o motivo do ajuste.'; end if;
  perform 1 from estoque_saldos where produto_id = p_produto for update;
  if _saldo(p_org, p_produto) + p_quantidade < 0 then raise exception 'O ajuste deixaria o saldo negativo.'; end if;
  insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, motivo, created_by)
  values (p_org, p_produto, _local_padrao(p_org), 'ajuste', p_quantidade, 'manual', trim(p_motivo), auth.uid());
end $$;

-- ================= Vendas =================
create or replace function criar_pedido(p_org uuid, p_cliente uuid, p_itens jsonb, p_obs text default null) returns pedidos
language plpgsql security definer set search_path = public as $$
declare ped pedidos; it record; pr produtos; tot integer := 0; lt integer; n integer := 0;
begin
  perform _exige_papel(p_org, array['admin','vendedor']);
  if not exists (select 1 from clientes where id = p_cliente and org_id = p_org) then raise exception 'Escolha um cliente.'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Inclua pelo menos um item.'; end if;
  insert into pedidos (org_id, numero, cliente_id, status, observacao, local_id, created_by)
  values (p_org, _prox(p_org, 'pedido'), p_cliente, 'rascunho', nullif(trim(coalesce(p_obs, '')), ''), _local_padrao(p_org), auth.uid())
  returning * into ped;
  for it in select * from jsonb_to_recordset(p_itens) as x(produto_id uuid, quantidade numeric, preco_centavos integer, desconto_centavos integer) loop
    n := n + 1;
    select * into pr from produtos where id = it.produto_id and org_id = p_org;
    if not found then raise exception 'Produto não encontrado.'; end if;
    if it.quantidade is null or it.quantidade <= 0 then raise exception 'Informe a quantidade de "%".', pr.descricao; end if;
    if coalesce(it.preco_centavos, -1) < 0 or coalesce(it.desconto_centavos, 0) < 0 then raise exception 'Preço e desconto não podem ser negativos.'; end if;
    if coalesce(it.desconto_centavos, 0) > round(it.quantidade * it.preco_centavos) then raise exception 'O desconto de "%" é maior que o total do item.', pr.descricao; end if;
    lt := greatest(0, round(it.quantidade * it.preco_centavos)::integer - coalesce(it.desconto_centavos, 0));
    insert into pedido_itens (pedido_id, produto_id, quantidade, preco_unit_centavos, desconto_centavos, total_centavos)
    values (ped.id, pr.id, it.quantidade, it.preco_centavos, coalesce(it.desconto_centavos, 0), lt);
    tot := tot + lt;
  end loop;
  update pedidos set total_centavos = tot where id = ped.id returning * into ped;
  return ped;
end $$;

create or replace function _pedido_travado(p_pedido uuid, p_papeis text[]) returns pedidos
language plpgsql security definer set search_path = public as $$
declare ped pedidos;
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  select * into ped from pedidos where id = p_pedido for update;
  if not found or not is_member(ped.org_id) then raise exception 'Pedido não encontrado.'; end if;
  perform _exige_papel(ped.org_id, p_papeis);
  return ped;
end $$;

create or replace function confirmar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ped pedidos; c clientes;
begin
  ped := _pedido_travado(p_pedido, array['admin','vendedor']);
  if ped.status <> 'rascunho' then raise exception 'Só é possível confirmar um pedido em rascunho.'; end if;
  select * into c from clientes where id = ped.cliente_id;
  if c.bloqueado then raise exception 'O cliente "%" está bloqueado.', c.nome; end if;
  perform _checar_estoque(ped.id);
  update pedidos set status = 'confirmado', updated_at = now() where id = ped.id;
end $$;

create or replace function faturar_pedido(p_pedido uuid, p_parcelas integer, p_dias integer) returns notas_fiscais
language plpgsql security definer set search_path = public as $$
declare ped pedidos; nf notas_fiscais; it record; base integer; resto integer; k integer;
begin
  ped := _pedido_travado(p_pedido, array['admin','financeiro']);
  if ped.status <> 'confirmado' then raise exception 'Só é possível faturar um pedido confirmado.'; end if;
  if exists (select 1 from notas_fiscais where pedido_id = ped.id and tipo = 'venda' and status = 'emitida') then raise exception 'Este pedido já tem nota emitida.'; end if;
  if p_parcelas is null or p_parcelas < 1 or p_parcelas > 12 then raise exception 'Parcelas devem ficar entre 1 e 12.'; end if;
  if p_dias is null or p_dias < 0 or p_dias > 120 then raise exception 'Dias entre parcelas inválido.'; end if;
  -- trava os saldos (ordem fixa evita deadlock) e confere o estoque já com a trava
  perform 1 from estoque_saldos where org_id = ped.org_id and produto_id in (select produto_id from pedido_itens where pedido_id = ped.id) order by produto_id for update;
  perform _checar_estoque(ped.id);
  insert into notas_fiscais (org_id, pedido_id, tipo, serie, numero, total_centavos, impostos_centavos)
  values (ped.org_id, ped.id, 'venda', 1, _prox(ped.org_id, 'nota'), ped.total_centavos, round(ped.total_centavos * 0.12)::integer) returning * into nf;
  for it in select i.*, pr.controla_estoque from pedido_itens i join produtos pr on pr.id = i.produto_id where i.pedido_id = ped.id loop
    insert into nota_itens (nota_id, produto_id, quantidade, valor_unit_centavos, total_centavos) values (nf.id, it.produto_id, it.quantidade, it.preco_unit_centavos, it.total_centavos);
    if it.controla_estoque then
      insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, origem_id, created_by)
      values (ped.org_id, it.produto_id, coalesce(ped.local_id, _local_padrao(ped.org_id)), 'saida', -it.quantidade, 'nota', nf.id, auth.uid());
    end if;
  end loop;
  base := ped.total_centavos / p_parcelas; resto := ped.total_centavos - base * p_parcelas;
  for k in 1..p_parcelas loop
    insert into financeiros (org_id, tipo, descricao, cliente_id, nota_id, pedido_id, parcela, total_parcelas, valor_centavos, vencimento)
    values (ped.org_id, 'receita', format('Pedido %s — NF %s', ped.numero, nf.numero), ped.cliente_id, nf.id, ped.id, k, p_parcelas,
            base + case when k = p_parcelas then resto else 0 end, _hoje() + (p_dias * k));
  end loop;
  update pedidos set status = 'faturado', parcelas = p_parcelas, dias_entre = p_dias, updated_at = now() where id = ped.id;
  return nf;
end $$;

create or replace function cancelar_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare ped pedidos; it record; nf notas_fiscais;
begin
  ped := _pedido_travado(p_pedido, array['admin']);
  if ped.status = 'cancelado' then raise exception 'O pedido já está cancelado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Informe o motivo do cancelamento.'; end if;
  if ped.status = 'faturado' then
    if exists (select 1 from financeiros f join financeiro_baixas b on b.financeiro_id = f.id where f.pedido_id = ped.id and f.tipo = 'receita') then
      raise exception 'Há parcelas já baixadas e este protótipo ainda não estorna baixas. Só é possível cancelar pedidos sem recebimento.';
    end if;
    update financeiros set status = 'cancelado', updated_at = now() where pedido_id = ped.id and tipo = 'receita';
    update notas_fiscais set status = 'cancelada', cancelada_em = now() where pedido_id = ped.id and tipo = 'venda' and status = 'emitida' returning * into nf;
    for it in select i.*, pr.controla_estoque from pedido_itens i join produtos pr on pr.id = i.produto_id where i.pedido_id = ped.id loop
      if it.controla_estoque then
        insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, origem_id, created_by)
        values (ped.org_id, it.produto_id, coalesce(ped.local_id, _local_padrao(ped.org_id)), 'estorno', it.quantidade, 'cancelamento', ped.id, auth.uid());
      end if;
    end loop;
  end if;
  update pedidos set status = 'cancelado', motivo_cancelamento = trim(p_motivo), updated_at = now() where id = ped.id;
end $$;

-- ================= Financeiro =================
create or replace function lancar_despesa(p_org uuid, p_descricao text, p_valor_centavos integer, p_vencimento date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exige_papel(p_org, array['admin','financeiro']);
  if length(trim(coalesce(p_descricao, ''))) = 0 then raise exception 'Informe a descrição.'; end if;
  if p_valor_centavos is null or p_valor_centavos <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_vencimento is null then raise exception 'Informe o vencimento.'; end if;
  insert into financeiros (org_id, tipo, descricao, valor_centavos, vencimento) values (p_org, 'despesa', trim(p_descricao), p_valor_centavos, p_vencimento);
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
  select coalesce(sum(valor_centavos), 0) into pago from financeiro_baixas where financeiro_id = f.id;
  restante := f.valor_centavos - pago;
  if p_valor_centavos > restante then raise exception 'O valor é maior que o saldo em aberto.'; end if;
  insert into financeiro_baixas (financeiro_id, valor_centavos, juros_centavos, created_by) values (f.id, p_valor_centavos, greatest(0, coalesce(p_juros_centavos, 0)), auth.uid());
  update financeiros set status = case when pago + p_valor_centavos >= valor_centavos then 'baixado' else 'parcial' end, updated_at = now() where id = f.id;
end $$;

-- ================= Painel =================
create or replace function dashboard(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_member(p_org) then raise exception 'Você não tem permissão para esta ação.'; end if;
  return jsonb_build_object(
    'vendas_mes_centavos', coalesce((select sum(total_centavos) from notas_fiscais where org_id = p_org and status = 'emitida' and tipo = 'venda'
        and date_trunc('month', emitida_em at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo')), 0),
    'receber_vencido_centavos', coalesce((select sum(f.valor_centavos - coalesce((select sum(b.valor_centavos) from financeiro_baixas b where b.financeiro_id = f.id), 0))
        from financeiros f where f.org_id = p_org and f.tipo = 'receita' and f.status in ('aberto','parcial') and f.vencimento < _hoje()), 0),
    'itens_sem_saldo', (select count(*) from produtos p where p.org_id = p_org and p.controla_estoque and p.ativo and _saldo(p_org, p.id) <= 0),
    'pedidos_abertos', (select count(*) from pedidos where org_id = p_org and status in ('rascunho','confirmado'))
  );
end $$;

-- ================= Exclusão de conta (LGPD) =================
-- Apaga as empresas em que o usuário é o único membro (com todos os dados). O app apaga o login em seguida.
create or replace function excluir_meus_dados() returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); o uuid;
begin
  if v is null then raise exception 'Faça login para continuar.'; end if;
  -- único administrador de uma empresa que ainda tem outros membros: não pode sair sem passar o cargo
  if exists (select 1 from org_members m where m.user_id = v and m.papel = 'admin'
      and exists (select 1 from org_members o where o.org_id = m.org_id and o.user_id <> v)
      and not exists (select 1 from org_members o where o.org_id = m.org_id and o.user_id <> v and o.papel = 'admin')) then
    raise exception 'Você é o único administrador. Passe o cargo para outra pessoa antes de excluir a conta.';
  end if;
  -- apaga na ordem das dependências (o ON DELETE CASCADE sozinho não garante a ordem e trava nas FKs)
  for o in select m.org_id from org_members m where m.user_id = v
      and not exists (select 1 from org_members x where x.org_id = m.org_id and x.user_id <> v) loop
    delete from financeiro_baixas where financeiro_id in (select id from financeiros where org_id = o);
    delete from financeiros where org_id = o;
    delete from nota_itens where nota_id in (select id from notas_fiscais where org_id = o);
    delete from notas_fiscais where org_id = o;
    delete from pedido_itens where pedido_id in (select id from pedidos where org_id = o);
    delete from pedidos where org_id = o;
    delete from estoque_movimentos where org_id = o;
    delete from estoque_saldos where org_id = o;
    delete from produto_componentes where produto_id in (select id from produtos where org_id = o);
    delete from orgs where id = o;
  end loop;
  delete from org_members where user_id = v;
end $$;

-- ================= Dados de exemplo (fictícios) =================
create or replace function _popular_exemplo(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare loc uuid := _local_padrao(p_org); c1 uuid; c2 uuid; c3 uuid; c4 uuid; ped pedidos; nf notas_fiscais; pid uuid; k integer;
  prods text[][] := array[
    ['Caixa de papelão 30x20 cm','Embalagens','UN','450','t'], ['Copo de papel 200 ml (pacote c/ 50)','Descartáveis','PCT','1290','t'],
    ['Sacola kraft média','Embalagens','UN','210','t'], ['Bandeja de papel-cartão 500 g','Embalagens','UN','320','t'],
    ['Fita adesiva 48 mm','Insumos','UN','780','t'], ['Guardanapo folha simples (pacote c/ 100)','Descartáveis','PCT','590','t'],
    ['Etiqueta adesiva personalizada','Serviços','UN','90','f'], ['Tampa de papel 90 mm (pacote c/ 50)','Descartáveis','PCT','980','t']];
  est numeric[] := array[500,120,800,60,0,200,0,15];
  i integer;
begin
  c1 := (criar_cliente(p_org, 'Mercado Exemplo Ltda', '11.111.111/0001-11', 'compras@mercadoexemplo.test')).id;
  c2 := (criar_cliente(p_org, 'Padaria Modelo ME', '22.222.222/0001-22', 'contato@padariamodelo.test')).id;
  c3 := (criar_cliente(p_org, 'Lanchonete Teste', '33.333.333/0001-33', 'oi@lanchoneteteste.test')).id;
  c4 := (criar_cliente(p_org, 'Restaurante Fictício Ltda', '44.444.444/0001-44', 'financeiro@ficticio.test')).id;
  update clientes set bloqueado = true where id = c4;
  for i in 1..8 loop
    pid := (criar_produto(p_org, prods[i][1], prods[i][2], prods[i][3], prods[i][4]::integer, prods[i][5] = 't')).id;
    if est[i] > 0 then
      insert into estoque_movimentos (org_id, produto_id, local_id, tipo, quantidade, origem_tipo, motivo, created_by) values (p_org, pid, loc, 'entrada', est[i], 'manual', 'Saldo inicial', auth.uid());
    end if;
  end loop;
  -- pedido faturado em 2 parcelas (a primeira já vencida)
  ped := criar_pedido(p_org, c1, jsonb_build_array(
    jsonb_build_object('produto_id', (select id from produtos where org_id = p_org and codigo = 1), 'quantidade', 100, 'preco_centavos', 450, 'desconto_centavos', 0),
    jsonb_build_object('produto_id', (select id from produtos where org_id = p_org and codigo = 2), 'quantidade', 20, 'preco_centavos', 1290, 'desconto_centavos', 500)));
  perform confirmar_pedido(ped.id); nf := faturar_pedido(ped.id, 2, 30);
  update financeiros set vencimento = _hoje() - 12 where pedido_id = ped.id and parcela = 1;
  update financeiros set vencimento = _hoje() + 18 where pedido_id = ped.id and parcela = 2;
  ped := criar_pedido(p_org, c2, jsonb_build_array(jsonb_build_object('produto_id', (select id from produtos where org_id = p_org and codigo = 3), 'quantidade', 200, 'preco_centavos', 210, 'desconto_centavos', 0)));
  perform confirmar_pedido(ped.id);
  perform criar_pedido(p_org, c3, jsonb_build_array(jsonb_build_object('produto_id', (select id from produtos where org_id = p_org and codigo = 6), 'quantidade', 30, 'preco_centavos', 590, 'desconto_centavos', 0)));
  insert into financeiros (org_id, tipo, descricao, valor_centavos, vencimento) values
    (p_org, 'despesa', 'Aluguel do galpão', 350000, _hoje() + 5), (p_org, 'despesa', 'Energia elétrica', 84250, _hoje() - 3);
end $$;

-- ================= Permissões de execução =================
-- Funções internas (_nome): ninguém chama pela API. Públicas: só usuário logado.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  criar_org(text, boolean), criar_cliente(uuid, text, text, text), criar_produto(uuid, text, text, text, integer, boolean),
  ajustar_estoque(uuid, uuid, numeric, text), criar_pedido(uuid, uuid, jsonb, text), confirmar_pedido(uuid),
  faturar_pedido(uuid, integer, integer), cancelar_pedido(uuid, text), lancar_despesa(uuid, text, integer, date),
  baixar_financeiro(uuid, integer, integer), dashboard(uuid), excluir_meus_dados(),
  is_member(uuid), tem_papel(uuid, text[])
to authenticated;
