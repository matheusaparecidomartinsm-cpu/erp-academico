-- Regras de acesso. Princípios:
--  * LEITURA: qualquer membro da empresa lê as linhas da empresa.
--  * ESCRITA em cadastros: só pelo papel certo (política abaixo).
--  * ESCRITA em pedidos/estoque/notas/financeiro: SOMENTE pelas funções (migração 3), que checam papel.
--    Por isso essas tabelas não têm política de escrita e o privilégio de escrita é revogado.
do $$
declare t text;
begin
  foreach t in array array['vendedores','clientes','grupos_produto','produtos','locais_estoque','estoque_saldos',
    'estoque_movimentos','tabelas_preco','naturezas','centros_resultado','contas_bancarias','tipos_pagamento',
    'pedidos','notas_fiscais','financeiros'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (is_member(org_id))', t||'_sel', t);
  end loop;
end $$;

-- cadastros: escrita direta por papel
create policy clientes_w on clientes for all to authenticated
  using (tem_papel(org_id, array['admin','vendedor'])) with check (tem_papel(org_id, array['admin','vendedor']));
do $$
declare t text;
begin
  foreach t in array array['vendedores','grupos_produto','produtos','locais_estoque','tabelas_preco','naturezas','centros_resultado','contas_bancarias','tipos_pagamento'] loop
    execute format('create policy %I on %I for all to authenticated using (tem_papel(org_id, array[''admin''])) with check (tem_papel(org_id, array[''admin'']))', t||'_w', t);
  end loop;
end $$;

alter table orgs enable row level security;
create policy orgs_sel on orgs for select to authenticated using (is_member(id));
alter table org_members enable row level security;
create policy members_sel on org_members for select to authenticated using (user_id = auth.uid() or is_member(org_id));
alter table contadores enable row level security;   -- sem política: ninguém acessa direto

-- tabelas filhas: acesso herdado do pai
alter table produto_volumes enable row level security;
alter table produto_componentes enable row level security;
alter table produto_alternativos enable row level security;
create policy pv_sel on produto_volumes for select to authenticated using (exists (select 1 from produtos p where p.id = produto_id and is_member(p.org_id)));
create policy pv_w on produto_volumes for all to authenticated using (exists (select 1 from produtos p where p.id = produto_id and tem_papel(p.org_id, array['admin']))) with check (exists (select 1 from produtos p where p.id = produto_id and tem_papel(p.org_id, array['admin'])));
create policy pc_sel on produto_componentes for select to authenticated using (exists (select 1 from produtos p where p.id = produto_id and is_member(p.org_id)));
create policy pc_w on produto_componentes for all to authenticated using (exists (select 1 from produtos p where p.id = produto_id and tem_papel(p.org_id, array['admin']))) with check (exists (select 1 from produtos p where p.id = produto_id and tem_papel(p.org_id, array['admin'])));
create policy pa_sel on produto_alternativos for select to authenticated using (exists (select 1 from produtos p where p.id = produto_id and is_member(p.org_id)));
create policy pa_w on produto_alternativos for all to authenticated using (exists (select 1 from produtos p where p.id = produto_id and tem_papel(p.org_id, array['admin']))) with check (exists (select 1 from produtos p where p.id = produto_id and tem_papel(p.org_id, array['admin'])));

alter table precos enable row level security;
create policy pr_sel on precos for select to authenticated using (exists (select 1 from tabelas_preco t where t.id = tabela_id and is_member(t.org_id)));
create policy pr_w on precos for all to authenticated using (exists (select 1 from tabelas_preco t where t.id = tabela_id and tem_papel(t.org_id, array['admin']))) with check (exists (select 1 from tabelas_preco t where t.id = tabela_id and tem_papel(t.org_id, array['admin'])));

alter table pedido_itens enable row level security;
create policy pi_sel on pedido_itens for select to authenticated using (exists (select 1 from pedidos p where p.id = pedido_id and is_member(p.org_id)));
alter table nota_itens enable row level security;
create policy ni_sel on nota_itens for select to authenticated using (exists (select 1 from notas_fiscais n where n.id = nota_id and is_member(n.org_id)));
alter table financeiro_baixas enable row level security;
create policy fb_sel on financeiro_baixas for select to authenticated using (exists (select 1 from financeiros f where f.id = financeiro_id and is_member(f.org_id)));

-- defesa em profundidade: sem escrita direta nas tabelas que só as funções alteram
revoke insert, update, delete, truncate on
  pedidos, pedido_itens, notas_fiscais, nota_itens, estoque_movimentos, estoque_saldos,
  financeiros, financeiro_baixas, contadores, orgs, org_members from anon, authenticated;
revoke all on all tables in schema public from anon;
